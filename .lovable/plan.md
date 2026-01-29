
# תוכנית משולבת: שיפור מערכת ההשכרות + מעקב שיחות אוטומטי

## סיכום כללי
תוכנית זו משלבת את כל הדרישות לפרויקט אחד מקיף:
1. שיפור ממשק יצירת השכרה חדשה
2. מעקב שיחות מלא (ידניות ואוטומטיות)
3. חיוג אוטומטי ב-14:00 ביום הראשון של האיחור

---

## חלק א: שיפור ממשק ההשכרות

### 1. חלון השכרה רחב (Horizontal Layout)

**מה ישתנה:**
- חלון ההשכרה יהפוך לרוחב מלא על המסך
- פריסה ב-2 עמודות: שמאל (לקוח + תאריכים) | ימין (בחירת פריטים)
- כל המידע נראה בלי גלילה

**קוד:**
```text
DialogContent: max-w-6xl w-[98vw]
Grid: grid-cols-1 lg:grid-cols-2 gap-6
```

### 2. גריד ויזואלי למלאי

**מה ישתנה:**
- כרטיסים גדולים וצבעוניים לפי קטגוריה
- כפתור "הוסף לסל" בולט בכל כרטיס
- אינדיקציה ברורה לפריט שנבחר (גבול ירוק + סימן V)

**צבעי קטגוריות:**

| קטגוריה | צבע רקע | צבע גבול |
|---------|---------|----------|
| סים אמריקאי | bg-red-50 | border-red-200 |
| סים אירופאי | bg-blue-50 | border-blue-200 |
| מכשיר פשוט | bg-green-50 | border-green-200 |
| סמארטפון | bg-purple-50 | border-purple-200 |
| מודם | bg-orange-50 | border-orange-200 |
| נטסטיק | bg-cyan-50 | border-cyan-200 |

### 3. לוח שנה ויזואלי לתאריכים

**מה ישתנה:**
- Popover עם Calendar במקום שדות תאריך
- בחירת טווח תאריכים ישירות על הלוח
- הצגת מספר הימים ומחיר צפוי

**ללא כפתורי קיצור** - רק לוח שנה נקי

### 4. באנדלים פופולריים משופרים

**מה ישתנה:**
- כרטיסי באנדל גדולים יותר עם עיצוב premium
- הצגת מחיר משוער לכל באנדל
- אייקונים גדולים יותר

---

## חלק ב: מערכת מעקב שיחות

### 5. טבלת call_logs חדשה

**סכמה:**

| שדה | סוג | תיאור |
|-----|-----|-------|
| id | uuid | מזהה ייחודי |
| entity_type | text | 'rental' או 'repair' |
| entity_id | uuid | מזהה ההשכרה/תיקון |
| customer_id | uuid | מזהה הלקוח (nullable) |
| customer_phone | text | מספר טלפון |
| call_status | text | pending / answered / no_answer / busy / callback |
| campaign_id | text | מזהה קמפיין מימות המשיח |
| call_type | text | 'manual' או 'automatic' |
| call_message | text | תוכן ההודעה שנשלחה |
| created_at | timestamp | זמן השיחה |
| updated_at | timestamp | זמן עדכון הסטטוס |

**RLS Policy:**
```sql
CREATE POLICY "Authenticated users can manage call_logs"
ON public.call_logs FOR ALL
USING (true)
WITH CHECK (true);
```

### 6. עדכון Edge Function - yemot-call

**שינויים:**
- שמירת רשומה ב-call_logs לפני שליחת השיחה
- החזרת campaign_id לממשק
- פרמטרים חדשים: entityType, entityId, callType

**קוד עיקרי:**
```typescript
interface YemotCallRequest {
  phone: string;
  message: string;
  callerId?: string;
  campaignType?: 'repair_ready' | 'rental_reminder';
  // New fields for logging
  entityType?: 'rental' | 'repair';
  entityId?: string;
  customerId?: string;
  callType?: 'manual' | 'automatic';
}

// Save call log to database
const { data: logData } = await supabase.from('call_logs').insert({
  entity_type: entityType,
  entity_id: entityId,
  customer_id: customerId,
  customer_phone: cleanPhone,
  call_status: 'pending',
  campaign_id: campaignId,
  call_type: callType || 'manual',
  call_message: message,
}).select().single();
```

### 7. Edge Function חדש - yemot-callback (Webhook)

**מטרה:** קבלת דיווחי סטטוס מימות המשיח

**קוד:**
```typescript
// supabase/functions/yemot-callback/index.ts
serve(async (req) => {
  const { campaignId, status, phone } = await parseYemotResponse(req);
  
  // Map Yemot status to our status
  const mappedStatus = mapYemotStatus(status);
  
  // Update call log
  await supabase.from('call_logs')
    .update({ 
      call_status: mappedStatus,
      updated_at: new Date().toISOString()
    })
    .eq('campaign_id', campaignId);
});
```

**Mapping סטטוסים:**

| סטטוס ימות | סטטוס מערכת |
|------------|-------------|
| answered | answered |
| noanswer | no_answer |
| busy | busy |
| callback | callback |

---

## חלק ג: חיוג אוטומטי באיחור

### 8. Edge Function חדש - process-overdue-calls

**לוגיקה:**
1. מציאת השכרות שהפכו לאיחור **היום** (endDate = אתמול)
2. בדיקה אם כבר התקשרנו היום
3. שליפת טלפון הלקוח
4. קריאה ל-yemot-call לביצוע השיחה
5. שמירת הרשומה ב-call_logs עם callType='automatic'

