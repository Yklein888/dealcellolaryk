# Plan: US SIMs System Redesign - Simplified Packages & Pricing

## Context

The user wants to restructure the US SIMs system with three key changes:

1. **Simplified Package Model**: Instead of free-form text, packages should be standardized:
   - "Calls Only" (שיחות בלבד)
   - "8GB"
   - "Unlimited" (ללא הגבלה)

2. **Remove Price from SIM Setup**: Price is NOT set when adding/activating SIMs. Instead:
   - Price is calculated ONLY during rental/contract creation
   - Fixed pricing: $55/week base + $10/week per additional week + $10 if Israeli number

3. **Single WhatsApp Notification Channel**: All notifications (new SIM + renewal) go to WhatsApp only
   - The US activator has a fixed WhatsApp contact (stored in `app_settings`)
   - Remove the "choose notification method" dialog complexity

4. **Dashboard Integration**: Add two new sections:
   - "הפעלות סימים" (SIM Activations) - summary of pending/activating/active SIMs
   - "הפעלות השכרות" (Rental Activations) - summary of rentals with US SIMs

---

## Current State Issues

**Problems Found in Codebase:**
1. Migration file missing fields: `sim_number`, `price_per_day`
2. `add_sim_by_token` RPC missing parameters
3. Pricing stored per-SIM but should be in Rentals system only
4. Packages are free-form text, not standardized
5. Renewal dialog has complex notification options (needs simplification)

---

## User Decisions (Confirmed) ✅

**1. US Activator WhatsApp**: Store in `app_settings` table (database)
   - Stored as key: `us_activator_whatsapp`
   - Can be changed anytime from settings (flexible)
   - Used for ALL notifications (new SIM + renewal)
   - Simplifies UI - no contact input in dialogs

**2. Notes Field**: KEEP IT
   - Keep notes field when adding SIM
   - Helps with tracking (e.g., "For customer XYZ", "Backup SIM")

**3. Israeli Number Decision**: OWNER DECIDES, READ-ONLY FOR PARTNER
   - Owner selects during SIM creation: "Include Israeli number? Yes/No"
   - Partner sees it during activation as READ-ONLY (cannot override)
   - This choice is binding and affects final pricing ($10 extra)

---

## Implementation Strategy

### Phase 1: Database Migration (NEW)

**File**: `supabase/migrations/20260224000002_refactor_us_sims.sql`

Changes needed:
1. Add `sim_number` field (text, nullable - ICCID)
2. Add `includes_israeli_number` field (boolean, default false)
3. Keep `package` field as text (values: 'calls_only', 'gb_8', 'unlimited')
4. Remove or keep `price_per_day`? (Currently kept for backward compat, but unused)
5. Update RPCs:
   - `add_sim_by_token(p_token, p_company, p_sim_number?, p_package?, p_notes?, p_includes_israeli?)`
   - `update_sim_activation(p_id, p_token, p_local?, p_israeli?, p_expiry?)`
   - `renew_sim_by_token(p_id, p_token, p_months?, p_includes_israeli?)`

### Phase 2: Update Types

**File**: `src/types/rental.ts`

```typescript
type USSimPackage = 'calls_only' | 'gb_8' | 'unlimited';

export const PACKAGE_LABELS: Record<USSimPackage, string> = {
  calls_only: 'שיחות בלבד',
  gb_8: '8GB',
  unlimited: 'ללא הגבלה',
};

export const US_SIM_PRICING = {
  basePerWeek: 55,              // $55/week
  additionalWeekCost: 10,       // +$10 per week after first
  israeliBonusCost: 10,         // +$10 one-time if selected
};

// Update USSim interface:
// - Add: simNumber?: string
// - Change: package to USSimPackage type
// - Add: includesIsraeliNumber?: boolean
// - REMOVE: pricePerDay, renewalContact, renewalMethod
```

### Phase 3: Update US SIMs Management Page

