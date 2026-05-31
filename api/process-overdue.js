import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from '../lib/supabase-server-config.js';

// Merged from process-overdue-calls.js + process-overdue-charges.js
// Use ?type=calls or ?type=charges to select action

async function isShabbatOrHoliday() {
  const today = new Date();
  if (today.getDay() === 6) {
    console.log('Today is Shabbat, skipping processing');
    return true;
  }

  try {
    const dateStr = today.toISOString().split('T')[0];
    const response = await fetch(
      `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=off&mod=off&start=${dateStr}&end=${dateStr}&geo=none`
    );

    if (!response.ok) return false;

    const data = await response.json();
    const isHoliday = data.items?.some((item) => item.yomtov === true || item.category === 'holiday') ?? false;
    if (isHoliday) console.log('Today is an Israeli holiday, skipping processing');
    return isHoliday;
  } catch (error) {
    console.warn('Error checking Hebcal API:', error);
    return false;
  }
}


async function processCharges(supabase, todayStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: overdueRentals, error: rentalsError } = await supabase
    .from('rentals')
    .select('id, customer_id, customer_name, end_date, overdue_daily_rate, overdue_grace_days, auto_charge_enabled, currency')
    .eq('status', 'active')
    .not('overdue_daily_rate', 'is', null)
    .gt('overdue_daily_rate', 0)
    .lt('end_date', todayStr);

  if (rentalsError) throw new Error(`Failed to fetch overdue rentals: ${rentalsError.message}`);

  if (!overdueRentals || overdueRentals.length === 0) {
    return { processed: 0, message: 'No overdue rentals to process' };
  }

  console.log(`Found ${overdueRentals.length} overdue rentals to process`);
  const results = [];

  for (const rental of overdueRentals) {
    try {
      const endDate = new Date(rental.end_date);
      endDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - endDate.getTime();
      const totalDaysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const effectiveDaysOverdue = totalDaysOverdue - (rental.overdue_grace_days || 0);

      if (effectiveDaysOverdue <= 0) { results.push({ rentalId: rental.id, status: 'grace_period' }); continue; }

      const { data: existingCharge } = await supabase
        .from('overdue_charges').select('id')
        .eq('rental_id', rental.id).eq('charge_date', todayStr).maybeSingle();

      if (existingCharge) { results.push({ rentalId: rental.id, status: 'already_processed' }); continue; }

      const chargeAmount = rental.overdue_daily_rate;

      let customer = null;
      if (rental.customer_id) {
        const { data: customerData } = await supabase
          .from('customers').select('id, name, payment_token').eq('id', rental.customer_id).maybeSingle();
        customer = customerData;
      }

      const hasToken = customer?.payment_token;

      if (hasToken && rental.auto_charge_enabled) {
        const transactionId = `overdue-${rental.id}-${todayStr}-${Date.now()}`;
        try {
          const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
          const pelecardResponse = await fetch(`${vercelUrl}/api/pelecard-pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: chargeAmount,
              customerName: rental.customer_name,
              token: customer.payment_token,
              customerId: rental.customer_id,
              description: `חיוב יומי על איחור בהשכרה - יום ${effectiveDaysOverdue}`,
              rentalId: rental.id,
              transactionId,
            }),
          });

          const paymentResult = await pelecardResponse.json();

          await supabase.from('overdue_charges').insert({
            rental_id: rental.id,
            customer_id: rental.customer_id,
            charge_date: todayStr,
            days_overdue: effectiveDaysOverdue,
            amount: chargeAmount,
            currency: rental.currency,
            status: paymentResult.success ? 'charged' : 'failed',
            transaction_id: paymentResult.success ? transactionId : undefined,
            error_message: paymentResult.success ? undefined : (paymentResult.error || 'Payment failed'),
          });

          results.push({ rentalId: rental.id, status: paymentResult.success ? 'charged' : 'failed', amount: chargeAmount });
        } catch (paymentError) {
          await supabase.from('overdue_charges').insert({
            rental_id: rental.id,
            customer_id: rental.customer_id,
            charge_date: todayStr,
            days_overdue: effectiveDaysOverdue,
            amount: chargeAmount,
            currency: rental.currency,
            status: 'failed',
            error_message: paymentError.message,
          });
          results.push({ rentalId: rental.id, status: 'failed', error: paymentError.message });
        }
      } else {
        await supabase.from('overdue_charges').insert({
          rental_id: rental.id,
          customer_id: rental.customer_id,
          charge_date: todayStr,
          days_overdue: effectiveDaysOverdue,
          amount: chargeAmount,
          currency: rental.currency,
          status: 'pending',
          error_message: hasToken ? 'Auto-charge disabled' : 'No payment token',
        });
        results.push({ rentalId: rental.id, status: 'pending', amount: chargeAmount });
      }
    } catch (rentalError) {
      results.push({ rentalId: rental.id, status: 'error', error: rentalError.message });
    }
  }

  return {
    processed: results.length,
    charged: results.filter((r) => r.status === 'charged').length,
    message: `Processed ${results.length} overdue rentals`,
  };
}

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).send('ok');
  }

  try {
    if (await isShabbatOrHoliday()) {
      return res.status(200).json({
        success: true,
        message: 'Skipped processing - Shabbat or Israeli holiday',
        processed: 0,
        skipped: true,
      });
    }

    const { url: supabaseUrl, serviceKey: supabaseServiceKey } = getSupabaseConfig();

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Supabase service key not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    console.log(`Processing overdue charges for today: ${todayStr}`);

    const result = await processCharges(supabase, todayStr);

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('Error in process-overdue:', error);
    return res.status(500).json({ error: error.message });
  }
}
