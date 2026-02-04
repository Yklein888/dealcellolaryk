
# תוכנית שדרוג: דאשבורד CellStation עם פיצ'רים חכמים בעדיפות גבוהה

## סקירה כללית
שדרוג מקיף של דאשבורד CellStation כולל 5 פיצ'רים מתקדמים:
1. **הדפסת הוראות חיוג** - כפתור הדפסה בטבלת המלאי ובסוף תהליך ההפעלה
2. **חישוב מחיר אוטומטי** - חישוב מפורט לפי ימי עסקים (ללא שבתות וחגים)
3. **באנדל עם מכשיר פשוט** - אפשרות להוספת מכשיר ב-5₪ ליום עסקים
4. **אזהרות תוקף סים** - התראה ויזואלית אם הסים יפוג במהלך ההשכרה
5. **סנכרון דו-כיווני עם Supabase** - יצירת השכרה אוטומטית ב-Supabase במקביל לשליחה ל-Google Script

## ממשק משתמש משודרג

### לשונית הפעלה חדשה (מעודכנת)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚡ הפעלת השכרה חדשה                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────┐  ┌────────────────────────────────────────┐ │
│  │  📱 בחר סים פנוי:          │  │  👤 פרטי לקוח:                         │ │
│  │  ┌────────────────────┐   │  │  שם: [_________________]               │ │
│  │  │ 7225-XXX - Golan ▼ │   │  │  טלפון: [_____________]                │ │
│  │  └────────────────────┘   │  └────────────────────────────────────────┘ │
│  │                           │                                             │
│  │  ┌────────────────────────┐  ┌────────────────────────────────────────┐ │
│  │  │ ✅ סים נבחר:           │  │  📅 תאריכים:                           │ │
│  │  │ ICCID: 8972509...     │  │  [שבוע] [שבועיים] [חודש] [מותאם]       │ │
│  │  │ מקומי: 7225-XXX-XXX   │  │  התחלה: [04/02/2026]                   │ │
│  │  │ ישראלי: 44-XXX-XXX    │  │  סיום:  [11/02/2026]                   │ │
│  │  │ תוקף: 15/06/2026      │  │                                         │ │
│  │  │ ⚠️ הסים יפוג ב-X ימים │  │  ⚠️ הסים פג תוקף לפני סיום ההשכרה!    │ │
│  │  └────────────────────────┘  └────────────────────────────────────────┘ │
│  └────────────────────────────┘                                            │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  📦 באנדל עם מכשיר:                                                  │  │
│  │  ☑️ הוסף מכשיר פשוט (+5₪ ליום עסקים)                                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  💰 פירוט מחיר:                                                       │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │ סים אירופאי (7 ימים)                              ₪200.00      │ │  │
│  │  │ מכשיר פשוט (5 ימי עסקים × ₪5)                     ₪25.00       │ │  │
│  │  ├─────────────────────────────────────────────────────────────────┤ │  │
│  │  │ ימים שהוחרגו: שבת 08/02, שבת 15/02                             │ │  │
│  │  ├─────────────────────────────────────────────────────────────────┤ │  │
│  │  │ סה"כ לתשלום:                                      ₪225.00      │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                    ┌────────────────────────────────────────┐              │
│                    │  ⚡ הפעל והשכר (שלח ל-CellStation)      │              │
│                    └────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### דיאלוג הצלחה משופר

