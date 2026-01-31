
# תוכנית שיפורים מקיפה למערכת

## סיכום הבקשות

1. **התקשרות רק ללקוחות עם סימים** - להתקשר ללקוחות רק כאשר הם לקחו סים (לא רק מכשיר)
2. **חובת מספר סים בהוספת מלאי** - לא לאפשר הוספת סים ללא מספר סים (ICCID), עם אפשרות לערוך
3. **שיפור החיפוש הגלובלי** - הצגת סטטוס המוצר בתוצאות + ניווט ישיר לפעולות מהירות
4. **הארכת השכרה בלחיצה** - כפתור מהיר להארכת השכרה
5. **ברקוד אוטומטי למוצרים** - כל מוצר מקבל ברקוד וניתן לסרוק אותו לניווט מהיר

---

## פתרון 1: התקשרות רק ללקוחות עם סימים

### קובץ: `supabase/functions/process-overdue-calls/index.ts`

נוסיף בדיקה של פריטי ההשכרה לפני ביצוע שיחה:

```typescript
// Check if rental includes at least one SIM card
const { data: rentalItems, error: itemsError } = await supabase
  .from('rental_items')
  .select('item_category')
  .eq('rental_id', rental.id);

if (itemsError) {
  console.error(`Error fetching rental items for ${rental.id}:`, itemsError);
  continue;
}

const hasSim = rentalItems?.some(item => 
  item.item_category === 'sim_european' || item.item_category === 'sim_american'
);

if (!hasSim) {
  console.log(`Rental ${rental.id} has no SIM cards, skipping call`);
  results.push({ rentalId: rental.id, success: true, error: 'No SIM cards in rental' });
  continue;
}
```

---

## פתרון 2: חובת מספר סים בהוספת מלאי

### קובץ: `src/pages/Inventory.tsx`

**שינויים:**
1. הוספת ולידציה ב-`handleSubmit` - בדיקה שמספר סים מוזן לקטגוריות סים
2. הוספת אינדיקציה ויזואלית לשדה חובה

```tsx
const handleSubmit = () => {
  if (!formData.name) {
    toast({
      title: 'שגיאה',
      description: 'יש להזין שם לפריט',
      variant: 'destructive',
    });
    return;
  }

  // Validate SIM number for SIM categories
  if (isSim(formData.category) && !formData.simNumber) {
    toast({
      title: 'שגיאה',
      description: 'יש להזין מספר סים (ICCID) לפריט מסוג סים',
      variant: 'destructive',
    });
    return;
  }

  // ... rest of submit logic
};
```

**עדכון ה-Label של שדה מספר סים:**
```tsx
<Label>
  מספר סים (ICCID) <span className="text-destructive">*</span>
</Label>
```

**הערה:** עריכה כבר נתמכת דרך `handleEdit` שממלא את הטופס עם כל הנתונים הקיימים.

---

## פתרון 3: שיפור החיפוש הגלובלי

### קובץ: `src/components/GlobalSearch.tsx`

**שינויים:**

1. **הוספת סטטוס לממשק התוצאות:**
```typescript
interface SearchResult {
  type: 'customer' | 'inventory' | 'rental' | 'repair';
  id: string;
  title: string;
  subtitle: string;
  status?: string;  // סטטוס הפריט
  statusVariant?: 'success' | 'warning' | 'destructive' | 'info';
  icon: React.ReactNode;
  link: string;
  // New: action data for quick actions
  actionData?: {
    itemId?: string;
    inventoryItem?: InventoryItem;
    rental?: Rental;
  };
}
```

2. **הצגת סטטוס בתוצאות חיפוש מלאי:**
```tsx
// Search inventory with status
inventory.forEach(item => {
  if (matchesSearch) {
    const statusLabels = { available: 'זמין', rented: 'מושכר', maintenance: 'בתחזוקה' };
    const statusVariants = { available: 'success', rented: 'info', maintenance: 'warning' };
    
    searchResults.push({
      type: 'inventory',
      id: item.id,
      title: item.name,
      subtitle: `${categoryIcons[item.category]} ${categoryLabels[item.category]}`,
      status: statusLabels[item.status],
      statusVariant: statusVariants[item.status],
      icon: <Package className="h-4 w-4" />,
      link: '/inventory',
      actionData: { inventoryItem: item },
    });
  }
});
```

3. **דיאלוג פעולות מהירות בלחיצה על תוצאה:**

במקום ניווט ישיר לדף, נפתח דיאלוג פעולות מהירות:

```tsx
const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
const [quickActionDialogOpen, setQuickActionDialogOpen] = useState(false);

const handleSelect = (result: SearchResult) => {
  if (result.type === 'inventory' && result.actionData?.inventoryItem) {
    setSelectedItem(result);
    setQuickActionDialogOpen(true);
  } else {
    navigate(result.link);
    onClose();
  }
};
```

**דיאלוג פעולות מהירות למוצר:**
- צפייה בפרטים מלאים
- עריכת המוצר
- הוספה להשכרה חדשה (אם זמין)
- ניווט לדף מלאי

---

## פתרון 4: הארכת השכרה בלחיצה

### קובץ: `src/pages/Rentals.tsx`

**הוספת דיאלוג הארכה:**

