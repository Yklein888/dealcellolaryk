import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logs: string[] = [];
  const log = (msg: string) => { logs.push(msg); console.log(msg); };

  try {
    log('🚀 התחלת סנכרון CellStation');
    
    // קריאת secrets
    const username = Deno.env.get('CELLSTATION_USERNAME');
    const password = Deno.env.get('CELLSTATION_PASSWORD');
    const scraperUrl = Deno.env.get('SCRAPER_URL');
    
    if (!username || !password) {
      throw new Error('Missing CellStation credentials');
    }
    
    if (!scraperUrl) {
      throw new Error('SCRAPER_URL not configured');
    }
    
    log(`📡 קורא לשרת Puppeteer: ${scraperUrl}`);
    
    // קריאה לשרת Render
    const response = await fetch(`${scraperUrl}/scrape-cellstation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Scraper error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Scraping failed');
    }
    
    const sims = data.sims || [];
    log(`✅ התקבלו ${sims.length} סימים מהשרת`);
    
    // התחברות ל-Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // מחיקת רשומות קיימות
    log('🗑️ מוחק רשומות קיימות...');
    await supabase
      .from('sim_cards')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    // הוספת רשומות חדשות
    if (sims.length > 0) {
      const simsWithTimestamp = sims.map((sim: any) => ({
        ...sim,
        last_synced: new Date().toISOString(),
      }));
      
      log('💾 שומר סימים חדשים...');
      const { error: insertError } = await supabase
        .from('sim_cards')
        .insert(simsWithTimestamp);
      
      if (insertError) {
        log(`❌ שגיאה בהוספה: ${insertError.message}`);
        throw insertError;
      }
    }
    
    log('🎉 סנכרון הושלם!');
    
    return new Response(
      JSON.stringify({ success: true, count: sims.length, logs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    log(`❌ שגיאה: ${errorMessage}`);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, logs }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
