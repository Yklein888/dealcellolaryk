import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🚀 התחלת סנכרון CellStation');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const CELLSTATION_USERNAME = Deno.env.get('CELLSTATION_USERNAME')!;
    const CELLSTATION_PASSWORD = Deno.env.get('CELLSTATION_PASSWORD')!;
    const SCRAPER_URL = Deno.env.get('SCRAPER_URL')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('📡 קורא לשרת Puppeteer...');
    
    const response = await fetch(`${SCRAPER_URL}/scrape-cellstation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: CELLSTATION_USERNAME,
        password: CELLSTATION_PASSWORD
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Scraper error: ${response.status} - ${errorText}`);
    }

    const { success, sims, error } = await response.json();

    if (!success) {
      throw new Error(error || 'Scraping failed');
    }

    console.log(`✅ התקבלו ${sims.length} סימים`);

    console.log('🗑️ מוחק רשומות ישנות...');
    await supabase
      .from('sim_cards')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (sims.length > 0) {
      const simsWithTimestamp = sims.map((sim: any) => ({
        ...sim,
        last_synced: new Date().toISOString(),
      }));

      console.log('💾 שומר סימים חדשים...');
      const { error: insertError } = await supabase
        .from('sim_cards')
        .insert(simsWithTimestamp);

      if (insertError) throw insertError;
    }

    console.log('🎉 סנכרון הושלם בהצלחה!');

    return new Response(
      JSON.stringify({
        success: true,
        count: sims.length,
        message: `${sims.length} סימים סונכרנו בהצלחה`,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (err: any) {
    console.error('❌ שגיאה:', err.message);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
