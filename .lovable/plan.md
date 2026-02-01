
מטרה
- להפוך את “הוראות החיוג” של סים אירופאי ל”הדפסה ישירה” בלי להוריד קבצי Word למחשב, ובמקביל לשמור על העיצוב המקורי של תבנית ה‑DOCX (בלי “עיצוב מחדש”).
- לפי הבדיקה בקוד: היום ההוראות נוצרות בשרת כ‑DOCX מתוך התבנית המקורית (Edge Function: `generate-calling-instructions`) ואז נשמרות מקומית דרך `file-saver` (הורדה).

מה יש היום (מצב קיים בקוד)
- `src/lib/callingInstructions.ts`:
  - `generateCallingInstructions(...)` קורא לפונקציית backend `generate-calling-instructions` ומקבל DOCX כ‑Blob.
  - אחר כך עושה `saveAs(blob, "...docx")` → זה יוצר קובץ במחשב (העמסה/בלגן).
- שימושים:
  - `src/pages/Rentals.tsx` מציג כפתור “הורד הוראות חיוג” לסים אירופאי.
  - `src/components/rentals/NewRentalDialog.tsx` מציג אייקון הורדה (FileDown) לסים אירופאי בתוך “פריטים נבחרים”.
- אין כרגע הדפסה ישירה, ואין שום ספריות jsPDF/html2canvas/docx-preview בפרויקט.

הבעיה והאילוץ המרכזי
- דפדפנים לא “מדפיסים Word” בצורה נאטיבית.
- כל ניסיון להמיר DOCX ל‑HTML ולהדפיס – בדרך כלל הורס את הפריסה של התבנית.
- כדי לשמור את הפריסה המקורית של התבנית, נשתמש בגישה שמדפיסה PDF שנוצר בתהליך שמנסה לשמר את העיצוב המקורי ככל האפשר.

הפתרון המוצע (לפי ההנחיות שלך)
ניישם הדפסה ישירה כך:
1) נמשיך לייצר DOCX מהתבנית המקורית (כמו היום) – זה שומר את “האמת” של המסמך המקורי.
2) במקום להוריד את ה‑DOCX למחשב, נרנדר אותו בתוך הדפדפן בצורה נאמנה לתבנית באמצעות `docx-preview`.
3) נצלם את הדפים כרינדור (Canvas) באמצעות `html2canvas` (זה נותן “תמונה” של הדף כפי שמופיע – הכי קרוב לשמירה על פריסה).
4) נרכיב PDF מתוך התמונות בעזרת `jsPDF`.
5) ניצור Blob של ה‑PDF בזיכרון (ללא הורדה).
6) ניצור URL זמני עם `URL.createObjectURL`.
7) נטעין את ה‑PDF בתוך iframe נסתר ונפעיל `print()` אוטומטית.
8) ניקוי משאבים: הסרת iframe, הסרת קונטיינרים זמניים, `URL.revokeObjectURL`.

הערת איכות חשובה (כדי להימנע מ”עיצוב מחדש”)
- ה‑PDF שיודפס יהיה “תמונתי” (כל דף תמונה), כי זה מה שמאפשר לשמור פריסה ב‑100% הרבה יותר טוב.
- החיסרון: טקסט לא יהיה “Selectable” כמו PDF טקסטואלי, אבל הדפסה תיראה כמו המקור.

שינויים בקוד (קבצים ותכולה)

A) הוספת תלויות (dependencies)
- נוסיף חבילות:
  - `docx-preview`
  - `html2canvas`
  - `jspdf`
- עדכון `package.json` בהתאם.

B) ריפקטור ב‑`src/lib/callingInstructions.ts`
נפצל את האחריות ל־2 פעולות:
1) פונקציה פנימית/חדשה שמחזירה Blob של ה‑DOCX בלי להוריד:
   - `fetchCallingInstructionsDocx(israeliNumber, localNumber, barcode): Promise<Blob>`
2) “הדפסה ישירה”:
   - `printCallingInstructions(israeliNumber, localNumber, barcode): Promise<void>`
   - שלבים:
     - `const docxBlob = await fetchCallingInstructionsDocx(...)`
     - יצירת `bodyContainer` + `styleContainer` נסתרים (offscreen)
     - `await renderAsync(docxBlob, bodyContainer, styleContainer, options)`
     - איתור דפים:
       - אם `docx-preview` יוצר `.docx-page` → נצלם כל דף בנפרד לדיוק ומולטי‑עמודים
       - אחרת נצלם את הקונטיינר כולו
     - `html2canvas(pageEl, { scale: 2, useCORS: true, backgroundColor: "#fff" })`
     - `jsPDF("p","mm","a4")` + `addImage` לכל דף
     - `const pdfBlob = pdf.output("blob")`
     - `const url = URL.createObjectURL(pdfBlob)`
     - iframe נסתר:
       - `iframe.src = url`
       - `iframe.onload = () => iframe.contentWindow?.print()`
     - ניקוי אחרי ~1–2 שניות:
       - `document.body.removeChild(iframe)`
       - `URL.revokeObjectURL(url)`
       - הסרת הקונטיינרים של ה‑docx-preview
