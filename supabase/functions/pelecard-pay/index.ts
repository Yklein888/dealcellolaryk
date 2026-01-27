import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PelecardRequest {
  amount: number;
  customerName: string;
  creditCard?: string;
  creditCardExpiry?: string; // Format: MMYY
  cvv?: string;
  token?: string; // For token-based payments
  customerId?: string;
  description?: string;
  rentalId?: string;
  transactionId: string; // Required for idempotency
}

// Mask sensitive data for logging
function maskSensitive(data: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...data };
  if (masked.creditCard) masked.creditCard = '****';
  if (masked.cvv) masked.cvv = '***';
  if (masked.password) masked.password = '****';
  if (masked.token) masked.token = '****';
  return masked;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const terminal = Deno.env.get('PELECARD_TERMINAL');
    const user = Deno.env.get('PELECARD_USER');
    const password = Deno.env.get('PELECARD_PASSWORD');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!terminal || !user || !password) {
      throw new Error('Pelecard credentials not configured');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestBody = await req.json() as PelecardRequest;
    const { 
      amount, 
      customerName, 
      creditCard,
      creditCardExpiry,
      cvv,
      token,
      customerId,
      description,
      rentalId,
      transactionId
    } = requestBody;

    // Log incoming request (masked)
    console.log('Charge request received:', JSON.stringify(maskSensitive(requestBody as unknown as Record<string, unknown>)));

    // Validate required fields
    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: 'transaction_id is required for idempotency' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Valid amount is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for token or credit card details
    const hasToken = !!token;
    const hasCardDetails = creditCard && creditCardExpiry && cvv;

    if (!hasToken && !hasCardDetails) {
      return new Response(
        JSON.stringify({ error: 'Either token or credit card details (creditCard, creditCardExpiry, cvv) are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Idempotency check - return existing result if already processed
    const { data: existingTransaction } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    if (existingTransaction) {
      console.log('Idempotent request - returning existing result:', transactionId);
      
      if (existingTransaction.status === 'success') {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Transaction already processed',
            transactionId: existingTransaction.transaction_id,
            gatewayResponse: existingTransaction.gateway_response
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: existingTransaction.error_message || 'Transaction previously failed',
            transactionId: existingTransaction.transaction_id,
            gatewayResponse: existingTransaction.gateway_response
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create pending transaction record
    const { error: insertError } = await supabase
      .from('payment_transactions')
      .insert({
        transaction_id: transactionId,
        rental_id: rentalId || null,
        amount,
        currency: 'ILS',
        status: 'pending',
        customer_name: customerName
      });

    if (insertError) {
      console.error('Failed to create transaction record:', insertError);
      // Continue anyway - idempotency is nice-to-have, not critical
    }

    console.log('Initiating Pelecard debit for:', customerName, 'Amount:', amount, 'TransactionId:', transactionId);

    // Pelecard expects the `id` field to be numeric (typically Israeli ID number).
    // Our app sometimes passes internal UUIDs (e.g. customerId), which causes gateway errors.
    // Send it only when it looks numeric.
    const customerIdNumeric = typeof customerId === 'string' && /^\d{5,10}$/.test(customerId)
      ? customerId
      : "";

    // Build gateway payload based on payment method
    const gatewayPayload: Record<string, string> = {
      terminalNumber: terminal,
      user: user,
      password: password,
      shopNumber: "001",
      total: Math.round(amount * 100).toString(), // Amount in agorot as string
      currency: "1", // 1 = ILS
      id: customerIdNumeric,
      authorizationNumber: "",
      paramX: description || `תשלום עבור ${customerName}`,
    };

    // Use token or card details
    if (hasToken) {
      gatewayPayload.token = token;
      gatewayPayload.creditCard = "";
      gatewayPayload.creditCardDateMmYy = "";
      gatewayPayload.cvv2 = "";
    } else {
      gatewayPayload.token = "";
      gatewayPayload.creditCard = creditCard!.replace(/\s/g, ''); // Remove spaces
      gatewayPayload.creditCardDateMmYy = creditCardExpiry!;
      gatewayPayload.cvv2 = cvv!;
    }

    // Send request to Pelecard Services API - DebitRegularType for direct charge
    const response = await fetch('https://gateway21.pelecard.biz/services/DebitRegularType', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gatewayPayload),
    });

    const responseText = await response.text();
    console.log('Pelecard API response:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    // Check Pelecard response - StatusCode "000" means success
    if (data.StatusCode === "000") {
      // Update transaction as successful
      await supabase
        .from('payment_transactions')
        .update({
          status: 'success',
          gateway_response: data
        })
        .eq('transaction_id', transactionId);

      console.log('Payment successful for transaction:', transactionId);

      // Save token to customer for future charges (if available and customer exists)
      const resultData = data.ResultData || data;
      const returnedToken = resultData.Token || data.Token;
      const cardLast4 = resultData.CreditCardNumber 
        ? resultData.CreditCardNumber.slice(-4) 
        : (creditCard ? creditCard.slice(-4) : null);
      const cardExpiry = resultData.CreditCardExpDate || creditCardExpiry;

      if (returnedToken && customerId) {
        const { error: tokenError } = await supabase
          .from('customers')
          .update({
            payment_token: returnedToken,
            payment_token_last4: cardLast4,
            payment_token_expiry: cardExpiry,
            payment_token_updated_at: new Date().toISOString()
          })
          .eq('id', customerId);

        if (tokenError) {
          console.error('Failed to save token to customer:', tokenError);
        } else {
          console.log('Token saved for customer:', customerId);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: data.ErrorMessage || 'operation success',
          transactionId: data.PelecardTransactionId,
          voucherId: data.VoucherId,
          approvalNumber: data.DebitApproveNumber,
          tokenSaved: !!returnedToken,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Update transaction as failed
      const errorMessage = data.ErrorMessage || 'Payment failed';
      await supabase
        .from('payment_transactions')
        .update({
          status: 'failed',
          gateway_response: data,
          error_message: errorMessage
        })
        .eq('transaction_id', transactionId);

      console.log('Payment failed for transaction:', transactionId, 'Error:', errorMessage);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          errorCode: data.StatusCode,
          details: data 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in pelecard-pay:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
