import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyxjoYYqxkjPI059oPtQZpjtHAnpFNzkzcmlROwdDkBl89ucsXX1qEh8qaoC4xHl3Sa/exec";

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

    const { sim_number, rental_id, customer_id } = await req.json();

    if (!sim_number) {
      return new Response(
        JSON.stringify({ error: 'sim_number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing activation request for SIM: ${sim_number}`);

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

    // Send activation request to Google Apps Script
    try {
      const googleResponse = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'activate',
          sim_number,
          rental_id: rental_id || null,
          customer_id: customer_id || null,
          requested_at: new Date().toISOString(),
        }),
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
