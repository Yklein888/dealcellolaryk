export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send('ok');
  }

  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: 'Missing phone or message' });
    }

    const waAccountId = process.env.WHATSAPP_ACCOUNT_ID;
    const waToken = process.env.WHATSAPP_TOKEN;

    if (!waAccountId || !waToken) {
      console.log('WhatsApp integration not configured');
      return res.status(200).json({
        success: true,
        note: 'WhatsApp integration not configured. Message logged instead.',
        loggedMessage: { phone, message },
      });
    }

    const response = await fetch(`https://graph.instagram.com/v18.0/${waAccountId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${waToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API error:', result);
      return res.status(response.status).json({
        error: 'Failed to send WhatsApp message',
        details: result,
      });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: true,
      messageId: result.messages?.[0]?.id,
    });
  } catch (error) {
    console.error('Error in send-whatsapp:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: error.message });
  }
}
