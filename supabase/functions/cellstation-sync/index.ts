import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyxjoYYqxkjPI059oPtQZpjtHAnpFNzkzcmlROwdDkBl89ucsXX1qEh8qaoC4xHl3Sa/exec';

interface ServiceItem {
  sim: string;
  local_number: string;
  israel_number: string;
  plan: string;
  expiry: string;
  status: string;
}

interface ApiResponse {
  services: ServiceItem[];
}

function parseExpiryDate(expiry: string): string | null {
  if (!expiry) return null;
  
  // Try to parse various date formats
  // Expected format from API might be "DD/MM/YYYY" or "YYYY-MM-DD"
  const parts = expiry.split('/');
  if (parts.length === 3) {
    // DD/MM/YYYY format
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // If already in YYYY-MM-DD format or other standard format
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
    console.log('🚀 התחלת סנכרון CellStation מ-Google Apps Script');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch data from Google Apps Script (with redirect support)
    console.log('📡 מושך נתונים מ-Google Apps Script...');
    
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'Supabase Edge Function'
      },
      redirect: 'follow', // Explicitly follow redirects (default in Deno, but being explicit)
    });
    
    console.log(`📡 Response status: ${response.status}, URL: ${response.url}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error response:', errorText.substring(0, 500));
      throw new Error(`Google Apps Script error: ${response.status} - ${response.statusText}`);
    }

    const responseText = await response.text();
    console.log('📄 Raw response (first 500 chars):', responseText.substring(0, 500));
    
    let data: ApiResponse;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse JSON:', parseError);
      throw new Error(`Invalid JSON response from API: ${responseText.substring(0, 200)}`);
    }
    
    if (!data.services || !Array.isArray(data.services)) {
      console.error('❌ Response structure:', JSON.stringify(data).substring(0, 500));
      throw new Error('Invalid response format: missing services array');
    }

    console.log(`✅ התקבלו ${data.services.length} סימים מה-API`);

    let updated = 0;
    let inserted = 0;

    // Process each SIM
    for (const service of data.services) {
      const simNumber = service.sim?.trim();
      
      if (!simNumber) {
        console.log('⚠️ דילוג על רשומה ללא מספר SIM');
        continue;
      }

      const simData = {
        sim_number: simNumber,
        local_number: service.local_number?.trim() || null,
        israeli_number: service.israel_number?.trim() || null,
        package_name: service.plan?.trim() || null,
        expiry_date: parseExpiryDate(service.expiry),
        is_active: service.status?.toLowerCase() === 'active',
        last_synced: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Check if SIM exists
      const { data: existingSim, error: selectError } = await supabase
        .from('sim_cards')
        .select('id')
        .eq('sim_number', simNumber)
        .maybeSingle();

      if (selectError) {
        console.error(`❌ שגיאה בחיפוש סים ${simNumber}:`, selectError.message);
        continue;
      }

      if (existingSim) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('sim_cards')
          .update(simData)
          .eq('id', existingSim.id);

        if (updateError) {
          console.error(`❌ שגיאה בעדכון סים ${simNumber}:`, updateError.message);
        } else {
          updated++;
        }
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('sim_cards')
          .insert({
            ...simData,
            created_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error(`❌ שגיאה בהוספת סים ${simNumber}:`, insertError.message);
        } else {
          inserted++;
        }
      }
    }

    console.log(`🎉 סנכרון הושלם: ${updated} עודכנו, ${inserted} נוספו`);

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        inserted,
        total: data.services.length,
        message: `${updated} סימים עודכנו, ${inserted} סימים נוספו`,
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
