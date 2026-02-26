const { createClient } = require('@supabase/supabase-js');

const API_KEY = process.env.SIM_ACTIVATION_API_KEY || 'sim-activation-secret-key';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send('ok');
  }

  try {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) {
      console.warn('Invalid API key attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabaseUrl = process.env.MAIN_SUPABASE_URL;
    const supabaseServiceKey = process.env.MAIN_SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Supabase configuration missing' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { sim_number, success, error_message } = req.body;

    if (!sim_number) {
      return res.status(400).json({ error: 'sim_number is required' });
    }

    console.log(`Processing activation callback for SIM: ${sim_number}, success: ${success}`);

    const { data: simData, error: fetchError } = await supabase
      .from('sim_cards')
      .select('activation_status')
      .eq('sim_number', sim_number)
      .single();

    if (fetchError || !simData) {
      console.error('SIM not found:', fetchError);
      return res.status(404).json({ error: 'SIM not found' });
    }

    if (simData.activation_status !== 'pending') {
      console.warn(`SIM ${sim_number} is not in pending status, current: ${simData.activation_status}`);
      return res.status(400).json({
        error: 'SIM is not pending activation',
        current_status: simData.activation_status,
      });
    }

    const updateData = {
      activation_status: success ? 'activated' : 'failed',
      activation_completed_at: new Date().toISOString(),
    };

    if (success) {
      updateData.is_active = true;
    }

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
      return res.status(500).json({ error: 'Failed to update SIM status' });
    }

    console.log(`SIM ${sim_number} activation status updated to: ${success ? 'activated' : 'failed'}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: true,
      message: `SIM ${success ? 'activated' : 'failed'} successfully`,
      sim_number,
      new_status: success ? 'activated' : 'failed',
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: error.message });
  }
}
