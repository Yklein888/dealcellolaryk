import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PelecardRequest {
  amount: number;
  customerName: string;
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

    const { amount, customerName, description } = await req.json() as PelecardRequest;

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Valid amount is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the published URL for redirects
    const baseUrl = 'https://dealcellolaryk.lovable.app';

    console.log('Initiating Pelecard payment for:', customerName, 'Amount:', amount);

    // Send request to Pelecard API - using gateway subdomain for stable DNS resolution
    const response = await fetch('https://gateway.pelecard.biz/ServicesAPI/PaymentPage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        terminal: terminal,
        user: user,
        password: password,
        amount: Math.round(amount * 100), // Amount in agorot
        currency: "1", // 1 = ILS
        good_url: `${baseUrl}/payment-success`,
        error_url: `${baseUrl}/payment-error`,
        description: description || `תשלום עבור ${customerName}`,
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

    // Pelecard returns URL field with the payment page URL
    if (data.URL) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          url: data.URL,
          transactionId: data.ConfirmationKey || null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: data.Error || data.ErrorMessage || 'Unknown error from Pelecard',
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
