

# תכנית תיקון מערכת CellStation - גרסה מקיפה

## בעיות שזוהו

### 1. מיפוי שדות לא נכון
נתונים מ-Google Apps Script מגיעים עם שמות שדות מבלבלים:
- `local_number` = מספר ישראלי (722587xxx)
- `israel_number` = מספר בינלאומי UK (447429xxx)

### 2. חוסר עקביות בנתונים
- טבלת `sim_cards`: מספרים ללא אפס מוביל (722587xxx)
- טבלת `inventory`: מספרים עם אפס מוביל (0722587xxx)
- פונקציית `normalizeForSearch` לא מטפלת בהבדל הזה

### 3. סימים חסרים בטבלת sim_cards
- הסנכרון מ-CellStation מחזיר רק 17 סימים (מתוך המלאי הזמין)
- סימים מושכרים מופיעים ב-`rentals` אבל לא ב-`services`/`inventory`
- זה גורם לכך שסימים פעילים לא מופיעים בלשונית "זמינים"

### 4. התאמה לא נכונה בין מערכות
- לשונית "השכרות פעילות" משתמשת בנתונים ישירות מ-Google Script
- ההשוואה למערכת הראשית לא עובדת בגלל הבדלי פורמט

---

## תכנית תיקון

### שלב 1: תיקון פונקציית נירמול מספרים
עדכון `normalizeForSearch` בקובץ `src/lib/utils.ts`:
- הסרת אפס מוביל למספרים ישראליים
- הסרת קידומת 44 למספרים בינלאומיים
- התאמה עקבית בין פורמטים שונים

### שלב 2: שיפור Edge Function לסנכרון
עדכון `supabase/functions/cellstation-sync/index.ts`:
- משיכת נתונים מ-`rentals` בנוסף ל-`services`
- סימון סימים מושכרים עם `is_rented = true`
- שמירת פרטי ההשכרה הפעילה (לקוח, תאריכים)
- הוספת שדה `linked_rental_id` לקישור להשכרה במערכת

### שלב 3: תיקון לשונית "זמינים להפעלה"
עדכון `src/components/cellstation/AvailableSimsTab.tsx`:
- שיפור פונקציית `getMainSystemStatus` להתאמה נכונה
- הצגת סימים זמינים בצורה ברורה
- תיקון לוגיקת הסינון

### שלב 4: תיקון לשונית "השכרות פעילות"  
עדכון `src/components/cellstation/ActiveRentalsTab.tsx`:
- תיקון מיפוי שדות (local_number = ישראלי, israel_number = UK)
- שיפור התאמה למערכת הראשית
- הצגת סטטוס נכון לכל השכרה

### שלב 5: הוספת לשונית חדשה "כל הסימים במערכת"
יצירת קובץ `src/components/cellstation/AllSimsTab.tsx`:
- הצגת כל הסימים מהמלאי הראשי
- סינון לפי סטטוס (זמין/מושכר/באיחור)
- הצלבה עם נתוני CellStation
- זיהוי סתירות והצגת אזהרות

### שלב 6: עדכון חישוב סטטיסטיקות
עדכון `src/components/cellstation/CellStationDashboard.tsx`:
- שימוש בנתונים משולבים מ-CellStation ומהמערכת הראשית
- הצגת מספרים מדויקים לכל קטגוריה

---

## פרטים טכניים

### תיקון normalizeForSearch
```typescript
export function normalizeForSearch(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let str = String(value).replace(/[-\s]/g, '').toLowerCase();
  // Remove leading zeros for Israeli numbers
  if (str.startsWith('0722') || str.startsWith('722')) {
    str = str.replace(/^0?722/, '722');
  }
  // Normalize UK numbers - keep without 44 prefix for matching
  if (str.startsWith('44')) {
    str = str.substring(2);
  }
  return str;
}
```

### מבנה נתונים משופר ב-sim_cards
- `sim_number`: ICCID (מפתח ראשי להתאמה)
- `israeli_number`: מספר ישראלי (722587xxx)
- `local_number`: מספר UK (447429xxx)
- `is_active`: האם פעיל ב-CellStation
- `is_rented`: האם מושכר ב-CellStation
- `linked_rental_id`: קישור להשכרה במערכת הראשית
- `cellstation_rental_info`: פרטי השכרה מ-CellStation (JSON)

### לוגיקת הצלבה משופרת
1. התאמה ראשית לפי ICCID (sim_number) - הכי אמין
2. התאמה משנית לפי מספר ישראלי (לאחר נירמול)
3. התאמה שלישית לפי מספר UK (לאחר נירמול)

---

## תוצאות צפויות

לאחר התיקון:
- סימים 0722587082, 0722587012, 0722586890 יופיעו כ"זמינים להפעלה"
- סימים 0722587074, 0722587066 יופיעו ב"השכרות פעילות" עם סטטוס "מושכר"
- הסטטיסטיקות יהיו מדויקות
- לא יהיו יותר בעיות סנכרון בין המערכות

