

# תוכנית לשיפורים במערכת השכרות

## סיכום הבקשות

1. **דילוג על שבתות וחגי ישראל** - החיוב האוטומטי והשיחות האוטומטיות לא יופעלו בימי שבת וחגי ישראל
2. **קטגוריות סינון בהשכרות** - הוספת כפתורי סטטוס מהירים כמו בעמוד התיקונים (פעיל, באיחור, הוחזר)
3. **הצגת כמות פריטים ללקוח** - הוספת מספר הפריטים המושכרים בכל כרטיס השכרה
4. **הורדת הוראות חיוג לכל סים** - כשיש כמה סימים אירופאיים בהשכרה, אפשרות להוריד הוראות לכל אחד בנפרד

---

## פתרון 1: דילוג על שבתות וחגי ישראל

### גישה
שימוש ב-**Hebcal REST API** (חינמי, ללא צורך ב-API key) לבדיקת האם היום הוא שבת או חג ישראלי.

### שינויים ב-Edge Functions

**קובץ: `supabase/functions/process-overdue-charges/index.ts`**
- הוספת פונקציה `isShabbatOrHoliday()` שמבצעת קריאה ל-Hebcal API
- בדיקה בתחילת הפונקציה ודילוג אם מדובר בשבת או חג

**קובץ: `supabase/functions/process-overdue-calls/index.ts`**
- אותו שינוי - בדיקת שבת/חג לפני ביצוע שיחות

### לוגיקת הבדיקה
```typescript
async function isShabbatOrHoliday(): Promise<boolean> {
  // בדיקה אם היום שבת
  const today = new Date();
  const dayOfWeek = today.getDay();
  if (dayOfWeek === 6) return true; // שבת
  
  // בדיקת חגים דרך Hebcal API
  const dateStr = today.toISOString().split('T')[0];
  const response = await fetch(
    `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=off&mod=off&start=${dateStr}&end=${dateStr}&geo=none`
  );
  const data = await response.json();
  
  // בדיקה אם יש יום טוב
  return data.items?.some(item => 
    item.yomtov === true || item.category === 'holiday'
  ) ?? false;
}
```

**חגים שייכללו:**
- ראש השנה (2 ימים)
- יום כיפור
- סוכות (2 ימים ראשונים)
- שמחת תורה
- פסח (2 ימים ראשונים + 2 אחרונים)
- שבועות (2 ימים)

---

## פתרון 2: כפתורי סטטוס מהירים בהשכרות

### שינויים בקובץ: `src/pages/Rentals.tsx`

הוספת גריד כפתורי סטטוס לפני הפילטרים (כמו בעמוד התיקונים):

```tsx
{/* Status Quick Access */}
<div className="grid grid-cols-3 gap-3 mb-6">
  <button
    onClick={() => setFilterStatus('active')}
    className={`stat-card p-4 text-center transition-all hover:border-primary/50 cursor-pointer ${filterStatus === 'active' ? 'border-primary bg-primary/10' : ''}`}
  >
    <div className="flex items-center justify-center gap-2 mb-1">
      <ShoppingCart className="h-5 w-5 text-primary" />
      <span className="text-2xl font-bold text-primary">
        {rentals.filter(r => r.status === 'active').length}
      </span>
    </div>
    <p className="text-sm text-muted-foreground">פעילות</p>
  </button>
  
  <button
    onClick={() => setFilterStatus('overdue')}
    className={`stat-card p-4 text-center transition-all hover:border-destructive/50 cursor-pointer ${filterStatus === 'overdue' ? 'border-destructive bg-destructive/10' : ''}`}
  >
    <div className="flex items-center justify-center gap-2 mb-1">
      <AlertTriangle className="h-5 w-5 text-destructive" />
      <span className="text-2xl font-bold text-destructive">
        {rentals.filter(r => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const endDate = parseISO(r.endDate);
          return r.status === 'active' && isBefore(endDate, today);
        }).length}
      </span>
    </div>
    <p className="text-sm text-muted-foreground">באיחור</p>
  </button>
  
  <button
    onClick={() => setFilterStatus('returned')}
    className={`stat-card p-4 text-center transition-all hover:border-success/50 cursor-pointer ${filterStatus === 'returned' ? 'border-success bg-success/10' : ''}`}
  >
    <div className="flex items-center justify-center gap-2 mb-1">
      <CheckCircle className="h-5 w-5 text-success" />
      <span className="text-2xl font-bold text-success">
        {rentals.filter(r => r.status === 'returned').length}
      </span>
    </div>
    <p className="text-sm text-muted-foreground">הוחזרו</p>
  </button>
</div>
```

---

## פתרון 3: הצגת כמות פריטים בכרטיס השכרה

### שינויים בקובץ: `src/pages/Rentals.tsx`

הוספת תצוגת מספר פריטים ליד שם הלקוח בכרטיס ההשכרה:

```tsx
{/* Customer + Item Count */}
<div className="flex items-center gap-3 mb-3">
  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 shrink-0">
    <User className="h-5 w-5 text-primary" />
  </div>
  <div className="flex-1 min-w-0">
    <p className="font-bold text-base text-foreground truncate">{rental.customerName}</p>
    <p className="text-xs text-muted-foreground">
      {rental.items.length} פריטים
    </p>
  </div>
</div>
```

---

## פתרון 4: הורדת הוראות חיוג לכל סים אירופאי

### שינויים בקובץ: `src/pages/Rentals.tsx`

עדכון לוגיקת הצגת הסימים כך שבמקום להציג רק סים אחד, יוצגו כל הסימים האירופאיים עם כפתור הורדה לכל אחד:

```tsx
{/* Multiple European SIMs support */}
{rental.items
  .filter(item => item.itemCategory === 'sim_european' && !item.isGeneric && item.inventoryItemId)
  .map((simItem, idx) => {
    const inventoryItem = inventory.find(i => i.id === simItem.inventoryItemId);
    const itemId = `rental-${rental.id}-sim-${idx}`;
    
    return (
      <div key={idx} className="mb-3 space-y-2">
        {/* Phone Numbers Display */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg p-3 border border-blue-200/50 dark:border-blue-800/50">
          <div className="text-center space-y-1">
            {/* Numbers display... */}
          </div>
        </div>
        
        {/* Download Button for this specific SIM */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDownloadInstructions(itemId, inventoryItem?.israeliNumber, inventoryItem?.localNumber)}
          disabled={downloadingInstructions === itemId}
          className="w-full"
        >
          {downloadingInstructions === itemId ? <Loader2 className="animate-spin" /> : <FileDown />}
          הורד הוראות - {simItem.itemName}
        </Button>
      </div>
    );
  })}
```

---

## סיכום הקבצים לעדכון

| קובץ | שינוי |
|------|-------|
| `supabase/functions/process-overdue-charges/index.ts` | בדיקת שבת/חג לפני חיוב |
| `supabase/functions/process-overdue-calls/index.ts` | בדיקת שבת/חג לפני שיחות |
| `src/pages/Rentals.tsx` | כפתורי סטטוס, כמות פריטים, הורדת הוראות לכל סים |

## הערות

- Hebcal API הוא שירות חינמי ואמין שמספק מידע על חגי ישראל
- בדיקת יום שבת נעשית לפי יום בשבוע (שבת = 6 ב-JavaScript)
- הפונקציות ישמרו לוג כשהן מדלגות על פעולה בגלל שבת/חג

