# WhatsApp Notifications & US SIM Rental Sync

## Overview

Two new features have been added to make US SIMs seamlessly integrated with the rental system:

1. **Automatic WhatsApp Notifications** - When US SIM status changes, send WhatsApp notification to the US activator
2. **Automatic Inventory Sync** - Active US SIMs are automatically synced to the rental inventory for customer rentals

---

## Feature 1: WhatsApp Notifications

### What It Does

When a US SIM status changes, the system automatically sends a WhatsApp message to the configured contact:

**Status Changes & Messages:**
- ⏳ **pending → activating**: "סים [company] החל בהפעלה - ממתין למספרים..."
- ✅ **activating → active**: "סים [company] הופעל בהצלחה! 📱 [local] 🇮🇱 [israeli]"
- 🔙 **any → returned**: "סים [company] הוחזר למלאי"

### Configuration

#### Step 1: Set WhatsApp Contact (Required)

Go to **סימים ארה"ב** (`/sims`) page and look for settings to add the WhatsApp contact:

```
US Activator WhatsApp Contact: +972-50-1234567
```

The contact is stored in `app_settings` table with key: `us_activator_whatsapp`

#### Step 2: Configure WhatsApp Business Account (Optional)

To actually send messages, you need Meta Business Account integration:

```bash
# Set environment variables in Supabase
WHATSAPP_ACCOUNT_ID=your_account_id
WHATSAPP_TOKEN=your_meta_api_token
```

**Without these vars:** Messages are logged but not sent (useful for testing)

### How It Works

1. **Realtime Detection** - When SIM status changes in the sim-manager database
2. **Compare Previous State** - `useUSSims` hook tracks previous SIM states
3. **Build Message** - Creates Hebrew message with relevant details
4. **Send via Edge Function** - Calls `send-whatsapp-notification` edge function
5. **Meta WhatsApp API** - Delivers message to configured contact

### Implementation Details

**File:** `src/hooks/useUSSims.ts`

```typescript
// Status change detection happens here
if (oldStatus !== newStatus) {
  const message = buildStatusChangeMessage(sim, oldStatus, newStatus);
  await supabase.functions.invoke('send-whatsapp-notification', {
    body: { phone: whatsappContact, message }
  });
}
```

**Edge Function:** `supabase/functions/send-whatsapp-notification/index.ts`

- Validates phone and message
- Uses Meta WhatsApp Business API to send
- Handles errors gracefully

---

## Feature 2: Automatic Inventory Sync

### What It Does

Active US SIMs are automatically synchronized from the `us_sims` table (sim-manager project) to the main `inventory_items` table, making them available for customer rentals.

### When It Happens

1. **On Dashboard Load** - Sync runs when Dashboard opens
2. **In useUSSims Hook** - Periodic checks for new active SIMs
3. **Manual Trigger** - Button in SIMs management page (planned)

### Sync Criteria

A US SIM is synced to rental inventory when:
- ✅ Status = `active`
- ✅ Has `local_number` filled
- ✅ Has `israeli_number` filled
- ✅ Not already in rental inventory

### What Gets Synced

**US SIM fields → Inventory fields:**
```typescript
{
  category: 'sim_american',
  name: '{company} ({package})',          // e.g., "T-Mobile (unlimited)"
  sim_number: '{sim.sim_number}',          // ICCID
  local_number: '{sim.local_number}',      // US number
  israeli_number: '{sim.israeli_number}',  // IL number
  expiry_date: '{sim.expiry_date}',        // Expiry
  status: 'available',                     // Always available in inventory
  notes: 'סים מ-{company}. כולל מספר ישראלי: {yes/no}'
}
```

### How to Rent Synced US SIMs

Once synced, US SIMs appear automatically in the **Rentals** creation dialog:

1. Go to **Rentals** → **+ Create New Rental**
2. Select customer and dates
3. In **ItemSelector** (right column):
   - Search for the US company name (e.g., "T-Mobile")
   - Or filter by category: **🇺🇸 סים אמריקאי**
4. Click the US SIM item to select
5. Toggle **ישראלי (+$10)** if needed (already set by owner)
6. See price preview: **$55-75 USD**
7. Create rental

---

## Files Added/Modified

### New Files

1. **`src/lib/usSimRentalSync.ts`** - Sync utilities
   - `syncActiveUSSimsToInventory()` - Syncs active SIMs to inventory
   - `sendSimStatusNotification()` - Sends WhatsApp messages
   - `setupUSSimSyncInterval()` - Periodic sync setup

