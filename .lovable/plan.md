

# תוכנית משולבת: תיקון זמינות מלאי + אזהרת תוקף סימים

## סקירה כללית

התוכנית כוללת שתי יכולות משולבות:
1. **תיקון בעיית הזמינות** - מניעת השכרה כפולה של אותו פריט
2. **אזהרת תוקף סימים** - הצגת אזהרה כשסים פג באמצע תקופת ההשכרה ומיון חכם של הסימים

---

## חלק א': תיקון בעיית זמינות המלאי

### הבעיה
כאשר נוצרת השכרה (אפילו עם תאריך עתידי), הפריט לא מוסר מיידית מרשימת הפריטים הזמינים, מה שמאפשר להשכיר אותו שוב.

### הפתרון

**1. אימות זמינות מול מסד הנתונים לפני יצירת השכרה**

בפונקציית `addRental`, לפני יצירת ההשכרה, נבצע שאילתה ישירה למסד הנתונים לוודא שכל הפריטים באמת זמינים:

```typescript
// Step 1: Verify all items are still available in database
const nonGenericItemIds = rental.items
  .filter(item => !item.isGeneric && item.inventoryItemId)
  .map(item => item.inventoryItemId);

if (nonGenericItemIds.length > 0) {
  const { data: currentInventory } = await supabase
    .from('inventory')
    .select('id, status, name')
    .in('id', nonGenericItemIds);
  
  const unavailableItems = currentInventory?.filter(
    item => item.status !== 'available'
  );
  
  if (unavailableItems && unavailableItems.length > 0) {
    const itemNames = unavailableItems.map(i => i.name).join(', ');
    throw new Error(`הפריטים הבאים כבר לא זמינים: ${itemNames}`);
  }
}
```

**2. עדכון batch במקום לולאה**

במקום לעדכן כל פריט בנפרד (שגורם לבעיית stale closure):

```typescript
// Update ALL items at once using batch update
if (nonGenericItemIds.length > 0) {
  const { error: updateError } = await supabase
    .from('inventory')
    .update({ status: 'rented' })
    .in('id', nonGenericItemIds);
  
  if (updateError) throw updateError;
}

// Then refresh all data
await fetchData();
```

**3. שיפור פונקציית getAvailableItems עם בדיקה כפולה**

הוספת בדיקת גיבוי שמוודאת שהפריט לא מופיע בהשכרה פעילה:

```typescript
const getAvailableItems = (category?: ItemCategory) => {
  // Get IDs of items in active rentals (as backup check)
  const rentedItemIds = new Set<string>();
  rentals
    .filter(r => r.status !== 'returned')
    .forEach(r => {
      r.items.forEach(item => {
        if (item.inventoryItemId && !item.isGeneric) {
          rentedItemIds.add(item.inventoryItemId);
        }
      });
    });
  
  return inventory.filter(item => 
    item.status === 'available' && 
    !rentedItemIds.has(item.id) && // Double-check
    (!category || item.category === category)
  );
};
```

**4. טיפול בשגיאה ב-NewRentalDialog**

הוספת try/catch ב-handleSubmit:

```typescript
try {
  await onAddRental({ ... });
  toast({ title: 'השכרה נוצרה', ... });
  onOpenChange(false);
} catch (error: any) {
  toast({
    title: 'שגיאה ביצירת השכרה',
    description: error.message || 'אחד הפריטים כבר לא זמין',
    variant: 'destructive',
  });
  return; // Don't close dialog
}
```

---

## חלק ב': אזהרת תוקף סימים ומיון חכם

### הדרישה
כאשר בוחרים סים מהמלאי ותוקף הסים פג באמצע תקופת ההשכרה - להציג אזהרה ולהציע בעדיפות ראשונה סימים שתקפים לכל תקופת ההשכרה.

### הפתרון

**1. פונקציה לבדיקת התאמת תוקף לתקופת השכרה**

```typescript
// Check if SIM expiry covers the rental period
const isSimValidForPeriod = (
  item: InventoryItem, 
  rentalEndDate: Date | undefined
): 'valid' | 'warning' | 'expired' => {
  // Only check SIMs
  if (item.category !== 'sim_american' && item.category !== 'sim_european') {
    return 'valid';
  }
  
  if (!item.expiryDate) return 'valid'; // No expiry = OK
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = parseISO(item.expiryDate);
  
  // Already expired
  if (isBefore(expiryDate, today)) return 'expired';
  
  // No rental end date yet - just check if not expired
  if (!rentalEndDate) return 'valid';
  
  // Expiry is before rental end date
  if (isBefore(expiryDate, rentalEndDate)) return 'warning';
  
  return 'valid';
};
```

