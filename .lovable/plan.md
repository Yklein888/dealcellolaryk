

# תיקון חלונית יצירת השכרה חדשה

## זיהוי הבעיה
הבעיה נמצאה בקומפוננט `DialogContent` הבסיסי (`src/components/ui/dialog.tsx`):

הגדרות ברירת המחדל מכילות:
- `sm:max-w-lg` - מגביל רוחב מקסימלי ל-512px בדסקטופ
- `sm:max-h-[85vh]` - מגביל גובה ל-85% מגובה המסך
- `p-4 sm:p-6` - padding קבוע

כשמוסיפים קלאסים מותאמים ב-NewRentalDialog, הם לא גוברים על ההגדרות הבסיסיות בגלל ש-Tailwind לא יודע לפתור קונפליקטים בין קלאסים responsive.

## פתרון

### שינוי 1: עדכון קומפוננט DialogContent הבסיסי
נוסיף prop בשם `size` שמאפשר גדלים שונים לדיאלוג:

```tsx
interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: 'default' | 'lg' | 'xl' | 'full';
}
```

**גדלים:**
- `default` - ההתנהגות הנוכחית (max-w-lg)
- `lg` - רוחב גדול יותר (max-w-4xl)
- `xl` - רוחב גדול מאוד (max-w-6xl)
- `full` - שימוש במרב שטח המסך (98vw, max-w-[1400px])

### שינוי 2: עדכון NewRentalDialog
נשתמש ב-`size="full"` כדי לקבל את החלונית הרחבה:

```tsx
<DialogContent size="full" className="h-[95vh] max-h-[900px]">
```

## פרטים טכניים

### קובץ: `src/components/ui/dialog.tsx`

**שורות 30-63** - עדכון DialogContent:
```tsx
interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: 'default' | 'lg' | 'xl' | 'full';
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, size = 'default', ...props }, ref) => {
  const sizeClasses = {
    default: 'sm:max-w-lg',
    lg: 'sm:max-w-4xl',
    xl: 'sm:max-w-6xl', 
    full: 'sm:w-[98vw] sm:max-w-[1400px]'
  };
  
  return (
    <DialogPortal>
      <DialogOverlay className="bg-black/40 backdrop-blur-sm" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed z-50 grid w-full gap-4 p-4 sm:p-6 shadow-2xl duration-300",
          "bg-white/95 backdrop-blur-xl border border-white/40",
          "inset-x-0 bottom-0 rounded-t-3xl max-h-[90vh] overflow-y-auto",
          "sm:inset-auto sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:max-h-[85vh]",
          sizeClasses[size],
          size === 'full' && 'sm:p-0 sm:max-h-[95vh]',
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          "sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      >
        {size !== 'full' && (
          <div className="sm:hidden mx-auto w-12 h-1.5 rounded-full bg-muted-foreground/30 mb-2" />
        )}
        {children}
        <DialogPrimitive.Close className="absolute left-4 top-4 rounded-xl p-2 opacity-70 ...">
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
```

### קובץ: `src/components/rentals/NewRentalDialog.tsx`

**שורה 469** - שימוש בגודל full:
```tsx
<DialogContent size="full" className="h-[95vh] max-h-[900px] flex flex-col">
```

## תוצאה צפויה
- החלונית תתפוס 98% מרוחב המסך עד 1400px
- גובה 95% מגובה המסך עד 900px
- אין יותר קונפליקט בין הקלאסים
- פריסה רחבה ונוחה עם שתי עמודות

