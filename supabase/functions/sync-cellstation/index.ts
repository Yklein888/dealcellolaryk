import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DOMParser, Element as DOMElement } from 'https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SimCard {
  short_number: string | null;
  local_number: string | null;
  israeli_number: string | null;
  sim_number: string | null;
  expiry_date: string | null;
  is_active: boolean;
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    
    // Get cookies from initial response
    const initialCookies = initialResponse.headers.get('set-cookie') || '';
    console.log('Initial cookies received:', initialCookies ? 'Yes' : 'No');
    
    // Parse cookie for session ID
    const cookieMatch = initialCookies.match(/PHPSESSID=([^;]+)/);
    const sessionCookie = cookieMatch ? `PHPSESSID=${cookieMatch[1]}` : initialCookies.split(';')[0];
    
    // Prepare login form data
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('login', '1');
    
    // Attempt login
    const loginResponse = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': sessionCookie,
        'Referer': loginUrl,
        'Origin': 'https://cellstation.co.il',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
      body: formData.toString(),
      redirect: 'manual',
    });
    
    // Get session cookies from login response
    const newCookies = loginResponse.headers.get('set-cookie') || '';
    const finalCookies = newCookies || sessionCookie;
    
    console.log('Login response status:', loginResponse.status);
    console.log('New cookies received:', newCookies ? 'Yes' : 'No');
    
    // Check if login was successful
    if (loginResponse.status === 302 || loginResponse.status === 200) {
      // Get the redirect location or response body to verify login
      const responseBody = await loginResponse.text();
      console.log('Response body length:', responseBody.length);
      
      // If we get a redirect or the response doesn't contain login form, we're logged in
      if (loginResponse.status === 302 || !responseBody.includes('login.php') || responseBody.includes('logout')) {
        console.log('Login appears successful');
        return finalCookies;
      }
    }
    
    console.log('Login may have failed - checking response...');
    return finalCookies; // Try anyway
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}

async function fetchSimList(sessionCookies: string): Promise<SimCard[]> {
  console.log('Fetching SIM list...');
  
  // Try different portal pages that might contain SIM data
  const possiblePages = [
    'https://cellstation.co.il/portal/sims.php',
    'https://cellstation.co.il/portal/my_sims.php',
    'https://cellstation.co.il/portal/dashboard.php',
    'https://cellstation.co.il/portal/index.php',
    'https://cellstation.co.il/portal/',
  ];
  
  for (const pageUrl of possiblePages) {
    try {
      console.log('Trying page:', pageUrl);
      
      const response = await fetch(pageUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cookie': sessionCookies,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });
      
      if (response.status !== 200) {
        console.log('Page not accessible:', response.status);
        continue;
      }
      
      const html = await response.text();
      console.log('Received HTML length:', html.length);
      
      // Log a sample of the HTML for debugging
      if (html.includes('div') && html.includes('card')) {
        console.log('Found div and card keywords in HTML');
      }
      
      // Check if we're actually logged in
      if (html.includes('login.php') && html.includes('password')) {
        console.log('Still on login page, authentication may have failed');
        continue;
      }
      
      // Try to parse the HTML and extract SIM data using div.card structure
      const sims = parseSimCards(html);
      
      if (sims.length > 0) {
        console.log('Found', sims.length, 'SIMs on page:', pageUrl);
        return sims;
      }
      
      console.log('No SIMs found on this page, trying next...');
    } catch (error) {
      console.error('Error fetching page:', pageUrl, error);
    }
  }
  
  return [];
}

function parseSimCards(html: string): SimCard[] {
  const sims: SimCard[] = [];
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    if (!doc) {
      console.log('Failed to parse HTML');
      return sims;
    }
    
    // Find all div.card elements (SIM cards)
    const cards = doc.querySelectorAll('div.card');
    console.log('Found', cards.length, 'div.card elements');
    
    // Also try other common selectors
    const altCards = doc.querySelectorAll('.card, .sim-card, .sim-item, [class*="card"]');
    console.log('Found', altCards.length, 'alternative card elements');
    
    const allCards = cards.length > 0 ? cards : altCards;
    
    for (const card of allCards) {
      const cardElement = card as DOMElement;
      const sim = parseCardElement(cardElement);
      if (sim) {
        sims.push(sim);
      }
    }
    
    // If no cards found, try to find any structure with phone numbers
    if (sims.length === 0) {
      console.log('No cards found, trying alternative parsing...');
      const altSims = parseAlternativeStructure(doc);
      if (altSims.length > 0) {
        return altSims;
      }
    }
    
  } catch (error) {
    console.error('Error parsing HTML:', error);
  }
  
  return sims;
}

