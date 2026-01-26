import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface YemotCallRequest {
  phone: string;
  message: string;
  callerId?: string;
  campaignType?: 'repair_ready' | 'rental_reminder';
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

    const { phone, message, callerId, campaignType } = await req.json() as YemotCallRequest;

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: 'Phone and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean phone number - remove non-digits
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Try the RunCampaign API endpoint for TTS calls
    // Format: https://www.call2all.co.il/ym/api/RunCampaign
    const yemotUrl = new URL('https://www.call2all.co.il/ym/api/RunCampaign');
    yemotUrl.searchParams.set('token', `${systemNumber}:${password}`);
    yemotUrl.searchParams.set('phones', cleanPhone);
    yemotUrl.searchParams.set('tts', message);
    
    // Set template ID based on campaign type
    if (campaignType === 'rental_reminder') {
      yemotUrl.searchParams.set('templateId', '1267261');
    }
    
    if (callerId) {
      yemotUrl.searchParams.set('caller_id', callerId);
    }

    console.log('Calling Yemot RunCampaign API for phone:', cleanPhone);
    console.log('URL:', yemotUrl.toString().replace(password, '***'));

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

    // Check if response indicates success
    const isSuccess = result.responseStatus === 'OK' || 
                      (result.success !== undefined && result.success) ||
                      (!result.responseStatus && !result.error);

    return new Response(
      JSON.stringify({ 
        success: isSuccess, 
        message: isSuccess ? 'Call initiated successfully' : 'Call may have failed',
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
