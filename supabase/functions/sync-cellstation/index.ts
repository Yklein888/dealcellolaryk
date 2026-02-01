import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DOMParser, Element as DOMElement } from 'https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SimCard {
  local_number: string | null;
  israeli_number: string | null;
  sim_number: string | null;
  expiry_date: string | null;
  is_rented: boolean;
  status: string;
  package_name: string | null;
  notes: string | null;
}

async function loginToCellStation(username: string, password: string): Promise<string | null> {
  console.log('Attempting to login to CellStation...');
  
  const loginUrl = 'https://cellstation.co.il/portal/login.php';
  
  try {
    // First, get the login page to obtain any CSRF tokens or session cookies
    const initialResponse = await fetch(loginUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    // Get cookies from initial response
    const initialCookies = initialResponse.headers.get('set-cookie') || '';
    console.log('Initial cookies received:', initialCookies ? 'Yes' : 'No');
    
    // Prepare login form data
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('login', '1'); // Common hidden field
    
    // Attempt login
    const loginResponse = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': initialCookies,
        'Referer': loginUrl,
      },
      body: formData.toString(),
      redirect: 'manual',
    });
    
    // Get session cookies from login response
    const sessionCookies = loginResponse.headers.get('set-cookie') || initialCookies;
    console.log('Login response status:', loginResponse.status);
    console.log('Session cookies received:', sessionCookies ? 'Yes' : 'No');
    
    // Check if login was successful (usually redirects to dashboard)
    if (loginResponse.status === 302 || loginResponse.status === 200) {
      return sessionCookies;
    }
    
    return null;
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}

async function fetchSimList(sessionCookies: string): Promise<SimCard[]> {
  console.log('Fetching SIM list...');
  
  // Common portal pages that might contain SIM data
  const possiblePages = [
    'https://cellstation.co.il/portal/sims.php',
    'https://cellstation.co.il/portal/my_sims.php',
    'https://cellstation.co.il/portal/dashboard.php',
    'https://cellstation.co.il/portal/index.php',
  ];
  
  for (const pageUrl of possiblePages) {
    try {
      console.log('Trying page:', pageUrl);
      
      const response = await fetch(pageUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cookie': sessionCookies,
        },
      });
      
      if (response.status !== 200) {
        console.log('Page not accessible:', response.status);
        continue;
      }
      
      const html = await response.text();
      console.log('Received HTML length:', html.length);
      
      // Try to parse the HTML and extract SIM data
      const sims = parseSimData(html);
      
      if (sims.length > 0) {
        console.log('Found', sims.length, 'SIMs on page:', pageUrl);
        return sims;
      }
    } catch (error) {
      console.error('Error fetching page:', pageUrl, error);
    }
  }
  
  return [];
}

function parseSimData(html: string): SimCard[] {
  const sims: SimCard[] = [];
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    if (!doc) {
      console.log('Failed to parse HTML');
      return sims;
    }
    
    // Try to find tables that might contain SIM data
    const tables = doc.querySelectorAll('table');
    console.log('Found', tables.length, 'tables');
    
    for (const table of tables) {
      const rows = (table as DOMElement).querySelectorAll('tr');
      
      for (let i = 1; i < rows.length; i++) { // Skip header row
        const cells = (rows[i] as DOMElement).querySelectorAll('td');
        const cellsArray = Array.from(cells) as DOMElement[];
        
        if (cellsArray.length >= 3) {
          // Try to extract SIM data from cells
          const sim: SimCard = {
            local_number: extractPhoneNumber(cellsArray[0]?.textContent || ''),
            israeli_number: extractPhoneNumber(cellsArray[1]?.textContent || ''),
            sim_number: extractSimNumber(cellsArray),
            expiry_date: extractDate(cellsArray),
            is_rented: checkIfRented(cellsArray),
            status: extractStatus(cellsArray),
            package_name: extractPackage(cellsArray),
            notes: null,
          };
          
          // Only add if we have at least one valid field
          if (sim.local_number || sim.israeli_number || sim.sim_number) {
            sims.push(sim);
          }
        }
      }
    }
    
    // Also try to find data in div/span elements with specific classes
    const simElements = doc.querySelectorAll('.sim-card, .sim-row, .sim-item, [data-sim]');
    console.log('Found', simElements.length, 'SIM elements');
    
    for (const element of simElements) {
      const text = (element as DOMElement).textContent || '';
      const sim = parseSimFromText(text);
      if (sim) {
        sims.push(sim);
      }
    }
    
  } catch (error) {
    console.error('Error parsing HTML:', error);
  }
  
  return sims;
}

