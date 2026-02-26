const { createClient } = require('@supabase/supabase-js');

async function isShabbatOrHoliday() {
  const today = new Date();
  if (today.getDay() === 6) {
    console.log('Today is Shabbat');
    return true;
  }

  try {
    const dateStr = today.toISOString().split('T')[0];
    const response = await fetch(
      `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=off&mod=off&start=${dateStr}&end=${dateStr}&geo=none`
    );

    if (response.ok) {
      const data = await response.json();
      return data.items?.some((item) => item.yomtov === true) ?? false;
    }
  } catch (error) {
    console.warn('Hebcal check failed');
  }

  return false;
}

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send('ok');
  }

  try {
    if (await isShabbatOrHoliday()) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: true,
        message: 'Skipped - Shabbat or holiday',
        processed: 0,
      });
    }

    const supabaseUrl = process.env.MAIN_SUPABASE_URL;
    const supabaseServiceKey = process.env.MAIN_SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Missing Supabase configuration' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    console.log(`Processing overdue charges for date: ${todayStr}`);

    const { data: overdueRentals, error: rentalsError } = await supabase
      .from('rentals')
      .select('id, customer_id, customer_name, end_date, overdue_daily_rate, overdue_grace_days, auto_charge_enabled, currency')
      .eq('status', 'active')
      .not('overdue_daily_rate', 'is', null)
      .gt('overdue_daily_rate', 0)
      .lt('end_date', todayStr);

    if (rentalsError) {
      return res.status(500).json({ error: `Failed to fetch overdue rentals: ${rentalsError.message}` });
    }

    if (!overdueRentals || overdueRentals.length === 0) {
      console.log('No overdue rentals with charging enabled found');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: true,
        message: 'No overdue rentals to process',
        processed: 0,
      });
    }

    console.log(`Found ${overdueRentals.length} overdue rentals to process`);

    const results = [];
    let chargedCount = 0;

    for (const rental of overdueRentals) {
      try {
        const endDate = new Date(rental.end_date);
        endDate.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - endDate.getTime();
        const totalDaysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const effectiveDaysOverdue = totalDaysOverdue - (rental.overdue_grace_days || 0);

        if (effectiveDaysOverdue <= 0) {
          results.push({ rentalId: rental.id, status: 'grace_period' });
          continue;
        }

        const { data: existingCharge } = await supabase
          .from('overdue_charges')
          .select('id')
          .eq('rental_id', rental.id)
          .eq('charge_date', todayStr)
          .maybeSingle();

        if (existingCharge) {
          results.push({ rentalId: rental.id, status: 'already_processed' });
          continue;
        }

        const chargeAmount = rental.overdue_daily_rate;

        let customer = null;
        if (rental.customer_id) {
          const { data: customerData } = await supabase
            .from('customers')
            .select('id, name, payment_token')
            .eq('id', rental.customer_id)
            .maybeSingle();
          customer = customerData;
        }

        const hasToken = customer?.payment_token;

        if (hasToken && rental.auto_charge_enabled) {
          const transactionId = `overdue-${rental.id}-${todayStr}-${Date.now()}`;

          try {
            // Call pelecard-pay API route
            const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
            const pelecardResponse = await fetch(`${vercelUrl}/api/pelecard-pay`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
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

            if (paymentResult.success) {
              await supabase.from('overdue_charges').insert({
                rental_id: rental.id,
                customer_id: rental.customer_id,
                charge_date: todayStr,
                days_overdue: effectiveDaysOverdue,
                amount: chargeAmount,
                currency: rental.currency,
                status: 'charged',
                transaction_id: transactionId,
              });

              chargedCount++;
              results.push({ rentalId: rental.id, status: 'charged', amount: chargeAmount });
            } else {
              await supabase.from('overdue_charges').insert({
                rental_id: rental.id,
                customer_id: rental.customer_id,
                charge_date: todayStr,
                days_overdue: effectiveDaysOverdue,
                amount: chargeAmount,
                currency: rental.currency,
                status: 'failed',
                error_message: paymentResult.error || 'Payment failed',
              });

              results.push({ rentalId: rental.id, status: 'failed', error: paymentResult.error });
            }
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

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: true,
      summary: {
        total: results.length,
        charged: results.filter((r) => r.status === 'charged').length,
      },
    });
  } catch (error) {
    console.error('Error in process-overdue-charges:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: error.message });
  }
}
