
# תוכנית: שיפור טעינת נתונים ומניעת אובדן נתונים

## מה קורה עכשיו

כשאתה רואה את ההודעה האדומה "חלק מהנתונים לא נטענו - נכשל בטעינת: מלאי":

| מה שקורה | מה שאתה רואה |
|-----------|--------------|
| בקשת רשת לשרת נכשלת (בעיה זמנית) | הודעת שגיאה אדומה |
| המערכת מנסה 3 פעמים עם המתנה | עדיין נכשל |
| יש cache מקומי אז המלאי **לא נעלם** | אבל עדיין מופיעה הודעה מפחידה |

**הנתונים שלך לא אובדים!** הם שמורים גם בשרת וגם במטמון המקומי.

---

## השיפורים המוצעים

### 1. הרחבת ה-Cache לכל הנתונים
כרגע רק המלאי נשמר מקומית. נוסיף cache גם ל:
- לקוחות
- השכרות (+ פריטי השכרה)
- תיקונים

**יתרון**: גם אם הרשת נופלת, תראה את כל הנתונים מהמטמון.

### 2. שיפור הודעות השגיאה
כשיש נתונים ב-cache:
- **במקום**: הודעה אדומה מפחידה "חלק מהנתונים לא נטענו"
- **יהיה**: הודעה כחולה עדינה "מוצג ממטמון מקומי, מנסה לעדכן..."

### 3. ניסיון רענון ברקע
אחרי שמציג נתונים מ-cache, המערכת תנסה לעדכן אוטומטית ברקע כל 30 שניות (עד 3 ניסיונות) בלי להפריע לך.

### 4. זיהוי סוג הכשל
המערכת תזהה האם הכשל הוא:
- בעיית רשת זמנית (WiFi, 3G ירוד)
- בעיית שרת
- חסימה של תוכנת אנטי-וירוס

---

## השינויים הטכניים

### קובץ: `src/hooks/useRental.tsx`

#### 1. הוספת Cache לכל הנתונים
```javascript
const CUSTOMERS_CACHE_KEY = 'dealcell_cache_customers_v1';
const RENTALS_CACHE_KEY = 'dealcell_cache_rentals_v1';
const REPAIRS_CACHE_KEY = 'dealcell_cache_repairs_v1';
```

#### 2. פונקציות שמירה/טעינה מ-Cache
```javascript
const loadCachedData = <T,>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveToCache = <T,>(key: string, data: T[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* ignore quota errors */ }
};
```

#### 3. אתחול State מ-Cache
```javascript
const [customers, setCustomers] = useState<Customer[]>(() => 
  loadCachedData(CUSTOMERS_CACHE_KEY)
);
const [rentals, setRentals] = useState<Rental[]>(() => 
  loadCachedData(RENTALS_CACHE_KEY)
);
const [repairs, setRepairs] = useState<Repair[]>(() => 
  loadCachedData(REPAIRS_CACHE_KEY)
);
```

#### 4. הודעות מותאמות
```javascript
// כשיש cache ורק חלק נכשל
if (hasCachedData) {
  toast({
    title: 'מוצג ממטמון מקומי',
    description: 'הנתונים מעודכנים. מנסה לסנכרן ברקע...',
    // ללא variant: destructive = הודעה רגילה (לא אדומה)
  });
}
```

#### 5. רענון אוטומטי ברקע
```javascript
// אם נכשל, נסה שוב אחרי 30 שניות (ברקע, בלי loading)
if (failedParts.length > 0 && backgroundRetryCount < 3) {
  setTimeout(() => {
    fetchDataBackground(failedTables);
  }, 30000);
}
```

---

## תרשים הזרימה החדש

```text
טעינת דף
    │
    ├── טען מ-Cache מיד (מהיר!)
    │
    ├── שלח בקשות לשרת
    │
    ├── הצלחה? ──┬── כן → עדכן Cache + הצג נתונים חדשים
    │            │
    │            └── לא → נסה שוב (עד 3 פעמים)
    │                        │
    │                        └── עדיין נכשל?
    │                                │
    │                                ├── יש Cache → הצג עם הודעה עדינה
    │                                │              + נסה ברקע כל 30 שניות
    │                                │
    │                                └── אין Cache → הודעת שגיאה
```

---

## מה לא ישתנה

- **הנתונים שלך בטוחים** - הם תמיד בשרת
- **Cache הוא רק גיבוי** - לתצוגה כשאין רשת
- **כל שינוי נשמר לשרת** - ומעדכן את ה-Cache

---

## סיכום

| לפני | אחרי |
|------|------|
| הודעה אדומה מפחידה | הודעה עדינה אם יש cache |
| רק מלאי ב-cache | כל הנתונים ב-cache |
| צריך לרענן ידנית | רענון אוטומטי ברקע |
| נראה כאילו נתונים אובדים | ברור שהכל שמור |
