import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { calculateRentalPrice } from '@/lib/pricing';
import { printCallingInstructions } from '@/lib/callingInstructions';
import { Loader2, CheckCircle, AlertTriangle, Search, X, User, Printer } from 'lucide-react';

interface SimRow {
  id: string;
  sim_number: string | null;
  uk_number: string | null;
  il_number: string | null;
  iccid: string | null;
  status: string | null;
  status_detail: string | null;
  expiry_date: string | null;
  plan: string | null;
  start_date: string | null;
  end_date: string | null;
  customer_name: string | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface QuickRentalDialogProps {
  sim: SimRow | null;
  isOpen: boolean;
  onClose: () => void;
  onActivate: (sim: SimRow, params: {
    start_rental: string;
    end_rental: string;
    price: string;
    days: string;
    note: string;
  }) => Promise<any>;
  onSuccess?: () => void;
}

export function QuickRentalDialog({ sim, isOpen, onClose, onActivate, onSuccess }: QuickRentalDialogProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];
  const defaultEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Customer search
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [manualName, setManualName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Rental details
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [includeDevice, setIncludeDevice] = useState(false);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [createdRentalId, setCreatedRentalId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Auto price calculation using main system pricing library
  const priceResult = useMemo(() => {
    if (!startDate || !endDate || startDate >= endDate) return null;
    try {
      return calculateRentalPrice(
        [
          { category: 'sim_european' as const },
          ...(includeDevice ? [{ category: 'device_simple' as const }] : []),
        ],
        startDate,
        endDate
      );
    } catch {
      return null;
    }
  }, [startDate, endDate, includeDevice]);

  const totalPrice = priceResult?.total || 0;

  const days = Math.max(1, Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  ));

  // Debounced customer search
  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      setDropdownOpen(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('customers')
          .select('id, name, phone')
          .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
          .limit(8);
        setSearchResults((data as Customer[]) || []);
        setDropdownOpen(true);
      } catch (e) {
        console.error('Customer search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Real PDF print calling instructions
  const handlePrint = async () => {
    if (!sim) return;
    setIsPrinting(true);
    try {
      await printCallingInstructions(
        sim.il_number || undefined,
        sim.uk_number || undefined,
        sim.iccid || undefined,
        false,
        sim.plan || undefined,
        sim.expiry_date || undefined,
        sim.sim_number || undefined
      );
    } catch {
      toast({ title: '❌ שגיאת הדפסה', description: 'לא ניתן להדפיס כעת', variant: 'destructive' });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSubmit = async () => {
    if (!sim) return;
    const customerName = selectedCustomer?.name || manualName.trim();
    if (!customerName) { setErrorMsg('יש לבחור לקוח או להזין שם'); return; }
    if (!startDate || !endDate) { setErrorMsg('יש לבחור תאריכים'); return; }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      // Step 1: Activate on CellStation
      const activateResult = await onActivate(sim, {
        start_rental: startDate,
        end_rental: endDate,
        price: String(totalPrice),
        days: String(days),
        note: customerName,
      });
      if (activateResult?.success === false) throw new Error(activateResult.error || 'שגיאה בהפעלת הסים');

      // Step 2: Create rental record
      const { data: newRental, error: rentalError } = await supabase
        .from('rentals' as any)
        .insert({
          customer_id: selectedCustomer?.id || null,
          customer_name: customerName,
          start_date: startDate,
          end_date: endDate,
          status: 'active',
          total_price: totalPrice,
          currency: 'ILS',
          notes: includeDevice ? 'כולל מכשיר פשוט' : undefined,
        })
        .select('id')
        .single();
      if (rentalError) throw new Error(rentalError.message);

      const rentalId = (newRental as any).id;

      // Step 3: Get or create SIM inventory item
      const { data: invItem } = await supabase
        .from('inventory' as any)
        .select('id')
        .eq('sim_number', sim.iccid || '')
        .maybeSingle();

      let simInventoryId: string;
      if (invItem) {
        simInventoryId = (invItem as any).id;
      } else {
        const { data: newInv, error: invErr } = await supabase
          .from('inventory' as any)
          .insert({
            name: 'סים גלישה',
            category: 'sim_european',
            sim_number: sim.iccid || '',
            local_number: sim.uk_number || null,
            israeli_number: sim.il_number || null,
            expiry_date: sim.expiry_date || null,
            status: 'rented',
          })
          .select('id')
          .single();
        if (invErr) throw new Error(invErr.message);
        simInventoryId = (newInv as any).id;
      }

      // Step 4: Create rental_item for SIM
      await supabase.from('rental_items' as any).insert({
        rental_id: rentalId,
        inventory_item_id: simInventoryId,
        item_name: sim.uk_number || sim.il_number || sim.iccid || 'SIM',
        item_category: 'sim_european',
      });

      if (invItem) {
        await supabase.from('inventory' as any).update({ status: 'rented' }).eq('id', simInventoryId);
      }

      setCreatedRentalId(rentalId);
      setStep('success');
      onSuccess?.();
    } catch (e: any) {
      const msg = e.message || 'שגיאה ביצירת ההשכרה';
      setErrorMsg(msg);
      toast({ title: '❌ שגיאה', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = useCallback(() => {
    setSearchTerm(''); setSearchResults([]); setSelectedCustomer(null); setManualName('');
    setStartDate(today); setEndDate(defaultEnd); setIncludeDevice(false);
    setIsSubmitting(false); setIsPrinting(false);
    setStep('form'); setCreatedRentalId(null); setErrorMsg(''); setDropdownOpen(false);
    onClose();
  }, [onClose, today, defaultEnd]);

  if (!sim) return null;

  const simLabel =
    sim.uk_number || sim.il_number || sim.sim_number ||
    (sim.iccid ? '...' + sim.iccid.slice(-6) : '—');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="flex flex-col max-w-md p-0 gap-0 h-[100dvh] sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-2xl overflow-hidden"
        dir="rtl"
      >
        {/* Fixed Header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b bg-background">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">📋 השכרה מהירה</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg bg-muted/60 border border-border/50 px-3 py-2 text-sm mt-3">
            <span className="font-mono font-semibold">{simLabel}</span>
            {sim.plan && <span className="text-muted-foreground mr-2">· {sim.plan}</span>}
          </div>
        </div>

        {/* Success Screen */}
        {step === 'success' ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <p className="font-bold text-lg text-green-700">ההשכרה נוצרה בהצלחה!</p>
              <p className="text-sm text-muted-foreground mt-1">הסים הופעל ונרשם בסיסטם</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs mt-2">
              <Button
                onClick={handlePrint}
                disabled={isPrinting}
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
              >
                {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                הדפס הוראות חיוג
              </Button>
              {createdRentalId && (
                <Button
                  variant="outline"
                  onClick={() => { navigate(`/rentals?highlight=${createdRentalId}`); handleClose(); }}
                  className="flex-1"
                >
                  עבור להשכרה
                </Button>
              )}
              <Button variant="ghost" onClick={handleClose} className="flex-1">סגור</Button>
            </div>
          </div>
        ) : (
          <>
            {/* Scrollable Form */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Customer search */}
              <div className="space-y-2">
                <Label>לקוח</Label>
                {selectedCustomer ? (
                  <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                    <User className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="font-medium flex-1">{selectedCustomer.name}</span>
                    {selectedCustomer.phone && <span className="text-muted-foreground text-xs">{selectedCustomer.phone}</span>}
                    <button onClick={() => { setSelectedCustomer(null); setSearchTerm(''); setManualName(''); }}>
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      className="pr-9 h-12 text-base"
                      placeholder="חפש לפי שם או טלפון..."
                      value={searchTerm}
                      onChange={e => { setSearchTerm(e.target.value); setManualName(e.target.value); }}
                      autoComplete="off"
                    />
                    {isSearching && <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                    {dropdownOpen && searchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {searchResults.map(c => (
                          <button
                            key={c.id}
                            className="w-full text-right px-3 py-2.5 hover:bg-muted/60 flex justify-between items-center text-sm border-b border-border/40 last:border-0"
                            onClick={() => { setSelectedCustomer(c); setSearchTerm(c.name); setManualName(c.name); setDropdownOpen(false); }}
                          >
                            <span className="font-medium">{c.name}</span>
                            <span className="text-muted-foreground text-xs">{c.phone}</span>
                          </button>
                        ))}
                        <button
                          className="w-full text-right px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40 border-t border-border/40"
                          onClick={() => { setSelectedCustomer(null); setManualName(searchTerm); setDropdownOpen(false); }}
                        >
                          המשך עם &quot;{searchTerm}&quot; ללא קישור ללקוח
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>תאריך התחלה</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-12 text-base" />
                </div>
                <div className="space-y-1.5">
                  <Label>תאריך סיום</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-12 text-base" />
                </div>
              </div>

              {/* Device toggle */}
              <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary/40 hover:bg-muted/30 cursor-pointer transition-colors">
                <Checkbox
                  checked={includeDevice}
                  onCheckedChange={v => setIncludeDevice(!!v)}
                  id="include-device"
                />
                <div>
                  <p className="font-medium text-sm">תוספת מכשיר פשוט</p>
                  <p className="text-xs text-muted-foreground">מחושב לפי ימי עסקים (ללא שבת וחגים)</p>
                </div>
              </label>

              {/* Auto-calculated price breakdown */}
              {priceResult && (
                <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/60 p-4 space-y-2">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-2">פירוט מחיר</p>
                  {priceResult.breakdown.map((b, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{b.item}{b.details ? <span className="text-xs opacity-70"> ({b.details})</span> : null}</span>
                      <span className="font-medium">{b.currency}{b.price.toLocaleString()}</span>
                    </div>
                  ))}
                  {priceResult.breakdown.length > 0 && (
                    <div className="flex justify-between font-bold text-foreground text-base border-t border-blue-200/60 pt-2 mt-1">
                      <span>סה&quot;כ לתשלום</span>
                      <span className="text-blue-700 dark:text-blue-300">₪{totalPrice.toLocaleString()}</span>
                    </div>
                  )}
                  {priceResult.businessDaysInfo && (
                    <p className="text-[11px] text-muted-foreground">{days} ימים סה&quot;כ · {priceResult.businessDaysInfo.businessDays} ימי עסקים</p>
                  )}
                </div>
              )}

              {/* Error message */}
              {errorMsg && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {errorMsg}
                </div>
              )}
            </div>

            {/* Sticky Action Footer */}
            <div className="flex-shrink-0 flex gap-3 px-5 py-4 border-t bg-background">
              <Button variant="outline" onClick={handleClose} disabled={isSubmitting} className="h-12">
                ביטול
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !startDate || !endDate}
                className="flex-1 h-12 gap-2 bg-blue-600 hover:bg-blue-700 text-base font-semibold"
              >
                {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> יוצר...</> : '✅ צור השכרה'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
