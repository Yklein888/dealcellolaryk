
# תוכנית: דאשבורד CellStation מלא עם הפעלת סימים ויצירת השכרות

## סקירה כללית
יצירת דאשבורד CellStation חדש ומקיף שמאפשר:
1. תצוגת מלאי סימים מ-CellStation עם סטטיסטיקות
2. הפעלת סים מתוך הממשק עם בחירת לקוח
3. יצירת השכרה אוטומטית עם הסים שהופעל
4. הדפסת הוראות חיוג ישירות מהדאשבורד
5. ממשק אינטואיטיבי עם לשוניות (מלאי, הפעלה חדשה, לקוחות)

## מבנה הפתרון

### שלב 1: יצירת קומפוננטת דאשבורד CellStation חכמה
קובץ חדש: `src/components/cellstation/CellStationDashboard.tsx`

הקומפוננטה תכלול:
- **לשונית מלאי סימים**: תצוגת טבלה עם כל הסימים, סינון וחיפוש
- **לשונית הפעלה חדשה**: 
  - בחירת סים פנוי מהמלאי
  - בחירת לקוח קיים או הוספת לקוח חדש
  - בחירת תאריכי השכרה
  - כפתור הפעלה שמבצע:
    1. שליחת פקודה ל-Google Script
    2. יצירת השכרה חדשה במערכת
    3. הוספה למלאי אם הסים לא קיים
- **לשונית לקוחות**: רשימת לקוחות עם אפשרות הוספה

### שלב 2: עדכון דף SimCards
עדכון `src/pages/SimCards.tsx` להשתמש בדאשבורד החדש

### שלב 3: אינטגרציה עם מערכת ההשכרות
חיבור לפונקציות קיימות:
- `addRental` - יצירת השכרה חדשה
- `addInventoryItem` - הוספת סים למלאי
- `addCustomer` - הוספת לקוח חדש
- `printCallingInstructions` - הדפסת הוראות

## פירוט טכני

### קומפוננטות חדשות

```text
src/components/cellstation/
├── CellStationDashboard.tsx      # קומפוננטה ראשית
├── SimInventoryTab.tsx           # לשונית מלאי
├── ActivationTab.tsx             # לשונית הפעלה
├── CustomersTab.tsx              # לשונית לקוחות
└── SimActivationForm.tsx         # טופס הפעלה מלא
```

### תהליך הפעלה משולב

```text
┌─────────────────────────────────────────────────────────────────┐
│                    תהליך הפעלת סים חכם                         │
├─────────────────────────────────────────────────────────────────┤
│  1. בחירת סים פנוי                                              │
│     ↓                                                          │
│  2. בחירת/הוספת לקוח                                            │
│     ↓                                                          │
│  3. בחירת תאריכי השכרה                                          │
│     ↓                                                          │
│  4. לחיצה על "הפעל והשכר"                                       │
│     ↓                                                          │
│  ┌──────────────────────────────────────────────────────┐      │
│  │ פעולות אוטומטיות:                                    │      │
│  │  a. שליחת POST ל-Google Script (set_pending)        │      │
│  │  b. עדכון סטטוס סים ל-pending                        │      │
│  │  c. הוספת סים למלאי (אם לא קיים)                     │      │
│  │  d. יצירת השכרה חדשה                                 │      │
│  │  e. הצעת הדפסת הוראות חיוג                           │      │
│  └──────────────────────────────────────────────────────┘      │
│     ↓                                                          │
│  5. הודעה למשתמש: "לחץ על Bookmarklet ב-CellStation"           │
└─────────────────────────────────────────────────────────────────┘
```

### ממשק משתמש

