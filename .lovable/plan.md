

# תוכנית יישום: עדכון sync-cellstation לשרת Render חיצוני

## סיכום מהיר

עדכון ה-Edge Function לקרוא לשרת Puppeteer חיצוני במקום לעשות scraping ישירות.

---

## שינוי 1: עדכון Edge Function

**קובץ:** `supabase/functions/sync-cellstation/index.ts`

### הקוד החדש (מפושט):

```typescript
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
```

---

## שינוי 2: הוספת Secret

| Secret | ערך זמני |
|--------|----------|
| SCRAPER_URL | https://example.com |

---

## קוד לשרת Render (להעתקה אחרי האישור)

### package.json
```json
{
  "name": "cellstation-scraper",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "puppeteer": "^22.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### server.js
```javascript
const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'CellStation Scraper API' });
});

// Main scraping endpoint
app.post('/scrape-cellstation', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Missing credentials' });
  }
  
  console.log('Starting scrape for user:', username);
  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    console.log('Navigating to login page...');
    await page.goto('https://cellstation.co.il/portal/login.php', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // מילוי טופס התחברות
    console.log('Filling login form...');
    await page.type('input[type="text"], input[name="username"]', username);
    await page.type('input[type="password"]', password);
    
    // לחיצה והמתנה לניווט
    await Promise.all([
      page.click('button[type="submit"], input[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
    ]);
    
    console.log('Logged in, waiting for cards...');
    
    // המתנה ל-cards
    await page.waitForSelector('.card', { timeout: 15000 });
    
    // חילוץ הנתונים
    const sims = await page.evaluate(() => {
      const cards = document.querySelectorAll('.card');
      const results = [];
      
      cards.forEach(card => {
        const shortNumber = card.querySelector('.pstyle')?.textContent?.trim() || null;
        const planEl = card.querySelector('.plan');
        const packageName = planEl?.textContent?.trim() || null;
        
        // חילוץ מספרים מהטקסט
        const cardText = card.textContent || '';
        const numberMatches = cardText.match(/\d{10,20}/g) || [];
        
        let localNumber = null;
        let israeliNumber = null;
        let simNumber = null;
        
        // ICCID הוא 18-20 ספרות
        const iccidMatch = numberMatches.find(n => n.length >= 18);
        if (iccidMatch) simNumber = iccidMatch;
        
        // מספר ישראלי מתחיל ב-07 או 05
        const israeliMatch = numberMatches.find(n => n.length === 10 && (n.startsWith('07') || n.startsWith('05')));
        if (israeliMatch) israeliNumber = israeliMatch;
        
        // מספר מקומי
        const localMatch = numberMatches.find(n => 
          n.length >= 10 && n.length <= 12 && 
          n !== israeliNumber && 
          n !== simNumber
        );
        if (localMatch) localNumber = localMatch;
        
        // תאריך תוקף
        const expiryMatch = cardText.match(/(\d{4}-\d{2}-\d{2})/);
        const expiryDate = expiryMatch ? expiryMatch[1] : null;
        
        // בדיקת פעילות לפי צבע
        const headerDiv = card.querySelector('[style*="background"]');
        const style = headerDiv?.getAttribute('style') || '';
        const isActive = style.includes('green') || !style.includes('red');
        
        if (shortNumber || localNumber || israeliNumber || simNumber) {
          results.push({
            short_number: shortNumber,
            local_number: localNumber,
            israeli_number: israeliNumber,
            sim_number: simNumber,
            package_name: packageName,
            expiry_date: expiryDate,
            is_active: isActive,
            is_rented: false,
            status: isActive ? 'active' : 'expired'
          });
        }
      });
      
      return results;
    });
    
    console.log(`Found ${sims.length} SIMs`);
    await browser.close();
    res.json({ success: true, sims, count: sims.length });
    
  } catch (error) {
    console.error('Scraping error:', error.message);
    if (browser) await browser.close();
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

---

## השלבים שלך אחרי האישור

1. **אני אעדכן** את sync-cellstation ואוסיף את ה-Secret
2. **אתה תיצור** repo חדש ב-GitHub עם package.json + server.js
3. **אתה תעלה** ל-Render.com (Web Service חינמי)
4. **אתה תעדכן** את SCRAPER_URL עם ה-URL האמיתי
5. **בדיקה** - לחץ "סנכרן סימים"

