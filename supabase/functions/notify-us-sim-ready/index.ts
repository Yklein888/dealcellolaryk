import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const simManagerUrl = Deno.env.get("SIM_MANAGER_SUPABASE_URL");
const simManagerKey = Deno.env.get("SIM_MANAGER_SUPABASE_KEY");

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
const simManagerSupabase = createClient(simManagerUrl!, simManagerKey!);

interface USSimUpdate {
  id: string;
  localNumber?: string;
  israeliNumber?: string;
  simCompany?: string;
  status?: string;
}

async function notifyCustomerUSSimReady(
  customerId: string,
  customerName: string,
  customerPhone: string,
  simName: string,
  localNumber?: string,
  israeliNumber?: string
) {
  try {
    // Call WhatsApp notification endpoint if numbers are ready
    if ((localNumber || israeliNumber) && customerPhone) {
      const message = `
🎉 סימך מוכן!
SIM: ${simName}
מספר ישראלי: ${israeliNumber || "ממתין"}
מספר מקומי: ${localNumber || "ממתין"}

✅ ניתן להשתמש בסים כעת
      `.trim();

      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerPhone,
          message,
          entityType: "rental",
          customerId,
        }),
      }).catch(err => console.log("WhatsApp notification skipped:", err.message));
    }

    // Store notification in database
    await supabase
      .from("notifications")
      .insert({
        customer_id: customerId,
        type: "sim_ready",
        title: "סימך מוכן!",
        message: `${simName} עם מספרים מוכן להשתמוש`,
        data: {
          simName,
          localNumber,
          israeliNumber,
        },
        read: false,
      })
      .throwOnError();

  } catch (error) {
    console.error("Error notifying customer:", error);
  }
}

async function checkAndNotifyUSSimUpdates() {
  try {
    // Get all active US SIM rentals from main project
    const { data: rentals } = await supabase
      .from("rentals")
      .select("*")
      .eq("status", "active");

    if (!rentals) return;

    // Get all rental items for these rentals
    const { data: rentalItems } = await supabase
      .from("rental_items")
      .select("*")
      .in("rental_id", rentals.map(r => r.id));

    if (!rentalItems) return;

    // Filter to only US SIM items
    const usSimItems = rentalItems.filter(item =>
      item.item_category === "sim_american" &&
      item.item_name?.includes("[us-sim-")
    );

    if (usSimItems.length === 0) return;

    // For each US SIM item, check if numbers are now available
    for (const item of usSimItems) {
      // Extract virtual SIM ID from item_name
      const match = item.item_name.match(/\[(us-sim-[^\]]+)\]/);
      if (!match) continue;

      const virtualSimId = match[1];
      const realSimId = virtualSimId.replace("us-sim-", "");

      // Get the US SIM data from sim-manager project
      const { data: usim } = await simManagerSupabase
        .from("us_sims")
        .select("*")
        .eq("id", realSimId)
        .single();

      if (!usim) continue;

      // Check if numbers are available and not already notified
      const hasNumbers = usim.local_number || usim.israeli_number;
      const wasNotified = item.item_name.includes("✓ NUMBERS READY");

      if (hasNumbers && !wasNotified) {
        // Get the rental to find customer info
        const rental = rentals.find(r => r.id === item.rental_id);
        if (!rental) continue;

        // Get customer details
        const { data: customer } = await supabase
          .from("customers")
          .select("*")
          .eq("id", rental.customer_id)
          .single();

        if (!customer) continue;

        // Notify customer
        await notifyCustomerUSSimReady(
          customer.id,
          customer.name,
          customer.phone,
          item.item_name.replace(/\[(us-sim-[^\]]+)\]\s*/, ""),
          usim.local_number,
          usim.israeli_number
        );

        // Mark in item_name that notification was sent
        await supabase
          .from("rental_items")
          .update({
            item_name: `${item.item_name} ✓ NUMBERS READY`,
          })
          .eq("rental_id", item.rental_id)
          .eq("inventory_item_id", item.inventory_item_id);
      }
    }
  } catch (error) {
    console.error("Error in checkAndNotifyUSSimUpdates:", error);
  }
}

serve(async (req) => {
  // This function can be called via webhook or scheduled
  const { action } = await req.json().catch(() => ({}));

  if (action === "check-updates") {
    await checkAndNotifyUSSimUpdates();
    return new Response(
      JSON.stringify({ success: true, message: "Checked US SIM updates" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: false, message: "Invalid action" }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
});