```text
┌─────────────────────────────────────────────────────────────────┐
│                    ✅ ההפעלה נשלחה בהצלחה!                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   📱 SIM: 8972509020XXXX (7225-XXX-XXXX)                       │
│   👤 לקוח: ישראל ישראלי                                         │
│   📅 תקופה: 04/02/2026 - 11/02/2026                            │
│   💰 מחיר: ₪225.00                                              │
│                                                                 │
│   ✅ נוצרה השכרה חדשה במערכת                                    │
│   ✅ הסים נוסף למלאי הראשי                                      │
│                                                                 │
│   ⚠️ עכשיו לחץ על הסימנייה באתר CellStation                    │
│      כדי להשלים את ההפעלה                                       │
│                                                                 │
│   ┌────────────────────┐   ┌────────────────────┐              │
│   │  🖨️ הדפס הוראות    │   │  ← חזור לדאשבורד  │              │
│   │     חיוג          │   │                    │              │
│   └────────────────────┘   └────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### לשונית מלאי (משודרגת)

עמודת "פעולות" משודרגת עם:
- כפתור **"הפעל"** - מעביר ללשונית הפעלה
- כפתור **"🖨️"** - הדפסת הוראות חיוג ישירות
- תג **אזהרת תוקף** - אם הסים עומד לפוג

## פירוט טכני

### שינויים בקובץ CellStationDashboard.tsx

#### 1. ייבוא פונקציות קיימות
```typescript
// ייבוא מהמערכת הקיימת
import { printCallingInstructions } from '@/lib/callingInstructions';
import { 
  calculateRentalPrice, 
  getExcludedDaysBreakdown, 
  EUROPEAN_BUNDLE_DEVICE_RATE 
} from '@/lib/pricing';
import { useRental } from '@/hooks/useRental';
```

#### 2. State חדשים
```typescript
// באנדל מכשיר
const [includeDevice, setIncludeDevice] = useState(false);

// מחיר מחושב
const [calculatedPrice, setCalculatedPrice] = useState<{
  total: number;
  breakdown: Array<{ item: string; price: number; currency: string; details?: string }>;
  businessDaysInfo?: { businessDays: number; excludedDates: string[] };
} | null>(null);

