# 🚀 Vercel Environment Variables Setup

**Status:** ✅ Ready to deploy - Add 4 environment variables

---

## 📋 Environment Variables Required

| Variable | Value |
|----------|-------|
| `CELLSTATION_USERNAME` | `D0548499222` |
| `CELLSTATION_PASSWORD` | `M&deal20151218` |
| `SUPABASE_URL` | `https://hlswvjyegirbhoszrqyo.supabase.co` |
| `SUPABASE_SERVICE_KEY` | (Your Supabase Service Role Key) |

---

## ✅ Step-by-Step Setup Instructions

### Step 1️⃣: Go to Vercel Dashboard
1. Open: https://vercel.com/dashboard
2. Select the `dealcellularyk` project

### Step 2️⃣: Open Environment Variables
1. Click **Settings** (top navigation)
2. Click **Environment Variables** (left sidebar)

### Step 3️⃣: Add `CELLSTATION_USERNAME`
1. Click **Add Environment Variable**
2. **Name:** `CELLSTATION_USERNAME`
3. **Value:** `D0548499222`
4. **Environment:** Select ALL (Production, Preview, Development)
5. Click **Save**

### Step 4️⃣: Add `CELLSTATION_PASSWORD`
1. Click **Add Environment Variable**
2. **Name:** `CELLSTATION_PASSWORD`
3. **Value:** `M&deal20151218`
4. **Environment:** Select ALL (Production, Preview, Development)
5. Click **Save**

### Step 5️⃣: Add `SUPABASE_URL`
1. Click **Add Environment Variable**
2. **Name:** `SUPABASE_URL`
3. **Value:** `https://hlswvjyegirbhoszrqyo.supabase.co`
4. **Environment:** Select ALL (Production, Preview, Development)
5. Click **Save**

### Step 6️⃣: Add `SUPABASE_SERVICE_KEY`
1. Click **Add Environment Variable**
2. **Name:** `SUPABASE_SERVICE_KEY`
3. **Value:** (Get from Supabase Dashboard → Settings → API)
4. **Environment:** Select ALL (Production, Preview, Development)
5. Click **Save**

### Step 7️⃣: Trigger Redeploy
1. Go to **Deployments** tab
2. Find the latest deployment (from your git push)
3. Click the three dots menu
4. Click **Redeploy**

⏳ Wait 2-5 minutes for redeploy to complete

---

## ✅ Testing After Deploy

Once redeployment completes:

1. **Open the app:** https://dealcellularyk.vercel.app
2. **Test the CellStation API:**
   - Navigate to the SIM activation page
   - Try to activate a SIM or swap
   - Check browser console (F12) for errors

### Expected Success:
- ✅ No "CELLSTATION_USERNAME" or "CELLSTATION_PASSWORD" errors
- ✅ No connection errors to CellStation
- ✅ API responses contain proper data

### If Something Fails:
1. Check **Vercel Logs** (Deployments → Function Logs)
2. Verify all 4 env vars are set
3. Check that values are exact (no extra spaces)
4. Look for curl errors related to CellStation connection

---

## 🔐 Security Notes

- ⚠️ These credentials should be kept secret
- Never commit `.env` files with real values to Git
- Environment variables are encrypted in Vercel
- Only team members with access can see them

---

## 🚀 What Gets Fixed

The updated API:
- ✅ **activate_sim**: Activates a new SIM without fetch_BHsim_details.php errors
- ✅ **swap_sim**: Swaps an active SIM to a new one
- ✅ **activate_and_swap**: Activates a new SIM, waits 60s, then swaps
- ✅ All actions bypass the problematic fetch_BHsim_details.php endpoint

---

## 📞 Done? You're Ready!

Once all env vars are set and redeploy completes, the CellStation integration is fully operational:
- API Routes respond to requests
- CellStation authentication works
- SIM activation and swapping functions properly
