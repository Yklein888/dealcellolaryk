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
    
    if (!response.ok) {
      throw new Error(`Google Apps Script error: ${response.status}`);
    }

    const data = await response.json();
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

    console.log(`🎉 סנכרון הושלם: ${updated} עודכנו, ${inserted} נוספו (סה"כ ${processedSims.size} סימים)`);

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        inserted,
        total: processedSims.size,
        message: `${updated} סימים עודכנו, ${inserted} סימים נוספו`,
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