// דיאלוג הצלחה
const [showSuccessDialog, setShowSuccessDialog] = useState(false);
const [lastActivation, setLastActivation] = useState<{
  sim: InventoryItem;
  customerName: string;
  price: number;
  startDate: string;
  endDate: string;
} | null>(null);
```

#### 3. חישוב מחיר אוטומטי
```typescript
// Effect לחישוב מחיר בזמן אמת
useEffect(() => {
  if (!selectedSim || !startDate || !endDate) {
    setCalculatedPrice(null);
    return;
  }

  const items = [
    { category: 'sim_european' as ItemCategory, includeEuropeanDevice: includeDevice }
  ];

  const result = calculateRentalPrice(items, startDate, endDate);
  setCalculatedPrice({
    total: result.ilsTotal || result.total,
    breakdown: result.breakdown,
    businessDaysInfo: result.businessDaysInfo
  });
}, [selectedSim, startDate, endDate, includeDevice]);
```

#### 4. בדיקת תוקף סים
```typescript
const getSimExpiryWarning = (sim: InventoryItem, endDate: string): string | null => {
  if (!sim.expiry || !endDate) return null;
  
  const expiryParts = sim.expiry.split('/');
  if (expiryParts.length !== 3) return null;
  
  const expiryDate = new Date(
    parseInt(expiryParts[2]), 
    parseInt(expiryParts[1]) - 1, 
    parseInt(expiryParts[0])
  );
  const rentalEnd = new Date(endDate);
  
  if (expiryDate < rentalEnd) {
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return `הסים יפוג ב-${daysUntilExpiry} ימים - לפני סיום ההשכרה!`;
  }
  return null;
};
```

#### 5. פונקציית הפעלה משודרגת עם סנכרון Supabase
```typescript
const handleActivateAndRent = async () => {
  if (!selectedSim || !customerName || !startDate || !endDate) {
    toast({ title: 'שגיאה', description: 'נא למלא את כל השדות', variant: 'destructive' });
    return;
  }

  try {
    // שלב 1: שליחה ל-Google Script
    await fetch(WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'activate',
        sim: selectedSim.sim,
        customer_name: customerName,
        customer_phone: customerPhone,
        start_date: startDate,
        end_date: endDate,
        price: calculatedPrice?.total || price
      })
    });

    // שלב 2: הוספה למלאי Supabase (אם לא קיים)
    const existingItem = inventory.find(i => i.simNumber === selectedSim.sim);
    let inventoryItemId = existingItem?.id;

    if (!existingItem) {
      await addInventoryItem({
        category: 'sim_european',
        name: `סים ${selectedSim.local_number}`,
        localNumber: selectedSim.local_number,
        israeliNumber: selectedSim.israel_number,
        expiryDate: parseExpiryDate(selectedSim.expiry),
        simNumber: selectedSim.sim,
        status: 'available'
      });
      // קבל את ה-ID של הפריט החדש
      const newItem = inventory.find(i => i.simNumber === selectedSim.sim);
      inventoryItemId = newItem?.id;
    }

    // שלב 3: יצירת השכרה ב-Supabase
    const rentalItems = [
      {
        inventoryItemId: inventoryItemId || '',
        itemCategory: 'sim_european' as ItemCategory,
        itemName: `סים אירופאי - ${selectedSim.local_number}`,
        hasIsraeliNumber: !!selectedSim.israel_number,
        isGeneric: false
      }
    ];

    // הוספת מכשיר לבאנדל
    if (includeDevice) {
      rentalItems.push({
        inventoryItemId: '',
        itemCategory: 'device_simple' as ItemCategory,
        itemName: 'מכשיר פשוט (באנדל אירופאי)',
        hasIsraeliNumber: false,
        isGeneric: true // מכשיר פשוט לא דורש פריט מלאי
      });
    }

    await addRental({
      customerId: '', // יימצא לפי שם הלקוח
      customerName,
      items: rentalItems,
      startDate,
      endDate,
      totalPrice: calculatedPrice?.total || parseFloat(price) || 0,
      currency: 'ILS',
      status: 'active',
      notes: `הופעל מ-CellStation Dashboard | טלפון: ${customerPhone}`
    });

    // שלב 4: הצגת דיאלוג הצלחה
    setLastActivation({
      sim: selectedSim,
      customerName,
      price: calculatedPrice?.total || 0,
      startDate,
      endDate
    });
    setShowSuccessDialog(true);

    // איפוס הטופס
    resetForm();

  } catch (error: any) {
    toast({
      title: 'שגיאה',
      description: error.message || 'נכשל בהפעלה',
      variant: 'destructive'
    });
  }
};
```

#### 6. כפתור הדפסת הוראות
```typescript
const handlePrintInstructions = async (sim: InventoryItem) => {
  try {
    await printCallingInstructions(
      sim.israel_number,
      sim.local_number,
      `SIM-${sim.sim.slice(-8)}`, // ברקוד
      false, // סים אירופאי
      sim.plan,
      sim.expiry
    );
    toast({ title: 'הודפס בהצלחה', description: 'ההוראות נשלחו למדפסת' });
  } catch (error) {
    toast({ title: 'שגיאה בהדפסה', variant: 'destructive' });
  }
};
```

### רכיבי UI חדשים

#### תצוגת פירוט מחיר
```typescript
{calculatedPrice && (
  <Card className="bg-primary/10 border-primary/30">
    <CardContent className="p-4">
      <h4 className="font-semibold mb-2 flex items-center gap-2">
        <Calculator className="h-4 w-4" />
        פירוט מחיר
      </h4>
      {calculatedPrice.breakdown.map((item, idx) => (
        <div key={idx} className="flex justify-between text-sm">
          <span>{item.item}</span>
          <span>{item.currency}{item.price.toFixed(2)}</span>
        </div>
      ))}
      {calculatedPrice.businessDaysInfo && (
        <div className="text-xs text-muted-foreground mt-2 border-t pt-2">
          ימים שהוחרגו: {calculatedPrice.businessDaysInfo.excludedDates.slice(0, 3).join(', ')}
          {calculatedPrice.businessDaysInfo.excludedDates.length > 3 && '...'}
        </div>
      )}
      <div className="border-t pt-2 mt-2 flex justify-between font-bold">
        <span>סה"כ</span>
        <span>₪{calculatedPrice.total.toFixed(2)}</span>
      </div>
    </CardContent>
  </Card>
)}
```

#### אזהרת תוקף סים
```typescript
{selectedSim && endDate && getSimExpiryWarning(selectedSim, endDate) && (
  <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg text-warning">
    <AlertTriangle className="h-5 w-5" />
    <span className="text-sm font-medium">
      {getSimExpiryWarning(selectedSim, endDate)}
    </span>
  </div>
)}
```

## קבצים שיעודכנו

| קובץ | פעולה | תיאור |
|------|-------|--------|
| `src/components/cellstation/CellStationDashboard.tsx` | עדכון מקיף | הוספת כל הפיצ'רים החכמים |

## תלויות בפונקציות קיימות

הדאשבורד המשודרג ישתמש בפונקציות שכבר קיימות במערכת:

| פונקציה | מיקום | שימוש |
|---------|-------|-------|
| `printCallingInstructions` | `src/lib/callingInstructions.ts` | הדפסת PDF עם הוראות חיוג |
| `calculateRentalPrice` | `src/lib/pricing.ts` | חישוב מחיר לפי ימי עסקים |
| `getExcludedDaysBreakdown` | `src/lib/pricing.ts` | פירוט ימים שהוחרגו |
| `addRental` | `src/hooks/useRental.tsx` | יצירת השכרה ב-Supabase |
| `addInventoryItem` | `src/hooks/useRental.tsx` | הוספת סים למלאי |

## זרימת תהליך משודרגת

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         תהליך "הפעל והשכר" משודרג                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   1. בחירת סים פנוי מרשימת CellStation                                      │
│      ↓                                                                      │
│   2. מילוי פרטי לקוח (עם בדיקה אם קיים ב-Supabase)                         │
│      ↓                                                                      │
│   3. בחירת תאריכים (עם אזהרה אם הסים יפוג)                                  │
│      ↓                                                                      │
│   4. בחירה אם להוסיף מכשיר פשוט לבאנדל                                      │
│      ↓                                                                      │
│   5. צפייה במחיר מחושב אוטומטית                                             │
│      ↓                                                                      │
│   6. לחיצה על "הפעל והשכר"                                                  │
│      ↓                                                                      │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │                       פעולות במקביל                               │    │
│   │  ┌─────────────────────┐  ┌─────────────────────────────────────┐ │    │
│   │  │ Google Script       │  │ Supabase                            │ │    │
│   │  │ - action: activate  │  │ - הוספה למלאי (אם חדש)              │ │    │
│   │  │ - ממתין לבוקמרקלט   │  │ - יצירת השכרה + פריטים              │ │    │
│   │  └─────────────────────┘  │ - עדכון סטטוס לrented               │ │    │
│   │                           └─────────────────────────────────────┘ │    │
│   └───────────────────────────────────────────────────────────────────┘    │
│      ↓                                                                      │
│   7. דיאלוג הצלחה עם אפשרות הדפסת הוראות                                   │
│      ↓                                                                      │
│   8. המשתמש לוחץ על בוקמרקלט ב-CellStation להשלמת ההפעלה                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## יתרונות הפתרון

1. **סנכרון מלא** - ההשכרה נוצרת גם ב-CellStation וגם ב-Supabase
2. **חישוב מדויק** - מחיר מחושב אוטומטית לפי ימי עסקים בלבד
3. **מניעת טעויות** - אזהרה ברורה כשהסים עומד לפוג
4. **תהליך מהיר** - הדפסת הוראות בלחיצה אחת
5. **גמישות** - אפשרות להוסיף מכשיר לבאנדל בקלות
6. **שימוש בקוד קיים** - ניצול הפונקציות הקיימות במערכת
