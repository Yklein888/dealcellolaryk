import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

// Simple API key for callback authentication
const API_KEY = Deno.env.get('SIM_ACTIVATION_API_KEY') || 'sim-activation-secret-key';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API key
    const apiKey = req.headers.get('x-api-key');
    if (apiKey !== API_KEY) {
      console.warn('Invalid API key attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { sim_number, success, error_message } = await req.json();

    if (!sim_number) {
      return new Response(
        JSON.stringify({ error: 'sim_number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing activation callback for SIM: ${sim_number}, success: ${success}`);

    // First, verify the SIM is in pending status
    const { data: simData, error: fetchError } = await supabase
      .from('sim_cards')
      .select('activation_status')
      .eq('sim_number', sim_number)
      .single();

    if (fetchError || !simData) {
      console.error('SIM not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'SIM not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (simData.activation_status !== 'pending') {
      console.warn(`SIM ${sim_number} is not in pending status, current: ${simData.activation_status}`);
      return new Response(
        JSON.stringify({ error: 'SIM is not pending activation', current_status: simData.activation_status }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the SIM status
    const updateData: Record<string, unknown> = {
      activation_status: success ? 'activated' : 'failed',
      activation_completed_at: new Date().toISOString(),
    };

    // If activation succeeded, also mark as active
    if (success) {
      updateData.is_active = true;
    }

    // Store error message in notes if failed
    if (!success && error_message) {
      const { data: currentSim } = await supabase
        .from('sim_cards')
        .select('notes')
        .eq('sim_number', sim_number)
        .single();
      
      const currentNotes = currentSim?.notes || '';
      updateData.notes = `${currentNotes}\n[Activation Failed ${new Date().toLocaleString()}]: ${error_message}`.trim();
    }

    const { error: updateError } = await supabase
      .from('sim_cards')
      .update(updateData)
      .eq('sim_number', sim_number);

    if (updateError) {
      console.error('Error updating sim_cards:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update SIM status', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`SIM ${sim_number} activation status updated to: ${success ? 'activated' : 'failed'}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `SIM ${success ? 'activated' : 'failed'} successfully`,
        sim_number,
        new_status: success ? 'activated' : 'failed',
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
