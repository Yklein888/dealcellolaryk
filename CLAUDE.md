# Deal Cellular - Project Guidelines

## Architecture (Don't Change!)
- **Frontend:** Next.js + React (deployed on Vercel)
- **Backend:** Vercel API Routes (Node.js, NOT Deno)
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (PDF templates)
- **Status:** ✅ Migration COMPLETE (Edge Functions → Vercel)
- **Live URL:** https://dealcellolaryk.vercel.app

## 12 API Routes (All in `/api/` directory)
1. yemot-call.js - Voice messages (60s timeout)
2. yemot-callback.js - Receives call status from Yemot
3. generate-calling-instructions.js - PDF generation (60s)
4. generate-invoice.js - Invoice creation
5. exchange-rate.js - USD/ILS rates (cached 1hr)
6. send-whatsapp.js - WhatsApp notifications
7. pelecard-pay.js - Payment processing (60s)
8. notify-us-sim-ready.js - US SIM notifications
9. sim-activation-request.js - Mark SIM pending
10. sim-activation-callback.js - Update SIM status
11. process-overdue.js - Auto-call + auto-charge (?type=calls or ?type=charges) (300s)
12. cellstation.js - SIM activation & swap (300s)

## External Services & Credentials
- **Yemot:** Phone system (voice calls)
- **Pelecard:** Payment processor
- **CellStation:** SIM activation (username: D0548499222)
- **WhatsApp:** Optional notifications
- **Supabase:** Database + file storage

## Critical Rules - NEVER BREAK
- ❌ Do NOT use Supabase Edge Functions (moved to Vercel)
- ❌ Do NOT use require() — must use import (ESM, package.json has "type":"module")
- ❌ Do NOT exceed 12 API routes (Vercel Hobby plan limit!)
- ❌ Do NOT modify Supabase database schema without documenting it
- ✅ Always add `maxDuration` in vercel.json when creating new routes
- ✅ Always use pdf-lib for PDF generation (NOT other libraries)
- ✅ Always maintain backwards compatibility with frontend

## Environment Variables (Required on Vercel)
```
MAIN_SUPABASE_URL=https://qifcynwnxmtoxzpskmmt.supabase.co
MAIN_SUPABASE_SERVICE_KEY=...
MAIN_SUPABASE_ANON_KEY=...
YEMOT_SYSTEM_NUMBER=...
YEMOT_PASSWORD=...
PELECARD_TERMINAL=...
PELECARD_USER=...
PELECARD_PASSWORD=...
CELLSTATION_USERNAME=D0548499222
CELLSTATION_PASSWORD=M&deal20151218
WHATSAPP_ACCOUNT_ID=... (optional)
WHATSAPP_TOKEN=... (optional)
```

## CellStation API Flow (IMPORTANT!)
**Three Actions:**
1. **activate_sim** - POST to `index.php?page=bh/index` with form data
2. **swap_sim** - POST to `index.php?page=bh/index` with form data
3. **activate_and_swap** - Two-step process:
   - Step 1: Activate new SIM
   - Step 2: Wait 20s (server-side)
   - Step 3: Return ready_to_swap status
   - Frontend must refresh SIMs list before calling swap_sim

## Memory & Context
- **Location:** `./MEMORY.md` (in this project directory, synced via Git)
- **Purpose:** Long-term memory of decisions, bugs, solutions
- **Update when:** Major changes, discovered bugs, important decisions

## If Confused During Work
1. Stop and re-read this file
2. Check MEMORY.md for context
3. Ask user for clarification if needed
