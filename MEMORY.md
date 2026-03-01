# Deal Cellular - Memory & Status

## 📌 Last Updated
March 1, 2026

---

## 🎯 Current Project State

| Component | Status | Notes |
|-----------|--------|-------|
| API Routes (12 total) | ✅ COMPLETE | Vercel Hobby = max 12 |
| Frontend | ✅ COMPLETE | All imports updated |
| Vercel Config | ✅ COMPLETE | vercel.json configured |
| Environment Variables | ✅ SET | Added to Vercel dashboard |
| Deployment | ✅ LIVE | dealcellolaryk.vercel.app |
| ESM Fix | ✅ FIXED | All require() → import |

---

## 🔄 Recent Changes

#### ✅ fix: convert require() to import in all API routes (ESM fix)
- **Time:** 2026-03-01 15:52
- **Files:** api/generate-invoice.js, api/notify-us-sim-ready.js, api/pelecard-pay.js + 5 others
- **Commit:** 6240fd3
- **Why:** package.json has "type":"module" → require() crashes at runtime on Vercel

#### ✅ fix: reduce API routes to 12 to fit Vercel Hobby plan limit
- **Time:** 2026-03-01 15:41
- **Files:** api/process-overdue-calls.js, api/process-overdue-charges.js → merged into api/process-overdue.js
- **Commit:** bb17407
- **Why:** Vercel Hobby plan = max 12 serverless functions. Had 14, merged 2 + deleted unused yemot-sms.js

#### ✅ fix(pelecard-pay): support anon key + user JWT when no service key available
- **Time:** 2026-03-01 14:41
- **Files:** api/pelecard-pay.js, src/pages/Customers.tsx, src/pages/Rentals.tsx
- **Commit:** 1a9c5c0

#### ✅ fix(swap_sim): find rental by account name even when ICCID not visible in BH index
- **Time:** 2026-02-26 01:13
- **Files:** api/cellstation.js, src/hooks/useCellStation.tsx
- **Commit:** 33a5715

#### ✅ Fix activate_and_swap: use correct CellStation endpoints
- **Time:** 2026-02-25 20:22
- **Files:** api/cellstation.js, src/components/cellstation/ActivateAndSwapDialog.tsx
- **Commit:** 432c79b

#### ✅ Major Migration: Edge Functions → Vercel API Routes
- **Time:** 2026-02-25
- **Commit:** cf0cbfa
- **Why:** Remove Lovable dependency. Voice messages failing on Windows. PDF broken.

---

## 🐛 Known Issues & Solutions

### Issue: ESM/CJS Mixing (SOLVED)
**Problem:** package.json has `"type":"module"` but API files used `require()` → FUNCTION_INVOCATION_FAILED 500 on Vercel
**Root Cause:** Next.js dev server transpiles mixed CJS+ESM, but Vercel production runs Node.js directly
**Solution:** Convert all `require('@supabase/supabase-js')` → `import { createClient } from '@supabase/supabase-js'`

### Issue: Vercel Hobby = Max 12 Functions (SOLVED)
**Problem:** Had 14 API routes, Vercel Hobby allows max 12
**Solution:**
- Merged `process-overdue-calls.js` + `process-overdue-charges.js` → `process-overdue.js` (use `?type=calls` or `?type=charges`)
- Deleted `yemot-sms.js` (was not used anywhere in frontend)

### Issue: CellStation activate_and_swap (SOLVED)
**Problem:** `fetch_BHsim_details.php` fails internally
**Solution:** POST directly to `index.php?page=bh/index` bypassing that endpoint

---

## 📋 12 API Routes (Current)

| Route | Timeout | Purpose |
|-------|---------|---------|
| cellstation.js | 300s | SIM activation & swap |
| yemot-call.js | 60s | Voice messages |
| yemot-callback.js | 30s | Call status from Yemot |
| generate-calling-instructions.js | 60s | PDF generation |
| generate-invoice.js | 30s | Invoice creation |
| exchange-rate.js | 30s | USD/ILS (cached 1hr) |
| send-whatsapp.js | 30s | WhatsApp notifications |
| pelecard-pay.js | 60s | Payment processing |
| notify-us-sim-ready.js | 60s | US SIM notifications |
| process-overdue.js | 300s | Auto-call + auto-charge (?type=calls/charges) |
| sim-activation-request.js | 30s | Mark SIM pending |
| sim-activation-callback.js | 30s | Update SIM status |

---

## 🔑 Environment Variables (All set on Vercel)

```
MAIN_SUPABASE_URL=https://qifcynwnxmtoxzpskmmt.supabase.co
MAIN_SUPABASE_SERVICE_KEY=✅ set
MAIN_SUPABASE_ANON_KEY=✅ set
YEMOT_SYSTEM_NUMBER=✅ set
YEMOT_PASSWORD=✅ set
PELECARD_TERMINAL=✅ set
PELECARD_USER=✅ set
PELECARD_PASSWORD=✅ set
CELLSTATION_USERNAME=D0548499222
CELLSTATION_PASSWORD=M&deal20151218
WHATSAPP_ACCOUNT_ID=optional
WHATSAPP_TOKEN=optional
```

---

## 🏗️ Architecture

- **Frontend:** Next.js + React → deployed on Vercel (dealcellolaryk.vercel.app)
- **Backend:** Vercel API Routes (Node.js, ESM)
- **Database:** Supabase PostgreSQL
- **Storage:** Supabase Storage (PDF templates at `templates/` bucket)
- **❌ NOT using:** Supabase Edge Functions (all moved to Vercel)

---

## 📋 Important Rules

- ❌ Never use `require()` — must use `import` (ESM)
- ❌ Never exceed 12 API routes (Vercel Hobby limit)
- ✅ Always add `maxDuration` in vercel.json for new routes
- ✅ Use `pdf-lib` for all PDF generation
- ✅ Test on `dealcellolaryk.vercel.app` (not localhost) when debugging Vercel issues
