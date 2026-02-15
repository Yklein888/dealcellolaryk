import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Zap, ArrowRight, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

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
  const [newIccid, setNewIccid] = useState('');
  const [iccidError, setIccidError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStep, setProgressStep] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const cleanIccid = newIccid.replace(/\D/g, '');
  const isValidIccid = cleanIccid.length >= 19 && cleanIccid.length <= 20;

  const handleNext = () => {
    if (!isValidIccid) {
      setIccidError('ICCID חייב להכיל 19-20 ספרות');
      return;
    }
    setIccidError('');
    setStep(2);
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    setStep(3);

    try {
      await onActivateAndSwap(
        {
          product: '',
          start_rental: new Date().toISOString().split('T')[0],
          end_rental: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          price: '',
          note: '',
          rental_id: rentalId,
          current_sim: oldSim.sim_number || '',
          swap_msisdn: '',
          swap_iccid: cleanIccid,
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
    if (isProcessing && !isComplete) return;
    onOpenChange(false);
    setTimeout(() => {
      setStep(1);
      setNewIccid('');
      setIccidError('');
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
            {step === 1 && 'הכנס את ה-ICCID של הסים החדש'}
            {step === 2 && 'אשר את הפעולה'}
            {step === 3 && (isComplete ? 'הפעולה הושלמה!' : 'מעבד...')}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Enter ICCID */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-muted/50 border">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <Label className="text-xs text-muted-foreground">סים ישן (להחלפה)</Label>
              </div>
              <div className="text-sm mt-1 font-mono">
                {oldSim.uk_number || oldSim.il_number || '---'}
                <span className="text-xs text-muted-foreground mr-2">ICCID: {oldSim.iccid || '---'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>ICCID של הסים החדש</Label>
              <Input
                placeholder="הכנס 19-20 ספרות..."
                value={newIccid}
                onChange={e => {
                  setNewIccid(e.target.value);
                  setIccidError('');
                }}
                className="font-mono text-left"
                dir="ltr"
              />
              {iccidError && (
                <p className="text-xs text-destructive">{iccidError}</p>
              )}
              {cleanIccid.length > 0 && (
                <p className={`text-xs ${isValidIccid ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {cleanIccid.length} ספרות {isValidIccid ? '✅' : `(צריך 19-20)`}
                </p>
              )}
            </div>

            <Button
              onClick={handleNext}
              disabled={!isValidIccid}
              className="w-full"
            >
              המשך <ArrowRight className="h-4 w-4 mr-2" />
            </Button>
          </div>
        )}

        {/* Step 2: Confirm */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20">
                <Label className="text-xs text-red-600">סים ישן</Label>
                <p className="font-mono text-sm mt-1">{oldSim.uk_number || oldSim.il_number || '---'}</p>
                <p className="text-[10px] text-muted-foreground font-mono" dir="ltr">
                  {oldSim.iccid || '---'}
                </p>
              </div>
              <div className="p-3 rounded-md border border-green-200 bg-green-50 dark:bg-green-950/20">
                <Label className="text-xs text-green-600">סים חדש</Label>
                <p className="font-mono text-sm mt-1">ICCID:</p>
                <p className="text-[10px] text-muted-foreground font-mono" dir="ltr">
                  {cleanIccid}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 text-sm">
              <p className="font-medium text-yellow-800 dark:text-yellow-200">⚠️ שים לב</p>
              <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-1">
                תהליך זה לוקח כ-70 שניות: הפעלת הסים החדש, המתנה של 30 שניות, ולאחר מכן החלפה. אל תסגור את החלון במהלך התהליך.
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
