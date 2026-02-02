

# תוכנית: יצירת Edge Function לסנכרון CellStation

## סקירה
ניצור Edge Function חדשה בשם `cellstation-sync` שתקרא לשרת ה-Puppeteer ב-Render ותעדכן את טבלת `sim_cards` ב-Supabase.

## שינויים נדרשים

### 1. יצירת Edge Function חדשה
**קובץ:** `supabase/functions/cellstation-sync/index.ts`

הפונקציה תכלול:
- קריאה ל-Scraper URL עם פרטי ההתחברות
- מחיקת כל הרשומות הישנות בטבלה
- הכנסת הנתונים החדשים עם timestamp של `last_synced`

**שימוש ב-Secrets קיימים:**
- `CELLSTATION_USERNAME` (במקום SITE_USERNAME)
- `CELLSTATION_PASSWORD` (במקום SITE_PASSWORD)
- `SCRAPER_URL` (כבר קיים - כתובת שרת ה-Puppeteer)
- `SUPABASE_URL` (קיים אוטומטית)
- `SUPABASE_SERVICE_ROLE_KEY` (קיים אוטומטית)

### 2. עדכון ה-Hook `useCellstationSync.tsx`
נוסיף פונקציית `syncSims` שתקרא ל-Edge Function:
```text
syncSims:
  - קריאה ל-Edge Function cellstation-sync
  - עדכון ה-UI עם תוצאות הסנכרון
  - הצגת הודעות הצלחה/שגיאה
```

### 3. עדכון דף SimCards
נוסיף כפתור "סנכרן סימים" ליד כפתור "רענן נתונים":
```text
כפתורים בהדר:
  [סנכרן סימים] - קורא ל-Edge Function (כפתור ראשי)
  [רענן נתונים] - רק טוען מחדש מהטבלה (כפתור משני)
```

---

## פרטים טכניים

### Edge Function Flow:
```text
1. קבלת בקשה
2. קריאה ל-Scraper URL עם username/password
3. קבלת רשימת סימים מה-Scraper
4. מחיקת כל הרשומות בטבלת sim_cards
5. הכנסת הרשומות החדשות עם last_synced
6. החזרת תוצאה (הצלחה/שגיאה)
```

### שמות Secrets (כבר קיימים):
- `CELLSTATION_USERNAME` = D0548499222
- `CELLSTATION_PASSWORD` = M&deal20151218
- `SCRAPER_URL` = https://sims-sync.onrender.com

**הערה חשובה:** אם ערכי ה-Secrets השמורים שונים מהערכים שסיפקת, תצטרך לעדכן אותם דרך Cloud View.

### תוספות לקובץ config.toml:
```toml
[functions.cellstation-sync]
verify_jwt = false
```

---

## תוצאה צפויה
לאחר היישום:
1. כפתור "סנכרן סימים" יקרא לשרת ה-Puppeteer ב-Render
2. הנתונים יתעדכנו בטבלה ויופיעו מיד בממשק (בזכות Real-time)
3. כפתור "רענן נתונים" ימשיך לפעול לרענון ידני מהטבלה

