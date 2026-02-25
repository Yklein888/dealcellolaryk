import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { calculateRentalPrice } from '@/lib/pricing';
import { printCallingInstructions } from '@/lib/callingInstructions';
import { Zap, ArrowRight, Loader2, CheckCircle, AlertTriangle, Search, X, User, Printer, UserPlus } from 'lucide-react';

interface CellStationSim {
  id: string;
  sim_number: string | null;
  uk_number: string | null;
  il_number: string | null;
  iccid: string | null;
  status: string | null;
  status_detail: string | null;
  expiry_date: string | null;
  plan: string | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface ActivateAndSwapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oldSim: CellStationSim;
  availableSims: CellStationSim[];
  onActivateAndSwap: (params: any, onProgress?: (step: string, percent: number) => void) => Promise<any>;
  onSuccess?: () => void;
}

export function ActivateAndSwapDialog({
  open, onOpenChange, oldSim, availableSims, onActivateAndSwap, onSuccess,
}: ActivateAndSwapDialogProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];
  const defaultEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [step, setStep] = useState<'rental' | 'iccid' | 'processing'>('rental');

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

  // New SIM ICCID
  const [newIccid, setNewIccid] = useState('');
  const [iccidError, setIccidError] = useState('');

  // Processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [progressStep, setProgressStep] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [createdRentalId, setCreatedRentalId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const cleanIccid = newIccid.replace(/\D/g, '');
  const isValidIccid = cleanIccid.length >= 19 && cleanIccid.length <= 20;

  const days = Math.max(1, Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  ));

  const priceResult = useMemo(() => {
    if (!startDate || !endDate || startDate >= endDate) return null;
    try {
      return calculateRentalPrice(
        [{ category: 'sim_european' as const }, ...(includeDevice ? [{ category: 'device_simple' as const }] : [])],
        startDate, endDate
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
          .from('customers').select('id, name, phone')
          .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`).limit(8);
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
        .select('id, name, phone').single();
      if (error) throw new Error(error.message);
      const newC = data as unknown as Customer;
      setSelectedCustomer(newC);
      setSearchTerm(newC.name); setManualName(newC.name);
      setShowAddCustomer(false); setNewCustomerPhone(''); setDropdownOpen(false);
      toast({ title: '✅ לקוח נוסף', description: `${newC.name} נוסף בהצלחה` });
    } catch (e: any) {
      toast({ title: '❌ שגיאה', description: e.message, variant: 'destructive' });
    } finally { setIsAddingCustomer(false); }
  };

  const handleNextToIccid = () => {
    const customerName = selectedCustomer?.name || manualName.trim();
    if (!customerName) { setErrorMsg('יש לבחור לקוח או להזין שם'); return; }
    if (!startDate || !endDate) { setErrorMsg('יש לבחור תאריכים'); return; }
    setErrorMsg('');
    setStep('iccid');
  };

  const handleConfirm = async () => {
    if (!isValidIccid) { setIccidError('ICCID חייב להכיל 19-20 ספרות'); return; }
    setIccidError('');
    setIsProcessing(true);
    setStep('processing');
    const customerName = selectedCustomer?.name || manualName.trim();
    try {
      setProgressStep('יוצר רשומת השכרה...');
      setProgressPercent(10);

      const { data: newRental, error: rentalError } = await supabase
        .from('rentals' as any)
        .insert({
          customer_id: selectedCustomer?.id || null, customer_name: customerName,
          start_date: startDate, end_date: endDate, status: 'active',
          total_price: totalPrice, currency: 'ILS',
          notes: includeDevice ? 'כולל מכשיר פשוט' : undefined,
        })
        .select('id').single();
      if (rentalError) throw new Error(rentalError.message);
      const rentalId = (newRental as any).id;
      setProgressPercent(20);

      const { data: invItem } = await supabase
        .from('inventory' as any).select('id').eq('sim_number', oldSim.iccid || '').maybeSingle();

      let simInventoryId: string;
      if (invItem) {
        simInventoryId = (invItem as any).id;
        await supabase.from('inventory' as any).update({ status: 'rented' }).eq('id', simInventoryId);
      } else {
        const { data: newInv, error: invErr } = await supabase
          .from('inventory' as any)
          .insert({ name: 'סים גלישה', category: 'sim_european', sim_number: oldSim.iccid || '',
            local_number: oldSim.uk_number || null, israeli_number: oldSim.il_number || null,
            expiry_date: oldSim.expiry_date || null, status: 'rented' })
          .select('id').single();
        if (invErr) throw new Error(invErr.message);
        simInventoryId = (newInv as any).id;
      }

      await supabase.from('rental_items' as any).insert({
        rental_id: rentalId, inventory_item_id: simInventoryId,
        item_name: oldSim.uk_number || oldSim.il_number || oldSim.iccid || 'SIM',
        item_category: 'sim_european',
      });
      setProgressPercent(30);
      setProgressStep('מפעיל ומחליף סים ב-CellStation...');

      await onActivateAndSwap(
        { product: '', start_rental: startDate, end_rental: endDate,
          price: String(totalPrice), note: customerName,
          current_sim: oldSim.sim_number || '', current_iccid: oldSim.iccid || '', swap_iccid: cleanIccid },
        (stepName, percent) => {
          setProgressStep(stepName);
          setProgressPercent(30 + Math.round(percent * 0.7));
        }
      );

      setProgressPercent(100);
      setProgressStep('הושלם בהצלחה!');
      setCreatedRentalId(rentalId);
      setIsComplete(true);
      onSuccess?.();
    } catch (e: any) {
      toast({ title: '❌ שגיאה', description: e.message || 'שגיאה בתהליך', variant: 'destructive' });
      setIsProcessing(false);
      setStep('iccid');
    }
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printCallingInstructions(
        oldSim.il_number || undefined, oldSim.uk_number || undefined,
        cleanIccid || oldSim.iccid || undefined, false,
        oldSim.plan || undefined, oldSim.expiry_date || undefined, oldSim.sim_number || undefined
      );
    } catch {
      toast({ title: '❌ שגיאת הדפסה', description: 'לא ניתן להדפיס', variant: 'destructive' });
    } finally { setIsPrinting(false); }
  };

  const handleClose = useCallback(() => {
    if (isProcessing && !isComplete) return;
    onOpenChange(false);
    setTimeout(() => {
      setStep('rental');
      setSearchTerm(''); setSearchResults([]); setSelectedCustomer(null); setManualName('');
      setStartDate(today); setEndDate(defaultEnd); setIncludeDevice(false);
      setShowAddCustomer(false); setNewCustomerPhone(''); setIsAddingCustomer(false);
      setNewIccid(''); setIccidError('');
      setIsProcessing(false); setIsPrinting(false);
      setProgressStep(''); setProgressPercent(0); setIsComplete(false);
      setCreatedRentalId(null); setErrorMsg(''); setDropdownOpen(false);
    }, 200);
  }, [isProcessing, isComplete, onOpenChange, today, defaultEnd]);

  const oldSimLabel = oldSim.uk_number || oldSim.il_number || '---';

  // ── Customer section (reused in rental step) ──
  const customerSection = (
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
        <div className="rounded-xl border-2 border-green-300 bg-green-50/80 dark:bg-green-950/20 dark:border-green-700 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-green-700 dark:text-green-300">➕ הוסף לקוח חדש</p>
            <button onClick={() => { setShowAddCustomer(false); setNewCustomerPhone(''); }}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">שם לקוח *</Label>
            <Input value={manualName} onChange={e => setManualName(e.target.value)}
              placeholder="שם מלא..." className="h-12 text-base bg-background" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">טלפון (אופציונלי)</Label>
            <Input value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)}
              placeholder="05X-XXXXXXX" type="tel" inputMode="tel" dir="ltr"
              className="h-12 text-base text-left bg-background" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => { setShowAddCustomer(false); setNewCustomerPhone(''); }} className="h-10">ביטול</Button>
            <Button onClick={handleAddNewCustomer} disabled={isAddingCustomer || !manualName.trim()}
              className="flex-1 h-10 gap-2 bg-green-600 hover:bg-green-700">
              {isAddingCustomer ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              הוסף לקוח
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input className="pr-9 text-base" style={{ height: '52px' }}
            placeholder="חפש לפי שם או טלפון..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setManualName(e.target.value); setShowAddCustomer(false); }}
            autoComplete="off" />
          {isSearching && <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
          {dropdownOpen && (searchResults.length > 0 || searchTerm.trim().length >= 2) && (
            <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-xl shadow-xl max-h-52 overflow-y-auto">
              {searchResults.map(c => (
                <button key={c.id}
                  className="w-full text-right px-4 py-3 hover:bg-muted/60 flex justify-between items-center text-sm border-b border-border/40 last:border-0 active:bg-muted"
                  onClick={() => { setSelectedCustomer(c); setSearchTerm(c.name); setManualName(c.name); setDropdownOpen(false); }}>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground text-xs">{c.phone}</span>
                </button>
              ))}
              {searchTerm.trim().length >= 2 && (
                <button
                  className="w-full text-right px-4 py-3 text-sm text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 flex items-center gap-2 border-t border-border/40 active:bg-green-100 font-medium"
                  onClick={() => { setDropdownOpen(false); setShowAddCustomer(true); setManualName(searchTerm); }}>
                  <UserPlus className="h-4 w-4 shrink-0" />
                  הוסף לקוח חדש: &quot;{searchTerm}&quot;
                </button>
              )}
              {searchResults.length > 0 && (
                <button className="w-full text-right px-4 py-2.5 text-xs text-muted-foreground hover:bg-muted/40 border-t border-border/40"
                  onClick={() => { setSelectedCustomer(null); setManualName(searchTerm); setDropdownOpen(false); }}>
                  המשך עם &quot;{searchTerm}&quot; ללא קישור ללקוח
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        size="full"
        className="p-0 gap-0 sm:max-w-md"
        dir="rtl"
        onInteractOutside={e => { if (isProcessing && !isComplete) e.preventDefault(); }}
        onEscapeKeyDown={e => { if (isProcessing && !isComplete) e.preventDefault(); }}
      >
        {/* ── STICKY HEADER ── */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-5 pt-4 pb-3 border-b">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-right">
              <Zap className="h-5 w-5 text-orange-500" />
              הפעלה + החלפת סים
            </DialogTitle>
            <DialogDescription className="text-right mt-0.5 text-xs">
              {step === 'rental' && 'פרטי השכרה ללקוח'}
              {step === 'iccid' && 'ICCID של הסים החדש'}
              {step === 'processing' && (isComplete ? '✅ הושלם!' : 'מעבד...')}
            </DialogDescription>
          </DialogHeader>
          {/* Old SIM badge */}
          <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 text-xs">
            <span className="text-orange-600 font-semibold">סים ישן:</span>
            <span className="font-mono font-bold">{oldSimLabel}</span>
            {oldSim.iccid && <span className="text-muted-foreground truncate" dir="ltr">{oldSim.iccid}</span>}
          </div>
          {/* Step indicator */}
          {step !== 'processing' && (
            <div className="flex gap-1.5 mt-2">
              {(['rental', 'iccid'] as const).map((s, i) => (
                <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${step === s ? 'bg-orange-500' : i < (['rental', 'iccid'].indexOf(step)) ? 'bg-orange-300' : 'bg-muted'}`} />
              ))}
            </div>
          )}
        </div>

        {/* ── STEP 1: RENTAL FORM ── */}
        {step === 'rental' && (
          <>
            <div className="px-5 py-4 space-y-5 pb-28">
              {customerSection}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">תאריך התחלה</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-base" style={{ height: '52px' }} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">תאריך סיום</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-base" style={{ height: '52px' }} />
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

              {/* Price breakdown */}
              {priceResult && (
                <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200/60 p-4 space-y-2.5">
                  <p className="text-xs font-bold text-orange-700 dark:text-orange-300 uppercase tracking-wider">פירוט מחיר אוטומטי</p>
                  {priceResult.breakdown.map((b, i) => (
                    <div key={i} className="flex justify-between text-sm items-start gap-2">
                      <span className="text-muted-foreground leading-snug">{b.item}{b.details ? <span className="text-xs opacity-60 block">{b.details}</span> : null}</span>
                      <span className="font-semibold shrink-0">{b.currency}{b.price.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-base border-t border-orange-200/60 pt-2.5">
                    <span>סה&quot;כ לתשלום</span>
                    <span className="text-orange-700 dark:text-orange-300 text-lg">₪{totalPrice.toLocaleString()}</span>
                  </div>
                  {priceResult.businessDaysInfo && (
                    <p className="text-[11px] text-muted-foreground">{days} ימים · {priceResult.businessDaysInfo.businessDays} ימי עסקים</p>
                  )}
                </div>
              )}

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />{errorMsg}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-sm border-t px-5 py-3">
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleClose} style={{ height: '52px' }}>ביטול</Button>
                <Button onClick={handleNextToIccid} className="flex-1 gap-2 bg-orange-600 hover:bg-orange-700 text-base font-bold" style={{ height: '52px' }}>
                  המשך <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── STEP 2: ENTER NEW ICCID ── */}
        {step === 'iccid' && (
          <>
            <div className="px-5 py-4 space-y-5 pb-28">
              {/* Rental summary */}
              <div className="p-3 rounded-xl bg-muted/50 border text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">לקוח:</span>
                  <span className="font-semibold">{selectedCustomer?.name || manualName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">תקופה:</span>
                  <span>{startDate} — {endDate}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>סה&quot;כ:</span>
                  <span className="text-orange-700">₪{totalPrice.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold">ICCID של הסים החדש</Label>
                <Input
                  placeholder="הכנס 19-20 ספרות..."
                  value={newIccid}
                  onChange={e => { setNewIccid(e.target.value); setIccidError(''); }}
                  className="font-mono text-left text-lg"
                  style={{ height: '58px' }}
                  dir="ltr"
                  inputMode="numeric"
                  autoFocus
                />
                {iccidError && <p className="text-sm text-destructive font-medium">{iccidError}</p>}
                {cleanIccid.length > 0 && (
                  <p className={`text-sm font-semibold ${isValidIccid ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {cleanIccid.length} ספרות {isValidIccid ? '✅ תקין' : `(צריך 19-20)`}
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 text-sm">
                <p className="font-bold text-amber-800 dark:text-amber-200 mb-1">⚠️ שים לב</p>
                <p className="text-amber-700 dark:text-amber-300 text-xs leading-relaxed">
                  תהליך זה לוקח כ-35 שניות: הפעלת הסים החדש, המתנה של 20 שניות, ולאחר מכן החלפה. אל תסגור את החלון.
                </p>
              </div>
            </div>

            <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-sm border-t px-5 py-3">
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('rental')} style={{ height: '52px' }}>חזור</Button>
                <Button onClick={handleConfirm} disabled={!isValidIccid} className="flex-1 gap-2 bg-orange-600 hover:bg-orange-700 text-base font-bold" style={{ height: '52px' }}>
                  <Zap className="h-4 w-4" /> הפעל + החלף
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── STEP 3: PROCESSING / DONE ── */}
        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center gap-6 px-5 py-10 min-h-[50vh]">
            <div className="text-center">
              {isComplete
                ? <div className="rounded-full bg-green-100 p-5 mx-auto w-fit"><CheckCircle className="h-14 w-14 text-green-500" /></div>
                : <div className="rounded-full bg-orange-100 p-5 mx-auto w-fit"><Loader2 className="h-14 w-14 animate-spin text-orange-500" /></div>
              }
              <p className="mt-4 font-bold text-lg">{progressStep || 'מתחיל...'}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {isComplete ? 'התהליך הושלם בהצלחה!' : 'אנא המתן, אל תסגור את החלון...'}
              </p>
            </div>
            <div className="w-full max-w-xs space-y-1">
              <Progress value={progressPercent} className="h-3" />
              <p className="text-center text-xs text-muted-foreground">{progressPercent}%</p>
            </div>
            {isComplete && (
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <Button onClick={handlePrint} disabled={isPrinting} className="h-14 gap-2 bg-green-600 hover:bg-green-700 text-base font-bold">
                  {isPrinting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
                  הדפס הוראות חיוג
                </Button>
                {createdRentalId && (
                  <Button variant="outline" className="h-12"
                    onClick={() => { navigate(`/rentals?highlight=${createdRentalId}`); handleClose(); }}>
                    עבור להשכרה
                  </Button>
                )}
                <Button onClick={handleClose} variant="ghost" className="h-10 text-muted-foreground">סגור</Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
