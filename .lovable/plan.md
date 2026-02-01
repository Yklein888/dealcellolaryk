
# תוכנית: הדפסה לסימים אמריקאיים + ניווט ישיר לפעולות

## סיכום הבקשות

1. **הדפסת סים אמריקאי**: הוספת אפשרות הדפסה לסימים אמריקאיים בגודל קטן (להדבקה על מכשירים), שכולל:
   - מספר אמריקאי (תמיד)
   - מספר ישראלי (אם קיים)
   - מספר סים (ICCID)
   - ברקוד

2. **ניווט ישיר לפעולות**: כשבוחרים מוצר בחיפוש ולוחצים "הוסף להשכרה", הדיאלוג של השכרה חדשה ייפתח ישירות עם הפריט מסומן (במקום לעבור לדף ההשכרות ולפתוח השכרה ידנית)

---

## חלק 1: הדפסת סים אמריקאי

### מה נוסיף
כפתור הדפסה חדש שמייצר מדבקה קטנה (כ-4x6 ס"מ) עם:

```text
┌─────────────────────────────┐
│    מספר אמריקאי/מקומי:     │
│     +1-555-123-4567         │
│ ────────────────────────── │
│    מספר ישראלי:             │
│     0722-587-081            │
│ ────────────────────────── │
│     SIM: 8972...            │
│                             │
│     [||||||||||||||||]      │
│       INV-XXXXXX            │
└─────────────────────────────┘
```

### קבצים לעריכה

#### 1. `src/components/inventory/QuickActionDialog.tsx`
- הוספת כפתור "הדפס מדבקה" לפריטים מסוג סים
- פונקציית הדפסה חדשה שמייצרת מסמך בגודל קטן

#### 2. `src/pages/Inventory.tsx`
- הוספת אותה פונקציית הדפסת מדבקה בדיאלוג העריכה
- עובד גם לסים אירופאי וגם לסים אמריקאי

### לוגיקת ההדפסה

```javascript
const printSimLabel = (item: InventoryItem) => {
  const printWindow = window.open('', '_blank');
  
  // גודל מדבקה: 4x6 ס"מ
  // כולל:
  // - מספר מקומי (אמריקאי/אירופאי)
  // - מספר ישראלי (אם קיים)
  // - מספר ICCID
  // - ברקוד (JsBarcode)
};
```

---

## חלק 2: ניווט ישיר לפעולות

### הבעיה הנוכחית
כשלוחצים "הוסף להשכרה" בחיפוש הגלובלי:
1. המשתמש מועבר לדף `/rentals`
2. צריך ללחוץ ידנית על "השכרה חדשה"
3. צריך לחפש ולבחור את הפריט מחדש

### הפתרון
הדיאלוג של השכרה חדשה ייפתח ישירות עם הפריט כבר מסומן.

### קבצים לעריכה

#### 1. `src/pages/Rentals.tsx`
- הוספת `useLocation` מ-react-router
- קריאת `location.state.addItemToRental` בטעינה
- פתיחה אוטומטית של `isAddDialogOpen` עם הפריט
- העברת `preSelectedItem` ל-NewRentalDialog

#### 2. `src/components/rentals/NewRentalDialog.tsx`
- הוספת prop חדש: `preSelectedItem?: InventoryItem`
- ב-`useEffect`: אם `preSelectedItem` קיים, הוסף אותו ל-`selectedItems` אוטומטית

#### 3. `src/pages/Inventory.tsx`
- הוספת `useLocation` מ-react-router
- קריאת `location.state.editItem` בטעינה
- פתיחה אוטומטית של דיאלוג העריכה עם הפריט

---

## שינויים טכניים מפורטים

### קובץ: `src/components/inventory/QuickActionDialog.tsx`

**שינוי 1**: הוספת פונקציית הדפסת מדבקה

```typescript
const printSimLabel = () => {
  if (!item) return;
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  
  const localDisplay = item.localNumber || '---';
  const israeliDisplay = item.israeliNumber || null;
  const simDisplay = item.simNumber || '---';
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <title>מדבקת סים</title>
      <style>
        @page { size: 4cm 6cm; margin: 2mm; }
        body { 
          font-family: Arial, sans-serif; 
          font-size: 8pt;
          width: 4cm;
          height: 6cm;
          padding: 2mm;
          direction: rtl;
        }
        .field { 
          margin-bottom: 2mm; 
          text-align: center;
        }
        .label { font-size: 6pt; color: #666; }
        .value { font-size: 9pt; font-weight: bold; }
        .barcode { margin-top: 3mm; text-align: center; }
        .barcode svg { max-width: 100%; height: 25px; }
      </style>
    </head>
    <body>
      <div class="field">
        <div class="label">מספר מקומי:</div>
        <div class="value">${localDisplay}</div>
      </div>
      ${israeliDisplay ? `
      <div class="field">
        <div class="label">מספר ישראלי:</div>
        <div class="value">${israeliDisplay}</div>
      </div>
      ` : ''}
      <div class="field">
        <div class="label">מספר סים:</div>
        <div class="value" style="font-size: 7pt;">${simDisplay}</div>
      </div>
      <div class="barcode">
        <svg id="barcode"></svg>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js"></script>
      <script>
        JsBarcode("#barcode", "${item.barcode || ''}", {
          format: "CODE128",
          width: 1,
          height: 25,
          displayValue: true,
          fontSize: 8,
          margin: 2
        });
        window.onload = function() {
          setTimeout(() => {
            window.print();
            window.close();
          }, 300);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};
```

**שינוי 2**: הוספת כפתור הדפסה לסימים

```tsx
{isSim && item.barcode && (
  <Button onClick={printSimLabel} variant="outline" className="w-full">
    <Printer className="h-4 w-4 ml-2" />
    הדפס מדבקה
  </Button>
)}
```

---

### קובץ: `src/pages/Rentals.tsx`

**שינוי 1**: הוספת import ו-useLocation

```typescript
import { useSearchParams, useLocation } from 'react-router-dom';

// בתוך הקומפוננטה:
const location = useLocation();
const [preSelectedItem, setPreSelectedItem] = useState<InventoryItem | null>(null);
```

**שינוי 2**: האזנה ל-state בטעינה

```typescript
useEffect(() => {
  // בדיקה אם הגענו עם פריט לבחירה מהחיפוש הגלובלי
  if (location.state?.addItemToRental) {
    const item = location.state.addItemToRental as InventoryItem;
    setPreSelectedItem(item);
    setIsAddDialogOpen(true);
    // ניקוי ה-state כדי שלא יישמר בהיסטוריה
    window.history.replaceState({}, document.title);
  }
}, [location.state]);
```

**שינוי 3**: העברת הפריט לדיאלוג

```tsx
<NewRentalDialog
  isOpen={isAddDialogOpen}
  onOpenChange={setIsAddDialogOpen}
  customers={customers}
  inventory={inventory}
  availableItems={availableItems}
  preSelectedItem={preSelectedItem}  // prop חדש
  onAddRental={addRental}
  onAddCustomer={addCustomer}
  onAddInventoryItem={addInventoryItem}
/>
```

---

### קובץ: `src/components/rentals/NewRentalDialog.tsx`

**שינוי 1**: הוספת prop חדש

```typescript
interface NewRentalDialogProps {
  // ... existing props
  preSelectedItem?: InventoryItem | null;
}
```

**שינוי 2**: הוספה אוטומטית של הפריט

```typescript
useEffect(() => {
  if (isOpen && preSelectedItem && preSelectedItem.status === 'available') {
    // בדיקה שהפריט לא כבר נבחר
    if (!selectedItems.some(i => i.inventoryItemId === preSelectedItem.id)) {
      setSelectedItems([{
        inventoryItemId: preSelectedItem.id,
        category: preSelectedItem.category,
        name: preSelectedItem.name,
        hasIsraeliNumber: false,
      }]);
    }
  }
}, [isOpen, preSelectedItem]);
```

---

### קובץ: `src/pages/Inventory.tsx`

**שינוי 1**: הוספת import ו-useLocation

```typescript
import { useSearchParams, useLocation } from 'react-router-dom';

// בתוך הקומפוננטה:
const location = useLocation();
```

**שינוי 2**: האזנה ל-state בטעינה

```typescript
useEffect(() => {
  // בדיקה אם הגענו עם פריט לעריכה מהחיפוש הגלובלי
  if (location.state?.editItem) {
    const item = location.state.editItem as InventoryItem;
    handleEdit(item);
    // ניקוי ה-state
    window.history.replaceState({}, document.title);
  }
}, [location.state]);
```

---

## תרשים זרימה חדש

```text
משתמש מחפש מוצר בחיפוש הגלובלי
    │
    ├── בוחר פריט מלאי
    │       │
    │       └── נפתח QuickActionDialog
    │                │
    │                ├── "הוסף להשכרה" ──> נפתח ישירות דיאלוג השכרה
    │                │                     עם הפריט כבר מסומן
    │                │
    │                ├── "ערוך פריט" ──> נפתח ישירות דיאלוג עריכה
    │                │                   עם הפריט טעון
    │                │
    │                └── "הדפס מדבקה" ──> מדבקה קטנה עם כל הפרטים
    │                                     (חדש!)
```

---

## סיכום השינויים

| קובץ | שינוי |
|------|-------|
| `QuickActionDialog.tsx` | הוספת כפתור "הדפס מדבקה" + פונקציית הדפסה |
| `Inventory.tsx` | הוספת כפתור הדפסת מדבקה + טיפול ב-state לעריכה |
| `Rentals.tsx` | טיפול ב-state לפתיחת דיאלוג השכרה עם פריט |
| `NewRentalDialog.tsx` | הוספת prop `preSelectedItem` + הוספה אוטומטית |

---

## יתרונות

1. **חסכון בזמן**: פריט נבחר אוטומטית - לא צריך לחפש פעמיים
2. **מדבקות מקצועיות**: גודל קטן ומתאים להדבקה על מכשירים
3. **תמיכה בכל הסימים**: גם אמריקאי וגם אירופאי
4. **מידע מלא**: כל המספרים הרלוונטיים + ברקוד