```tsx
const [extendDialogOpen, setExtendDialogOpen] = useState(false);
const [extendingRental, setExtendingRental] = useState<Rental | null>(null);
const [extendDays, setExtendDays] = useState(7); // ברירת מחדל: שבוע

// Open extend dialog
const openExtendDialog = (rental: Rental) => {
  setExtendingRental(rental);
  setExtendDays(7);
  setExtendDialogOpen(true);
};

// Handle extend rental
const handleExtendRental = async () => {
  if (!extendingRental) return;

  const currentEndDate = parseISO(extendingRental.endDate);
  const newEndDate = addDays(currentEndDate, extendDays);

  try {
    const { error } = await supabase
      .from('rentals')
      .update({
        end_date: format(newEndDate, 'yyyy-MM-dd'),
        updated_at: new Date().toISOString(),
      })
      .eq('id', extendingRental.id);

    if (error) throw error;

    toast({
      title: 'ההשכרה הוארכה',
      description: `תאריך ההחזרה החדש: ${format(newEndDate, 'dd/MM/yyyy', { locale: he })}`,
    });
    setExtendDialogOpen(false);
    window.location.reload();
  } catch (error) {
    toast({
      title: 'שגיאה',
      description: 'לא ניתן להאריך את ההשכרה',
      variant: 'destructive',
    });
  }
};
```

**כפתור הארכה בכרטיס ההשכרה:**
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => openExtendDialog(rental)}
>
  <Calendar className="h-4 w-4" />
  הארכה
</Button>
```

**דיאלוג הארכה:**
```tsx
<Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>הארכת השכרה</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      <p>תאריך החזרה נוכחי: {extendingRental?.endDate}</p>
      <div className="grid grid-cols-4 gap-2">
        {[3, 7, 14, 30].map(days => (
          <Button
            key={days}
            variant={extendDays === days ? 'default' : 'outline'}
            onClick={() => setExtendDays(days)}
          >
            {days} ימים
          </Button>
        ))}
      </div>
      <Button onClick={handleExtendRental} className="w-full">
        הארך ל-{extendDays} ימים נוספים
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

---

## פתרון 5: ברקוד אוטומטי למוצרים

### גישה טכנית

נשתמש בספריית **JsBarcode** (קלה ופשוטה) ליצירת ברקודים מסוג Code 128. לסריקה נשתמש ב-**html5-qrcode**.

### שינויים נדרשים:

**1. הוספת dependencies:**
```bash
npm install jsbarcode html5-qrcode
```

**2. קובץ חדש: `src/components/BarcodeScanner.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, X } from 'lucide-react';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcodeId: string) => void;
}

export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (isOpen) {
      scannerRef.current = new Html5Qrcode('scanner');
      scannerRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          onScan(decodedText);
          onClose();
        },
        () => {}
      );
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>סרוק ברקוד מוצר</DialogTitle>
        </DialogHeader>
        <div id="scanner" className="w-full aspect-square" />
      </DialogContent>
    </Dialog>
  );
}
```

**3. עדכון טבלת inventory:**

```sql
-- Add barcode column
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS barcode TEXT UNIQUE;
```

**4. יצירת ברקוד אוטומטית בהוספת מוצר:**

הברקוד ייוצר אוטומטית מ-prefix + ID קצר:
```typescript
// Format: INV-{first 8 chars of UUID}
const generateBarcode = (itemId: string): string => {
  return `INV-${itemId.substring(0, 8).toUpperCase()}`;
};
```

**5. קומפוננט הצגת ברקוד:**

```tsx
import JsBarcode from 'jsbarcode';

function BarcodeDisplay({ code }: { code: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, code, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: true,
      });
    }
  }, [code]);

  return <svg ref={svgRef} />;
}
```

**6. כפתור סריקה בדאשבורד:**

```tsx
<Button onClick={() => setScannerOpen(true)}>
  <Camera className="h-4 w-4" />
  סרוק ברקוד
</Button>
```

**7. לוגיקת מציאת מוצר לפי ברקוד:**

```typescript
const handleBarcodeScan = (barcode: string) => {
  const item = inventory.find(i => i.barcode === barcode);
  if (item) {
    // Open quick action dialog for this item
    openQuickActionDialog(item);
  } else {
    toast({
      title: 'לא נמצא',
      description: 'לא נמצא מוצר עם ברקוד זה',
      variant: 'destructive',
    });
  }
};
```

---

## סיכום הקבצים לעדכון

| קובץ | שינוי |
|------|-------|
| `supabase/functions/process-overdue-calls/index.ts` | בדיקת סימים לפני התקשרות |
| `src/pages/Inventory.tsx` | ולידציית מספר סים + הצגת ברקוד |
| `src/components/GlobalSearch.tsx` | הצגת סטטוס + דיאלוג פעולות מהירות |
| `src/pages/Rentals.tsx` | כפתור הארכת השכרה + דיאלוג |
| `src/types/rental.ts` | הוספת שדה barcode לממשק InventoryItem |
| `src/hooks/useRental.tsx` | טעינת barcode ממסד הנתונים |
| `src/components/BarcodeScanner.tsx` | **קובץ חדש** - סורק ברקודים |
| `src/components/BarcodeDisplay.tsx` | **קובץ חדש** - הצגת ברקוד |
| Migration | הוספת עמודת barcode לטבלת inventory |

## Dependencies חדשות

```json
{
  "jsbarcode": "^3.11.6",
  "html5-qrcode": "^2.3.8"
}
```

---

## תזרים העבודה המתוכנן

1. הוספת migration לעמודת barcode
2. התקנת ספריות ברקוד
3. עדכון Edge Function להתקשרות עם סימים בלבד
4. עדכון דף המלאי עם ולידציה + ברקוד
5. עדכון החיפוש הגלובלי
6. הוספת כפתור הארכת השכרה
7. יצירת קומפוננטות סריקה והצגת ברקוד
