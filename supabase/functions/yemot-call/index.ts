import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface YemotCallRequest {
  phone: string;
  message: string;
  callerId?: string;
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

    const { phone, message, callerId } = await req.json() as YemotCallRequest;

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: 'Phone and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean phone number - remove non-digits
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Build Yemot API URL for outgoing call with TTS
    const yemotUrl = new URL('https://www.call2all.co.il/ym/api/CallFile');
    yemotUrl.searchParams.set('token', `${systemNumber}:${password}`);
    yemotUrl.searchParams.set('phones', cleanPhone);
    yemotUrl.searchParams.set('tts_text', message);
    
    if (callerId) {
      yemotUrl.searchParams.set('caller_id', callerId);
    }

    console.log('Calling Yemot API for phone:', cleanPhone);

    const response = await fetch(yemotUrl.toString());
    const responseText = await response.text();

    console.log('Yemot API response:', responseText);

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
        message: 'Call initiated successfully',
        result 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in yemot-call:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
