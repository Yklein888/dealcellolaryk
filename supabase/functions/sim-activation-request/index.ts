import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzKhHEQeldMrsNjL8RZMigkPvIKJDRSWD0WoDYpyGPAmGxBYFxDi_9EiUldFjnZ6TIE/exec";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { sim_number, rental_id, customer_id, customer_name, start_date, end_date } = await req.json();

    if (!sim_number) {
      return new Response(
        JSON.stringify({ error: 'sim_number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing activation request for SIM: ${sim_number}`);

    // Fetch SIM details
    const { data: simData } = await supabase
      .from('sim_cards')
      .select('sim_number, israeli_number, local_number, package_name')
      .eq('sim_number', sim_number)
      .single();

    // Use provided customer_name or fetch from database
    let customerName = customer_name || null;
    if (!customerName && customer_id) {
      const { data: customerData } = await supabase
        .from('customers')
        .select('name')
        .eq('id', customer_id)
        .single();
      customerName = customerData?.name || null;
    }

    // Update sim_cards table with pending status
    const { error: updateError } = await supabase
      .from('sim_cards')
      .update({
        activation_status: 'pending',
        activation_requested_at: new Date().toISOString(),
        linked_rental_id: rental_id || null,
        linked_customer_id: customer_id || null,
      })
      .eq('sim_number', sim_number);

    if (updateError) {
      console.error('Error updating sim_cards:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update SIM status', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send activation request to Google Apps Script with set_pending action
    try {
      const googlePayload = {
        action: 'set_pending',
        sim: sim_number,
        customerName: customerName || '',
        startDate: start_date || '',
        endDate: end_date || '',
      };

      console.log('Sending to Google Script:', JSON.stringify(googlePayload));

      const googleResponse = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(googlePayload),
        redirect: 'follow',
      });

      const googleResult = await googleResponse.text();
      console.log('Google Apps Script response:', googleResult);
    } catch (googleError) {
      console.error('Error sending to Google Apps Script:', googleError);
      // Don't fail the whole request - the SIM is marked pending and can be picked up later
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Activation request sent',
        sim_number,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
