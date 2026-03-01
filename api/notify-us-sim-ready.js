import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send('ok');
  }

  try {
    const mainUrl = process.env.MAIN_SUPABASE_URL;
    const mainKey = process.env.MAIN_SUPABASE_SERVICE_KEY;
    const simUrl = process.env.SIM_MANAGER_SUPABASE_URL;
    const simKey = process.env.SIM_MANAGER_SUPABASE_KEY;
    const mainAnonKey = process.env.MAIN_SUPABASE_ANON_KEY;

    if (!mainUrl || !mainKey || !simUrl || !simKey || !mainAnonKey) {
      return res.status(500).json({ error: 'Supabase credentials not configured' });
    }

    const mainSupabase = createClient(mainUrl, mainKey);
    const simSupabase = createClient(simUrl, simKey);

    const { entityType, entityId } = req.body;

    if (!entityType || !entityId) {
      return res.status(400).json({ error: 'entityType and entityId are required' });
    }

    console.log('Checking US SIM ready status for:', entityType, entityId);

    let phone = null;
    let customerId = null;

    if (entityType === 'rental') {
      const { data: rental } = await mainSupabase
        .from('rentals')
        .select('customer_id')
        .eq('id', entityId)
        .single();

      if (rental?.customer_id) {
        customerId = rental.customer_id;
        const { data: customer } = await mainSupabase
          .from('customers')
          .select('phone')
          .eq('id', customerId)
          .single();
        phone = customer?.phone;
      }
    } else if (entityType === 'customer') {
      customerId = entityId;
      const { data: customer } = await mainSupabase
        .from('customers')
        .select('phone')
        .eq('id', customerId)
        .single();
      phone = customer?.phone;
    }

    if (!phone) {
      return res.status(400).json({ error: 'No phone number found' });
    }

    const cleanPhone = phone.replace(/\D/g, '');

    // Check sim-manager for US SIM status
    const { data: usSims } = await simSupabase
      .from('us_sims')
      .select('id, number, status')
      .eq('status', 'ready');

    if (!usSims || usSims.length === 0) {
      return res.status(200).json({
        success: true,
        readyCount: 0,
        message: 'No US SIMs ready for notification',
      });
    }

    // Send WhatsApp notification
    const whatsappResponse = await fetch(`${mainUrl}/functions/v1/send-whatsapp-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mainAnonKey}`,
      },
      body: JSON.stringify({
        phone: cleanPhone,
        message: `Your US SIM is ready! ${usSims.length} SIM(s) available.`,
      }),
    }).catch(() => null);

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: true,
      readyCount: usSims.length,
      notified: !!whatsappResponse?.ok,
    });
  } catch (error) {
    console.error('Error in notify-us-sim-ready:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: error.message });
  }
}
