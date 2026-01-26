import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PelecardRequest {
  amount: number;
  customerName: string;
  creditCard: string;
  creditCardExpiry: string; // Format: MMYY
  cvv: string;
  customerId?: string;
  description?: string;
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

    if (!terminal || !user || !password) {
      throw new Error('Pelecard credentials not configured');
    }

    const { 
      amount, 
      customerName, 
      creditCard,
      creditCardExpiry,
      cvv,
      customerId,
      description 
    } = await req.json() as PelecardRequest;

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Valid amount is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!creditCard || !creditCardExpiry || !cvv) {
      return new Response(
        JSON.stringify({ error: 'Credit card details are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Initiating Pelecard debit for:', customerName, 'Amount:', amount);

    // Send request to Pelecard Services API - DebitRegularType for direct charge
    // Using gateway21 as specified in Pelecard documentation
    const response = await fetch('https://gateway21.pelecard.biz/services/DebitRegularType', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        terminalNumber: terminal,
        user: user,
        password: password,
        shopNumber: "001",
        creditCard: creditCard.replace(/\s/g, ''), // Remove spaces
        creditCardDateMmYy: creditCardExpiry,
        token: "",
        total: Math.round(amount * 100).toString(), // Amount in agorot as string
        currency: "1", // 1 = ILS
        cvv2: cvv,
        id: customerId || "",
        authorizationNumber: "",
        paramX: description || `תשלום עבור ${customerName}`,
      }),
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
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: data.ErrorMessage || 'operation success',
          transactionId: data.PelecardTransactionId,
          voucherId: data.VoucherId,
          approvalNumber: data.DebitApproveNumber,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: data.ErrorMessage || 'Payment failed',
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
