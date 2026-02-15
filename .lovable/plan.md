
# תיקון הפעלת סים ב-CellStation API

## מה קורה עכשיו
הפורטל מחזיר שגיאה 500 (תשובה ריקה - רק CSS). מהלוגים עולות שתי בעיות:

1. **תאריכים בפורמט לא נכון** - נשלחים כ-`16/02/2026` במקום `2026-02-16` (קוד ההמרה שנוסף כנראה לא נפרס כראוי או שלא רץ)
2. **צעד חסר בתהליך** - הפורטל מצפה שתתבצע קריאה ל-`calculate_days.php` לפני השליחה. ה-JavaScript של הפורטל מראה שהכפתור "שלח" מוסתר עד שחישוב המחיר מצליח - ייתכן שזה מגדיר משתנה סשן בצד השרת.

## תיקונים נדרשים

### 1. הוספת קריאת calculate_days.php לפני השליחה
לפי ה-JavaScript של הפורטל, לפני הגשת הטופס נשלחת קריאת AJAX ל:
```
POST content/dashboard/rentals/calculate_days.php
data: { start_rental, end_rental, product, exp }
```
צריך להוסיף את הצעד הזה בין שלב 2 (שליפת פרטי סים) לשלב 3 (שליחת הטופס).

### 2. תיקון פורמט תאריכים
הפורטל משתמש ב-`input type="date"` ו-`new Date()` ב-JavaScript, שמצפים ל-`yyyy-MM-dd`. נוודא שההמרה אכן מתבצעת ונוסיף לוג אחרי ההמרה לאימות.

### 3. הוספת לוגים מפורטים
לוגים ברורים אחרי כל שלב כדי לדעת בדיוק מה נשלח ומה חוזר.

## פרטים טכניים

### שינויים בקובץ `supabase/functions/cellstation-api/index.ts`

בפעולת `activate_sim` (ובדומה ב-`activate_and_swap`):

**אחרי שלב 2 (fetch_BHsim_details) ולפני שלב 3 (submit):**
- הוספת קריאת POST ל-`content/dashboard/rentals/calculate_days.php` עם `start_rental`, `end_rental`, `product`, `exp`
- לוג של התשובה מ-calculate_days
- שימוש בתאריכים בפורמט `yyyy-MM-dd` בכל הקריאות

**המרת תאריכים:**
- הזזת קוד ההמרה לפני הקריאה ל-calculate_days
- לוג מפורש: `"Date conversion: INPUT -> OUTPUT"` כדי לוודא שרץ

**שלב 3 (submit):**
- שליחה עם תאריכים מומרים
- לוג של כל שדה שנשלח

### פעולות זהות גם ב-activate_and_swap ו-swap_sim
