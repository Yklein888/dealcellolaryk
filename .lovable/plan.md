
# תוכנית: סנכרון דו-כיווני להפעלת סימים

## סקירה כללית
מערכת שמאפשרת להפעיל סימים מתוך Lovable, לתקשר עם Google Apps Script שמנהל תור פקודות, ולהשתמש ב-Bookmarklet לביצוע ההפעלה בפועל באתר CellStation.

## תהליך העבודה

```text
┌─────────────────┐     ┌──────────────────────┐     ┌────────────────────┐
│   Lovable UI    │────▶│  Google Apps Script  │────▶│   Bookmarklet      │
│  (Activate SIM) │     │   (Command Queue)    │     │  (Execute on Site) │
└─────────────────┘     └──────────────────────┘     └────────────────────┘
         │                       │                            │
         │                       │                            │
         ▼                       ▼                            ▼
┌─────────────────┐     ┌──────────────────────┐     ┌────────────────────┐
│   sim_cards DB  │◀────│  Status Callback     │◀────│   Confirmation     │
│  (Update Status)│     │  (Mark as Done)      │     │   (Success/Fail)   │
└─────────────────┘     └──────────────────────┘     └────────────────────┘
```

---

## רכיב 1: עדכון מסד הנתונים

### הוספת שדות לטבלת sim_cards
- `activation_status` - סטטוס ההפעלה: `none` | `pending` | `activated` | `failed`
- `activation_requested_at` - מתי נשלחה הבקשה
- `activation_completed_at` - מתי ההפעלה הושלמה
- `linked_rental_id` - קישור להשכרה (אופציונלי)
- `linked_customer_id` - קישור ללקוח (אופציונלי)

---

## רכיב 2: Edge Functions

### 2.1 פונקציה: `sim-activation-request`
- **מטרה**: שולחת בקשת הפעלה ל-Google Apps Script
- **קלט**: sim_number, rental_id (אופציונלי), customer_id (אופציונלי)
- **פעולות**:
  1. מעדכנת את sim_cards עם `activation_status = 'pending'`
  2. שולחת POST ל-Google Apps Script עם פרטי הסים
  3. Google Apps Script שומר את הבקשה ב-Google Sheet ("תור הפעלות")

### 2.2 פונקציה: `sim-activation-callback`
- **מטרה**: מקבלת עדכון מה-Bookmarklet לאחר ההפעלה
- **קלט**: sim_number, success/failure, error_message
- **פעולות**:
  1. מעדכנת את sim_cards עם `activation_status = 'activated'` או `'failed'`
  2. מעדכנת את `is_active = true` אם ההפעלה הצליחה

---

## רכיב 3: ממשק משתמש (Rentals Page)

### כפתור "הפעל סים" בכרטיס השכרה
- מוצג רק עבור השכרות פעילות עם סימים
- מציג את הסימים הקשורים להשכרה
- כשנלחץ:
  1. שולח בקשת הפעלה ל-Edge Function
  2. מעדכן את הסטטוס ל-"ממתין להפעלה"
  3. מציג Toast עם הודעת "בקשת ההפעלה נשלחה"

### אינדיקטור סטטוס הפעלה
- 🔄 ממתין להפעלה (pending)
- ✅ הופעל (activated)
- ❌ נכשל (failed)

---

## רכיב 4: Google Apps Script (עדכון)

### Endpoint חדש: doPost
הוספת handler לבקשות POST שמקבל פקודות הפעלה:
```text
{
  "action": "activate",
  "sim_number": "8972...",
  "rental_id": "uuid",
  "customer_id": "uuid"
}
```

### שמירה ב-Sheet חדש: "Activation Queue"
עמודות:
- sim_number
- status (pending/processing/done/failed)
- requested_at
- completed_at
- rental_id
- customer_id

---

## רכיב 5: Bookmarklet

### קוד ה-Bookmarklet
סקריפט JavaScript שרץ בדף CellStation ו:
1. מושך את רשימת הסימים הממתינים מ-Google Apps Script
2. לכל סים בתור:
   - מוצא את הסים בטבלה בדף
   - מבצע את פעולת ההפעלה (קליק על כפתור/מילוי טופס)
   - שולח עדכון ל-Google Apps Script שהפעולה הושלמה
3. Google Apps Script שולח callback ל-Lovable לעדכון הסטטוס

---

## סדר יישום

### שלב 1: עדכון מסד נתונים
- הוספת עמודות חדשות לטבלת sim_cards

### שלב 2: Edge Functions
- יצירת `sim-activation-request`
- יצירת `sim-activation-callback`

### שלב 3: ממשק משתמש
- הוספת כפתור "הפעל סים" לדף ההשכרות
- הוספת אינדיקטור סטטוס הפעלה

### שלב 4: תיעוד Google Apps Script
- הוראות להוספת ה-Endpoint החדש
- מבנה ה-Sheet לתור ההפעלות

### שלב 5: קוד Bookmarklet
- סקריפט מוכן להתקנה בדפדפן
- הוראות שימוש

---

## שיקולי אבטחה
- Edge Function callback מוגן עם API key
- וידוא שרק סימים במצב 'pending' ניתנים לעדכון
- לוגים מפורטים לכל פעולה

## הערות
- ה-Bookmarklet דורש הרצה ידנית על ידי המשתמש
- Google Apps Script משמש כ-middleware בין Lovable ל-Bookmarklet
- הסנכרון הרגיל מ-CellStation ימשיך לעבוד כרגיל

