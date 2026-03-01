import { createClient } from '@supabase/supabase-js';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx7HRL6ythPzBINoQDir2PreXod3FNtQJJwfrev3z84xQb-84X8-PHPwb1XFzc750j5/exec';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send('ok');
  }

  try {
    const supabaseUrl = process.env.MAIN_SUPABASE_URL;
    const supabaseServiceKey = process.env.MAIN_SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Supabase configuration missing' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { sim_number, rental_id, customer_id, customer_name, start_date, end_date } = req.body;

    if (!sim_number) {
      return res.status(400).json({ error: 'sim_number is required' });
    }

    console.log(`Processing activation request for SIM: ${sim_number}`);

    // Fetch SIM details
    const { data: simData } = await supabase
      .from('sim_cards')
      .select('sim_number, israeli_number, local_number, package_name')
      .eq('sim_number', sim_number)
      .single();

    let customerName = customer_name || null;
    if (!customerName && customer_id) {
      const { data: customerData } = await supabase
        .from('customers')
        .select('name')
        .eq('id', customer_id)
        .single();
      customerName = customerData?.name || null;
    }

    // Update sim_cards table
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
      return res.status(500).json({ error: 'Failed to update SIM status' });
    }

    // Send to Google Apps Script (optional)
    try {
      const googlePayload = {
        action: 'set_pending',
        sim: sim_number,
        customerName: customerName || '',
        startDate: start_date || '',
        endDate: end_date || '',
      };

      console.log('Sending to Google Script:', googlePayload);

      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(googlePayload),
      });
    } catch (error) {
      console.error('Error sending to Google Apps Script:', error);
      // Don't fail the whole request
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: true,
      message: 'Activation request sent',
      sim_number,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: error.message });
  }
}
