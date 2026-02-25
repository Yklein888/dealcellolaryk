# 🇺🇸 US SIMs System - Setup & Troubleshooting Guide

## ✅ What's Already Complete

### 1. **Full Dashboard** (`src/pages/USSims.tsx`)
- ✅ 6 stats cards (Pending, Activating, Active, Rented, Overdue, Expiring Soon)
- ✅ 6 tabs for filtering (הכל, ממתין, בהפעלה, פעיל, מושכר, הוחזר)
- ✅ Alert banners (overdue & expiring SIMs)
- ✅ Search bar (filter by company, number, customer, etc.)
- ✅ Mobile card view + Desktop table
- ✅ Customer column showing rental info
- ✅ Per-row actions (Quick Rental, Renew, Mark Returned, Delete)

### 2. **Quick Rental Dialog** (`src/components/ussims/USSimQuickRentalDialog.tsx`)
- ✅ Select customer
- ✅ Choose start/end dates
- ✅ Auto-calculate price with `calculateAmericanSimPrice()`
- ✅ Virtual ID encoding: `us-sim-${id}` stored as `[us-sim-ID]` in item_name
- ✅ Creates rental with proper data structure

### 3. **Auto-Notification System**
- ✅ Edge Function: `supabase/functions/notify-us-sim-ready/index.ts`
  - Monitors active/overdue US SIM rentals
  - Sends WhatsApp notification when numbers assigned
  - Sends HTML email notification
  - Stores notification in database
- ✅ React Hook: `src/hooks/useUSSimNotificationSync.ts`
  - Calls Edge Function every 5 minutes
  - Graceful error handling

---

## 🔴 What Still Needs Configuration

### Issue 1: Missing Environment Variables
**Error:** Edge Function fails because it can't find `SIM_MANAGER_SUPABASE_URL` and `SIM_MANAGER_SUPABASE_KEY`

**Solution:** Add these secrets to your main Supabase project

#### Steps:

1. **Get the values from your SIM-Manager project:**
   - Go to: https://supabase.com/dashboard/project/hlswvjyegirbhoszrqyo/settings/api
   - Copy the **Project URL** (e.g., `https://hlswvjyegirbhoszrqyo.supabase.co`)
   - Copy the **Service Role Key** (⚠️ Keep this secret!)

2. **Add to main project secrets:**
   - Go to: https://supabase.com/dashboard/project/qifcynwnxmtoxzpskmmt/settings/functions
   - Click "Secrets" or "Environment Variables"
   - Add two secrets:
     ```
     SIM_MANAGER_SUPABASE_URL = https://hlswvjyegirbhoszrqyo.supabase.co
     SIM_MANAGER_SUPABASE_KEY = (paste the Service Role Key)
     ```

3. **Redeploy the Edge Function:**
   - Go to: https://supabase.com/dashboard/project/qifcynwnxmtoxzpskmmt/functions
   - Find `notify-us-sim-ready`
   - Click to view, then the system should auto-detect new secrets
   - Or manually redeploy by running:
     ```bash
     supabase functions deploy notify-us-sim-ready
     ```

---

### Issue 2: White Screen on One Computer (After Login)

**Possible Cause:** Service Worker cache or browser cache issue

**Solution (User-side):**
1. **Clear browser cache:**
   - Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
   - Select "All time"
   - Check all boxes
   - Click "Clear data"

2. **Unregister Service Worker:**
   - Open DevTools: `F12`
   - Go to "Application" tab
   - Click "Service Workers" (left menu)
   - Find "dealcellolaryk" entry
   - Click "Unregister"

3. **Hard refresh:**
   - Press `Ctrl + F5` (Windows) or `Cmd + Shift + R` (Mac)

4. **If still not working:**
   - Try incognito/private mode (to test without cache)
   - If it works in incognito, the issue is definitely cache/Service Worker

---

## 📋 Testing Checklist

Once env vars are added:

- [ ] **Open `/sims` page** - should load without CORS errors
- [ ] **Check Console (F12)** - no "CORS" or "SIM_MANAGER" errors
- [ ] **Wait 5 minutes** - notification sync runs automatically
- [ ] **Test manually:** Assign a US SIM to a customer, wait 5 min
  - Customer should receive WhatsApp + Email
  - Notification should appear in database
- [ ] **Mobile view** - all features work on phone
- [ ] **Search/tabs** - filtering works correctly

---

## 🔗 Quick Links

| System | Link |
|--------|------|
| Main Project | https://supabase.com/dashboard/project/qifcynwnxmtoxzpskmmt |
| SIM-Manager Project | https://supabase.com/dashboard/project/hlswvjyegirbhoszrqyo |
| App (Production) | https://dealcellularyk.vercel.app |
| App (Dev) | http://localhost:8080 |

---

## 🛠️ Files Reference

| File | Purpose |
|------|---------|
| `src/pages/USSims.tsx` | Main dashboard page |
| `src/components/ussims/USSimQuickRentalDialog.tsx` | Quick rental form |
| `src/hooks/useUSSims.ts` | Fetch US SIMs from sim-manager project |
| `src/hooks/useUSSimNotificationSync.ts` | Auto-check for numbers every 5 min |
| `supabase/functions/notify-us-sim-ready/index.ts` | Send notifications when numbers ready |
| `src/lib/pricing.ts` | Price calculation: `calculateAmericanSimPrice()` |

---

## 📝 Notes

- Virtual US SIM IDs use format: `us-sim-${simId}`
- Stored in rental_items as `[us-sim-ID]` prefix in `item_name` field to avoid UUID conflicts
- Notifications use WhatsApp via Supabase Edge Functions
- Email template is HTML with RTL support (Hebrew)
- System checks every 5 minutes, no manual trigger needed

