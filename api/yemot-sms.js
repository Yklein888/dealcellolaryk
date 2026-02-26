const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send('ok');
  }

  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone and message are required' });
    }

    const systemNumber = process.env.YEMOT_SYSTEM_NUMBER;
    const password = process.env.YEMOT_PASSWORD;

    if (!systemNumber || !password) {
      return res.status(500).json({ error: 'Yemot credentials not configured' });
    }

    const cleanPhone = phone.replace(/\D/g, '');

    const yemotUrl = new URL('https://www.call2all.co.il/ym/api/SendSms');
    yemotUrl.searchParams.set('token', `${systemNumber}:${password}`);
    yemotUrl.searchParams.set('phones', cleanPhone);
    yemotUrl.searchParams.set('message', message);

    console.log('Sending SMS via Yemot to:', cleanPhone);

    const response = await fetch(yemotUrl.toString());
    const responseText = await response.text();

    console.log('Yemot SMS API response:', responseText);

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: true,
      message: 'SMS sent successfully',
      result,
    });
  } catch (error) {
    console.error('Error in yemot-sms:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: error.message });
  }
}
