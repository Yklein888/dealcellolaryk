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
import { Zap, ArrowRight, Loader2, CheckCircle, AlertTriangle, Search, X, User, Printer } from 'lucide-react';

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
  open,
  onOpenChange,
  oldSim,
  availableSims,
  onActivateAndSwap,
  onSuccess,
}: ActivateAndSwapDialogProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];
  const defaultEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Step: 'rental' | 'iccid' | 'processing'
  const [step, setStep] = useState<'rental' | 'iccid' | 'processing'>('rental');

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

  // Auto price calculation
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

      // Create rental record in DB
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
      setProgressPercent(20);

      // Create SIM inventory item
      const { data: invItem } = await supabase
        .from('inventory' as any)
        .select('id')
        .eq('sim_number', oldSim.iccid || '')
        .maybeSingle();

      let simInventoryId: string;
      if (invItem) {
        simInventoryId = (invItem as any).id;
        await supabase.from('inventory' as any).update({ status: 'rented' }).eq('id', simInventoryId);
      } else {
        const { data: newInv, error: invErr } = await supabase
          .from('inventory' as any)
          .insert({
            name: 'סים גלישה',
            category: 'sim_european',
            sim_number: oldSim.iccid || '',
            local_number: oldSim.uk_number || null,
            israeli_number: oldSim.il_number || null,
            expiry_date: oldSim.expiry_date || null,
            status: 'rented',
          })
          .select('id')
          .single();
        if (invErr) throw new Error(invErr.message);
        simInventoryId = (newInv as any).id;
      }

      await supabase.from('rental_items' as any).insert({
        rental_id: rentalId,
        inventory_item_id: simInventoryId,
        item_name: oldSim.uk_number || oldSim.il_number || oldSim.iccid || 'SIM',
        item_category: 'sim_european',
      });

      setProgressPercent(30);
      setProgressStep('מפעיל ומחליף סים ב-CellStation...');

      // Now do CellStation activate + swap
      await onActivateAndSwap(
        {
          product: '',
          start_rental: startDate,
          end_rental: endDate,
          price: String(totalPrice),
          note: customerName,
          current_sim: oldSim.sim_number || '',
          current_iccid: oldSim.iccid || '',
          swap_iccid: cleanIccid,
        },
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
      const msg = e.message || 'שגיאה בתהליך';
      toast({ title: '❌ שגיאה', description: msg, variant: 'destructive' });
      setIsProcessing(false);
      setStep('iccid');
    }
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printCallingInstructions(
        oldSim.il_number || undefined,
        oldSim.uk_number || undefined,
        cleanIccid || oldSim.iccid || undefined,
        false,
        oldSim.plan || undefined,
        oldSim.expiry_date || undefined,
        oldSim.sim_number || undefined
      );
    } catch {
      toast({ title: '❌ שגיאת הדפסה', description: 'לא ניתן להדפיס', variant: 'destructive' });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleClose = useCallback(() => {
    if (isProcessing && !isComplete) return;
    onOpenChange(false);
    setTimeout(() => {
      setStep('rental');
      setSearchTerm(''); setSearchResults([]); setSelectedCustomer(null); setManualName('');
      setStartDate(today); setEndDate(defaultEnd); setIncludeDevice(false);
      setNewIccid(''); setIccidError('');
      setIsProcessing(false); setIsPrinting(false);
      setProgressStep(''); setProgressPercent(0); setIsComplete(false);
      setCreatedRentalId(null); setErrorMsg(''); setDropdownOpen(false);
    }, 200);
  }, [isProcessing, isComplete, onOpenChange, today, defaultEnd]);

  const oldSimLabel = oldSim.uk_number || oldSim.il_number || '---';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="flex flex-col max-w-md p-0 gap-0 h-[100dvh] sm:h-auto sm:max-h-[92vh] rounded-none sm:rounded-2xl overflow-hidden"
        dir="rtl"
        onInteractOutside={e => { if (isProcessing && !isComplete) e.preventDefault(); }}
        onEscapeKeyDown={e => { if (isProcessing && !isComplete) e.preventDefault(); }}
      >
        {/* Fixed Header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b bg-background">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Zap className="h-5 w-5 text-orange-500" />
              הפעלה + החלפת סים
            </DialogTitle>
            <DialogDescription className="mt-1">
              {step === 'rental' && 'פרטי השכרה ללקוח'}
              {step === 'iccid' && 'הכנס את ה-ICCID של הסים החדש'}
              {step === 'processing' && (isComplete ? '✅ הושלם בהצלחה!' : 'מעבד...')}
            </DialogDescription>
          </DialogHeader>
          {/* Old SIM badge */}
          <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 text-sm">
            <span className="text-orange-600 font-medium text-xs">סים ישן:</span>
            <span className="font-mono font-semibold">{oldSimLabel}</span>
            {oldSim.iccid && <span className="text-muted-foreground text-xs" dir="ltr">{oldSim.iccid}</span>}
          </div>
        </div>

        {/* STEP 1: Rental form */}
        {step === 'rental' && (
          <>
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
                      <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-44 overflow-y-auto">
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
                />
                <div>
                  <p className="font-medium text-sm">תוספת מכשיר פשוט</p>
                  <p className="text-xs text-muted-foreground">מחושב לפי ימי עסקים (ללא שבת וחגים)</p>
                </div>
              </label>

              {/* Price breakdown */}
              {priceResult && (
                <div className="rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200/60 p-4 space-y-2">
                  <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide mb-2">פירוט מחיר</p>
                  {priceResult.breakdown.map((b, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{b.item}{b.details ? <span className="text-xs opacity-70"> ({b.details})</span> : null}</span>
                      <span className="font-medium">{b.currency}{b.price.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-foreground text-base border-t border-orange-200/60 pt-2 mt-1">
                    <span>סה&quot;כ לתשלום</span>
                    <span className="text-orange-700 dark:text-orange-300">₪{totalPrice.toLocaleString()}</span>
                  </div>
                  {priceResult.businessDaysInfo && (
                    <p className="text-[11px] text-muted-foreground">{days} ימים · {priceResult.businessDaysInfo.businessDays} ימי עסקים</p>
                  )}
                </div>
              )}

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />{errorMsg}
                </div>
              )}
            </div>
            <div className="flex-shrink-0 flex gap-3 px-5 py-4 border-t bg-background">
              <Button variant="outline" onClick={handleClose} className="h-12">ביטול</Button>
              <Button onClick={handleNextToIccid} className="flex-1 h-12 gap-2 bg-orange-600 hover:bg-orange-700 text-base font-semibold">
                המשך לבחירת סים חדש <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {/* STEP 2: Enter new ICCID */}
        {step === 'iccid' && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 border text-sm">
                <p className="text-xs text-muted-foreground mb-1">לקוח</p>
                <p className="font-semibold">{selectedCustomer?.name || manualName}</p>
                <p className="text-xs text-muted-foreground mt-1">{startDate} — {endDate} · ₪{totalPrice.toLocaleString()}</p>
              </div>

              <div className="space-y-2">
                <Label>ICCID של הסים החדש</Label>
                <Input
                  placeholder="הכנס 19-20 ספרות..."
                  value={newIccid}
                  onChange={e => { setNewIccid(e.target.value); setIccidError(''); }}
                  className="font-mono text-left h-14 text-lg"
                  dir="ltr"
                  autoFocus
                />
                {iccidError && <p className="text-xs text-destructive">{iccidError}</p>}
                {cleanIccid.length > 0 && (
                  <p className={`text-sm font-medium ${isValidIccid ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {cleanIccid.length} ספרות {isValidIccid ? '✅ תקין' : '(צריך 19-20)'}
                  </p>
                )}
              </div>

              <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 text-sm">
                <p className="font-medium text-yellow-800 dark:text-yellow-200">⚠️ שים לב</p>
                <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-1">
                  תהליך זה לוקח כ-70 שניות: הפעלת הסים החדש, המתנה של 30 שניות, ולאחר מכן החלפה. אל תסגור את החלון.
                </p>
              </div>
            </div>
            <div className="flex-shrink-0 flex gap-3 px-5 py-4 border-t bg-background">
              <Button variant="outline" onClick={() => setStep('rental')} className="h-12">חזור</Button>
              <Button
                onClick={handleConfirm}
                disabled={!isValidIccid}
                className="flex-1 h-12 gap-2 bg-orange-600 hover:bg-orange-700 text-base font-semibold"
              >
                <Zap className="h-4 w-4" /> הפעל + החלף
              </Button>
            </div>
          </>
        )}

        {/* STEP 3: Processing / Done */}
        {step === 'processing' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
            <div className="text-center">
              {isComplete ? (
                <div className="rounded-full bg-green-100 p-4 mx-auto w-fit">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
              ) : (
                <div className="rounded-full bg-orange-100 p-4 mx-auto w-fit">
                  <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
                </div>
              )}
              <p className="mt-4 font-semibold text-lg">{progressStep || 'מתחיל...'}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {isComplete ? 'התהליך הושלם בהצלחה!' : 'אנא המתן, אל תסגור את החלון...'}
              </p>
            </div>

            <div className="w-full max-w-xs">
              <Progress value={progressPercent} className="h-3" />
              <p className="text-center text-xs text-muted-foreground mt-1">{progressPercent}%</p>
            </div>

            {isComplete && (
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <Button
                  onClick={handlePrint}
                  disabled={isPrinting}
                  className="gap-2 bg-green-600 hover:bg-green-700 h-12"
                >
                  {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
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
                <Button onClick={handleClose} variant="ghost" className="h-12">סגור</Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