**הודעה אוטומטית:**
```text
שלום [שם לקוח], זוהי תזכורת ממערכת דיל סלולר. 
מועד ההחזרה של הציוד המושכר עבר. 
אנא צור קשר להחזרת הציוד בהקדם. תודה רבה.
```

### 9. תזמון ב-14:00 כל יום (pg_cron)

**SQL:**
```sql
SELECT cron.schedule(
  'process-overdue-calls-daily-14',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url:='https://qifcynwnxmtoxzpskmmt.supabase.co/functions/v1/process-overdue-calls',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer [ANON_KEY]'
    ),
    body:='{}'::jsonb
  );
  $$
);
```

**שעת הפעלה:** 14:00 (שעון ישראל = UTC+2/3)
- בחורף: 12:00 UTC
- בקיץ: 11:00 UTC

---

## חלק ד: ממשק היסטוריית שיחות

### 10. קומפוננטה חדשה - CallHistoryBadge

**מיקום:** ליד כל כפתור "התקשר ללקוח"

**תצוגה:**
- Badge עם מספר השיחות (לדוגמה: "3 שיחות")
- צבע לפי סטטוס אחרון: ירוק (ענה), אדום (לא ענה), אפור (ממתין)
- לחיצה פותחת Popover עם היסטוריה מלאה

**עיצוב:**
```text
┌──────────────────────────────────────────┐
│  📞 3 שיחות                    [סגור]   │
├──────────────────────────────────────────┤
│  29/01/2026 14:00  ✅ ענה    (אוטומטי)  │
│  28/01/2026 10:30  ❌ לא ענה  (ידני)    │
│  27/01/2026 09:15  ⏳ ממתין   (ידני)    │
└──────────────────────────────────────────┘
```

### 11. שילוב בדף השכרות

**שינויים ב-Rentals.tsx:**
- הוספת CallHistoryBadge ליד כפתור "הודע ללקוח"
- עדכון notifyRentalCustomer לשלוח entityType + entityId
- הצגת היסטוריה לפני שליחת שיחה חדשה

### 12. שילוב בדף תיקונים

**שינויים ב-Repairs.tsx:**
- הוספת CallHistoryBadge ליד כפתור "הודע ללקוח"
- עדכון notifyCustomer לשלוח entityType + entityId
- הצגת היסטוריה לפני שליחת שיחה חדשה

---

## חלק ה: עדכוני Types ו-Hook

### 13. עדכון src/types/rental.ts

```typescript
// New type for call logs
export interface CallLog {
  id: string;
  entityType: 'rental' | 'repair';
  entityId: string;
  customerId?: string;
  customerPhone: string;
  callStatus: 'pending' | 'answered' | 'no_answer' | 'busy' | 'callback';
  campaignId?: string;
  callType: 'manual' | 'automatic';
  callMessage?: string;
  createdAt: string;
  updatedAt?: string;
}
```

### 14. עדכון src/hooks/useRental.tsx

**פונקציות חדשות:**
- `getCallLogs(entityType, entityId)` - שליפת היסטוריית שיחות
- `addCallLog(log)` - הוספת רשומת שיחה (נעשה ב-Edge Function)

---

## סיכום קבצים לעדכון

| קובץ | פעולה | תיאור |
|------|-------|-------|
| `src/pages/Rentals.tsx` | עדכון | ממשק רחב, גריד ויזואלי, לוח שנה, באנדלים, CallHistoryBadge |
| `src/pages/Repairs.tsx` | עדכון | CallHistoryBadge, עדכון notifyCustomer |
| `src/types/rental.ts` | עדכון | הוספת טיפוס CallLog |
| `src/hooks/useRental.tsx` | עדכון | פונקציות call_logs |
| `src/components/CallHistoryBadge.tsx` | חדש | קומפוננטת היסטוריית שיחות |
| `supabase/functions/yemot-call/index.ts` | עדכון | שמירת לוג, החזרת campaign_id |
| `supabase/functions/yemot-callback/index.ts` | חדש | Webhook לקבלת סטטוס |
| `supabase/functions/process-overdue-calls/index.ts` | חדש | חיוג אוטומטי ב-14:00 |
| **Migration** | חדש | טבלת call_logs + pg_cron job |

---

## הערה חשובה: הגדרת Webhook בימות המשיח

כדי לקבל דיווחי סטטוס אוטומטיים, יש להגדיר את ה-URL הבא בממשק ימות המשיח:
```
https://qifcynwnxmtoxzpskmmt.supabase.co/functions/v1/yemot-callback
```

אם אין אפשרות להגדיר webhook, נוסיף כפתור ידני "עדכן סטטוס" שיאפשר למשתמש לסמן אם הלקוח ענה או לא.

---

## סדר ביצוע

```text
שלב 1: יצירת טבלת call_logs (Migration)
   ↓
שלב 2: עדכון yemot-call לשמירת לוגים
   ↓
שלב 3: יצירת yemot-callback (Webhook)
   ↓
שלב 4: יצירת process-overdue-calls + pg_cron
   ↓
שלב 5: יצירת CallHistoryBadge קומפוננטה
   ↓
שלב 6: עדכון Rentals.tsx (ממשק רחב + גריד + שיחות)
   ↓
שלב 7: עדכון Repairs.tsx (שיחות)
   ↓
שלב 8: עדכון types + hook
```
