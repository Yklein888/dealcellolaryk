const { createClient } = require('@supabase/supabase-js');

function maskSensitive(data) {
  const masked = { ...data };
  if (masked.creditCard) masked.creditCard = '****';
  if (masked.cvv) masked.cvv = '***';
  if (masked.password) masked.password = '****';
  if (masked.token) masked.token = '****';
  return masked;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send('ok');
  }

  try {
    const terminal = process.env.PELECARD_TERMINAL;
    const user = process.env.PELECARD_USER;
    const password = process.env.PELECARD_PASSWORD;
    const supabaseUrl = process.env.MAIN_SUPABASE_URL;
    const supabaseServiceKey = process.env.MAIN_SUPABASE_SERVICE_KEY;
    const supabaseAnonKey = process.env.MAIN_SUPABASE_ANON_KEY;

    if (!terminal || !user || !password) {
      return res.status(500).json({ error: 'Pelecard credentials not configured' });
    }

    if (!supabaseUrl || (!supabaseServiceKey && !supabaseAnonKey)) {
      return res.status(500).json({ error: 'Supabase configuration missing' });
    }

    // Use service key if available, otherwise use anon key + user JWT from frontend
    const supabaseKey = supabaseServiceKey || supabaseAnonKey;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // If using anon key, set user auth from JWT passed by frontend
    if (!supabaseServiceKey) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const userJwt = authHeader.replace('Bearer ', '');
        supabase.auth.setSession({ access_token: userJwt, refresh_token: '' });
      }
    }

    const {
      amount,
      customerName,
      creditCard,
      creditCardExpiry,
      cvv,
      token,
      useStoredToken,
      customerId,
      description,
      rentalId,
      transactionId,
    } = req.body;

    console.log('Charge request received:', JSON.stringify(maskSensitive(req.body)));

    if (!transactionId) {
      return res.status(400).json({ error: 'transaction_id is required for idempotency' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    let actualToken = token;
    if (useStoredToken && customerId) {
      console.log('Fetching stored token for customer:', customerId);
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('payment_token, payment_token_last4, payment_token_expiry')
        .eq('id', customerId)
        .single();

      if (customerError || !customerData?.payment_token) {
        return res.status(400).json({ error: 'No payment token found for customer' });
      }
      actualToken = customerData.payment_token;
    }

    const hasToken = !!actualToken;
    const hasCardDetails = creditCard && creditCardExpiry && cvv;

    if (!hasToken && !hasCardDetails) {
      return res.status(400).json({
        error: 'Either token or credit card details (creditCard, creditCardExpiry, cvv) are required',
      });
    }

    // Idempotency check
    const { data: existingTransaction } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    if (existingTransaction) {
      console.log('Idempotent request - returning existing result:', transactionId);

      if (existingTransaction.status === 'success') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({
          success: true,
          message: 'Transaction already processed',
          transactionId: existingTransaction.transaction_id,
        });
      } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(400).json({
          success: false,
          error: existingTransaction.error_message || 'Transaction previously failed',
          transactionId: existingTransaction.transaction_id,
        });
      }
    }

    // Create pending transaction record
    await supabase.from('payment_transactions').insert({
      transaction_id: transactionId,
      rental_id: rentalId || null,
      amount,
      currency: 'ILS',
      status: 'pending',
      customer_name: customerName,
    });

    console.log('Initiating Pelecard debit for:', customerName, 'Amount:', amount);

    const customerIdNumeric =
      typeof customerId === 'string' && /^\d{5,10}$/.test(customerId) ? customerId : '';

    const gatewayPayload = {
      terminalNumber: terminal,
      user: user,
      password: password,
      shopNumber: '001',
      total: Math.round(amount * 100).toString(),
      currency: '1',
      id: customerIdNumeric,
      authorizationNumber: '',
      paramX: description || `תשלום עבור ${customerName}`,
    };

    if (hasToken) {
      gatewayPayload.token = actualToken;
      gatewayPayload.creditCard = '';
      gatewayPayload.creditCardDateMmYy = '';
      gatewayPayload.cvv2 = '';
    } else {
      gatewayPayload.token = '';
      gatewayPayload.creditCard = creditCard.replace(/\s/g, '');
      gatewayPayload.creditCardDateMmYy = creditCardExpiry;
      gatewayPayload.cvv2 = cvv;
    }

    const response = await fetch('https://gateway21.pelecard.biz/services/DebitRegularType', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gatewayPayload),
    });

    const responseText = await response.text();
    console.log('Pelecard API response:', responseText.slice(0, 200));

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    if (data.StatusCode === '000') {
      await supabase.from('payment_transactions').update({
        status: 'success',
        gateway_response: data,
      });

      const resultData = data.ResultData || data;
      const returnedToken = resultData.Token || data.Token;
      const cardLast4 = resultData.CreditCardNumber
        ? resultData.CreditCardNumber.slice(-4)
        : creditCard
          ? creditCard.slice(-4)
          : null;
      const cardExpiry = resultData.CreditCardExpDate || creditCardExpiry;

      if (returnedToken && customerId) {
        await supabase.from('customers').update({
          payment_token: returnedToken,
          payment_token_last4: cardLast4,
          payment_token_expiry: cardExpiry,
          payment_token_updated_at: new Date().toISOString(),
        });
      }

      let invoiceNumber = null;
      try {
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            customer_id: customerId || null,
            customer_name: customerName,
            rental_id: rentalId || null,
            transaction_id: transactionId,
            amount,
            currency: 'ILS',
            description: description || `תשלום עבור ${customerName}`,
            business_name: 'דיל סלולר',
            business_id: '201512258',
            status: 'issued',
            issued_at: new Date().toISOString(),
          })
          .select('invoice_number')
          .single();

        if (!invoiceError) {
          invoiceNumber = invoice.invoice_number;
        }
      } catch (error) {
        console.error('Error creating invoice:', error);
      }

      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: true,
        message: data.ErrorMessage || 'operation success',
        transactionId: data.PelecardTransactionId,
        invoiceNumber,
      });
    } else {
      const errorMessage = data.ErrorMessage || 'Payment failed';
      await supabase.from('payment_transactions').update({
        status: 'failed',
        gateway_response: data,
        error_message: errorMessage,
      });

      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(400).json({
        success: false,
        error: errorMessage,
        errorCode: data.StatusCode,
      });
    }
  } catch (error) {
    console.error('Error in pelecard-pay:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: error.message });
  }
}
