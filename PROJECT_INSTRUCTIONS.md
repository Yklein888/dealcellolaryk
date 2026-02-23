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
- **Deploy**: אוטומטי עם כל push ל-main

### Database - Supabase יחיד!
> ⚠️ יש רק פרויקט Supabase אחד: **hlswvjyegirbhoszrqyo**

#### Supabase (hlswvjyegirbhoszrqyo)
- **URL**: https://hlswvjyegirbhoszrqyo.supabase.co
- **Dashboard**: https://supabase.com/dashboard/project/hlswvjyegirbhoszrqyo
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3d2anllZ2lyYmhvc3pycXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3OTg4MTAsImV4cCI6MjA4NjM3NDgxMH0.KNRl4-S-XxVMcaoPPQXV5gLi6W9yYNWeHqtMok-Mpg8`
- **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3d2anllZ2lyYmhvc3pycXlvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc5ODgxMCwiZXhwIjoyMDg2Mzc0ODEwfQ.C_0heApIB-wQvh2QM6-BqDakOyRcqiVhexuKAdwUrKI`
- **טבלאות**: cellstation_sims (+ כל שאר הטבלאות של המערכת)
- **Edge Function**: cellstation-api ✅ פעילה

---

## 🔑 Credentials

### GitHub
```
Token: ghp_xxxx... (שמור בנפרד - לא לשמור ב-GitHub\!)
Owner: Yklein888
Expires: March 22, 2026
```

### Vercel Environment Variables
```
VITE_SUPABASE_URL=https://hlswvjyegirbhoszrqyo.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3d2anllZ2lyYmhvc3pycXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3OTg4MTAsImV4cCI6MjA4NjM3NDgxMH0.KNRl4-S-XxVMcaoPPQXV5gLi6W9yYNWeHqtMok-Mpg8
```

---

## ⚙️ cellstation-api Edge Function

### מה היא עושה
הפונקציה מתחברת לפורטל CellStation (https://cellstation.co.il/portal) ומנהלת את כל הסימים:

| Action | תיאור |
|--------|-------|
| `get_sims` | שליפת כל הסימים מה-DB (ללא login לפורטל) |
| `sync_csv` | סנכרון מהפורטל → שולף CSV → שומר ב-DB |
| `activate_sim` | הפעלת SIM חדש בפורטל |
| `swap_sim` | החלפת SIM |
| `activate_and_swap` | הפעלה + החלפה (עם המתנה 60 שניות ביניהם) |
| `update_sim_status` | עדכון סטטוס SIM ב-DB |

### Secrets שמוגדרים ב-Supabase
- `CELLSTATION_USERNAME` ✅
- `CELLSTATION_PASSWORD` ✅

### איך לקרוא לפונקציה
```bash
curl -X POST https://hlswvjyegirbhoszrqyo.supabase.co/functions/v1/cellstation-api \
  -H "Content-Type: application/json" \
  -H "apikey: <ANON_KEY>" \
  -d '{"action":"get_sims"}'
```

---

## 🚨 כללי ברזל - Edge Functions ב-Supabase

### ❌ אסור - קוד ישן שלא עובד
```typescript
// אסור! - import ישן מ-deno.land
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// אסור! - esm.sh לא נתמך ב-runtime החדש
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// אסור! - שימוש ב-serve() הישן
serve(async (req) => { ... });
```

### ✅ חובה - קוד נכון ל-runtime הנוכחי
```typescript
// נכון! - npm: specifier
import { createClient } from "npm:@supabase/supabase-js@2";

// נכון! - Deno.serve ישירות
Deno.serve(async (req) => { ... });
```

> 💡 **למה?** Supabase עדכנו את ה-Deno runtime. הפקודה `serve` מ-deno.land/std
> ו-imports מ-`esm.sh` גורמים ל-`BOOT_ERROR` בגרסאות חדשות.
> תמיד להשתמש ב-`npm:` ו-`Deno.serve`.

---

## 🔄 איך לעדכן Edge Function

### דרך Management API (מומלץ)
```bash
# 1. הכן את הקוד
# 2. שלח PATCH עם body=קוד ו-verify_jwt=false

curl -X PATCH \
  "https://api.supabase.com/v1/projects/hlswvjyegirbhoszrqyo/functions/cellstation-api" \
  -H "Authorization: Bearer <SUPABASE_PAT>" \
  -H "Content-Type: application/json" \
  -d '{"verify_jwt": false, "body": "<קוד TypeScript כ-string>"}'
```

### Supabase Personal Access Token (PAT)
נשמר בצ'אט - לא לשתף. ניתן לצור ב: https://supabase.com/dashboard/account/tokens

### לבדוק שהפונקציה עובדת אחרי עדכון
```bash
curl -X POST https://hlswvjyegirbhoszrqyo.supabase.co/functions/v1/cellstation-api \
  -H "Content-Type: application/json" \
  -H "apikey: <ANON_KEY>" \
  -d '{"action":"get_sims"}'
# צפוי: {"success":true,"sims":[...]} עם 29 סימים
```

---

## 📁 מבנה קבצים חשוב

```
src/
├── pages/
│   ├── Dashboard.tsx           # דף ראשי
│   ├── CellStation.tsx         # ניהול סימים
│   └── ...
├── hooks/
│   ├── useCellStation.tsx      # Logic CellStation - קורא ל-Edge Function
│   └── ...
├── integrations/
│   └── supabase/
│       └── client.ts           # hardcoded URL ל-hlswvjyegirbhoszrqyo

supabase/functions/
└── cellstation-api/
    └── index.ts               # ✅ מעודכן - npm: + Deno.serve
```

---

## 🔄 Workflow

### לעשות שינויים בקוד
```
1. ערוך קבצים דרך GitHub API
2. Vercel עושה deploy אוטומטי (1-2 דקות)
3. בדוק ב: https://dealcellolaryk.vercel.app
```

### לעדכן Edge Function
```
1. ערוך supabase/functions/cellstation-api/index.ts ב-GitHub
2. שלח PATCH ל-Supabase Management API
3. בדוק עם curl
```

---

## ✅ סטטוס נוכחי (פברואר 2026)

- ✅ מערכת השכרות מלאה
- ✅ ניהול לקוחות ומלאי
- ✅ cellstation-api פעילה ועובדת (גרסה 17)
- ✅ סנכרון 29 סימים מ-CellStation
- ✅ Real-Time Sync
- ✅ אינטגרציה Pelecard, Yemot
