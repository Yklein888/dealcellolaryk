import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map Yemot status codes to our internal status
function mapYemotStatus(yemotStatus: string): string {
  const statusLower = (yemotStatus || '').toLowerCase();
  
  if (statusLower.includes('answer') && !statusLower.includes('no')) {
    return 'answered';
  }
  if (statusLower.includes('noanswer') || statusLower.includes('no_answer') || statusLower.includes('no answer')) {
    return 'no_answer';
  }
  if (statusLower.includes('busy')) {
    return 'busy';
  }
  if (statusLower.includes('callback') || statusLower.includes('call_back') || statusLower.includes('call back')) {
    return 'callback';
  }
  
  // Default to pending if unknown status
  return 'pending';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the callback data - Yemot may send via query params, form data, or JSON
    let campaignId: string | null = null;
    let status: string | null = null;
    let phone: string | null = null;

    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const body = await req.json();
      campaignId = body.campaignId || body.campaign_id || body.CampaignId || null;
      status = body.status || body.Status || body.callStatus || null;
      phone = body.phone || body.Phone || null;
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      campaignId = formData.get('campaignId') as string || formData.get('campaign_id') as string || null;
      status = formData.get('status') as string || formData.get('Status') as string || null;
      phone = formData.get('phone') as string || formData.get('Phone') as string || null;
    } else {
      // Try query parameters
      const url = new URL(req.url);
      campaignId = url.searchParams.get('campaignId') || url.searchParams.get('campaign_id') || null;
      status = url.searchParams.get('status') || url.searchParams.get('Status') || null;
      phone = url.searchParams.get('phone') || url.searchParams.get('Phone') || null;
    }

    console.log('Yemot callback received:', { campaignId, status, phone });

    if (!campaignId && !phone) {
      return new Response(
        JSON.stringify({ error: 'No identifier provided (campaignId or phone)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map the status
    const mappedStatus = status ? mapYemotStatus(status) : 'pending';

    // Update the call log
    let updateQuery = supabase.from('call_logs').update({
      call_status: mappedStatus,
      updated_at: new Date().toISOString(),
    });

    if (campaignId) {
      updateQuery = updateQuery.eq('campaign_id', campaignId);
    } else if (phone) {
      // If no campaign ID, try to find by phone (most recent pending call)
      const cleanPhone = phone.replace(/\D/g, '');
      updateQuery = updateQuery
        .eq('customer_phone', cleanPhone)
        .eq('call_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);
    }

    const { error } = await updateQuery;

    if (error) {
      console.error('Error updating call log:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update call log' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Call log updated successfully:', { campaignId, mappedStatus });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Status updated',
        mappedStatus,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in yemot-callback:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