**File**: `src/pages/USSims.tsx`

**"הוסף סים" Dialog** (lines ~244-310):
- REMOVE: `newPrice` state and price input field
- KEEP: `newNotes` state and notes input
- ADD: `newPackage` state (Select dropdown: Calls Only | 8GB | Unlimited)
- ADD: `newIncludesIsraeli` state (Checkbox)
- Call signature: `addSim(company, simNumber, package, notes, includes_israeli)`

**Table Display** (lines ~164-237):
- REMOVE: "מחיר ליום" column completely
- Keep: Company | SIM# | Package | Local# | Israeli# | Expiry | Status | Actions

**Renewal Dialog** (lines ~309-387):
- REMOVE: All radio buttons for WhatsApp/Email/None
- REMOVE: Contact input field
- REMOVE: `renewMethod`, `renewContact` state variables
- KEEP: `renewIncludesIsraeli` checkbox
- Simplify: `renewSim(id, 1, undefined, undefined, includes_israeli)`

### Phase 4: Update SIM Activation Page

**File**: `src/pages/SimActivation.tsx`

1. **Header** (lines ~157-194):
   - Remove price display
   - Keep: Company, ICCID, Package, Notes, Status

2. **Package Field**:
   - If package not yet set, show as dropdown (optional during activation)
   - Otherwise, show as read-only text

3. **Israeli Number**:
   - Show checkbox: "כולל מספר ישראלי"
   - READ-ONLY (cannot be changed - owner decided at creation)
   - Mark visually if it's checked

### Phase 5: Dashboard Enhancement

**File**: `src/pages/Dashboard.tsx`

Add two new sections (after existing stat cards):

1. **"הפעלות סימים" Section**:
   - Use `useUSSims()` hook
   - Show stats: Pending | Activating | Active counts
   - Link to `/sims` page

2. **"הפעלות השכרות" Section**:
   - Use `useRental()` hook
   - Filter rentals with US SIMs
   - Show customer | package | duration | price | status
   - Link to `/rentals` page

### Phase 6: Pricing Utility

**File**: `src/components/USSimRentalCalculator.ts` (NEW)

```typescript
export function calculateUSSimPrice(weeks: number, includesIsraeli: boolean): number {
  const baseCost = 55 * weeks;
  const additionalCost = 10 * (weeks - 1);
  const israeliBonus = includesIsraeli ? 10 : 0;
  return baseCost + additionalCost + israeliBonus;
}
```

Use in:
- Rentals.tsx when adding US SIM rental items
- Invoice calculations
- Price preview during rental creation

---

## Files to Modify (Priority Order)

| # | File | Change | Scope |
|---|------|--------|-------|
| 1 | `supabase/migrations/20260224000002_refactor_us_sims.sql` | NEW - Update schema, fix RPCs | ~80 lines |
| 2 | `src/types/rental.ts` | Add types, remove old fields, add PRICING constants | ~30 lines |
| 3 | `src/hooks/useUSSims.ts` | Update addSim, renewSim signatures to match RPCs | ~50 lines |
| 4 | `src/pages/USSims.tsx` | Remove price, add package/Israeli fields, simplify renewal | ~150 lines |
| 5 | `src/pages/SimActivation.tsx` | Remove price, make Israeli read-only, show package | ~80 lines |
| 6 | `src/components/USSimRentalCalculator.ts` | NEW - Pricing calculation | ~20 lines |
| 7 | `src/pages/Dashboard.tsx` | Add SIM & Rental activation sections | ~150 lines |

---

## Detailed Changes

### USSims.tsx - Add SIM Dialog Modifications

**Current State:**
```typescript
const [newCompany, setNewCompany] = useState('T-Mobile');
const [newSimNumber, setNewSimNumber] = useState('');
const [newPackage, setNewPackage] = useState('');
const [newPrice, setNewPrice] = useState('');  // REMOVE THIS
const [newNotes, setNewNotes] = useState('');
```

