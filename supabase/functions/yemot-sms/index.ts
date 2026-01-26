import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface YemotSmsRequest {
  phone: string;
  message: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const systemNumber = Deno.env.get('YEMOT_SYSTEM_NUMBER');
    const password = Deno.env.get('YEMOT_PASSWORD');

    if (!systemNumber || !password) {
      throw new Error('Yemot credentials not configured');
    }

    const { phone, message } = await req.json() as YemotSmsRequest;

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: 'Phone and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean phone number - remove non-digits
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Build Yemot API URL for SMS
    const yemotUrl = new URL('https://www.call2all.co.il/ym/api/SendSms');
    yemotUrl.searchParams.set('token', `${systemNumber}:${password}`);
    yemotUrl.searchParams.set('phones', cleanPhone);
    yemotUrl.searchParams.set('message', message);

    console.log('Sending SMS via Yemot API to:', cleanPhone);

    const response = await fetch(yemotUrl.toString());
    const responseText = await response.text();

    console.log('Yemot SMS API response:', responseText);

    // Parse Yemot response
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'SMS sent successfully',
        result 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in yemot-sms:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
