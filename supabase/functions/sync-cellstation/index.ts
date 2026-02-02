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

// Detailed logging array to return to client
const syncLogs: string[] = [];
function log(message: string, data?: unknown) {
  const logEntry = data ? `${message}: ${JSON.stringify(data, null, 2)}` : message;
  syncLogs.push(logEntry);
  console.log(logEntry);
}

async function loginToCellStation(username: string, password: string): Promise<string | null> {
  log('=== שלב 1: התחברות ל-CellStation ===');
  log('מנסה להתחבר ל-CellStation...');
  log('URL התחברות', 'https://cellstation.co.il/portal/login.php');
  log('שם משתמש', username);
  
  const loginUrl = 'https://cellstation.co.il/portal/login.php';
  
  try {
    // First, get the login page to obtain any CSRF tokens or session cookies
    log('שולח בקשת GET ראשונית לקבלת cookies...');
    const initialResponse = await fetch(loginUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    
    log('סטטוס בקשה ראשונית', initialResponse.status);
    
    // Get cookies from initial response
    const initialCookies = initialResponse.headers.get('set-cookie') || '';
    log('קוקיז שהתקבלו', initialCookies ? 'כן - ' + initialCookies.substring(0, 100) + '...' : 'לא');
    
    // Parse cookie for session ID
    const cookieMatch = initialCookies.match(/PHPSESSID=([^;]+)/);
    const sessionCookie = cookieMatch ? `PHPSESSID=${cookieMatch[1]}` : initialCookies.split(';')[0];
    log('Session cookie שנשלח', sessionCookie);
    
    // Prepare login form data
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('login', '1');
    
    log('שולח בקשת POST להתחברות...');
    
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
    
    log('=== תוצאות התחברות ===');
    log('סטטוס תגובה', loginResponse.status);
    log('קוקיז חדשים', newCookies ? 'כן' : 'לא');
    log('URL אחרי התחברות', loginResponse.headers.get('location') || 'לא היה redirect');
    
    // Check if login was successful
    if (loginResponse.status === 302 || loginResponse.status === 200) {
      const responseBody = await loginResponse.text();
      log('אורך תגובה', responseBody.length);
      log('מקטע מהתגובה (100 תווים ראשונים)', responseBody.substring(0, 100));
      
      // Check if we're still on login page
      const stillOnLogin = responseBody.includes('login.php') && responseBody.includes('password');
      log('עדיין בדף התחברות?', stillOnLogin);
      
      if (loginResponse.status === 302 || !stillOnLogin || responseBody.includes('logout')) {
        log('✅ ההתחברות נראית מוצלחת!');
        return finalCookies;
      }
    }
    
    log('❌ ההתחברות נכשלה - מנסה בכל זאת...');
    return finalCookies;
  } catch (error) {
    log('❌ שגיאת התחברות', error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function fetchSimList(sessionCookies: string): Promise<SimCard[]> {
  log('=== שלב 2: שליפת רשימת סימים ===');
  
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
      log(`מנסה דף: ${pageUrl}`);
      
      const response = await fetch(pageUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cookie': sessionCookies,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });
      
      log('סטטוס תגובה', response.status);
      
      if (response.status !== 200) {
        log('דף לא נגיש, ממשיך לבא...');
        continue;
      }
      
      const html = await response.text();
      log('אורך HTML שהתקבל', html.length);
      log('מקטע HTML (500 תווים ראשונים)', html.substring(0, 500));
      
      // Check if we're actually logged in
      if (html.includes('login.php') && html.includes('password')) {
        log('❌ עדיין בדף התחברות - האימות נכשל');
        continue;
      }
      
      log('✅ מחובר! מתחיל לחפש cards...');
      
      // Try to parse the HTML and extract SIM data using div.card structure
      const sims = parseSimCards(html);
      
      if (sims.length > 0) {
        log(`✅ נמצאו ${sims.length} סימים בדף: ${pageUrl}`);
        return sims;
      }
      
      log('לא נמצאו סימים בדף זה, ממשיך לבא...');
    } catch (error) {
      log(`❌ שגיאה בשליפת דף ${pageUrl}`, error instanceof Error ? error.message : String(error));
    }
  }
  
  log('❌ לא נמצאו סימים באף דף');
  return [];
}

function parseSimCards(html: string): SimCard[] {
  const sims: SimCard[] = [];
  
  log('=== שלב 3: חיפוש div.card elements ===');
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    if (!doc) {
      log('❌ נכשל בפענוח HTML');
      return sims;
    }
    
    // Find all div.card elements (SIM cards)
    const cards = doc.querySelectorAll('div.card');
    log('מספר div.card שנמצאו', cards.length);
    
    // Also try other common selectors
    const altCards = doc.querySelectorAll('.card, .sim-card, .sim-item, [class*="card"]');
    log('מספר elements חלופיים ([class*="card"])', altCards.length);
    
    const allCards = cards.length > 0 ? cards : altCards;
    
    // Log first card HTML if found
    if (allCards.length > 0) {
      const firstCard = allCards[0] as DOMElement;
      log('HTML של card ראשון', firstCard.outerHTML?.substring(0, 500) || 'לא זמין');
    } else {
      log('❌ לא נמצאו cards! בודק מבנים אחרים...');
      
      // Log all classes found in the document
      const allElements = doc.querySelectorAll('[class]');
      const classes = new Set<string>();
      for (const el of allElements) {
        const className = (el as DOMElement).getAttribute('class');
        if (className) classes.add(className);
      }
      log('כל ה-classes שנמצאו בדף', Array.from(classes).slice(0, 20));
    }
    
    let cardIndex = 0;
    for (const card of allCards) {
      cardIndex++;
      log(`--- מעבד card מספר ${cardIndex} ---`);
      const cardElement = card as DOMElement;
      const sim = parseCardElement(cardElement, cardIndex);
      if (sim) {
        sims.push(sim);
        log(`✅ Card ${cardIndex} נוסף למערך`);
      } else {
        log(`❌ Card ${cardIndex} לא הכיל מידע שימושי`);
      }
    }
    
    // If no cards found, try to find any structure with phone numbers
    if (sims.length === 0) {
      log('מנסה parsing חלופי (חיפוש מספרי טלפון)...');
      const altSims = parseAlternativeStructure(doc);
      if (altSims.length > 0) {
        log(`✅ נמצאו ${altSims.length} סימים בשיטה חלופית`);
        return altSims;
      }
    }
    
  } catch (error) {
    log('❌ שגיאה בפענוח HTML', error instanceof Error ? error.message : String(error));
  }
  
  return sims;
}

function parseCardElement(card: DOMElement, cardIndex: number): SimCard | null {
  try {
    const cardHtml = card.outerHTML || '';
    const cardText = card.textContent || '';
    
    log(`Card ${cardIndex} - טקסט מלא`, cardText.substring(0, 200));
    
    // Extract short number from p.pstyle
    const pstyleElement = card.querySelector('p.pstyle, .pstyle');
    const shortNumber = pstyleElement?.textContent?.trim() || null;
    log(`Card ${cardIndex} - short_number (p.pstyle)`, shortNumber || 'לא נמצא');
    
    // Extract package name from p.plan
    const planElement = card.querySelector('p.plan, .plan');
    const packageName = planElement?.textContent?.trim() || null;
    log(`Card ${cardIndex} - package_name (p.plan)`, packageName || 'לא נמצא');
    
    // Extract the three numbers (local, israeli, ICCID)
    // They appear as 3 lines of numbers in the card
    const numberMatches = cardText.match(/\d{10,20}/g) || [];
    log(`Card ${cardIndex} - מספרים שנמצאו (10-20 ספרות)`, numberMatches);
    
    let localNumber: string | null = null;
    let israeliNumber: string | null = null;
    let simNumber: string | null = null;
    
    // ICCID is typically 18-20 digits
    const iccidMatch = numberMatches.find(n => n.length >= 18);
    if (iccidMatch) {
      simNumber = iccidMatch;
    }
    log(`Card ${cardIndex} - sim_number (ICCID)`, simNumber || 'לא נמצא');
    
    // Israeli number starts with 07 or 05 (10 digits)
    const israeliMatch = numberMatches.find(n => n.length === 10 && (n.startsWith('07') || n.startsWith('05')));
    if (israeliMatch) {
      israeliNumber = israeliMatch;
    }
    log(`Card ${cardIndex} - israeli_number`, israeliNumber || 'לא נמצא');
    
    // Local number is the remaining 10-12 digit number (not Israeli, not ICCID)
    const localMatch = numberMatches.find(n => 
      n.length >= 10 && n.length <= 12 && 
      n !== israeliNumber && 
      n !== simNumber
    );
    if (localMatch) {
      localNumber = localMatch;
    }
    log(`Card ${cardIndex} - local_number`, localNumber || 'לא נמצא');
    
    // Extract expiry date - look for "תוקף התכנית" followed by date
    const expiryMatch = cardText.match(/תוקף\s*(?:התכנית)?\s*(\d{4}-\d{2}-\d{2}|\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
    let expiryDate: string | null = null;
    if (expiryMatch) {
      expiryDate = normalizeDate(expiryMatch[1]);
    }
    log(`Card ${cardIndex} - expiry_date`, expiryDate || 'לא נמצא');
    
    // Check if active based on background color (green = active, red = inactive)
    const style = card.getAttribute('style') || '';
    const className = card.getAttribute('class') || '';
    const isActive = !cardHtml.includes('red') && 
                     !className.includes('inactive') && 
                     !className.includes('expired') &&
                     !style.includes('red');
    log(`Card ${cardIndex} - is_active`, isActive);
    log(`Card ${cardIndex} - style attribute`, style || 'אין');
    log(`Card ${cardIndex} - class attribute`, className);
    
    // Only add if we have at least one meaningful field
    if (shortNumber || localNumber || israeliNumber || simNumber) {
      const sim: SimCard = {
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
      log(`Card ${cardIndex} - סיכום`, sim);
      return sim;
    }
    
    return null;
  } catch (error) {
    log(`❌ שגיאה בעיבוד card`, error instanceof Error ? error.message : String(error));
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

  // Clear logs for each request
  syncLogs.length = 0;

  try {
    log('========================================');
    log('🚀 התחלת סנכרון CellStation');
    log('========================================');
    
    // Get credentials from environment
    const username = Deno.env.get('CELLSTATION_USERNAME');
    const password = Deno.env.get('CELLSTATION_PASSWORD');
    
    if (!username || !password) {
      log('❌ חסרים פרטי התחברות!');
      log('CELLSTATION_USERNAME קיים?', !!username);
      log('CELLSTATION_PASSWORD קיים?', !!password);
      return new Response(
        JSON.stringify({ success: false, error: 'CellStation credentials not configured', logs: syncLogs }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    log('פרטי התחברות נמצאו');
    
    // Login to CellStation
    const sessionCookies = await loginToCellStation(username, password);
    
    if (!sessionCookies) {
      log('❌ ההתחברות נכשלה לחלוטין');
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to login to CellStation', logs: syncLogs }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Fetch SIM data
    const sims = await fetchSimList(sessionCookies);
    
    log('========================================');
    log('=== סיכום סופי ===');
    log('========================================');
    log('סה"כ סימים שנמצאו', sims.length);
    if (sims.length > 0) {
      log('מערך הסימים המלא', sims);
    }
    
    // Connect to Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Delete existing records (full sync)
    log('מוחק רשומות קיימות...');
    const { error: deleteError } = await supabase
      .from('sim_cards')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (deleteError) {
      log('❌ שגיאה במחיקת רשומות', deleteError.message);
    } else {
      log('✅ רשומות קיימות נמחקו');
    }
    
    // Insert new records
    if (sims.length > 0) {
      const simsWithTimestamp = sims.map(sim => ({
        ...sim,
        last_synced: new Date().toISOString(),
      }));
      
      log('מוסיף רשומות חדשות...');
      const { error: insertError } = await supabase
        .from('sim_cards')
        .insert(simsWithTimestamp);
      
      if (insertError) {
        log('❌ שגיאה בהוספת סימים', insertError.message);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to save SIMs: ' + insertError.message, logs: syncLogs }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      log('✅ סימים נוספו בהצלחה');
    }
    
    log('========================================');
    log('🎉 סנכרון הושלם!');
    log('========================================');
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        count: sims.length,
        message: `Successfully synced ${sims.length} SIMs`,
        logs: syncLogs
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (err: unknown) {
    log('❌ שגיאה כללית', err instanceof Error ? err.message : String(err));
    log('Stack trace', err instanceof Error ? err.stack : 'לא זמין');
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, logs: syncLogs }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
