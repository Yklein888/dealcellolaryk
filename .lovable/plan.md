
# תוכנית: מערכת קופה (POS) לחנות

## סקירה כללית

מערכת קופה מודרנית ומהירה לחנות פיזית, עם הפרדה מלאה בין ממשק הקופה לבין מערכת החשבוניות החיצונית (YPAY). המערכת תתמוך בתשלום במזומן ובאשראי, עם מעקב סטטוס מלא לכל עסקה.

---

## מבנה המערכת

```text
+------------------+     +-----------------+     +------------------+
|                  |     |                 |     |                  |
|   מסך קופה ראשי  | --> |  מסך תשלום      | --> |  מסך אישור       |
|   (מוצרים+עגלה)  |     |  (אשראי/מזומן)  |     |  (מסמך מ-YPAY)   |
|                  |     |                 |     |                  |
+------------------+     +-----------------+     +------------------+
         |                       |                       |
         v                       v                       v
+---------------------------------------------------------------+
|                     מסד נתונים (Supabase)                      |
|  - pos_products (מוצרים)                                       |
|  - pos_sales (עסקאות)                                          |
|  - pos_sale_items (פריטים בעסקה)                                |
|  - pos_audit_log (לוג ביקורת)                                   |
+---------------------------------------------------------------+
         |                       |
         v                       v
+------------------+     +------------------+
|   Pelecard API   |     |    YPAY API      |
|   (אשראי)        |     |   (חשבוניות)     |
+------------------+     +------------------+
```

---

## טבלאות חדשות במסד הנתונים

### 1. pos_products (מוצרים לקופה)
| עמודה | סוג | תיאור |
|-------|-----|-------|
| id | uuid | מזהה ייחודי |
| name | text | שם המוצר |
| sku | text | מק"ט (אופציונלי) |
| price | numeric | מחיר |
| category | text | קטגוריה |
| image_url | text | תמונה (אופציונלי) |
| is_active | boolean | פעיל למכירה |
| display_order | integer | סדר הצגה |

### 2. pos_sales (עסקאות מכירה)
| עמודה | סוג | תיאור |
|-------|-----|-------|
| id | uuid | מזהה עסקה |
| sale_number | serial | מספר מכירה רץ |
| status | enum | סטטוס (created/awaiting_payment/payment_approved/document_generated/completed/failed) |
| total_amount | numeric | סכום כולל |
| payment_method | text | אשראי/מזומן |
| cash_received | numeric | סכום שהתקבל (מזומן) |
| cash_change | numeric | עודף |
| payment_reference | text | מזהה תשלום חיצוני |
| ypay_document_number | text | מספר מסמך מ-YPAY |
| ypay_document_url | text | קישור למסמך |
| ypay_document_type | text | סוג מסמך |
| cashier_id | uuid | מזהה קופאי |
| created_at | timestamp | נוצר |
| completed_at | timestamp | הושלם |

### 3. pos_sale_items (פריטים בעסקה)
| עמודה | סוג | תיאור |
|-------|-----|-------|
| id | uuid | מזהה |
| sale_id | uuid | קישור לעסקה |
| product_id | uuid | קישור למוצר |
| product_name | text | שם המוצר (snapshot) |
| quantity | integer | כמות |
| unit_price | numeric | מחיר יחידה |
| line_total | numeric | סה"כ שורה |

### 4. pos_audit_log (לוג ביקורת)
| עמודה | סוג | תיאור |
|-------|-----|-------|
| id | uuid | מזהה |
| action | text | פעולה (sale_created, payment_processed, document_generated, refund_requested) |
| sale_id | uuid | עסקה קשורה |
| user_id | uuid | מי ביצע |
| details | jsonb | פרטים נוספים |
| created_at | timestamp | זמן |

---

## Edge Functions חדשות

### 1. ypay-generate-document
- מקבל: פרטי עסקה, שיטת תשלום, מזהה תשלום
- שולח ל-YPAY API: בקשת יצירת מסמך (קבלה/חשבונית-קבלה)
- מחזיר: מספר מסמך, URL, סוג מסמך
- מטפל בשגיאות: אם YPAY לא זמין - חוסם את השלמת העסקה