**2. מיון רשימת הפריטים הזמינים**

הסימים ימוינו לפי התאמת התוקף - תקינים בראש, אזהרות בסוף:

```typescript
// Sort available items - valid SIMs first, warning SIMs last
const sortedAvailableItems = useMemo(() => {
  if (!endDate) return filteredAvailableItems;
  
  return [...filteredAvailableItems].sort((a, b) => {
    const aStatus = isSimValidForPeriod(a, endDate);
    const bStatus = isSimValidForPeriod(b, endDate);
    
    // Sort order: valid > warning > expired
    const order = { valid: 0, warning: 1, expired: 2 };
    return order[aStatus] - order[bStatus];
  });
}, [filteredAvailableItems, endDate]);
```

**3. הצגה ויזואלית של מצב התוקף**

בכרטיס כל סים ברשימה, הצגת אייקון/צבע לפי מצב התוקף:

```typescript
{/* In item card */}
{isSim(item.category) && item.expiryDate && (
  <div className={cn(
    "text-[10px] flex items-center gap-1",
    validityStatus === 'warning' && "text-amber-600 dark:text-amber-400",
    validityStatus === 'expired' && "text-red-500"
  )}>
    {validityStatus === 'warning' && <AlertTriangle className="h-3 w-3" />}
    {validityStatus === 'expired' && <XCircle className="h-3 w-3" />}
    <span>תוקף: {format(parseISO(item.expiryDate), 'dd/MM/yy')}</span>
    {validityStatus === 'warning' && (
      <span className="font-medium">(פג באמצע!)</span>
    )}
  </div>
)}
```

**4. אזהרה בבחירת סים עם תוקף בעייתי**

כשמשתמש בוחר סים שהתוקף שלו פג באמצע תקופת ההשכרה:

```typescript
const handleAddItem = (item: InventoryItem) => {
  // ... existing validation ...
  
  // Check SIM expiry vs rental period
  const validityStatus = isSimValidForPeriod(item, endDate);
  
  if (validityStatus === 'expired') {
    toast({
      title: 'סים פג תוקף',
      description: 'לא ניתן להשכיר סים שכבר פג תוקפו',
      variant: 'destructive',
    });
    return;
  }
  
  if (validityStatus === 'warning') {
    toast({
      title: '⚠️ שים לב - הסים יפוג באמצע ההשכרה',
      description: `תוקף הסים: ${item.expiryDate}. תאריך סיום השכרה: ${endDate ? format(endDate, 'dd/MM/yyyy') : '-'}`,
      variant: 'warning',
    });
  }
  
  // Continue adding the item...
};
```

**5. סיכום בפריטים נבחרים עם אזהרה**

ברשימת הפריטים הנבחרים, הצגת אזהרה אם יש סים עם בעיית תוקף:

```typescript
{/* In selected items section */}
{validityStatus === 'warning' && (
  <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
    <AlertTriangle className="h-3 w-3" />
    <span>תוקף הסים יפוג ב-{item.expiryDate} - לפני סיום ההשכרה!</span>
  </div>
)}
```

---

## קבצים שיעודכנו

1. **`src/hooks/useRental.tsx`**
   - שיפור `addRental` עם אימות זמינות ועדכון batch
   - שיפור `getAvailableItems` עם בדיקה כפולה

2. **`src/components/rentals/NewRentalDialog.tsx`**
   - הוספת פונקציית `isSimValidForPeriod`
   - מיון חכם של רשימת הפריטים הזמינים
   - הצגה ויזואלית של מצב התוקף בכרטיסי הסימים
   - אזהרת toast בבחירת סים עם תוקף בעייתי
   - הצגת אזהרה ברשימת הפריטים הנבחרים
   - טיפול בשגיאות זמינות עם try/catch

---

## תוצאה צפויה

### לגבי זמינות מלאי:
- פריט שנבחר להשכרה יוסר מיידית מרשימת הזמינים
- אם שני משתמשים מנסים להשכיר את אותו פריט - הראשון יצליח והשני יקבל הודעת שגיאה ברורה
- גם השכרות עם תאריך עתידי יסמנו את הפריט כ-"מושכר" מיידית

### לגבי אזהרת תוקף סימים:
- סימים תקפים לכל תקופת ההשכרה יופיעו בראש הרשימה
- סימים שיפוג תוקפם באמצע יופיעו בסוף עם סימון צהוב
- בבחירת סים עם תוקף בעייתי - תוצג הודעת אזהרה ברורה
- המשתמש עדיין יכול לבחור את הסים הזה אם הוא רוצה (זו רק אזהרה, לא חסימה)