**לשונית מלאי סימים:**
- כרטיסי סטטיסטיקה (סה"כ, פעילים, פנויים, עומדים לפוג)
- חיפוש לפי ICCID, מספר ישראלי, מספר מקומי
- סינון לפי סטטוס (פעיל/לא פעיל/פנוי/בהשכרה)
- טבלה עם עמודות: SIM, מספר מקומי, מספר ישראלי, תוכנית, תוקף, סטטוס, פעולות
- כפתורי פעולה: הפעל, הוסף למלאי, הדפס הוראות

**לשונית הפעלה חדשה:**
- בחירת סים מרשימה נפתחת (רק סימים פנויים)
- תצוגת פרטי הסים הנבחר
- חיפוש ובחירת לקוח מרשימה
- כפתור הוספת לקוח חדש מהיר
- בחירת טווח תאריכים עם לוח עברי
- תצוגת מחיר מחושב
- כפתור "הפעל והשכר" ראשי

**לשונית לקוחות:**
- רשימת לקוחות קיימים
- חיפוש לקוחות
- כפתור הוספת לקוח חדש

### שדות נתונים

**SimCard (מ-CellStation):**
- sim_number (ICCID)
- local_number (מספר מקומי)
- israeli_number (מספר ישראלי)
- package_name (תוכנית)
- expiry_date (תוקף)
- is_active (האם פעיל)
- activation_status (none/pending/activated/failed)

**הפעלה + השכרה:**
- selectedSim: SimCard
- selectedCustomerId: string
- customerName: string
- startDate: Date
- endDate: Date
- deposit?: number
- notes?: string

### פעולות API

1. **שליחת הפעלה ל-Google Script:**
```typescript
POST https://script.google.com/macros/s/AKfycbw5Zv5OWnH8UI0dCzfBR37maMDRf0NwIsX8PxREugD5lSSLKC2KYx9P72c0qQkb-TpA/exec
{
  action: 'set_pending',
  sim: simNumber,
  customerName: customerName,
  startDate: startDate,
  endDate: endDate
}
```

2. **הוספת סים למלאי (אם לא קיים):**
```typescript
addInventoryItem({
  category: 'sim_european',
  name: `סים ${localNumber || simNumber}`,
  localNumber,
  israeliNumber,
  expiryDate,
  simNumber,
  status: 'available'
})
```

3. **יצירת השכרה:**
```typescript
addRental({
  customerId,
  customerName,
  items: [{
    inventoryItemId,
    itemCategory: 'sim_european',
    itemName: `סים אירופאי - ${localNumber}`,
    hasIsraeliNumber: false
  }],
  startDate,
  endDate,
  totalPrice,
  currency: 'USD',
  status: 'active'
})
```

4. **הדפסת הוראות:**
```typescript
printCallingInstructions(israeliNumber, localNumber, barcode, false, packageName, expiryDate)
```

### תצוגת סטטוס הפעלה

| סטטוס | אייקון | צבע | הודעה |
|-------|--------|-----|--------|
| none | ⚪ | אפור | לא הופעל |
| pending | 🔄 | צהוב | ממתין להפעלה |
| activated | ✅ | ירוק | הופעל |
| failed | ❌ | אדום | נכשל |

### דיאלוג אישור לאחר הפעלה

לאחר הפעלה מוצלחת:
```
┌─────────────────────────────────────────────┐
│           ✅ ההפעלה נשלחה בהצלחה!           │
├─────────────────────────────────────────────┤
│  SIM: 8972509020123456789                   │
│  לקוח: ישראל ישראלי                         │
│  תאריכים: 03/02/2026 - 10/02/2026          │
│                                             │
│  ⚠️ לחץ על Bookmarklet באתר CellStation    │
│     כדי להשלים את ההפעלה                    │
│                                             │
│  ┌─────────────┐  ┌──────────────────┐     │
│  │ 🖨️ הדפס     │  │ ← חזור לדאשבורד │     │
│  │   הוראות   │  │                  │     │
│  └─────────────┘  └──────────────────┘     │
└─────────────────────────────────────────────┘
```

## קבצים שייווצרו/יעודכנו

| קובץ | פעולה | תיאור |
|------|-------|--------|
| `src/components/cellstation/CellStationDashboard.tsx` | חדש | קומפוננטה ראשית |
| `src/components/cellstation/SimInventoryTab.tsx` | חדש | לשונית מלאי |
| `src/components/cellstation/ActivationTab.tsx` | חדש | לשונית הפעלה |
| `src/components/cellstation/SimActivationForm.tsx` | חדש | טופס הפעלה מלא |
| `src/pages/SimCards.tsx` | עדכון | שימוש בדאשבורד החדש |

## יתרונות הפתרון

1. **תהליך אחיד**: הפעלה + השכרה בפעולה אחת
2. **חכם**: בודק אם הסים במלאי ומוסיף אוטומטית
3. **מהיר**: אין צורך לעבור בין דפים
4. **שלם**: כולל הדפסת הוראות בסוף התהליך
5. **אינטואיטיבי**: ממשק דומה לדאשבורד הקיים שכבר עובד
6. **משולב**: מנצל את כל הפונקציות הקיימות במערכת
