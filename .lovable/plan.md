
# יישום PDF Overlay להוראות חיוג - סים אירופאי

## מטרה
שינוי מלא של תהליך יצירת הוראות החיוג כך שהמסמך המקורי יישאר **בדיוק כמו שהוא** - עם הלוגו, הגופנים, השוליים וכל העיצוב המקורי. המספרים והברקוד יתווספו כ**שכבת-על** מעל ה-PDF בלי לשנות בייט אחד מהמסמך המקורי.

---

## מה משתנה

| רכיב | לפני | אחרי |
|------|------|------|
| פורמט תבנית | DOCX | PDF |
| אופן עריכה | שינוי XML פנימי | שכבת-על בלבד |
| ספרייה | JSZip | pdf-lib |
| פורמט ברקוד | BMP | PNG |
| תוצאה | DOCX מעודכן | PDF מוכן להדפסה |

---

## שלב 1: הכנת תבנית PDF

### פעולה נדרשת מהמשתמש
יש להמיר את קובץ התבנית הקיים מ-DOCX ל-PDF ולהעלות ל-Storage:

1. פתח את `calling-instructions-template.docx` ב-Word
2. שמור כ-PDF עם השם `calling-instructions-template.pdf`
3. העלה את ה-PDF ל-Storage בתיקיית `templates`

---

## שלב 2: Edge Function חדשה

### קובץ: `supabase/functions/generate-calling-instructions/index.ts`

שכתוב מלא של הפונקציה עם pdf-lib:

```text
┌─────────────────────────────────────────────┐
│  תהליך חדש:                                 │
│                                             │
│  1. קבלת בקשה (מספרים + ברקוד)             │
│  2. הורדת תבנית PDF מ-Storage              │
│  3. טעינת PDF עם pdf-lib                   │
│  4. הוספת שכבת-על:                         │
│     • drawText() למספרים                   │
│     • drawImage() לברקוד PNG               │
│  5. החזרת PDF חדש                          │
└─────────────────────────────────────────────┘
```

### מיקומים מדויקים (A4: 595 x 842 נקודות)

| אלמנט | מיקום X | מיקום Y | גודל |
|-------|---------|---------|------|
| מספר ישראלי | 100 (מימין) | 745 | 14pt |
| מספר מקומי | 100 (מימין) | 725 | 14pt |
| ברקוד | מרכז (297.5) | 50 | 170×57pt (~60×20mm) |

### קוד חדש

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

// פונקציה ליצירת PNG ברקוד
function generateBarcodePng(text: string): Uint8Array {
  // יצירת ברקוד Code128 כ-PNG
  // ...
}

serve(async (req) => {
  // 1. קבלת פרמטרים
  const { israeliNumber, localNumber, barcode } = await req.json();
  
  // 2. הורדת תבנית PDF מ-Storage
  const templateUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/templates/calling-instructions-template.pdf`;
  const templateBytes = await fetch(templateUrl).then(r => r.arrayBuffer());
  
  // 3. טעינת PDF - המסמך המקורי לא משתנה!
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  // 4. הוספת מספרים (שכבה חדשה מעל המקור)
  page.drawText(`מספר ישראלי: ${israeliDisplay}`, {
    x: 100, y: 745, size: 14, font, color: rgb(0, 0, 0)
  });
  
  page.drawText(`מספר מקומי: ${localDisplay}`, {
    x: 100, y: 725, size: 14, font, color: rgb(0, 0, 0)
  });
  
  // 5. הוספת ברקוד PNG (שכבה חדשה)
  if (barcode) {
    const pngBytes = generateBarcodePng(barcode);
    const pngImage = await pdfDoc.embedPng(pngBytes);
    page.drawImage(pngImage, {
      x: 212, y: 50, width: 170, height: 57
    });
  }
  
  // 6. שמירה והחזרה
  const pdfBytes = await pdfDoc.save();
  return new Response(pdfBytes, {
    headers: { "Content-Type": "application/pdf" }
  });
});
```

---

## שלב 3: עדכון צד לקוח

### קובץ: `src/lib/callingInstructions.ts`

פישוט משמעותי - כבר מקבלים PDF מוכן:

```text
לפני:
  DOCX → docx-preview → HTML → html2canvas → jsPDF → Print

אחרי:
  PDF → ישירות להדפסה! ✓
```

### שינויים עיקריים

1. **שינוי שם פונקציה**: `fetchCallingInstructionsDocx` → `fetchCallingInstructionsPdf`
2. **הסרת ספריות**: לא צריך יותר `docx-preview`, `html2canvas`
3. **הדפסה ישירה**: PDF נפתח ב-iframe ומודפס ישירות

```typescript
const fetchCallingInstructionsPdf = async (
  israeliNumber: string | undefined,
  localNumber: string | undefined,
  barcode?: string
): Promise<Blob> => {
  // קריאה ל-Edge Function - מחזירה PDF מוכן
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-calling-instructions`,
    { /* ... */ }
  );
  return await response.blob(); // PDF ישירות!
};

export const printCallingInstructions = async (...) => {
  // 1. קבלת PDF מהשרת
  const pdfBlob = await fetchCallingInstructionsPdf(...);
  const pdfUrl = URL.createObjectURL(pdfBlob);
  
  // 2. פתיחה ב-iframe והדפסה ישירה
  const iframe = document.createElement('iframe');
  iframe.src = pdfUrl;
  iframe.onload = () => iframe.contentWindow?.print();
};
```

---

## שלב 4: יצירת ברקוד PNG

פונקציה חדשה שיוצרת ברקוד Code128 כתמונת PNG:

```typescript
function generateBarcodePng(text: string): Uint8Array {
  const pattern = generateCode128Pattern(text);
  
  // יצירת PNG ידנית
  const barWidth = 2;
  const height = 60;
  const width = pattern.length * barWidth + 20;
  
  // PNG header + IHDR + IDAT + IEND
  // ... לוגיקת PNG מלאה
  
  return pngBytes;
}
```

---

## תוצאה צפויה

```text
┌─────────────────────────────────────────────┐
│  [לוגו מקורי - ללא שינוי!]                 │
│  [עיצוב מקורי - ללא שינוי!]                │
│                                             │
│  מספר ישראלי: 0722-587-081   ← שכבת-על    │
│  מספר מקומי: 44-7429629581   ← שכבת-על    │
│                                             │
│  [תוכן ההוראות המקורי - ללא שינוי!]        │
│                                             │
│  ▌▌▌▌▌ INV-12345678 ▌▌▌▌▌    ← שכבת-על    │
└─────────────────────────────────────────────┘
```

---

## סיכום טכני

### קבצים שישתנו

| קובץ | סוג שינוי |
|------|----------|
| `supabase/functions/generate-calling-instructions/index.ts` | שכתוב מלא |
| `src/lib/callingInstructions.ts` | פישוט משמעותי |

### פעולות נוספות

1. **העלאת תבנית PDF** - נדרש מהמשתמש להמיר ולהעלות
2. **Deploy Edge Function** - אוטומטי
3. **בדיקה** - השוואה בין PDF מקורי לתוצאה

### יתרונות

- **אפס שינוי בעיצוב** - המסמך המקורי נשאר זהה לחלוטין
- **מיקום מדויק** - קואורדינטות קבועות בנקודות
- **איכות מעולה** - PDF וקטורי
- **ביצועים טובים** - פחות שלבי המרה בצד הלקוח
- **תחזוקה קלה** - קוד פשוט יותר