2. **`supabase/functions/send-whatsapp-notification/index.ts`** - Edge function
   - Receives phone and message
   - Calls Meta WhatsApp Business API
   - Returns success/error

3. **`supabase/functions/send-whatsapp-notification/deno.json`** - Function config

### Modified Files

1. **`src/hooks/useUSSims.ts`**
   - Added WhatsApp contact loading
   - Added status change detection
   - Added realtime notification triggering
   - Added `buildStatusChangeMessage()` helper

2. **`src/components/rentals/rental-form/SelectedItemsSummary.tsx`**
   - Enhanced print button for European SIMs (previous commit)

---

## Testing the Features

### Test WhatsApp Notifications

1. **Without WhatsApp Account** (Recommended for testing):
   - Don't set env vars
   - Notifications are logged to console
   - Check browser console → Network tab

2. **With WhatsApp Account**:
   - Set `WHATSAPP_ACCOUNT_ID` and `WHATSAPP_TOKEN` in Supabase
   - Actually sends WhatsApp messages

**Test Steps:**
1. Go to `/sims` page
2. Add a new US SIM (status: pending)
3. Open `/activate/:token` (public page)
4. Fill in local and Israeli numbers
5. Click Save
6. Check console or WhatsApp for notification

### Test Inventory Sync

1. Go to `/sims` → Activate a US SIM
2. Go to **Rentals** → **+ Create New Rental**
3. In ItemSelector, search for the US SIM company name
4. If synced: SIM appears in the grid
5. Click to select
6. See price calculate automatically

**Verify in Inventory:**
1. Go to **Inventory** page
2. Expand **🇺🇸 סים אמריקאי** category
3. Should show synced SIMs

---

## Troubleshooting

### US SIM Not Appearing in Rentals

**Cause 1:** SIM not active yet
- **Fix:** Verify SIM status is "פעיל" (active) in `/sims` page
- **Fix:** Ensure both local and Israeli numbers are filled

**Cause 2:** Sync hasn't run yet
- **Fix:** Refresh Dashboard page
- **Fix:** Wait for periodic sync (currently 5 minutes)

**Cause 3:** Different databases
- **Fix:** Verify you're using the same main Supabase project for rentals
- **Check:** Inventory table should be in `public` schema

### WhatsApp Not Sending

**Without env vars (Testing):**
- ✅ This is normal - messages logged instead
- Check console for "WhatsApp integration not configured"

**With env vars:**
- ❌ Check WhatsApp Business Account credentials
- ❌ Verify phone number format (include country code)
- ❌ Check Supabase Edge Function logs for errors
- ❌ Verify token permissions in Meta Business account

---

## Future Enhancements

1. **Sync Status UI** - Show sync progress in `/sims` page
2. **Manual Sync Button** - Allow owner to trigger sync
3. **Custom Messages** - Configure notification messages per company
4. **SMS Fallback** - Send SMS if WhatsApp fails
5. **Read Receipts** - Track if activator read the message
6. **Bulk Operations** - Sync multiple SIMs at once

---

## Code Examples

### Manual Sync in Component

```typescript
import { syncActiveUSSimsToInventory } from '@/lib/usSimRentalSync';

const result = await syncActiveUSSimsToInventory(activatorToken);
console.log(`Synced ${result.synced} SIMs`);
if (result.error) {
  console.error(result.error);
}
```

### Send Custom Notification

```typescript
import { sendSimStatusNotification } from '@/lib/usSimRentalSync';

const result = await sendSimStatusNotification(
  '+972-50-1234567',
  'T-Mobile',
  'pending',
  'active',
  '+1-555-123-4567',
  '+972-50-9876543'
);
```

### Setup Periodic Sync

```typescript
import { setupUSSimSyncInterval } from '@/lib/usSimRentalSync';

// Start syncing every 5 minutes
const unsubscribe = setupUSSimSyncInterval(activatorToken, 5 * 60 * 1000);

// Stop syncing
unsubscribe();
```

---

## Summary

✅ **WhatsApp Notifications:** Automatic messages when SIM status changes
✅ **Inventory Sync:** Active SIMs automatically appear in rental system
✅ **Seamless Rental:** Customers can rent US SIMs with automatic pricing
✅ **Production Ready:** All error handling and fallbacks in place

The system now provides a complete workflow:
1. Owner adds US SIM at `/sims`
2. Activator fills details at `/activate/:token`
3. WhatsApp notification sent automatically
4. SIM appears in rental inventory
5. Customer can rent it
6. Price calculated automatically ($55+ USD)