### 2. pos-process-sale
- מנהל את כל זרימת העסקה
- מעדכן סטטוס בכל שלב
- קורא ל-pelecard-pay (אשראי) או ישירות ל-ypay (מזומן)

---

## מסכים ורכיבים

### 1. מסך קופה ראשי (POSMain.tsx)
```text
+------------------------------------------+
|  🔍 חיפוש מוצר                    [⚙️]  |
+------------------------------------------+
|                    |                     |
|   📦 📦 📦 📦     |    עגלת קניות       |
|   📦 📦 📦 📦     |    ─────────────     |
|   📦 📦 📦 📦     |    מוצר 1    x2  ₪20 |
|   📦 📦 📦 📦     |    מוצר 2    x1  ₪15 |
|                    |    ─────────────     |
|   כפתורי מוצרים   |    סה"כ: ₪35        |
|   גדולים (grid)   |                     |
|                    |    [לתשלום ➡️]       |
+------------------------------------------+
```

**תכונות:**
- גריד מוצרים עם כפתורים גדולים (מותאם למסך מגע)
- חיפוש מוצר בזמן אמת
- עגלה בצד עם אפשרות עדכון כמות/מחיקה
- כפתור מעבר לתשלום (רק אם יש פריטים)

### 2. מסך תשלום (POSPayment.tsx)
```text
+------------------------------------------+
|           💳 תשלום                        |
+------------------------------------------+
|                                          |
|         סה"כ לתשלום: ₪35.00             |
|                                          |
|    +------------+    +------------+      |
|    |   💳      |    |   💵      |       |
|    |  אשראי    |    |  מזומן    |       |
|    +------------+    +------------+      |
|                                          |
|    [אם מזומן: שדה סכום שהתקבל]          |
|    [חישוב עודף אוטומטי]                 |
|                                          |
|    [אשר תשלום ✓]         [חזור ←]       |
+------------------------------------------+
```

### 3. מסך עיבוד (POSProcessing.tsx)
```text
+------------------------------------------+
|                                          |
|            ⏳ מעבד תשלום...              |
|                                          |
|         [מעבד תשלום באשראי]             |
|                  ↓                       |
|         [יוצר מסמך ב-YPAY]              |
|                                          |
|    (כל הפעולות חסומות בזמן עיבוד)       |
+------------------------------------------+
```

### 4. מסך אישור (POSConfirmation.tsx)
```text
+------------------------------------------+
|                                          |
|            ✓ העסקה הושלמה!              |
|                                          |
|       מספר מסמך: 12345                   |
|       סוג: קבלה                          |
|                                          |
|    [📧 שלח ללקוח]    [🖨️ הדפס]          |
|                                          |
|          [מכירה חדשה 🔄]                |
+------------------------------------------+
```

### 5. דשבורד מנהל (POSDashboard.tsx)
- סה"כ מכירות היום
- פילוח: אשראי / מזומן
- מספר עסקאות
- עסקאות שנכשלו
- סינון לפי תאריך וקופאי

### 6. היסטוריית עסקאות (POSHistory.tsx)
- רשימת כל העסקאות
- פרטי כל עסקה
- קישור למסמך ב-YPAY
- אפשרות יזום החזר (דרך YPAY)

---

## זרימת תשלום - אשראי

```text
1. משתמש לוחץ "אשראי"
2. סטטוס: created → awaiting_payment
3. קריאה ל-pelecard-pay
4. אם נכשל: אפשר retry או cancel
5. אם הצליח: סטטוס → payment_approved
6. קריאה ל-ypay-generate-document
7. אם YPAY נכשל: חסום השלמה, אפשר retry
8. אם YPAY הצליח: סטטוס → document_generated → completed
9. הצג מסך אישור עם מספר מסמך
```

## זרימת תשלום - מזומן

