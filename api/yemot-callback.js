const { createClient } = require('@supabase/supabase-js');

function mapYemotStatus(yemotStatus) {
  const statusLower = (yemotStatus || '').toLowerCase();

  if (statusLower.includes('answer') && !statusLower.includes('no')) {
    return 'answered';
  }
  if (statusLower.includes('noanswer') || statusLower.includes('no_answer') || statusLower.includes('no answer')) {
    return 'no_answer';
  }
  if (statusLower.includes('busy')) {
    return 'busy';
  }
  if (statusLower.includes('callback') || statusLower.includes('call_back') || statusLower.includes('call back')) {
    return 'callback';
  }

  return 'pending';
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send('ok');
  }

  try {
    const supabaseUrl = process.env.MAIN_SUPABASE_URL;
    const supabaseServiceKey = process.env.MAIN_SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Supabase credentials not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let campaignId = null;
    let status = null;
    let phone = null;

    const contentType = req.headers['content-type'] || '';

    if (contentType.includes('application/json')) {
      const body = req.body;
      campaignId = body.campaignId || body.campaign_id || body.CampaignId || null;
      status = body.status || body.Status || body.callStatus || null;
      phone = body.phone || body.Phone || null;
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      campaignId = req.body.campaignId || req.body.campaign_id || null;
      status = req.body.status || req.body.Status || null;
      phone = req.body.phone || req.body.Phone || null;
    } else {
      const url = new URL(`http://localhost${req.url}`);
      campaignId = url.searchParams.get('campaignId') || url.searchParams.get('campaign_id') || null;
      status = url.searchParams.get('status') || url.searchParams.get('Status') || null;
      phone = url.searchParams.get('phone') || url.searchParams.get('Phone') || null;
    }

    console.log('Yemot callback received:', { campaignId, status, phone });

    if (!campaignId && !phone) {
      return res.status(400).json({ error: 'No identifier provided (campaignId or phone)' });
    }

    const mappedStatus = status ? mapYemotStatus(status) : 'pending';

    let updateQuery = supabase.from('call_logs').update({
      call_status: mappedStatus,
      updated_at: new Date().toISOString(),
    });

    if (campaignId) {
      updateQuery = updateQuery.eq('campaign_id', campaignId);
    } else if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      updateQuery = updateQuery
        .eq('customer_phone', cleanPhone)
        .eq('call_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);
    }

    const { error } = await updateQuery;

    if (error) {
      console.error('Error updating call log:', error);
      return res.status(500).json({ error: 'Failed to update call log' });
    }

    console.log('Call log updated successfully:', { campaignId, mappedStatus });

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: true,
      message: 'Status updated',
      mappedStatus,
    });
  } catch (error) {
    console.error('Error in yemot-callback:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: error.message });
  }
}
