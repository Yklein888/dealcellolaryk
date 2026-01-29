import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const yemotSystemNumber = Deno.env.get('YEMOT_SYSTEM_NUMBER');
    const yemotPassword = Deno.env.get('YEMOT_PASSWORD');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    if (!yemotSystemNumber || !yemotPassword) {
      throw new Error('Yemot credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get yesterday's date (rentals that became overdue today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const todayStr = today.toISOString().split('T')[0];

    console.log('Processing overdue calls for rentals ending on:', yesterdayStr);

    // Find active rentals that ended yesterday (first day of being overdue)
    const { data: overdueRentals, error: rentalsError } = await supabase
      .from('rentals')
      .select(`
        id,
        customer_id,
        customer_name,
        end_date
      `)
      .eq('status', 'active')
      .eq('end_date', yesterdayStr);

    if (rentalsError) {
      throw new Error(`Error fetching overdue rentals: ${rentalsError.message}`);
    }

    if (!overdueRentals || overdueRentals.length === 0) {
      console.log('No rentals became overdue today');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No overdue rentals to process',
          processed: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${overdueRentals.length} rentals that became overdue today`);

    const results: { rentalId: string; success: boolean; error?: string }[] = [];

    for (const rental of overdueRentals) {
      try {
        // Check if we already called today for this rental
        const { data: existingCalls, error: callsError } = await supabase
          .from('call_logs')
          .select('id')
          .eq('entity_type', 'rental')
          .eq('entity_id', rental.id)
          .eq('call_type', 'automatic')
          .gte('created_at', todayStr);

        if (callsError) {
          console.error(`Error checking existing calls for rental ${rental.id}:`, callsError);
          results.push({ rentalId: rental.id, success: false, error: callsError.message });
          continue;
        }

        if (existingCalls && existingCalls.length > 0) {
          console.log(`Already called today for rental ${rental.id}, skipping`);
          results.push({ rentalId: rental.id, success: true, error: 'Already called today' });
          continue;
        }

        // Get customer phone number
        let customerPhone: string | null = null;
        
        if (rental.customer_id) {
          const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('phone')
            .eq('id', rental.customer_id)
            .single();

          if (customerError) {
            console.error(`Error fetching customer for rental ${rental.id}:`, customerError);
          } else if (customer) {
            customerPhone = customer.phone;
          }
        }

        if (!customerPhone) {
          console.log(`No phone number for rental ${rental.id}, skipping`);
          results.push({ rentalId: rental.id, success: false, error: 'No phone number' });
          continue;
        }

        // Clean phone number
        const cleanPhone = customerPhone.replace(/\D/g, '');
        
        // Create the message
        const message = `שלום ${rental.customer_name}, זוהי תזכורת ממערכת דיל סלולר. מועד ההחזרה של הציוד המושכר עבר. אנא צור קשר להחזרת הציוד בהקדם. תודה רבה.`;

        // Call Yemot API
        const yemotUrl = new URL('https://www.call2all.co.il/ym/api/RunCampaign');
        yemotUrl.searchParams.set('token', `${yemotSystemNumber}:${yemotPassword}`);
        yemotUrl.searchParams.set('phones', cleanPhone);
        yemotUrl.searchParams.set('tts', message);
        yemotUrl.searchParams.set('templateId', '1267261');

        console.log(`Calling Yemot for rental ${rental.id}, phone: ${cleanPhone}`);

        const yemotResponse = await fetch(yemotUrl.toString());
        const yemotText = await yemotResponse.text();
        
        let yemotResult;
        let campaignId: string | null = null;
        try {
          yemotResult = JSON.parse(yemotText);
          campaignId = yemotResult.campaignId || yemotResult.campaign_id || null;
        } catch {
          yemotResult = { raw: yemotText };
        }

        const isSuccess = yemotResult.responseStatus === 'OK' || 
                          (yemotResult.success !== undefined && yemotResult.success) ||
                          (!yemotResult.responseStatus && !yemotResult.error);

        // Save call log
        const { error: logError } = await supabase.from('call_logs').insert({
          entity_type: 'rental',
          entity_id: rental.id,
          customer_id: rental.customer_id,
          customer_phone: cleanPhone,
          call_status: 'pending',
          campaign_id: campaignId,
          call_type: 'automatic',
          call_message: message,
        });

        if (logError) {
          console.error(`Error saving call log for rental ${rental.id}:`, logError);
        }

        results.push({ rentalId: rental.id, success: isSuccess });
        console.log(`Call ${isSuccess ? 'initiated' : 'may have failed'} for rental ${rental.id}`);

      } catch (rentalError) {
        const errorMsg = rentalError instanceof Error ? rentalError.message : 'Unknown error';
        console.error(`Error processing rental ${rental.id}:`, rentalError);
        results.push({ rentalId: rental.id, success: false, error: errorMsg });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Processed ${results.length} rentals, ${successCount} successful`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${results.length} overdue rentals`,
        processed: results.length,
        successful: successCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in process-overdue-calls:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
