# תוכנית: עדכון sync-cellstation לשרת Render חיצוני

## ✅ הושלם

1. **Edge Function עודכן** - `supabase/functions/sync-cellstation/index.ts`
2. **Secret נוסף** - `SCRAPER_URL` (זמני: https://example.com)

---

## השלבים הבאים שלך

### 1. צור repo חדש ב-GitHub עם הקבצים הבאים:

**package.json:**
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

**server.js:**
```javascript
const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'CellStation Scraper API' });
});

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
    
    await page.goto('https://cellstation.co.il/portal/login.php', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await page.type('input[type="text"], input[name="username"]', username);
    await page.type('input[type="password"]', password);
    
    await Promise.all([
      page.click('button[type="submit"], input[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
    ]);
    
    await page.waitForSelector('.card', { timeout: 15000 });
    
    const sims = await page.evaluate(() => {
      const cards = document.querySelectorAll('.card');
      const results = [];
      
      cards.forEach(card => {
        const shortNumber = card.querySelector('.pstyle')?.textContent?.trim() || null;
        const planEl = card.querySelector('.plan');
        const packageName = planEl?.textContent?.trim() || null;
        
        const cardText = card.textContent || '';
        const numberMatches = cardText.match(/\d{10,20}/g) || [];
        
        let localNumber = null;
        let israeliNumber = null;
        let simNumber = null;
        
        const iccidMatch = numberMatches.find(n => n.length >= 18);
        if (iccidMatch) simNumber = iccidMatch;
        
        const israeliMatch = numberMatches.find(n => n.length === 10 && (n.startsWith('07') || n.startsWith('05')));
        if (israeliMatch) israeliNumber = israeliMatch;
        
        const localMatch = numberMatches.find(n => 
          n.length >= 10 && n.length <= 12 && 
          n !== israeliNumber && 
          n !== simNumber
        );
        if (localMatch) localNumber = localMatch;
        
        const expiryMatch = cardText.match(/(\d{4}-\d{2}-\d{2})/);
        const expiryDate = expiryMatch ? expiryMatch[1] : null;
        
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

### 2. העלה ל-Render.com
1. היכנס ל-[render.com](https://render.com)
2. צור Web Service חדש מה-repo
3. בחר Free plan
4. המתן שהשרת יעלה

### 3. עדכן את SCRAPER_URL
אחרי שיש לך את ה-URL (למשל `https://cellstation-scraper.onrender.com`), עדכן אותו בפרויקט.

### 4. בדיקה
לחץ "סנכרן סימים" בדף הסימים לבדיקה.