```text
1. משתמש לוחץ "מזומן"
2. מזין סכום שהתקבל
3. מחשב עודף
4. סטטוס: created → awaiting_payment → payment_approved
5. קריאה ל-ypay-generate-document
6. אם YPAY נכשל: חסום! לא ניתן להשלים ללא מסמך
7. אם YPAY הצליח: סטטוס → document_generated → completed
8. הצג עודף + מספר מסמך
```

---

## הרשאות ותפקידים

| תפקיד | הרשאות |
|-------|--------|
| קופאי (cashier) | יצירת מכירות, תשלום, צפייה בעסקאות שלו |
| מנהל (manager) | כל הנ"ל + דשבורד, היסטוריה, יזום החזרים |
| בעלים (admin) | כל הנ"ל + הגדרות, ניהול מוצרים |

---

## אבטחה ותאימות

1. **ללא אחסון פרטי אשראי** - רק מזהי עסקאות
2. **Audit log מלא** - מי עשה מה ומתי
3. **RLS policies** - כל משתמש רואה רק מה שמותר לו
4. **סטטוסים מחייבים** - אי אפשר לדלג על שלבים
5. **חסימת עריכה** - אחרי document_generated אי אפשר לערוך

---

## אינטגרציית YPAY

**Secrets נדרשים:**
- `YPAY_CLIENT_ID`
- `YPAY_CLIENT_SECRET`

**זרימת API:**
1. קבלת Access Token (תקף שעה)
2. קריאה ל-Document Generator
3. קבלת URL + מספר מסמך

---

## קבצים חדשים

### דפים:
- `src/pages/POS.tsx` - מסך קופה ראשי
- `src/pages/POSDashboard.tsx` - דשבורד מנהל
- `src/pages/POSHistory.tsx` - היסטוריית עסקאות
- `src/pages/POSProducts.tsx` - ניהול מוצרים

### קומפוננטות:
- `src/components/pos/POSProductGrid.tsx`
- `src/components/pos/POSCart.tsx`
- `src/components/pos/POSPaymentDialog.tsx`
- `src/components/pos/POSProcessingOverlay.tsx`
- `src/components/pos/POSConfirmationDialog.tsx`
- `src/components/pos/POSProductSearch.tsx`

### Hooks:
- `src/hooks/usePOSSale.tsx` - ניהול עסקה
- `src/hooks/usePOSProducts.tsx` - ניהול מוצרים
- `src/hooks/useYPay.tsx` - אינטגרציית YPAY

### Edge Functions:
- `supabase/functions/ypay-auth/index.ts` - קבלת token
- `supabase/functions/ypay-document/index.ts` - יצירת מסמך
- `supabase/functions/pos-process-sale/index.ts` - עיבוד מכירה

### טיפוסים:
- `src/types/pos.ts` - טיפוסי POS

---

## פרטים טכניים

### מיגרציית מסד נתונים
יצירת enum לסטטוס עסקה:
```sql
CREATE TYPE pos_sale_status AS ENUM (
  'created',
  'awaiting_payment', 
  'payment_approved',
  'document_generated',
  'completed',
  'failed'
);
```

### עדכון ניווט
הוספת קישורים לסיידבר:
- קופה (POS)
- דשבורד קופה (מנהל)
- מוצרים (אדמין)

---

## שלבי מימוש

1. **שלב 1**: מיגרציית DB + טיפוסים
2. **שלב 2**: Edge functions (YPAY)
3. **שלב 3**: מסך קופה ראשי + עגלה
4. **שלב 4**: זרימת תשלום (אשראי + מזומן)
5. **שלב 5**: מסכי עיבוד ואישור
6. **שלב 6**: דשבורד והיסטוריה
7. **שלב 7**: ניהול מוצרים
8. **שלב 8**: הרשאות ו-RLS

---

## הערה חשובה

לפני התחלת המימוש, יש צורך להזין את ה-secrets של YPAY:
- `YPAY_CLIENT_ID`
- `YPAY_CLIENT_SECRET`

האם יש לך גישה ל-API של YPAY? אם כן, אוכל להתחיל מיד במימוש.
