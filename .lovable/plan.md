

# תוכנית: הוספת קטגוריה "מסתיימות היום" + קוביות לחיצות + חיפוש מורחב

## סיכום
הוספת קטגוריה חדשה בדשבורד להשכרות שמסתיימות היום (שאינן באיחור אבל דורשות תשומת לב), הפיכת קוביות הנתונים ללחיצות עם ניווט לעמודים מסוננים, והוספת חיפוש לפי מספר סים במלאי.

---

## חלק 1: קטגוריה חדשה - "מסתיימות היום"

### עדכון הטיפוס `DashboardStats`
הוספת שדה חדש לסטטיסטיקות:
```text
endingToday: number  // השכרות שתאריך הסיום שלהן הוא היום
```

### עדכון חישוב הסטטיסטיקות ב-`useRental.tsx`
הוספת לוגיקה לחישוב השכרות שמסתיימות היום:
```text
לפני: 
- באיחור = endDate < today
- קרובות = endDate > today AND endDate < 3 ימים

אחרי:
- באיחור = endDate < startOfToday (לפני היום)
- מסתיימות היום = endDate === today (בדיוק היום)
- קרובות = endDate > today AND endDate < 3 ימים (מחר והלאה)
```

### הוספת קובייה חדשה בדשבורד
קובייה בצבע כתום/warning עם אייקון `CalendarClock` או דומה:
```text
כותרת: "מסתיימות היום"
ערך: מספר ההשכרות
צבע: warning (כתום)
```

---

## חלק 2: קוביות לחיצות

### עדכון `StatCard.tsx`
הוספת props חדשים לתמיכה בניווט:
- `onClick?: () => void` - פונקציית לחיצה
- `href?: string` - קישור לניווט ישיר
- עיצוב cursor pointer ואפקט hover כשהקובייה לחיצה

### עדכון `DashboardStatsGrid.tsx`
חיבור קוביות לעמודים עם פילטרים:

| קובייה | יעד | פילטר URL |
|--------|-----|-----------|
| השכרות פעילות | `/rentals` | `?status=active` |
| באיחור | `/rentals` | `?status=overdue` |
| מסתיימות היום | `/rentals` | `?status=ending_today` |
| תיקונים בתהליך | `/repairs` | `?status=in_lab` |
| החזרות קרובות | `/rentals` | `?status=upcoming` |
| פריטים זמינים | `/inventory` | `?status=available` |

### עדכון עמודי היעד
- `Rentals.tsx` - קריאת query params בטעינה והחלת פילטרים אוטומטית
- `Repairs.tsx` - קריאת query params והחלת פילטרים
- `Inventory.tsx` - קריאת query params והחלת פילטרים

---

## חלק 3: חיפוש מורחב במלאי

### עדכון לוגיקת החיפוש ב-`Inventory.tsx`
הוספת `simNumber` לשדות החיפוש:
```text
לפני: name + localNumber + israeliNumber
אחרי: name + localNumber + israeliNumber + simNumber
```

### עדכון placeholder
```text
"חיפוש לפי שם, מספר טלפון, מספר סים..."
```

---

## קבצים שיעודכנו

| קובץ | פעולה | תיאור |
|------|-------|-------|
| `src/types/rental.ts` | עדכון | הוספת `endingToday` ל-DashboardStats |
| `src/hooks/useRental.tsx` | עדכון | חישוב השכרות מסתיימות היום |
| `src/components/StatCard.tsx` | עדכון | הוספת onClick/href + עיצוב hover |
| `src/components/dashboard/DashboardStatsGrid.tsx` | עדכון | קובייה חדשה + חיבור ניווט |
| `src/pages/Inventory.tsx` | עדכון | חיפוש simNumber + קריאת params |
| `src/pages/Rentals.tsx` | עדכון | טיפול בפילטר ending_today + קריאת params |
| `src/pages/Repairs.tsx` | עדכון | קריאת query params |

---

## התנהגות צפויה

### לחיצה על "מסתיימות היום"
1. משתמש לוחץ על הקובייה בדשבורד
2. מועבר ל-`/rentals?status=ending_today`
3. עמוד ההשכרות מציג רק השכרות שמסתיימות היום
4. הפילטר מסומן אוטומטית

### חיפוש במלאי לפי ICCID
1. משתמש מקליד את מספר הסים (למשל "89972...")
2. המערכת מחפשת בכל השדות כולל מספר הסים
3. מוצגים הפריטים התואמים

