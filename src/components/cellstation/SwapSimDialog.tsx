import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowLeftRight, Loader2, User, Phone, CreditCard, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface CellStationSim {
  id: string;
  sim_number: string | null;
  uk_number: string | null;
  il_number: string | null;
  iccid: string | null;
  status: string | null;
  status_detail: string | null;
  plan: string | null;
  customer_name: string | null;
  expiry_date?: string | null;
}

interface SwapSimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSim: CellStationSim;
  availableSims: CellStationSim[];
  onSwap: (params: {
    rental_id: string;
    current_sim: string;
    current_iccid: string;
    swap_msisdn: string;
    swap_iccid: string;
  }) => Promise<any>;
  isSwapping: boolean;
  rentalId?: string;
}

export function SwapSimDialog({
  open,
  onOpenChange,
  currentSim,
  availableSims,
  onSwap,
  isSwapping,
  rentalId,
}: SwapSimDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedSimId, setSelectedSimId] = useState('');
  const [manualIccid, setManualIccid] = useState('');
  const [useManual, setUseManual] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [swapResult, setSwapResult] = useState<'success' | 'error' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const { toast } = useToast();

  const filtered = useMemo(() => {
    const avail = availableSims.filter(s => s.status === 'available' && s.status_detail === 'valid');
    if (!search.trim()) return avail;
    const q = search.toLowerCase();
    return avail.filter(s =>
      [s.sim_number, s.uk_number, s.il_number, s.iccid].some(v => v?.toLowerCase().includes(q))
    );
  }, [availableSims, search]);

  const selectedSim = availableSims.find(s => s.id === selectedSimId);

  const effectiveIccid = useManual ? manualIccid : (selectedSim?.iccid || '');
  const isIccidValid = effectiveIccid.length >= 19 && effectiveIccid.length <= 20 && /^\d+$/.test(effectiveIccid);

  const newSimLabel = useManual
    ? `ICCID: ...${manualIccid.slice(-6)}`
    : (selectedSim?.uk_number || selectedSim?.il_number || `...${selectedSim?.iccid?.slice(-6) || ''}`);

  const handleConfirmSwap = async () => {
    setShowConfirmation(false);
    setSwapResult(null);
    setErrorMsg('');

    try {
      await onSwap({
        rental_id: rentalId || '',
        current_sim: currentSim.sim_number || '',
        current_iccid: currentSim.iccid || '',
        swap_msisdn: useManual ? '' : (selectedSim?.uk_number || ''),
        swap_iccid: effectiveIccid,
      });
      setSwapResult('success');
      toast({ title: '✅ הסים הוחלף בהצלחה' });
      // Auto-close after success
      setTimeout(() => {
        onOpenChange(false);
        resetState();
      }, 1500);
    } catch (e: any) {
      setSwapResult('error');
      setErrorMsg(e.message || 'שגיאה בהחלפת הסים');
    }
  };

  const resetState = () => {
    setSelectedSimId('');
    setManualIccid('');
    setUseManual(false);
    setSwapResult(null);
    setErrorMsg('');
    setSearch('');
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('he-IL'); } catch { return d; }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) resetState(); onOpenChange(o); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              החלפת סים
            </DialogTitle>
            <DialogDescription>
              החלף את הסים הנוכחי בסים חדש
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current SIM Info - Enhanced */}
            <div className="p-3 rounded-md bg-muted/50 border space-y-2">
              <Label className="text-xs text-muted-foreground font-semibold">סים נוכחי</Label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">SIM:</span>
                  <span className="font-mono font-medium">{currentSim.sim_number || '-'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">UK:</span>
                  <span className="font-mono" dir="ltr">{currentSim.uk_number || '-'}</span>
                </div>
                {currentSim.customer_name && (
                  <div className="flex items-center gap-1.5 col-span-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">לקוח:</span>
                    <span className="font-medium">{currentSim.customer_name}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <Badge variant="outline">{currentSim.plan || 'ללא חבילה'}</Badge>
                <span className="text-xs text-muted-foreground font-mono">
                  ICCID: ...{currentSim.iccid?.slice(-6)}
                </span>
              </div>
            </div>

            {/* Success/Error Result */}
            {swapResult === 'success' && (
              <div className="p-3 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-300 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-green-700 dark:text-green-400 font-medium">הסים הוחלף בהצלחה!</span>
              </div>
            )}
            {swapResult === 'error' && (
              <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-300 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <span className="text-red-700 dark:text-red-400 font-medium">שגיאה בהחלפה</span>
                  {errorMsg && <p className="text-xs text-red-600 mt-1">{errorMsg}</p>}
                </div>
              </div>
            )}

            {/* New SIM Selection */}
            {!swapResult && (
              <>
                <div className="space-y-2">
                  <Label>בחר סים חדש מהרשימה</Label>
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="חיפוש סים..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pr-10"
                      onFocus={() => setUseManual(false)}
                    />
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {filtered.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">אין סימים זמינים</p>
                    )}
                    {filtered.map(sim => (
                      <button
                        key={sim.id}
                        onClick={() => {
                          setSelectedSimId(sim.id);
                          setUseManual(false);
                          setManualIccid('');
                        }}
                        className={cn(
                          'w-full text-right p-2 rounded-md text-sm border transition-colors',
                          selectedSimId === sim.id && !useManual
                            ? 'bg-primary/10 border-primary ring-1 ring-primary'
                            : 'border-border hover:bg-muted'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">
                            תוקף: {formatDate(sim.expiry_date)}
                          </span>
                          <div>
                            <span className="font-mono text-xs">{sim.uk_number || sim.il_number || '---'}</span>
                            <span className="text-[10px] mr-2 text-muted-foreground">...{sim.iccid?.slice(-6)}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t" />
                  <span className="text-xs text-muted-foreground">או</span>
                  <div className="flex-1 border-t" />
                </div>

                {/* Manual ICCID Input */}
                <div className="space-y-2">
                  <Label>הכנס ICCID ידנית (19-20 ספרות)</Label>
                  <Input
                    value={manualIccid}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      setManualIccid(val);
                      if (val) {
                        setUseManual(true);
                        setSelectedSimId('');
                      }
                    }}
                    placeholder="89..."
                    dir="ltr"
                    className={cn(
                      "font-mono",
                      useManual && manualIccid ? 'ring-1 ring-primary border-primary' : ''
                    )}
                    maxLength={20}
                  />
                  {manualIccid && !isIccidValid && useManual && (
                    <p className="text-xs text-destructive">ICCID חייב להיות 19-20 ספרות</p>
                  )}
                  {isIccidValid && useManual && (
                    <p className="text-xs text-green-600">✓ ICCID תקין</p>
                  )}
                </div>

                <Button
                  onClick={() => setShowConfirmation(true)}
                  disabled={isSwapping || !isIccidValid}
                  className="w-full gap-2"
                >
                  {isSwapping ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> מחליף...</>
                  ) : (
                    <><ArrowLeftRight className="h-4 w-4" /> החלף סים</>
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              אישור החלפת סים
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>האם להחליף את הסים?</p>
                <div className="p-3 rounded-md bg-muted/50 border space-y-1.5">
                  <div className="flex justify-between">
                    <span className="font-mono text-xs text-red-600">
                      {currentSim.uk_number || `...${currentSim.iccid?.slice(-6)}`}
                    </span>
                    <span className="text-muted-foreground">סים ישן:</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono text-xs text-green-600">{newSimLabel}</span>
                    <span className="text-muted-foreground">סים חדש:</span>
                  </div>
                  {currentSim.customer_name && (
                    <div className="flex justify-between">
                      <span className="font-medium">{currentSim.customer_name}</span>
                      <span className="text-muted-foreground">לקוח:</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  הפעולה תחליף את הסים בפורטל CellStation ותעדכן את המלאי המקומי.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSwap} disabled={isSwapping}>
              {isSwapping ? 'מחליף...' : 'אישור החלפה'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
