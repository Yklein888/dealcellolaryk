import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GOOGLE_URL = 'https://script.google.com/macros/s/AKfycbx7HRL6ythPzBINoQDir2PreXod3FNtQJJwfrev3z84xQb-84X8-PHPwb1XFzc750j5/exec';

function parseExpiryDate(expiry: string): string | null {
  if (!expiry) return null;
  const parts = expiry.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const date = new Date(expiry);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  return null;
}

// Normalize number for consistent matching
function normalizeNumber(value: string | null | undefined): string {
  if (!value) return '';
  let str = String(value).replace(/[-\s]/g, '').toLowerCase();
  // Remove leading zero from Israeli numbers
  if (str.startsWith('0722') || str.startsWith('0752')) {
    str = str.substring(1);
  }
  // Remove 44 prefix from UK numbers
  if (str.startsWith('44') && str.length > 10) {
    str = str.substring(2);
  }
  return str;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('🚀 מתחיל סנכרון מ-Google Apps Script...');

    const response = await fetch(GOOGLE_URL, { redirect: 'follow' });
    
    const responseText = await response.text();
    console.log('📡 Response status:', response.status, 'Content-Type:', response.headers.get('content-type'));
    console.log('📡 Response preview:', responseText.substring(0, 300));

    if (!response.ok) {
      throw new Error(`Google Apps Script error: ${response.status} - ${responseText.substring(0, 200)}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html') || responseText.trimStart().startsWith('<')) {
      throw new Error(`Google Apps Script returned HTML instead of JSON. The script URL may be invalid or the script has an error. Preview: ${responseText.substring(0, 200)}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      throw new Error(`Failed to parse response as JSON: ${responseText.substring(0, 200)}`);
    }
    const services = data.services || [];
    const rentals = data.rentals || [];

    console.log(`✅ התקבלו ${services.length} סימים מ-services ו-${rentals.length} השכרות מ-rentals`);

    let updated = 0;
    let inserted = 0;
    const processedSims = new Set<string>();

    // Process services (available SIMs)
    for (const item of services) {
      const simNumber = String(item.sim || '').trim();
      if (!simNumber) continue;
      processedSims.add(simNumber);

      // Check if exists by sim_number
      const { data: existing } = await supabase
        .from('sim_cards')
        .select('id')
        .eq('sim_number', simNumber)
        .maybeSingle();

      // IMPORTANT: Field mapping from Google Script is SWAPPED
      // item.local_number = Israeli number (722587xxx)
      // item.israel_number = UK number (447429xxx)
      const simData = {
        sim_number: simNumber,
        israeli_number: item.local_number ? String(item.local_number).trim() : null,
        local_number: item.israel_number ? String(item.israel_number).trim() : null,
        package_name: item.plan ? String(item.plan).trim() : null,
        expiry_date: parseExpiryDate(String(item.expiry || '')),
        is_active: String(item.status || '').toLowerCase() === 'active',
        is_rented: false, // In services = available
        last_synced: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from('sim_cards').update(simData).eq('id', existing.id);
        updated++;
      } else {
        await supabase.from('sim_cards').insert({ ...simData, created_at: new Date().toISOString() });
        inserted++;
      }
    }

    // Process rentals (rented SIMs)
    for (const rental of rentals) {
      const simNumber = String(rental.sim || '').trim();
      if (!simNumber || processedSims.has(simNumber)) continue;
      processedSims.add(simNumber);

      const { data: existing } = await supabase
        .from('sim_cards')
        .select('id')
        .eq('sim_number', simNumber)
        .maybeSingle();

      // IMPORTANT: Same swapped mapping for rentals
      // rental.local_number = Israeli number
      // rental.israel_number = UK number
      const simData = {
        sim_number: simNumber,
        israeli_number: rental.local_number ? String(rental.local_number).trim() : null,
        local_number: rental.israel_number ? String(rental.israel_number).trim() : null,
        package_name: rental.plan ? String(rental.plan).trim() : null,
        expiry_date: null, // Rentals don't have expiry in the same format
        is_active: true,
        is_rented: true, // In rentals = currently rented
        last_synced: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from('sim_cards').update(simData).eq('id', existing.id);
        updated++;
      } else {
        await supabase.from('sim_cards').insert({ ...simData, created_at: new Date().toISOString() });
        inserted++;
      }
    }

    // Cross-reference with inventory and rentals
    console.log('🔄 מצליב נתונים עם המלאי וההשכרות...');
    
    // Get all inventory items that are SIMs (european/american) with their rental status
    const { data: inventoryItems } = await supabase
      .from('inventory')
      .select('id, sim_number, israeli_number, local_number, status')
      .in('category', ['sim_european', 'sim_american']);

    // Get all active rentals with their items
    const { data: activeRentals } = await supabase
      .from('rentals')
      .select('id, customer_id, customer_name, status, rental_items(inventory_item_id)')
      .in('status', ['active', 'overdue']);

    // Build a map: inventory_item_id -> rental info
    const rentalMap = new Map<string, { rentalId: string; customerId: string | null; customerName: string }>();
    if (activeRentals) {
      for (const rental of activeRentals) {
        const items = (rental as any).rental_items || [];
        for (const item of items) {
          if (item.inventory_item_id) {
            rentalMap.set(item.inventory_item_id, {
              rentalId: rental.id,
              customerId: rental.customer_id,
              customerName: rental.customer_name,
            });
          }
        }
      }
    }

    // Build a map: normalized number / sim_number -> inventory item
    const invBySim = new Map<string, any>();
    const invByIsraeli = new Map<string, any>();
    if (inventoryItems) {
      for (const inv of inventoryItems) {
        if (inv.sim_number) invBySim.set(normalizeNumber(inv.sim_number), inv);
        if (inv.israeli_number) invByIsraeli.set(normalizeNumber(inv.israeli_number), inv);
      }
    }

    // Now update sim_cards with cross-referenced data
    let crossUpdated = 0;
    const { data: allSimCards } = await supabase.from('sim_cards').select('id, sim_number, israeli_number');
    
    if (allSimCards) {
      for (const sim of allSimCards) {
        // Find matching inventory item
        const normSim = normalizeNumber(sim.sim_number);
        const normIsraeli = normalizeNumber(sim.israeli_number);
        const inv = (normSim && invBySim.get(normSim)) || (normIsraeli && invByIsraeli.get(normIsraeli));
        
        if (inv) {
          const rental = rentalMap.get(inv.id);
          const updateData: any = {
            is_rented: inv.status === 'rented',
          };
          if (rental) {
            updateData.linked_rental_id = rental.rentalId;
            updateData.linked_customer_id = rental.customerId;
          } else {
            updateData.linked_rental_id = null;
            updateData.linked_customer_id = null;
          }
          
          await supabase.from('sim_cards').update(updateData).eq('id', sim.id);
          crossUpdated++;
        }
      }
    }

    console.log(`🎉 סנכרון הושלם: ${updated} עודכנו, ${inserted} נוספו, ${crossUpdated} הוצלבו (סה"כ ${processedSims.size} סימים)`);

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        inserted,
        crossReferenced: crossUpdated,
        total: processedSims.size,
        message: `${updated} סימים עודכנו, ${inserted} סימים נוספו, ${crossUpdated} הוצלבו עם המלאי`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('❌ שגיאה:', err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
