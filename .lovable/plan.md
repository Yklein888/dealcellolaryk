

# תוכנית: מעבר לסנכרון מבוסס Supabase בלבד

## סקירה
הבוט החיצוני (GitHub Action) כעת מסנכרן ישירות לטבלת `sim_cards` ב-Supabase. נצטרך להסיר את הקריאה לשרת Render ולפשט את הממשק כך שיעבוד אך ורק עם הנתונים מ-Supabase.

## שינויים נדרשים

### 1. עדכון ה-Hook `useCellstationSync.tsx`
**מה ישתנה:**
- הסרת הפונקציה `syncSims` שקוראת ל-Edge Function
- הסרת ה-state של `syncLogs` (כבר אין לוגים מהשרת החיצוני)
- שינוי שם הפונקציה `syncSims` ל-`refreshData` שרק עושה refetch
- פישוט ה-hook כך שיכלול רק:
  - קריאת נתונים מ-Supabase
  - האזנה בזמן אמת לשינויים
  - פונקציית רענון ידני

### 2. עדכון הדף `SimCards.tsx`
**מה ישתנה:**
- הסרת כפתור "סנכרן סימים" (כי הסנכרון נעשה אוטומטית על ידי GitHub Action)
- הסרת הפאנל של הלוגים (כבר לא רלוונטי)
- שינוי הכפתור "רענן נתונים" להיות הכפתור הראשי
- עדכון ההודעה למצב ריק (הסרת ההפניה ל"סנכרן סימים")

### 3. מחיקת Edge Function `sync-cellstation`
**מה ישתנה:**
- מחיקת הקובץ `supabase/functions/sync-cellstation/index.ts`
- הקובץ כבר לא נדרש כי הסנכרון מתבצע ישירות על ידי GitHub Action

---

## פרטים טכניים

### Hook חדש ומפושט:
```text
useCellstationSync:
  - simCards: נתונים מ-Supabase
  - isLoading: מצב טעינה
  - refreshData: פונקציה לרענון ידני
  - Real-time subscription (נשאר כמו שהוא)
```

### ממשק משתמש מעודכן:
```text
כותרת: "סימים מ-CellStation"
תת-כותרת: "סנכרון אחרון: [תאריך מ-last_synced]"

כפתורים:
  [רענן נתונים] - רק כפתור אחד לרענון

הודעה למצב ריק:
  "אין סימים להצגה"
  "הנתונים מתעדכנים אוטומטית"
```

---

## פעולות נוספות (מחוץ ל-Lovable)

לאחר אישור התוכנית, תצטרך לבצע את הפעולות הבאות:

1. **ב-Render**: מחק את ה-Service של `sims-sync` (Delete Service)
2. **ב-GitHub**: וודא שקיימים:
   - קובץ `sync.js` (הסקריפט שמסנכרן ל-Supabase)
   - תיקיית `.github/workflows` עם ה-Workflow
3. **הפעלת סנכרון**: לך ל-GitHub Actions ← SIM Cards Auto Sync ← Run workflow

