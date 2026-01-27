
# תוכנית: שיפור מערכת סליקה Pelecard

## מה הבנתי

### המצב הקיים
- יש Edge Function פעילה ב-`supabase/functions/pelecard-pay/index.ts`
- משתמשת ב-endpoint: `https://gateway21.pelecard.biz/services/DebitRegularType`
- מקבלת שגיאת אימות (קוד 501): "Login for user deal failed"

### הקוד שסיפקת
- מבוסס על Node.js/Express (לא תואם ישירות ל-Edge Functions שמשתמשות ב-Deno)
- כולל תכונות נוספות טובות:
  - בדיקת idempotency (למניעת כפילויות)
  - לוגים מובנים
  - טיפול בשגיאות מפורט

## מה נעשה

### שלב 1: עדכון Edge Function
שדרוג הפונקציה `pelecard-pay` עם השיפורים הבאים:

```text
┌────────────────────────────────────────────────────────────────┐
│  pelecard-pay Edge Function (Deno)                            │
├────────────────────────────────────────────────────────────────┤
│  1. בדיקת idempotency לפי transaction_id                      │
│  2. תמיכה בשתי שיטות תשלום:                                   │
│     - Direct Debit (כרטיס + CVV)                              │
│     - Token-based (אם יש token שמור)                          │
│  3. לוגים מפורטים ללא מידע רגיש                               │
│  4. טיפול בשגיאות משופר                                       │
└────────────────────────────────────────────────────────────────┘
```

### שלב 2: הוספת טבלת payment_transactions
לשמירת היסטוריית עסקאות ובדיקת כפילויות:

| שדה | סוג | תיאור |
|-----|-----|-------|
| id | uuid | מזהה ייחודי |
| rental_id | uuid | קישור להשכרה |
| transaction_id | text | מזהה עסקה (idempotency) |
| amount | numeric | סכום |
| status | enum | success / failed / pending |
| gateway_response | jsonb | תגובת הסליקה |
| created_at | timestamp | תאריך יצירה |

### שלב 3: עדכון הקוד הקיים ב-Edge Function

```typescript
// שינויים עיקריים:

// 1. הוספת בדיקת idempotency
const existingTransaction = await checkIdempotency(transactionId);
if (existingTransaction) {
  return existingResponse(existingTransaction);
}

// 2. תמיכה ב-token או כרטיס
const payload = token 
  ? { token, total, currency: "1", ... }
  : { creditCard, creditCardDateMmYy, cvv2, total, ... };

// 3. שמירת תוצאת העסקה ב-DB
await saveTransaction({
  rentalId,
  transactionId,
  amount,
  status: result.success ? 'success' : 'failed',
  gatewayResponse: result
});
```

### שלב 4: עדכון ה-Frontend
הוספת `transaction_id` ייחודי לכל בקשת תשלום למניעת כפילויות

## הערה חשובה לגבי שגיאת האימות

שגיאת 501 "Login for user deal failed" מצביעה על:
- פרטי התחברות שגויים (user/password/terminal)
- או שה-Terminal לא מורשה לסוג העסקה הזה

**יש לוודא** שה-secrets מוגדרים נכון:
- `PELECARD_TERMINAL` - מספר מסוף נכון
- `PELECARD_USER` - שם משתמש נכון
- `PELECARD_PASSWORD` - סיסמה נכונה

בקוד שסיפקת רשום:
- TERMINAL: `5757227016`
- USER: `deal`

אם אלו הפרטים הנכונים, יש לעדכן את ה-secrets. אם לא, יש לספק את הפרטים הנכונים.

## פרטים טכניים

### קבצים שיווצרו/יעודכנו
1. `supabase/functions/pelecard-pay/index.ts` - עדכון הלוגיקה
2. Migration חדש - טבלת payment_transactions
3. `src/pages/Rentals.tsx` - הוספת transaction_id לבקשות

### RLS לטבלת payment_transactions
```sql
-- כל משתמש מאומת יכול לראות ולהוסיף עסקאות
CREATE POLICY "Authenticated users can manage transactions"
ON payment_transactions
FOR ALL
USING (true)
WITH CHECK (true);
```
