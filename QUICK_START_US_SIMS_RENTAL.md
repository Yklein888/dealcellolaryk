# Quick Start: US SIM Rental System

## 🚀 How to Start Using US SIM Rentals (Right Now!)

### Step 1: Create a US SIM

```
1. Go to: סימים ארה"ב (/sims)
2. Click: + הוסף סים
3. Fill in:
   ✓ Company: T-Mobile / AT&T / Verizon / etc.
   ✓ SIM Number: (optional ICCID)
   ✓ Package: שיחות בלבד / 8GB / ללא הגבלה
   ✓ Israeli Number: YES ✓ or NO ✗
   ✓ Notes: (optional)
4. Click: הוסף
   → Status: ממתין (Pending)
```

### Step 2: Activate the SIM

```
1. Copy activation link from /sims page
2. Send to US contact via WhatsApp
3. Contact opens link on any device (no login needed)
4. Contact fills:
   ✓ Local US number: +1-555-123-4567
   ✓ Israeli number: 050-1234567 (if you selected YES in step 1)
   ✓ Expiry date: MM/DD/YYYY
5. Click: שמור
   → Status changes to: פעיל (Active)
   → ✅ Automatic WhatsApp notification sent!
```

### Step 3: Rent to Customer

```
1. Go to: Rentals
2. Click: + Create New Rental
3. Select customer and dates
4. In right column (ItemSelector):
   ✓ Search: "T-Mobile" or company name
   ✓ OR filter: 🇺🇸 סים אמריקאי
5. Click the US SIM card to select
6. Toggle: ישראלי (+$10) if included
7. See price preview:
   📊 סים אמריקאי    $55-75
8. Click: צור השכרה
   → Rental created with US SIM!
```

---

## ✨ Features Available

### Feature 1: Automatic WhatsApp Notifications

When SIM status changes:

| Status Change | Message Sent |
|---|---|
| ⏳ pending → activating | "סים T-Mobile החל בהפעלה - ממתין למספרים..." |
| ✅ activating → active | "סים T-Mobile הופעל בהצלחה! 📱 +1-555... 🇮🇱 050-..." |
| 🔙 any → returned | "סים T-Mobile הוחזר למלאי" |

**Note:** WhatsApp contact must be configured in Settings

### Feature 2: Automatic Inventory Sync

- ✅ Active US SIMs automatically appear in rental system
- ✅ Syncs every 5 minutes
- ✅ No manual action needed
- ✅ Already available for customer rentals

---

## 💰 Pricing

### Formula
```
Price (USD) = $55 (base per week)
            + $10 × (weeks - 1) (additional weeks)
            + $10 (if Israeli number included - one time)
```

### Examples

| Duration | Israeli | Calculation | Total |
|----------|---------|-------------|-------|
| 7 days (1 week) | NO | 55 + 0 + 0 | **$55** |
| 7 days (1 week) | YES | 55 + 0 + 10 | **$65** |
| 14 days (2 weeks) | NO | 55 + 10 + 0 | **$65** |
| 14 days (2 weeks) | YES | 55 + 10 + 10 | **$75** |
| 21 days (3 weeks) | YES | 55 + 20 + 10 | **$85** |
| 10 days (2 weeks) | YES | 55 + 10 + 10 | **$75** |

---

## ❓ Common Questions

### Q: Where do I see the WhatsApp notification?

**A:** Notifications are sent to the WhatsApp contact configured in Settings. If not configured, messages appear in browser console (for testing).

### Q: Can I rent US SIMs to multiple customers?

**A:** Yes! Each active SIM can be synced to inventory. If you have 5 active SIMs, they all appear as rental options.

### Q: What if I want to change the Israeli number after creation?

**A:** The Israeli number choice is locked by the owner at creation. The activator cannot change it (read-only during activation).

### Q: How do I update the WhatsApp contact number?

**A:** In Settings (future enhancement) or in your Supabase dashboard:
- Table: `app_settings` (in sim-manager project)
- Key: `us_activator_whatsapp`
- Update the value

### Q: Can I rent a US SIM that hasn't been activated yet?

**A:** No, the SIM must be in "פעיל" (active) status to rent. It needs both numbers filled by the activator first.

### Q: What happens if the SIM expires during rental?

**A:** The rental continues, but you'll see a warning ⚠️. The SIM will need renewal before the next rental.

---

## 🔧 Setup Checklist

- [ ] Create at least one US SIM at `/sims`
- [ ] Share activation link with US contact
- [ ] Contact activates the SIM (fills numbers)
- [ ] Check that WhatsApp notification arrives (if configured)
- [ ] Go to Rentals and search for the US SIM company
- [ ] Verify SIM appears in ItemSelector
- [ ] Create a test rental to verify pricing
- [ ] Print calling instructions for customer

---

## 📱 What Customer Sees on Rental

When you create a rental with US SIM, the customer gets:

```
Rental Details:
  Customer: John Smith
  Duration: Feb 24 - Mar 6, 2026 (10 days)

  Items:
    🇺🇸 T-Mobile (Unlimited)
    Numbers: 📱 +1-555-123-4567 (US)
             🇮🇱 050-1234567 (Israel)
    Expiry: 12/31/2026

  Price Breakdown:
    סים אמריקאי (2 weeks): $75.00
    סה"כ: $75.00 USD
```

---

## 🆘 Troubleshooting

### Problem: US SIM doesn't appear in rentals

**Solution 1:** Check if SIM is active
- Go to `/sims`
- SIM status should be "פעיל" (active)
- Both numbers should be filled

**Solution 2:** Refresh the page
- Dashboard auto-syncs every 5 minutes
- Refresh to trigger immediate sync

**Solution 3:** Check inventory directly
- Go to Inventory page
- Expand "🇺🇸 סים אמריקאי" category
- Should see the synced SIM

### Problem: Price not calculating correctly

**Solution:**
- Verify dates are set (both start and end)
- Check that US SIM is actually selected (should have ✓ checkmark)
- Ensure Israeli toggle matches what you want

### Problem: WhatsApp notification not sending

**Solution 1:** Check if WhatsApp contact is configured
- Go to `/sims` Settings
- Verify "US Activator WhatsApp" has a phone number

**Solution 2:** For testing without real WhatsApp
- Open browser console (F12)
- You should see logged messages
- This is normal - means system is working

---

## 📚 More Information

For detailed technical information, see:
- `WHATSAPP_NOTIFICATIONS_AND_RENTAL_SYNC.md`
- `US_SIMS_SYSTEM_COMPLETE.md`
- `VERIFICATION_US_SIMS_RENTAL_INTEGRATION.md`

---

**That's it! You're ready to start renting US SIMs. 🎉**

Questions? Check the troubleshooting section or review the detailed docs.
