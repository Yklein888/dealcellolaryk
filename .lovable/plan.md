

# תוכנית: אינטגרציה אוטומטית לסנכרון סימים מ-CellStation

## סקירה כללית
בניית מערכת שמתחברת לפורטל CellStation, מושכת את כל נתוני הסימים, ומסנכרנת אותם לטבלה ייעודית ב-Supabase.

## שלב 1: הגדרת Secrets
שמירת פרטי ההתחברות כ-secrets מאובטחים:
- `CELLSTATION_USERNAME` - שם המשתמש
- `CELLSTATION_PASSWORD` - הסיסמא

## שלב 2: יצירת טבלת sim_cards
```sql
CREATE TABLE public.sim_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_number TEXT,
  israeli_number TEXT,
  sim_number TEXT,
  expiry_date DATE,
  is_rented BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'available',
  package_name TEXT,
  notes TEXT,
  last_synced TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS policies
ALTER TABLE public.sim_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage sim_cards"
  ON public.sim_cards FOR ALL
  USING (true) WITH CHECK (true);
```

## שלב 3: יצירת Edge Function - sync-cellstation
Edge Function שמבצעת:

1. **התחברות לפורטל**
   - שליחת בקשת POST עם credentials
   - שמירת ה-session cookie

2. **שליפת נתוני הסימים**
   - בקשת GET לדף הסימים עם ה-cookie
   - פירוס ה-HTML באמצעות cheerio (או regex אם המבנה פשוט)

3. **עיבוד ושמירה**
   - מחיקת כל הרשומות הקיימות
   - הכנסת הרשומות החדשות
   - עדכון שדה `last_synced`

```text
+------------+       +------------------+       +------------+
|  Frontend  | ----> | Edge Function    | ----> | CellStation|
|  Button    |       | sync-cellstation |       | Portal     |
+------------+       +------------------+       +------------+
                            |
                            v
                     +------------+
                     | Supabase   |
                     | sim_cards  |
                     +------------+
```

## שלב 4: עדכון ממשק המשתמש - דף SimCards חדש

### 4.1 יצירת דף חדש `src/pages/SimCards.tsx`
- כפתור "סנכרן סימים" עם loading indicator
- טבלה עם כל הסימים המסונכרנים
- חיפוש לפי מספר טלפון/סים
- סינון: כל הסימים / פנויים / בהשכרה
- מיון לפי תוקף
- צביעה אדומה לסימים שפגי תוקף בקרוב (< חודש)

### 4.2 עדכון הניווט
- הוספת לינק "סימים מ-CellStation" בתפריט הצד

## שלב 5: יצירת hook - useCellstationSync
```typescript
// שימוש ב-Edge Function
const syncSims = async () => {
  setLoading(true);
  const { data, error } = await supabase.functions.invoke('sync-cellstation');
  if (error) {
    toast({ title: 'שגיאה', description: error.message });
  } else {
    toast({ title: 'הצלחה', description: `סונכרנו ${data.count} סימים` });
    refetch();
  }
  setLoading(false);
};
```

## אתגרים טכניים ופתרונות

### 1. Web Scraping ב-Edge Functions
Edge Functions לא תומכות ב-Puppeteer. הפתרון:
- שימוש ב-`fetch` לשליחת בקשות HTTP ישירות
- שימוש ב-cheerio (זמין ב-Deno) לפירוס HTML
- או שימוש בספריית `deno-dom` לפירוס

### 2. Session Management
- שמירת cookies מהתחברות
- העברתם בבקשות הבאות

### 3. מבנה ה-HTML לא ידוע
- ייתכן שנצטרך לחקור את המבנה בזמן הפיתוח
- אם המבנה משתנה, הסקריפט יישבר

## סיכום קבצים

| קובץ | פעולה |
|------|-------|
| `supabase/functions/sync-cellstation/index.ts` | יצירה - Edge Function לסנכרון |
| `src/pages/SimCards.tsx` | יצירה - דף הצגת וניהול סימים |
| `src/hooks/useCellstationSync.tsx` | יצירה - hook לקריאת ה-Edge Function |
| `src/components/AppSidebar.tsx` | עדכון - הוספת לינק לדף SimCards |
| `src/App.tsx` | עדכון - הוספת route חדש |
| מיגרציית DB | יצירת טבלת sim_cards |

## הערות חשובות

1. **אבטחה**: פרטי ההתחברות יישמרו כ-secrets ולא בקוד
2. **תלות בספק**: אם CellStation משנים את המבנה, הסקריפט יישבר
3. **rate limiting**: ייתכן שהפורטל חוסם בקשות מרובות
4. **תנאי שימוש**: יש לוודא ש-scraping מותר בתנאי השימוש של CellStation

