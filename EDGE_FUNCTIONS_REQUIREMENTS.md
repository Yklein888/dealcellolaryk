# 🔌 Edge Functions - Environment Variables Required

## 📋 Summary

**Auto-Provided by Supabase:** 3 variables
**Requires Manual Setup:** 10+ variables
**For US SIMs Only:** 2 critical variables

---

## ✅ Auto-Provided (No Setup Needed)

These are automatically set when Edge Functions run in your Supabase project:

| Variable | Value | Used In |
|----------|-------|---------|
| `SUPABASE_URL` | Your main project URL | All functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (from settings) | All functions |
| `SUPABASE_ANON_KEY` | Anon key | Notification functions |

---

## 🔴 **For US SIMs Notification System (CRITICAL)**

**Required for:** `notify-us-sim-ready` Edge Function

| Variable | Value | Where to Get |
|----------|-------|--------------|
| `SIM_MANAGER_SUPABASE_URL` | `https://hlswvjyegirbhoszrqyo.supabase.co` | Fixed (SIM-Manager project URL) |
| `SIM_MANAGER_SUPABASE_KEY` | Anon key from SIM-Manager | https://supabase.com/dashboard/project/hlswvjyegirbhoszrqyo/settings/api |

**How to Add to Vercel:**
1. Go to: https://vercel.com/dashboard/project/dealcellularyk/settings?tab=environment-variables
2. Add both variables with Environment = "ALL"
3. Redeploy

---

## 🟡 Optional (If You Use These Features)

### WhatsApp Notifications
**Edge Function:** `send-whatsapp-notification`

| Variable | Description |
|----------|-------------|
| `WHATSAPP_ACCOUNT_ID` | Your WhatsApp Business Account ID |
| `WHATSAPP_TOKEN` | WhatsApp API token |

### Yemot Integration (Calls/SMS)
**Edge Functions:** `yemot-call`, `yemot-sms`, `yemot-callback`

| Variable | Description |
|----------|-------------|
| `YEMOT_PASSWORD` | Yemot system password |
| `YEMOT_SYSTEM_NUMBER` | Your Yemot system number |

### CellStation Integration
**Edge Function:** `cellstation-api`

| Variable | Description |
|----------|-------------|
| `CELLSTATION_USERNAME` | CellStation username |
| `CELLSTATION_PASSWORD` | CellStation password |

### Pelecard Payment
**Edge Function:** `pelecard-pay`

| Variable | Description |
|----------|-------------|
| `PELECARD_USER` | Pelecard user ID |
| `PELECARD_PASSWORD` | Pelecard password |
| `PELECARD_TERMINAL` | Pelecard terminal ID |

### SIM Activation Callback
**Edge Function:** `sim-activation-callback`

| Variable | Default | Description |
|----------|---------|-------------|
| `SIM_ACTIVATION_API_KEY` | `sim-activation-secret-key` | API key for webhook validation |

---

## 🎯 Recommended Setup Order

### Phase 1: Critical (Required Now)
- [ ] `SIM_MANAGER_SUPABASE_URL`
- [ ] `SIM_MANAGER_SUPABASE_KEY`

### Phase 2: Important (If Using)
- [ ] `WHATSAPP_ACCOUNT_ID` + `WHATSAPP_TOKEN`
- [ ] `YEMOT_PASSWORD` + `YEMOT_SYSTEM_NUMBER`

### Phase 3: Optional (Nice to Have)
- [ ] `CELLSTATION_USERNAME` + `CELLSTATION_PASSWORD`
- [ ] `PELECARD_USER` + `PELECARD_PASSWORD` + `PELECARD_TERMINAL`

---

## 📝 How to Add to Vercel

1. **Go to:**
   https://vercel.com/dashboard/project/dealcellularyk/settings?tab=environment-variables

2. **For each variable:**
   - Click **Add Environment Variable**
   - Enter Name
   - Enter Value
   - Select Environment: **All** (Production, Preview, Development)
   - Click **Save**

3. **After adding:**
   - Go to **Deployments**
   - Click the latest deployment
   - Click **Redeploy** button
   - Wait 5-10 minutes

---

## ✅ Verification

After setting environment variables:

1. Open **DevTools** (`F12`)
2. Go to **Network** tab
3. Find requests to Edge Functions
4. Check response status:
   - ✅ 200 = Variable found and working
   - ❌ 500 = Variable missing or invalid

Example console output:
```
[US SIM Sync] Update check result: { success: true, notified: 2 }
```

---

## 🔐 Security Notes

- ⚠️ Never commit `.env` files to Git
- ✅ `.env.local` is in `.gitignore` (safe)
- ✅ Vercel stores secrets securely
- ✅ Use anon keys (not service role keys) for client-side
- ✅ Service role keys only in Edge Functions

---

## 🆘 Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "SIM_MANAGER_SUPABASE_URL is required" | Variable not set | Add to Vercel and redeploy |
| "Could not establish connection" | SIM-Manager key invalid | Check key is correct anon key |
| "CORS error" | Wrong project URL | Use `hlswvjyegirbhoszrqyo` not main project |
| Function times out | Missing credentials | Check all required variables are set |

---

## 📞 Quick Reference

```bash
# For US SIMs Feature (ESSENTIAL)
SIM_MANAGER_SUPABASE_URL=https://hlswvjyegirbhoszrqyo.supabase.co
SIM_MANAGER_SUPABASE_KEY=<anon-key-from-sim-manager>

# For WhatsApp (Optional)
WHATSAPP_ACCOUNT_ID=<your-account-id>
WHATSAPP_TOKEN=<your-token>

# For Yemot (Optional)
YEMOT_PASSWORD=<your-password>
YEMOT_SYSTEM_NUMBER=<your-number>
```
