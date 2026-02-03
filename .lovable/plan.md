

# תוכנית: סנכרון סימים מ-Google Apps Script

## סקירה
נחליף את ה-Edge Function הקיימת שמסתמכת על שרת Puppeteer חיצוני, בפונקציה פשוטה יותר שמושכת נתונים ישירות מ-Google Apps Script Web App ומעדכנת את טבלת `sim_cards`.

## מקור הנתונים
```text
URL: https://script.google.com/macros/s/AKfycby_K6f6OOf5STuF2xQQ5STu/exec
Format: JSON עם מערך 'services'
```

## שינויים נדרשים

### 1. עדכון Edge Function `cellstation-sync`
**קובץ:** `supabase/functions/cellstation-sync/index.ts`

**לוגיקה חדשה:**
```text
1. קריאה ל-Google Apps Script URL
2. קבלת אובייקט JSON עם מערך 'services'
3. לכל פריט במערך:
   - חיפוש לפי sim_number בטבלה
   - אם קיים: UPDATE
   - אם לא קיים: INSERT
4. החזרת סיכום (כמה עודכנו / נוספו)
```

**מיפוי שדות מה-API לטבלה:**
| שדה ב-API | שדה בטבלה |
|-----------|------------|
| sim | sim_number (מזהה ייחודי) |
| local_number | local_number |
| israel_number | israeli_number |
| plan | package_name |
| expiry | expiry_date |
| status | is_active (true אם status = "active") |

### 2. עדכון ה-Hook והממשק
**אין צורך בשינויים** - ה-hook והממשק כבר מוכנים עם כפתור "סנכרן סימים" שקורא ל-Edge Function. רק נעדכן את התוכן של ה-Edge Function.

---

## פרטים טכניים

### מבנה ה-Edge Function החדשה:
```text
1. CORS headers
2. Fetch מ-Google Apps Script
3. Parse JSON → services array
4. Loop על כל service:
   - upsert לטבלת sim_cards לפי sim_number
5. ספירת updated vs inserted
6. החזרת תוצאה עם toast message
```

### יתרונות הפתרון:
- **פשוט** - קריאה ישירה ל-API ללא צורך בשרתים חיצוניים
- **מהיר** - אין scraping, רק fetch של JSON
- **אמין** - Google Apps Script זמין תמיד
- **Upsert logic** - עדכון קיימים + הוספת חדשים (לא מחיקה)

### הודעות למשתמש:
```text
בזמן סנכרון: "מסנכרן עם CellStation..."
הצלחה: "X סימים עודכנו, Y סימים נוספו"
שגיאה: הודעת שגיאה מפורטת
```