function parseCardElement(card: DOMElement): SimCard | null {
  try {
    const cardHtml = card.outerHTML || '';
    const cardText = card.textContent || '';
    
    // Extract short number from p.pstyle
    const pstyleElement = card.querySelector('p.pstyle, .pstyle');
    const shortNumber = pstyleElement?.textContent?.trim() || null;
    
    // Extract package name from p.plan
    const planElement = card.querySelector('p.plan, .plan');
    const packageName = planElement?.textContent?.trim() || null;
    
    // Extract the three numbers (local, israeli, ICCID)
    // They appear as 3 lines of numbers in the card
    const numberMatches = cardText.match(/\d{10,20}/g) || [];
    
    let localNumber: string | null = null;
    let israeliNumber: string | null = null;
    let simNumber: string | null = null;
    
    // ICCID is typically 18-20 digits
    const iccidMatch = numberMatches.find(n => n.length >= 18);
    if (iccidMatch) {
      simNumber = iccidMatch;
    }
    
    // Israeli number starts with 07 or 05 (10 digits)
    const israeliMatch = numberMatches.find(n => n.length === 10 && (n.startsWith('07') || n.startsWith('05')));
    if (israeliMatch) {
      israeliNumber = israeliMatch;
    }
    
    // Local number is the remaining 10-12 digit number (not Israeli, not ICCID)
    const localMatch = numberMatches.find(n => 
      n.length >= 10 && n.length <= 12 && 
      n !== israeliNumber && 
      n !== simNumber
    );
    if (localMatch) {
      localNumber = localMatch;
    }
    
    // Extract expiry date - look for "תוקף התכנית" followed by date
    const expiryMatch = cardText.match(/תוקף\s*(?:התכנית)?\s*(\d{4}-\d{2}-\d{2}|\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
    let expiryDate: string | null = null;
    if (expiryMatch) {
      expiryDate = normalizeDate(expiryMatch[1]);
    }
    
    // Check if active based on background color (green = active, red = inactive)
    const style = card.getAttribute('style') || '';
    const className = card.getAttribute('class') || '';
    const isActive = !cardHtml.includes('red') && 
                     !className.includes('inactive') && 
                     !className.includes('expired') &&
                     !style.includes('red');
    
    // Only add if we have at least one meaningful field
    if (shortNumber || localNumber || israeliNumber || simNumber) {
      console.log('Parsed SIM card:', { shortNumber, localNumber, israeliNumber, simNumber, packageName, expiryDate, isActive });
      
      return {
        short_number: shortNumber,
        local_number: localNumber,
        israeli_number: israeliNumber,
        sim_number: simNumber,
        expiry_date: expiryDate,
        is_active: isActive,
        is_rented: !isActive,
        status: isActive ? 'active' : 'expired',
        package_name: packageName,
        notes: null,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing card element:', error);
    return null;
  }
}

function parseAlternativeStructure(doc: ReturnType<DOMParser['parseFromString']>): SimCard[] {
  const sims: SimCard[] = [];
  
  if (!doc) return sims;
  
  // Try to find any elements containing phone numbers
  const allElements = doc.querySelectorAll('*');
  const potentialContainers: DOMElement[] = [];
  
  for (const el of allElements) {
    const element = el as DOMElement;
    const text = element.textContent || '';
    
    // Look for elements that contain multiple phone numbers (likely SIM cards)
    const phoneMatches = text.match(/\d{10,20}/g);
    if (phoneMatches && phoneMatches.length >= 2) {
      // Check if this is a leaf-ish container (not too many children)
      const children = element.querySelectorAll('*');
      if (children.length < 20) {
        potentialContainers.push(element);
      }
    }
  }
  
  console.log('Found', potentialContainers.length, 'potential SIM containers');
  
  // Process unique containers (avoid duplicates from parent/child)
  const processed = new Set<string>();
  
  for (const container of potentialContainers) {
    const text = container.textContent || '';
    if (processed.has(text)) continue;
    processed.add(text);
    
    const sim = extractSimFromText(text);
    if (sim) {
      sims.push(sim);
    }
  }
  
  return sims;
}

function extractSimFromText(text: string): SimCard | null {
  const numberMatches = text.match(/\d{10,20}/g) || [];
  
  if (numberMatches.length < 2) return null;
  
  let localNumber: string | null = null;
  let israeliNumber: string | null = null;
  let simNumber: string | null = null;
  
  for (const num of numberMatches) {
    if (num.length >= 18) {
      simNumber = num;
    } else if (num.length === 10 && (num.startsWith('07') || num.startsWith('05'))) {
      israeliNumber = num;
    } else if (num.length >= 10 && num.length <= 12 && !localNumber) {
      localNumber = num;
    }
  }
  
  // Extract short number (6 digits typically)
  const shortMatch = text.match(/\b(\d{6})\b/);
  const shortNumber = shortMatch ? shortMatch[1] : null;
  
  // Extract expiry date
  const expiryMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  const expiryDate = expiryMatch ? expiryMatch[1] : null;
  
  // Extract package name
  const packageMatch = text.match(/(\d+\s*גיגה?\s*(?:גלישה)?)/i);
  const packageName = packageMatch ? packageMatch[1] : null;
  
  if (localNumber || israeliNumber || simNumber) {
    return {
      short_number: shortNumber,
      local_number: localNumber,
      israeli_number: israeliNumber,
      sim_number: simNumber,
      expiry_date: expiryDate,
      is_active: !text.includes('פג') && !text.toLowerCase().includes('expired'),
      is_rented: false,
      status: 'available',
      package_name: packageName,
      notes: null,
    };
  }
  
  return null;
}

function normalizeDate(dateStr: string): string | null {
  try {
    // Handle YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Handle DD/MM/YYYY or DD-MM-YYYY
    const match = dateStr.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`;
    }
    
    return null;
  } catch {
    return null;
  }
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
    console.log('Username:', username);
    
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
    
    // Delete existing records (full sync)
    const { error: deleteError } = await supabase
      .from('sim_cards')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
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
