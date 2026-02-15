import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Search, Zap, ArrowRight, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CellStationSim {
  id: string;
  sim_number: string | null;
  uk_number: string | null;
  il_number: string | null;
  iccid: string | null;
  status: string | null;
  status_detail: string | null;
  plan: string | null;
}

interface ActivateAndSwapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oldSim: CellStationSim;
  availableSims: CellStationSim[];
  onActivateAndSwap: (params: any, onProgress?: (step: string, percent: number) => void) => Promise<any>;
  rentalId: string;
  inventoryItemId?: string;
}

export function ActivateAndSwapDialog({
  open,
  onOpenChange,
  oldSim,
  availableSims,
  onActivateAndSwap,
  rentalId,
  inventoryItemId,
}: ActivateAndSwapDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [search, setSearch] = useState('');
  const [selectedSimId, setSelectedSimId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStep, setProgressStep] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const filtered = useMemo(() => {
    const avail = availableSims.filter(s => s.status === 'available' && s.status_detail === 'valid');
    if (!search.trim()) return avail;
    const q = search.toLowerCase();
    return avail.filter(s =>
      [s.sim_number, s.uk_number, s.il_number, s.iccid].some(v => v?.toLowerCase().includes(q))
    );
  }, [availableSims, search]);

  const selectedSim = availableSims.find(s => s.id === selectedSimId);

  const handleConfirm = async () => {
    if (!selectedSim?.iccid) return;

    setIsProcessing(true);
    setStep(3);

    try {
      await onActivateAndSwap(
        {
          product: selectedSim.plan || '',
          start_rental: new Date().toLocaleDateString('en-GB'),
          end_rental: new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-GB'),
          price: '',
          note: '',
          rental_id: rentalId,
          current_sim: oldSim.sim_number || '',
          swap_msisdn: selectedSim.uk_number || '',
          swap_iccid: selectedSim.iccid?.replace(/\D/g, '') || '',
        },
        (stepName, percent) => {
          setProgressStep(stepName);
          setProgressPercent(percent);
        }
      );
      setIsComplete(true);
    } catch {
      setIsProcessing(false);
      setStep(2);
    }
  };

  const handleClose = () => {
    if (isProcessing && !isComplete) return; // Prevent closing during processing
    onOpenChange(false);
    // Reset state
    setTimeout(() => {
      setStep(1);
      setSelectedSimId('');
      setSearch('');
      setIsProcessing(false);
      setProgressStep('');
      setProgressPercent(0);
      setIsComplete(false);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-md"
        dir="rtl"
        onInteractOutside={e => { if (isProcessing && !isComplete) e.preventDefault(); }}
        onEscapeKeyDown={e => { if (isProcessing && !isComplete) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            הפעלה + החלפת סים
          </DialogTitle>
          <DialogDescription>
            {step === 1 && 'בחר סים חדש להפעלה'}
            {step === 2 && 'אשר את הפעולה'}
            {step === 3 && (isComplete ? 'הפעולה הושלמה!' : 'מעבד...')}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Select new SIM */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-muted/50 border">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <Label className="text-xs text-muted-foreground">סים ישן (להחלפה)</Label>
              </div>
              <div className="text-sm mt-1 font-mono">
                {oldSim.uk_number || oldSim.il_number || '---'}
                <span className="text-xs text-muted-foreground mr-2">...{oldSim.iccid?.slice(-6)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>בחר סים חדש</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="חיפוש..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pr-10"
                />
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {filtered.map(sim => (
                  <button
                    key={sim.id}
                    onClick={() => setSelectedSimId(sim.id)}
                    className={cn(
                      'w-full text-right p-2 rounded-md text-sm border transition-colors',
                      selectedSimId === sim.id
                        ? 'bg-primary/10 border-primary ring-1 ring-primary'
                        : 'border-green-300 hover:bg-muted'
                    )}
                  >
                    <span className="font-mono text-xs">{sim.uk_number || sim.il_number || '---'}</span>
                    <span className="text-[10px] mr-2 text-muted-foreground">
                      ...{sim.iccid?.slice(-6)}
                    </span>
                    <Badge variant="outline" className="text-[10px] mr-2">{sim.plan || '---'}</Badge>
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!selectedSimId}
              className="w-full"
            >
              המשך <ArrowRight className="h-4 w-4 mr-2" />
            </Button>
          </div>
        )}

        {/* Step 2: Confirm */}
        {step === 2 && selectedSim && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20">
                <Label className="text-xs text-red-600">סים ישן</Label>
                <p className="font-mono text-sm mt-1">{oldSim.uk_number || oldSim.il_number || '---'}</p>
                <p className="text-[10px] text-muted-foreground">...{oldSim.iccid?.slice(-6)}</p>
              </div>
              <div className="p-3 rounded-md border border-green-200 bg-green-50 dark:bg-green-950/20">
                <Label className="text-xs text-green-600">סים חדש</Label>
                <p className="font-mono text-sm mt-1">{selectedSim.uk_number || selectedSim.il_number || '---'}</p>
                <p className="text-[10px] text-muted-foreground">...{selectedSim.iccid?.slice(-6)}</p>
              </div>
            </div>

            <div className="p-3 rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 text-sm">
              <p className="font-medium text-yellow-800 dark:text-yellow-200">⚠️ שים לב</p>
              <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-1">
                תהליך זה לוקח כ-70 שניות. אל תסגור את החלון במהלך התהליך.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                חזור
              </Button>
              <Button onClick={handleConfirm} className="flex-1 gap-2">
                <Zap className="h-4 w-4" /> הפעל + החלף
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === 3 && (
          <div className="space-y-6 py-4">
            <div className="text-center">
              {isComplete ? (
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              ) : (
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              )}
              <p className="mt-3 font-medium text-lg">
                {progressStep || 'מתחיל...'}
              </p>
            </div>

            <Progress value={progressPercent} className="h-3" />

            <p className="text-center text-sm text-muted-foreground">
              {isComplete
                ? 'התהליך הושלם בהצלחה!'
                : 'אנא המתן, אל תסגור את החלון...'}
            </p>

            {isComplete && (
              <Button onClick={handleClose} className="w-full">
                סגור
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