**New State:**
```typescript
const [newCompany, setNewCompany] = useState('T-Mobile');
const [newSimNumber, setNewSimNumber] = useState('');
const [newPackage, setNewPackage] = useState<USSimPackage>('calls_only');  // Type-safe
const [newNotes, setNewNotes] = useState('');
const [newIncludesIsraeli, setNewIncludesIsraeli] = useState(false);  // NEW
```

**New Dialog Fields:**
```tsx
<Select value={newPackage} onValueChange={(val) => setNewPackage(val as USSimPackage)}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectItem value="calls_only">שיחות בלבד</SelectItem>
    <SelectItem value="gb_8">8GB</SelectItem>
    <SelectItem value="unlimited">ללא הגבלה</SelectItem>
  </SelectContent>
</Select>

<div className="flex items-center space-x-2 space-x-reverse">
  <Checkbox
    id="includes-israeli"
    checked={newIncludesIsraeli}
    onCheckedChange={(checked) => setNewIncludesIsraeli(checked as boolean)}
  />
  <Label htmlFor="includes-israeli" className="font-normal cursor-pointer">
    כולל מספר ישראלי
  </Label>
</div>
```

### USSims.tsx - Renewal Dialog Simplification

**Remove:**
- All three radio button options
- Contact input field
- renewMethod state
- renewContact state

**Keep:**
- renewIncludesIsraeli checkbox (but make it required to choose)

**New Dialog:**
```tsx
<div className="flex items-center space-x-2 space-x-reverse">
  <Checkbox
    id="renewal-israeli"
    checked={renewIncludesIsraeli}
    onCheckedChange={(checked) => setRenewIncludesIsraeli(checked as boolean)}
  />
  <Label htmlFor="renewal-israeli" className="font-normal cursor-pointer">
    להוסיף מספר ישראלי גם לחידוש?
  </Label>
</div>

<Button variant="glow" onClick={handleRenew}>
  הארך לחודש נוסף
</Button>
```

### SimActivation.tsx - Changes

**Remove:**
- Price display from header

**Add:**
- Package as read-only field
- Israeli number checkbox as READ-ONLY with message "(שנבחר על ידי בעלים)"

**Header Card (simplified):**
```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
  {sim.sim_number && (
    <div>
      <p className="text-muted-foreground">ICCID</p>
      <p className="font-mono font-bold text-foreground">{sim.sim_number.slice(0, 12)}...</p>
    </div>
  )}
  {sim.package && (
    <div>
      <p className="text-muted-foreground">חבילה</p>
      <p className="font-bold text-foreground">{PACKAGE_LABELS[sim.package]}</p>
    </div>
  )}
  {sim.notes && (
    <div>
      <p className="text-muted-foreground">הערות</p>
      <p className="text-foreground text-xs truncate">{sim.notes}</p>
    </div>
  )}
</div>
```

---

## Testing Checklist

- [ ] Apply migration successfully on Supabase
- [ ] Add new SIM without price field works
- [ ] New SIM includes package selection
- [ ] New SIM includes Israeli number checkbox
- [ ] Activation page shows package (read-only)
- [ ] Activation page shows Israeli number (read-only)
- [ ] Renewal dialog simplified (no notification options)
- [ ] Table no longer shows price column
- [ ] Dashboard shows SIM stats section
- [ ] Dashboard shows rental stats section
- [ ] Price calculation formula works: $55/week + $10/(week-1) + $10 if Israeli
- [ ] All Hebrew text displays correctly (RTL)
- [ ] No TypeScript compilation errors
- [ ] No console warnings

---

## Ready for Implementation

This plan is detailed enough to implement in phases. Start with:
1. Migration (may need manual review)
2. Types (quick)
3. Hooks (update signatures)
4. UI pages (bulk of work)
5. Dashboard (enhancements)
