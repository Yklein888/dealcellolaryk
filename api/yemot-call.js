const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    return res.status(200).send('ok');
  }

  try {
    const { phone, message, entityType, entityId, customerId } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone and message are required' });
    }

    const systemNumber = process.env.YEMOT_SYSTEM_NUMBER;
    const password = process.env.YEMOT_PASSWORD;

    if (!systemNumber || !password) {
      return res.status(500).json({ error: 'Yemot credentials not configured' });
    }

    const cleanPhone = phone.replace(/\D/g, '');

    // Call Yemot API
    const yemotUrl = new URL('https://www.call2all.co.il/ym/api/RunCampaign');
    yemotUrl.searchParams.set('token', `${systemNumber}:${password}`);
    yemotUrl.searchParams.set('phones', cleanPhone);
    yemotUrl.searchParams.set('tts', message);
    yemotUrl.searchParams.set('templateId', '1267261');

    console.log('Calling Yemot for phone:', cleanPhone);

    const yemotResponse = await fetch(yemotUrl.toString());
    const yemotText = await yemotResponse.text();

    let yemotResult;
    let campaignId = null;
    try {
      yemotResult = JSON.parse(yemotText);
      campaignId = yemotResult.campaignId || yemotResult.campaign_id || null;
    } catch {
      yemotResult = { raw: yemotText };
    }

    console.log('Yemot response:', yemotResult);

    // Try to log to Supabase (optional - failure won't break the call)
    if (process.env.MAIN_SUPABASE_URL && process.env.MAIN_SUPABASE_SERVICE_KEY) {
      try {
        const supabase = createClient(
          process.env.MAIN_SUPABASE_URL,
          process.env.MAIN_SUPABASE_SERVICE_KEY
        );

        await supabase.from('call_logs').insert({
          entity_type: entityType || null,
          entity_id: entityId || null,
          customer_id: customerId || null,
          customer_phone: cleanPhone,
          call_status: 'pending',
          campaign_id: campaignId,
          call_message: message,
        });
      } catch (logError) {
        console.error('Failed to log call:', logError);
        // Don't fail the request
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Call initiated',
      campaignId,
      result: yemotResult,
    });
  } catch (error) {
    console.error('Error in yemot-call:', error);
    return res.status(500).json({ error: error.message });
  }
}