function extractPhoneNumber(text: string): string | null {
  // Match various phone number formats
  const phoneMatch = text.match(/[\d\-\+\(\)\s]{7,20}/);
  if (phoneMatch) {
    const cleaned = phoneMatch[0].replace(/[^\d\+]/g, '');
    if (cleaned.length >= 7) {
      return cleaned;
    }
  }
  return null;
}

function extractSimNumber(cells: DOMElement[]): string | null {
  for (const cell of cells) {
    const text = cell.textContent || '';
    // ICCID is typically 18-22 digits
    const iccidMatch = text.match(/\d{18,22}/);
    if (iccidMatch) {
      return iccidMatch[0];
    }
  }
  return null;
}

function extractDate(cells: DOMElement[]): string | null {
  for (const cell of cells) {
    const text = cell.textContent || '';
    // Try various date formats
    const datePatterns = [
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,  // DD/MM/YYYY or MM/DD/YYYY
      /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,    // YYYY-MM-DD
    ];
    
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          const date = new Date(text);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        } catch {
          // Continue trying other patterns
        }
      }
    }
  }
  return null;
}

function checkIfRented(cells: DOMElement[]): boolean {
  for (const cell of cells) {
    const text = (cell.textContent || '').toLowerCase();
    if (text.includes('rented') || text.includes('בהשכרה') || text.includes('מושכר')) {
      return true;
    }
  }
  return false;
}

function extractStatus(cells: DOMElement[]): string {
  for (const cell of cells) {
    const text = (cell.textContent || '').toLowerCase();
    if (text.includes('active') || text.includes('פעיל')) return 'active';
    if (text.includes('rented') || text.includes('בהשכרה')) return 'rented';
    if (text.includes('expired') || text.includes('פג')) return 'expired';
    if (text.includes('inactive') || text.includes('לא פעיל')) return 'inactive';
  }
  return 'available';
}

function extractPackage(cells: DOMElement[]): string | null {
  for (const cell of cells) {
    const text = cell.textContent || '';
    // Look for package-related keywords
    if (text.includes('GB') || text.includes('ג\'יגה') || text.includes('חבילה')) {
      return text.trim();
    }
  }
  return null;
}

function parseSimFromText(text: string): SimCard | null {
  const localMatch = text.match(/local[:\s]+([+\d\-]+)/i);
  const israeliMatch = text.match(/israel[i]?[:\s]+([+\d\-]+)/i);
  const iccidMatch = text.match(/(?:iccid|sim)[:\s]*(\d{18,22})/i);
  
  if (localMatch || israeliMatch || iccidMatch) {
    return {
      local_number: localMatch ? localMatch[1] : null,
      israeli_number: israeliMatch ? israeliMatch[1] : null,
      sim_number: iccidMatch ? iccidMatch[1] : null,
      expiry_date: null,
      is_rented: text.toLowerCase().includes('rented') || text.includes('בהשכרה'),
      status: 'available',
      package_name: null,
      notes: null,
    };
  }
  
  return null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get credentials from environment
    const username = Deno.env.get('CELLSTATION_USERNAME');
    const password = Deno.env.get('CELLSTATION_PASSWORD');
    
    if (!username || !password) {
      console.error('Missing CellStation credentials');
      return new Response(
        JSON.stringify({ success: false, error: 'CellStation credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Starting CellStation sync...');
    
    // Login to CellStation
    const sessionCookies = await loginToCellStation(username, password);
    
    if (!sessionCookies) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to login to CellStation' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Login successful, fetching SIMs...');
    
    // Fetch SIM data
    const sims = await fetchSimList(sessionCookies);
    
    console.log('Fetched', sims.length, 'SIMs');
    
    // Connect to Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Delete existing records
    const { error: deleteError } = await supabase
      .from('sim_cards')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (deleteError) {
      console.error('Error deleting old records:', deleteError);
    }
    
    // Insert new records
    if (sims.length > 0) {
      const simsWithTimestamp = sims.map(sim => ({
        ...sim,
        last_synced: new Date().toISOString(),
      }));
      
      const { error: insertError } = await supabase
        .from('sim_cards')
        .insert(simsWithTimestamp);
      
      if (insertError) {
        console.error('Error inserting SIMs:', insertError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to save SIMs: ' + insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        count: sims.length,
        message: `Successfully synced ${sims.length} SIMs` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (err: unknown) {
    console.error('Sync error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
