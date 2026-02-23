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
import { Loader2, CheckCircle, AlertTriangle, Search, X, User, Printer, UserPlus } from 'lucide-react';

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
  // Quick-add customer
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);

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

  const days = Math.max(1, Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  ));

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
    } catch { return null; }
  }, [startDate, endDate, includeDevice]);

  const totalPrice = priceResult?.total || 0;

  // Debounced customer search
  useEffect(() => {
    if (searchTerm.trim().length < 2) { setSearchResults([]); setDropdownOpen(false); return; }
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
      } catch { } finally { setIsSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Quick-add new customer
  const handleAddNewCustomer = async () => {
    const name = manualName.trim() || searchTerm.trim();
    if (!name) return;
    setIsAddingCustomer(true);
    try {
      const { data, error } = await supabase
        .from('customers' as any)
        .insert({ name, phone: newCustomerPhone.trim() || null })
        .select('id, name, phone')
        .single();
      if (error) throw new Error(error.message);
      const newC = data as Customer;
      setSelectedCustomer(newC);
      setSearchTerm(newC.name);
      setManualName(newC.name);
      setShowAddCustomer(false);
      setNewCustomerPhone('');
      setDropdownOpen(false);
      toast({ title: '✅ לקוח נוסף', description: `${newC.name} נוסף בהצלחה` });
    } catch (e: any) {
      toast({ title: '❌ שגיאה', description: e.message, variant: 'destructive' });
    } finally { setIsAddingCustomer(false); }
  };

  // Real PDF print
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
      toast({ title: '❌ שגיאת הדפסה', description: 'לא ניתן להדפיס', variant: 'destructive' });
    } finally { setIsPrinting(false); }
  };

  const handleSubmit = async () => {
    if (!sim) return;
    const customerName = selectedCustomer?.name || manualName.trim();
    if (!customerName) { setErrorMsg('יש לבחור לקוח או להזין שם'); return; }
    if (!startDate || !endDate) { setErrorMsg('יש לבחור תאריכים'); return; }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const activateResult = await onActivate(sim, {
        start_rental: startDate, end_rental: endDate,
        price: String(totalPrice), days: String(days), note: customerName,
      });
      if (activateResult?.success === false) throw new Error(activateResult.error || 'שגיאה בהפעלת הסים');

      const { data: newRental, error: rentalError } = await supabase
        .from('rentals' as any)
        .insert({
          customer_id: selectedCustomer?.id || null,
          customer_name: customerName,
          start_date: startDate, end_date: endDate,
          status: 'active', total_price: totalPrice, currency: 'ILS',
          notes: includeDevice ? 'כולל מכשיר פשוט' : undefined,
        })
        .select('id').single();
      if (rentalError) throw new Error(rentalError.message);

      const rentalId = (newRental as any).id;
      const { data: invItem } = await supabase
        .from('inventory' as any).select('id').eq('sim_number', sim.iccid || '').maybeSingle();

      let simInventoryId: string;
      if (invItem) {
        simInventoryId = (invItem as any).id;
        await supabase.from('inventory' as any).update({ status: 'rented' }).eq('id', simInventoryId);
      } else {
        const { data: newInv, error: invErr } = await supabase
          .from('inventory' as any)
          .insert({ name: 'סים גלישה', category: 'sim_european', sim_number: sim.iccid || '',
            local_number: sim.uk_number || null, israeli_number: sim.il_number || null,
            expiry_date: sim.expiry_date || null, status: 'rented' })
          .select('id').single();
        if (invErr) throw new Error(invErr.message);
        simInventoryId = (newInv as any).id;
      }
      await supabase.from('rental_items' as any).insert({
        rental_id: rentalId, inventory_item_id: simInventoryId,
        item_name: sim.uk_number || sim.il_number || sim.iccid || 'SIM',
        item_category: 'sim_european',
      });

      setCreatedRentalId(rentalId);
      setStep('success');
      onSuccess?.();
    } catch (e: any) {
      const msg = e.message || 'שגיאה ביצירת ההשכרה';
      setErrorMsg(msg);
      toast({ title: '❌ שגיאה', description: msg, variant: 'destructive' });
    } finally { setIsSubmitting(false); }
  };

  const handleClose = useCallback(() => {
    setSearchTerm(''); setSearchResults([]); setSelectedCustomer(null); setManualName('');
    setStartDate(today); setEndDate(defaultEnd); setIncludeDevice(false);
    setShowAddCustomer(false); setNewCustomerPhone(''); setIsAddingCustomer(false);
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
      {/* size="full" hides drag handle; p-0 gap-0 removes default padding; sm:max-w-md limits desktop width */}
      <DialogContent size="full" className="p-0 gap-0 sm:max-w-md" dir="rtl">

        {/* ── STICKY HEADER ── */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-5 pt-4 pb-3 border-b">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-right">📋 השכרה מהירה</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg bg-muted/60 border border-border/50 px-3 py-2 text-sm mt-3 flex items-center gap-2">
            <span className="font-mono font-semibold flex-1">{simLabel}</span>
            {sim.plan && <span className="text-muted-foreground text-xs">· {sim.plan}</span>}
          </div>
        </div>

        {/* ── SUCCESS SCREEN ── */}
        {step === 'success' ? (
          <div className="flex flex-col items-center justify-center gap-5 px-5 py-10 text-center min-h-[50vh]">
            <div className="rounded-full bg-green-100 p-5">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <div>
              <p className="font-bold text-xl text-green-700">ההשכרה נוצרה בהצלחה!</p>
              <p className="text-sm text-muted-foreground mt-1">הסים הופעל ונרשם בסיסטם</p>
            </div>
            <div className="flex flex-col gap-3 w-full max-w-xs mt-2">
              <Button
                onClick={handlePrint}
                disabled={isPrinting}
                className="h-14 gap-2 bg-green-600 hover:bg-green-700 text-base font-semibold"
              >
                {isPrinting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
                הדפס הוראות חיוג
              </Button>
              {createdRentalId && (
                <Button
                  variant="outline"
                  className="h-12"
                  onClick={() => { navigate(`/rentals?highlight=${createdRentalId}`); handleClose(); }}
                >
                  עבור להשכרה
                </Button>
              )}
              <Button variant="ghost" onClick={handleClose} className="h-10 text-muted-foreground">
                סגור
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* ── SCROLLABLE FORM CONTENT ── */}
            <div className="px-5 py-4 space-y-5 pb-28">

              {/* Customer search */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">לקוח</Label>
                {selectedCustomer ? (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
                    <User className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="font-medium flex-1">{selectedCustomer.name}</span>
                    {selectedCustomer.phone && <span className="text-muted-foreground text-xs">{selectedCustomer.phone}</span>}
                    <button onClick={() => { setSelectedCustomer(null); setSearchTerm(''); setManualName(''); }}>
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                ) : showAddCustomer ? (
                  // ── QUICK ADD CUSTOMER INLINE FORM ──
                  <div className="rounded-xl border-2 border-green-300 bg-green-50/80 dark:bg-green-950/20 dark:border-green-700 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-green-700 dark:text-green-300">➕ הוסף לקוח חדש</p>
                      <button onClick={() => { setShowAddCustomer(false); setNewCustomerPhone(''); }}>
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">שם לקוח *</Label>
                      <Input
                        value={manualName}
                        onChange={e => setManualName(e.target.value)}
                        placeholder="שם מלא..."
                        className="h-12 text-base bg-background"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">טלפון (אופציונלי)</Label>
                      <Input
                        value={newCustomerPhone}
                        onChange={e => setNewCustomerPhone(e.target.value)}
                        placeholder="05X-XXXXXXX"
                        type="tel"
                        inputMode="tel"
                        dir="ltr"
                        className="h-12 text-base text-left bg-background"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setShowAddCustomer(false); setNewCustomerPhone(''); }}
                        className="flex-none h-10"
                      >
                        ביטול
                      </Button>
                      <Button
                        onClick={handleAddNewCustomer}
                        disabled={isAddingCustomer || !manualName.trim()}
                        className="flex-1 h-10 gap-2 bg-green-600 hover:bg-green-700"
                      >
                        {isAddingCustomer
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <UserPlus className="h-4 w-4" />}
                        הוסף לקוח
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      className="pr-9 h-13 text-base"
                      style={{ height: '52px' }}
                      placeholder="חפש לפי שם או טלפון..."
                      value={searchTerm}
                      onChange={e => { setSearchTerm(e.target.value); setManualName(e.target.value); setShowAddCustomer(false); }}
                      autoComplete="off"
                    />
                    {isSearching && <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                    {dropdownOpen && (searchResults.length > 0 || searchTerm.trim().length >= 2) && (
                      <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-xl shadow-xl max-h-52 overflow-y-auto">
                        {searchResults.map(c => (
                          <button
                            key={c.id}
                            className="w-full text-right px-4 py-3 hover:bg-muted/60 flex justify-between items-center text-sm border-b border-border/40 last:border-0 active:bg-muted"
                            onClick={() => { setSelectedCustomer(c); setSearchTerm(c.name); setManualName(c.name); setDropdownOpen(false); }}
                          >
                            <span className="font-medium">{c.name}</span>
                            <span className="text-muted-foreground text-xs">{c.phone}</span>
                          </button>
                        ))}
                        {/* Quick-add option */}
                        {searchTerm.trim().length >= 2 && (
                          <button
                            className="w-full text-right px-4 py-3 text-sm text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 flex items-center gap-2 border-t border-border/40 active:bg-green-100 font-medium"
                            onClick={() => { setDropdownOpen(false); setShowAddCustomer(true); setManualName(searchTerm); }}
                          >
                            <UserPlus className="h-4 w-4 shrink-0" />
                            הוסף לקוח חדש: &quot;{searchTerm}&quot;
                          </button>
                        )}
                        {searchResults.length > 0 && (
                          <button
                            className="w-full text-right px-4 py-2.5 text-xs text-muted-foreground hover:bg-muted/40 border-t border-border/40"
                            onClick={() => { setSelectedCustomer(null); setManualName(searchTerm); setDropdownOpen(false); }}
                          >
                            המשך עם &quot;{searchTerm}&quot; ללא קישור ללקוח
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">תאריך התחלה</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-13 text-base" style={{ height: '52px' }} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">תאריך סיום</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-13 text-base" style={{ height: '52px' }} />
                </div>
              </div>

              {/* Device toggle */}
              <label className="flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/40 hover:bg-muted/20 cursor-pointer transition-colors active:bg-muted/40">
                <Checkbox checked={includeDevice} onCheckedChange={v => setIncludeDevice(!!v)} className="shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">תוספת מכשיר פשוט</p>
                  <p className="text-xs text-muted-foreground mt-0.5">מחושב לפי ימי עסקים (ללא שבת וחגים)</p>
                </div>
              </label>

              {/* Auto-calculated price breakdown */}
              {priceResult && (
                <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/60 p-4 space-y-2.5">
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">פירוט מחיר אוטומטי</p>
                  {priceResult.breakdown.map((b, i) => (
                    <div key={i} className="flex justify-between text-sm items-start gap-2">
                      <span className="text-muted-foreground leading-snug">{b.item}{b.details ? <span className="text-xs opacity-60 block">{b.details}</span> : null}</span>
                      <span className="font-semibold shrink-0">{b.currency}{b.price.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-base border-t border-blue-200/60 pt-2.5 mt-1">
                    <span>סה&quot;כ לתשלום</span>
                    <span className="text-blue-700 dark:text-blue-300 text-lg">₪{totalPrice.toLocaleString()}</span>
                  </div>
                  {priceResult.businessDaysInfo && (
                    <p className="text-[11px] text-muted-foreground">{days} ימים · {priceResult.businessDaysInfo.businessDays} ימי עסקים</p>
                  )}
                </div>
              )}

              {/* Error */}
              {errorMsg && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />{errorMsg}
                </div>
              )}
            </div>

            {/* ── STICKY FOOTER ── */}
            <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-sm border-t px-5 py-3">
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleClose} disabled={isSubmitting} className="h-13" style={{ height: '52px' }}>
                  ביטול
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !startDate || !endDate}
                  className="flex-1 h-13 gap-2 bg-blue-600 hover:bg-blue-700 text-base font-bold"
                  style={{ height: '52px' }}
                >
                  {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> יוצר...</> : '✅ צור השכרה'}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
