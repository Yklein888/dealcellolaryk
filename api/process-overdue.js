import { createClient } from '@supabase/supabase-js';

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

async function processCalls(supabase, todayStr, yemotSystemNumber, yemotPassword) {
  const { data: overdueRentals, error: rentalsError } = await supabase
    .from('rentals')
    .select('id, customer_id, customer_name, end_date')
    .eq('status', 'active')
    .lt('end_date', todayStr);

  if (rentalsError) throw new Error(`Error fetching overdue rentals: ${rentalsError.message}`);

  if (!overdueRentals || overdueRentals.length === 0) {
    return { processed: 0, message: 'No overdue rentals to process' };
  }

  console.log(`Found ${overdueRentals.length} overdue active rentals`);
  const results = [];

  for (const rental of overdueRentals) {
    try {
      const { data: rentalItems, error: itemsError } = await supabase
        .from('rental_items')
        .select('item_category')
        .eq('rental_id', rental.id);

      if (itemsError) { results.push({ rentalId: rental.id, success: false, error: itemsError.message }); continue; }

      const hasSim = rentalItems?.some(
        (item) => item.item_category === 'sim_european' || item.item_category === 'sim_american'
      );

      if (!hasSim) { results.push({ rentalId: rental.id, success: true, error: 'No SIM cards in rental' }); continue; }

      const { data: existingCalls } = await supabase
        .from('call_logs')
        .select('id')
        .eq('entity_type', 'rental')
        .eq('entity_id', rental.id)
        .eq('call_type', 'automatic')
        .gte('created_at', todayStr);

      if (existingCalls && existingCalls.length > 0) {
        results.push({ rentalId: rental.id, success: true, error: 'Already called today' });
        continue;
      }

      let customerPhone = null;
      if (rental.customer_id) {
        const { data: customer } = await supabase
          .from('customers').select('phone').eq('id', rental.customer_id).single();
        customerPhone = customer?.phone;
      }

      if (!customerPhone) { results.push({ rentalId: rental.id, success: false, error: 'No phone number' }); continue; }

      const cleanPhone = customerPhone.replace(/\D/g, '');
      const message = `שלום ${rental.customer_name}, זוהי תזכורת ממערכת דיל סלולר. מועד ההחזרה של הציוד המושכר עבר.`;

      const yemotUrl = new URL('https://www.call2all.co.il/ym/api/RunCampaign');
      yemotUrl.searchParams.set('token', `${yemotSystemNumber}:${yemotPassword}`);
      yemotUrl.searchParams.set('phones', cleanPhone);
      yemotUrl.searchParams.set('tts', message);
      yemotUrl.searchParams.set('templateId', '1267261');

      const yemotResponse = await fetch(yemotUrl.toString());
      const yemotText = await yemotResponse.text();

      let yemotResult;
      let campaignId = null;
      try {
        yemotResult = JSON.parse(yemotText);
        campaignId = yemotResult.campaignId || yemotResult.campaign_id || null;
      } catch {
        yemotResult = { raw: yemotText };
      }

      const isSuccess = yemotResult.responseStatus === 'OK' || yemotResult.success !== undefined;

      await supabase.from('call_logs').insert({
        entity_type: 'rental',
        entity_id: rental.id,
        customer_id: rental.customer_id,
        customer_phone: cleanPhone,
        call_status: 'pending',
        campaign_id: campaignId,
        call_type: 'automatic',
        call_message: message,
      });

      results.push({ rentalId: rental.id, success: isSuccess });
    } catch (error) {
      results.push({ rentalId: rental.id, success: false, error: error.message });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  return { processed: results.length, successful: successCount, message: `Processed ${results.length} overdue rentals` };
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

  const type = req.query.type || req.body?.type;

  if (!type || (type !== 'calls' && type !== 'charges')) {
    return res.status(400).json({ error: 'Missing or invalid type. Use ?type=calls or ?type=charges' });
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

    const supabaseUrl = process.env.MAIN_SUPABASE_URL;
    const supabaseServiceKey = process.env.MAIN_SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Supabase service key not configured' });
    }

    if (type === 'calls') {
      const yemotSystemNumber = process.env.YEMOT_SYSTEM_NUMBER;
      const yemotPassword = process.env.YEMOT_PASSWORD;
      if (!yemotSystemNumber || !yemotPassword) {
        return res.status(500).json({ error: 'Yemot credentials not configured' });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    console.log(`Processing overdue ${type} for today: ${todayStr}`);

    let result;
    if (type === 'calls') {
      const yemotSystemNumber = process.env.YEMOT_SYSTEM_NUMBER;
      const yemotPassword = process.env.YEMOT_PASSWORD;
      result = await processCalls(supabase, todayStr, yemotSystemNumber, yemotPassword);
    } else {
      result = await processCharges(supabase, todayStr);
    }

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error(`Error in process-overdue (${type}):`, error);
    return res.status(500).json({ error: error.message });
  }
}