3) נשאיר אופציה להורדה (למקרי גיבוי) – אבל לא כפעולה הראשית:
   - `downloadCallingInstructions(...)` שישתמש שוב ב‑`saveAs(docxBlob, ...)`.
   - או נשאיר את הפונקציה הקיימת כ”הורדה” ונוסיף חדשה להדפסה; אבל נעדכן את ה‑UI להשתמש בהדפסה.

C) עדכון ה‑UI לאירופאי (שלא יוריד קבצים)
1) `src/pages/Rentals.tsx`
- לשנות את הכפתור “הורד הוראות חיוג” ל:
  - טקסט: “הדפס הוראות חיוג”
  - אייקון: `Printer` במקום `FileDown`
- לשנות את handler:
  - במקום `generateCallingInstructions(...)` → `printCallingInstructions(...)`
- Toast:
  - במקום “הקובץ הורד בהצלחה” → הודעה בסגנון:
    - “פותח חלון הדפסה…”
    - ואם יש כשל: “לא ניתן לפתוח הדפסה. אפשר לנסות הורדה כגיבוי.”

2) `src/components/rentals/NewRentalDialog.tsx`
- להחליף את כפתור האייקון (FileDown) לאייקון Printer ולהדפיס ישירות באותו אופן.
- לשמור על אותה לוגיקה של “כפתור לכל סים” כאשר יש כמה סימים.

D) טיפול בקצוות (כדי למנוע “שוב זה לא עובד לי”)
- חסימת “לחיצה כפולה” בזמן יצירה/רינדור/הדפסה:
  - שימוש ב‑`downloadingInstructions` (אולי נרצה לשנות שם ל‑`printingInstructions`, אבל לא חובה)
- תאימות דפדפנים:
  - Chrome/Edge: אמור לעבוד טוב
  - Safari/iOS: לעיתים `print()` בתוך iframe יכול להיות רגיש; נשאיר fallback “הורד כקובץ” בתוך תפריט קטן או כפתור משני (מומלץ מאוד כדי שלא תיתקע).
- ניקוי זיכרון:
  - חובה לוודא `revokeObjectURL` והסרת DOM זמני אחרי כל הדפסה, אחרת זה יכול לצבור זיכרון.

בדיקות/QA שנבצע אחרי מימוש
1) הדפסה ישירה מסים אירופאי מתוך:
   - כרטיס השכרה ב‑`/rentals`
   - דיאלוג “השכרה חדשה” (`NewRentalDialog`)
2) בדיקה עם:
   - סים עם מספר ישראלי + מקומי
   - סים עם מקומי בלבד
   - ברקוד קיים
3) בדיקת איכות:
   - שהפריסה זהה לתבנית המקורית (כותרות/יישור/מרווחים/ברקוד בתחתית שמאל)
4) בדיקה שאין הורדה למחשב:
   - לא נוצר קובץ בתיקיית Downloads
5) בדיקת ביצועים:
   - לוודא שלא נשארים iframes/containers אחרי ההדפסה (Memory leak)

מה ייצא למשתמש בסוף (תוצאה)
- לחיצה על “הדפס הוראות חיוג” תפתח מיד את דיאלוג ההדפסה של הדפדפן עם מסמך שנראה כמו התבנית המקורית.
- לא יווצרו עשרות קבצי Word במחשב.
- אם הדפסה נחסמת/נכשלת בדפדפן מסוים: יהיה fallback להורדה (רצוי), כדי שתמיד תהיה דרך להדפיס.

קבצים שניגע בהם
- `package.json` (הוספת תלויות)
- `src/lib/callingInstructions.ts` (ריפקטור + פונקציית print)
- `src/pages/Rentals.tsx` (להחליף “הורדה” ל”הדפסה” ולשנות אייקון/טקסט/טוסטים)
- `src/components/rentals/NewRentalDialog.tsx` (אותו שינוי בדיאלוג)

סיכונים ידועים והפחתה
- “הדפסה חייבת להיות מתוך פעולה של המשתמש”: תהליך רינדור+צילום הוא אסינכרוני, ובחלק מהדפדפנים זה עלול להיחשב לא “user gesture”.
  - הפחתה: נשמור את ההדפסה כתגובה ישירה ללחיצה, ונפתח את ה‑iframe מיד עם “מסך טוען” ואז נחליף ל‑pdf כשהוא מוכן, או נשאיר fallback הורדה במצב שהדפסה נחסמה.
- התאמת פונטים: אם התבנית משתמשת בפונט שלא קיים במערכת, התצוגה עשויה להשתנות.
  - הפחתה: `docx-preview` מנסה לכבד fonts; בנוסף צילום כקנבס יקפיא את מה שנראה בפועל.

