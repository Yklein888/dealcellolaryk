import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, message } = await req.json()

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing phone or message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get WhatsApp integration details from environment
    const waAccountId = Deno.env.get('WHATSAPP_ACCOUNT_ID')
    const waToken = Deno.env.get('WHATSAPP_TOKEN')

    if (!waAccountId || !waToken) {
      console.log('WhatsApp integration not configured - message not sent')
      // Don't fail the request, just log that it wasn't sent
      return new Response(
        JSON.stringify({
          success: true,
          note: 'WhatsApp integration not configured. Message logged instead.',
          loggedMessage: { phone, message }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send WhatsApp message via Meta Business API
    // This requires WhatsApp Business Account and phone number ID
    const response = await fetch(
      `https://graph.instagram.com/v18.0/${waAccountId}/messages`,
      {
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
      }
    )

    const result = await response.json()

    if (!response.ok) {
      console.error('WhatsApp API error:', result)
      return new Response(
        JSON.stringify({
          error: 'Failed to send WhatsApp message',
          details: result
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messages?.[0]?.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in send-whatsapp-notification:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
