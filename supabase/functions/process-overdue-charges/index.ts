import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OverdueRental {
  id: string;
  customer_id: string | null;
  customer_name: string;
  end_date: string;
  overdue_daily_rate: number;
  overdue_grace_days: number;
  auto_charge_enabled: boolean;
  currency: string;
}

interface Customer {
  id: string;
  name: string;
  payment_token: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date in ISO format
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    console.log(`Processing overdue charges for date: ${todayStr}`);

    // Find all active rentals that are overdue and have auto_charge_enabled
    const { data: overdueRentals, error: rentalsError } = await supabase
      .from('rentals')
      .select('id, customer_id, customer_name, end_date, overdue_daily_rate, overdue_grace_days, auto_charge_enabled, currency')
      .eq('status', 'active')
      .not('overdue_daily_rate', 'is', null)
      .gt('overdue_daily_rate', 0)
      .lt('end_date', todayStr);

    if (rentalsError) {
      throw new Error(`Failed to fetch overdue rentals: ${rentalsError.message}`);
    }

    if (!overdueRentals || overdueRentals.length === 0) {
      console.log('No overdue rentals with charging enabled found');
      return new Response(
        JSON.stringify({ success: true, message: 'No overdue rentals to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${overdueRentals.length} overdue rentals to process`);

    const results: { rentalId: string; status: string; amount?: number; error?: string }[] = [];

    for (const rental of overdueRentals as OverdueRental[]) {
      try {
        // Calculate days overdue (considering grace period)
        const endDate = new Date(rental.end_date);
        endDate.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - endDate.getTime();
        const totalDaysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const effectiveDaysOverdue = totalDaysOverdue - (rental.overdue_grace_days || 0);

        if (effectiveDaysOverdue <= 0) {
          console.log(`Rental ${rental.id}: Still within grace period (${totalDaysOverdue} days overdue, ${rental.overdue_grace_days} grace days)`);
          results.push({ rentalId: rental.id, status: 'grace_period' });
          continue;
        }

        // Check if we already charged for today
        const { data: existingCharge } = await supabase
          .from('overdue_charges')
          .select('id')
          .eq('rental_id', rental.id)
          .eq('charge_date', todayStr)
          .maybeSingle();

        if (existingCharge) {
          console.log(`Rental ${rental.id}: Already processed for today`);
          results.push({ rentalId: rental.id, status: 'already_processed' });
          continue;
        }

        const chargeAmount = rental.overdue_daily_rate;

        // Get customer info for token
        let customer: Customer | null = null;
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
          // Attempt to charge using saved token
          const transactionId = `overdue-${rental.id}-${todayStr}-${Date.now()}`;

          try {
            // Call the pelecard-pay function
            const pelecardUrl = `${supabaseUrl}/functions/v1/pelecard-pay`;
            const paymentResponse = await fetch(pelecardUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                amount: chargeAmount,
                customerName: rental.customer_name,
                token: customer!.payment_token,
                customerId: rental.customer_id,
                description: `חיוב יומי על איחור בהשכרה - יום ${effectiveDaysOverdue}`,
                rentalId: rental.id,
                transactionId,
              }),
            });

            const paymentResult = await paymentResponse.json();

            if (paymentResult.success) {
              // Record successful charge
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

              console.log(`Rental ${rental.id}: Charged ${chargeAmount} ${rental.currency} successfully`);
              results.push({ rentalId: rental.id, status: 'charged', amount: chargeAmount });
            } else {
              // Record failed charge
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

              console.log(`Rental ${rental.id}: Charge failed - ${paymentResult.error}`);
              results.push({ rentalId: rental.id, status: 'failed', error: paymentResult.error });
            }
          } catch (paymentError) {
            const errorMsg = paymentError instanceof Error ? paymentError.message : 'Unknown payment error';
            await supabase.from('overdue_charges').insert({
              rental_id: rental.id,
              customer_id: rental.customer_id,
              charge_date: todayStr,
              days_overdue: effectiveDaysOverdue,
              amount: chargeAmount,
              currency: rental.currency,
              status: 'failed',
              error_message: errorMsg,
            });

            console.error(`Rental ${rental.id}: Payment error - ${errorMsg}`);
            results.push({ rentalId: rental.id, status: 'failed', error: errorMsg });
          }
        } else {
          // No token available - just record the pending charge
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

          console.log(`Rental ${rental.id}: Recorded pending charge (no token or auto-charge disabled)`);
          results.push({ rentalId: rental.id, status: 'pending', amount: chargeAmount });
        }
      } catch (rentalError) {
        const errorMsg = rentalError instanceof Error ? rentalError.message : 'Unknown error';
        console.error(`Error processing rental ${rental.id}:`, errorMsg);
        results.push({ rentalId: rental.id, status: 'error', error: errorMsg });
      }
    }

    const summary = {
      total: results.length,
      charged: results.filter(r => r.status === 'charged').length,
      pending: results.filter(r => r.status === 'pending').length,
      failed: results.filter(r => r.status === 'failed').length,
      gracePeriod: results.filter(r => r.status === 'grace_period').length,
      alreadyProcessed: results.filter(r => r.status === 'already_processed').length,
    };

    console.log('Processing complete:', summary);

    return new Response(
      JSON.stringify({ success: true, summary, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in process-overdue-charges:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
