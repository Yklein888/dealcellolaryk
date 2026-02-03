import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GOOGLE_URL = 'https://script.google.com/macros/s/AKfycbw5Zv5OWnH8UI0dCzfBR37maMDRf0NwIsX8PxREugD5lSSLKC2KYx9P72c0qQkb-TpA/exec';

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

    console.log(`✅ התקבלו ${services.length} סימים`);

    let updated = 0;
    let inserted = 0;

    for (const item of services) {
      const simNumber = String(item.sim || '').trim();
      if (!simNumber) continue;

      // Check if exists
      const { data: existing } = await supabase
        .from('sim_cards')
        .select('id')
        .eq('sim_number', simNumber)
        .maybeSingle();

      const simData = {
        sim_number: simNumber,
        // Swapped: israel_number from source contains local numbers (7225...)
        // and local_number from source contains Israeli numbers (44...)
        local_number: item.israel_number ? String(item.israel_number).trim() : null,
        israeli_number: item.local_number ? String(item.local_number).trim() : null,
        package_name: item.plan ? String(item.plan).trim() : null,
        expiry_date: parseExpiryDate(String(item.expiry || '')),
        is_active: String(item.status || '').toLowerCase() === 'active',
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

    console.log(`🎉 סנכרון הושלם: ${updated} עודכנו, ${inserted} נוספו`);

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        inserted,
        total: services.length,
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
