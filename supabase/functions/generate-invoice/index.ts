import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvoiceRequest {
  customerId?: string;
  customerName: string;
  rentalId?: string;
  transactionId?: string;
  amount: number;
  currency: string;
  description?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: InvoiceRequest = await req.json();
    const { customerId, customerName, rentalId, transactionId, amount, currency, description } = body;

    console.log("Creating invoice for:", customerName, "Amount:", amount, currency);

    // Insert invoice into database
    const { data: invoice, error: insertError } = await supabase
      .from("invoices")
      .insert({
        customer_id: customerId || null,
        customer_name: customerName,
        rental_id: rentalId || null,
        transaction_id: transactionId || null,
        amount,
        currency: currency || "ILS",
        description: description || "חיוב",
        business_name: "דיל סלולר",
        business_id: "201512258",
        status: "issued",
        issued_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating invoice:", insertError);
      throw new Error(`Failed to create invoice: ${insertError.message}`);
    }

    console.log("Invoice created successfully:", invoice.id, "Number:", invoice.invoice_number);

    return new Response(
      JSON.stringify({
        success: true,
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoice_number,
          amount: invoice.amount,
          currency: invoice.currency,
          issuedAt: invoice.issued_at,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error in generate-invoice:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
