# DealCell Project - הוראות עבודה

## 🎯 מטרת הפרויקט
מערכת ניהול השכרות מקיפה עם אינטגרציה לפורטל CellStation לניהול כרטיסי SIM.

---

## 🏗️ ארכיטקטורה

### קוד מקור
- **GitHub**: https://github.com/Yklein888/dealcellolaryk
- **Branch**: main

### Hosting
- **Platform**: Vercel
- **Live URL**: https://dealcellolaryk.vercel.app
- **Project**: dealcellolaryk
- **Team**: yklein89-3235's projects

### Database - פרויקט אחד בלבד!

#### ⚠️ חשוב: יש פרויקט Supabase אחד בלבד
- **Project**: Sim-manager
- **Project ID**: hlswvjyegirbhoszrqyo
- **URL**: https://hlswvjyegirbhoszrqyo.supabase.co
- **Dashboard**: https://supabase.com/dashboard/project/hlswvjyegirbhoszrqyo
- **טבלאות**: cellstation_sims (+ כל שאר הטבלאות של האפליקציה)
- **Edge Function**: cellstation-api
- **Secrets**: CELLSTATION_USERNAME, CELLSTATION_PASSWORD
- **RLS על cellstation_sims**: מכובה (DISABLED) - חובה להשאיר כך!

> ❌ הפרויקט qifcynwnxmtoxzpskmmt לא קיים (נמחק). לא לציין אותו בשום מקום.

---

## 🔑 Credentials

### GitHub
```
Token: [GITHUB_TOKEN_IN_SETTINGS]
Owner: Yklein888
Expires: March 22, 2026
```

### Vercel Environment Variables
```
VITE_SUPABASE_URL=https://hlswvjyegirbhoszrqyo.supabase.co   ← לא בשימוש! client.ts hardcoded
VITE_SUPABASE_ANON_KEY=[KEY_IN_VERCEL_ENV]
```

### Supabase Keys
```
Anon Key: [KEY_IN_VERCEL_ENV]

Service Role Key: [KEY_IN_VERCEL_ENV]
```

---

## 🔧 ארכיטקטורת הקוד - קריטי!

### src/integrations/supabase/client.ts
```typescript
// URL מקושח - לא תלוי ב-env vars
const SUPABASE_URL = 'https://hlswvjyegirbhoszrqyo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
```

### src/hooks/useCellStation.tsx - fetch ישיר!
```typescript
// ⚠️ לא להחליף ב-createClient! יגרום ל-CORS ERR_FAILED
const CS_URL = 'https://hlswvjyegirbhoszrqyo.supabase.co';
const CS_KEY = '...anon key...';
const CS_H = { 'apikey': CS_KEY, 'Authorization': `Bearer ${CS_KEY}` };          // ← ללא Content-Type (GET)
const CS_H_JSON = { ...CS_H, 'Content-Type': 'application/json' };               // ← עם Content-Type (POST/PATCH)

// GET - ללא Content-Type כדי למנוע CORS preflight
async function csGet(path: string): Promise<any[]>

// POST/PATCH/DELETE - עם Content-Type
async function csInsert(table: string, rows: any[]): Promise<void>
async function csUpdate(table: string, filter: string, data: any): Promise<void>
async function csDelete(path: string): Promise<void>
async function csInvoke(action: string, params: any): Promise<any>  // Edge Function
```

### ⚠️ כללי CORS קריטיים
- **Content-Type בלי צורך → preflight OPTIONS → נכשל!**
- ב-GET requests: **אסור** להוסיף `Content-Type: application/json`
- ב-POST/PATCH: מותר כי הדפדפן שולח preflight שעובד

---

## 🔄 Workflow

### לעשות שינויים בקוד
```bash
1. ערוך קבצים ב-src/
2. git add -A
3. git commit -m "תיאור השינוי"
4. git push origin main
5. Vercel יעשה deploy אוטומטי (1-2 דקות)
```

### לשנות Database
```
1. Supabase Dashboard → Table Editor / SQL Editor
2. ערוך או הרץ SQL
3. שינויים מיידיים
```

### לעדכן Edge Functions
```
1. Supabase Dashboard → Edge Functions
2. ערוך קוד
3. Deploy
4. פעיל תוך שניות
```

---

## 📁 מבנה קבצים חשוב

```
src/
├── pages/
│   ├── Dashboard.tsx           # דף ראשי + Real-Time Sync
│   ├── CellStation.tsx         # ניהול סימים
│   ├── Rentals.tsx
│   └── ...
├── hooks/
│   ├── useCellStation.tsx      # ⚠️ fetch ישיר - לא createClient!
│   ├── useRental.tsx
│   └── ...
├── components/
│   ├── cellstation/
│   ├── dashboard/
│   └── ...
└── integrations/
    └── supabase/
        └── client.ts           # URL מקושח ל-hlswvjyegirbhoszrqyo

supabase/functions/
└── cellstation-api/
    └── index.ts               # Edge Function - login ל-CellStation portal
```

---

## ✅ Features מיושמים

- ✅ מערכת השכרות מלאה
- ✅ ניהול לקוחות ומלאי
- ✅ תיקונים ותשלומים
- ✅ Real-Time Sync (Dashboard)
- ✅ אינטגרציה עם Pelecard
- ✅ אינטגרציה עם Yemot
- ✅ יצירת חשבוניות
- ✅ CellStation Sync - עובד! (fetch ישיר, RLS מכובה)

---

## 📞 תמיכה

שאלות? פתח צ'אט חדש עם Claude עם הקישור למסמך הזה!
