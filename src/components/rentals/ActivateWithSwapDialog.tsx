import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client'; // still used for inventory update
import { externalSupabase } from '@/integrations/external-supabase/client';
import { InventoryItem } from '@/types/rental';
import { useToast } from '@/hooks/use-toast';

interface ActivateWithSwapDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** The old SIM that needs replacement (currently in rental, needs_swap=true) */
  oldSim: InventoryItem | null;
  /** The new SIM to activate */
  newSim: InventoryItem | null;
  customerName: string;
  startDate: string;
  endDate: string;
  onComplete: () => void;
}

type Step = 'confirm' | 'activating' | 'swapping' | 'done' | 'error';

export function ActivateWithSwapDialog({
  isOpen,
  onOpenChange,
  oldSim,
  newSim,
  customerName,
  startDate,
  endDate,
  onComplete,
}: ActivateWithSwapDialogProps) {
  const [step, setStep] = useState<Step>('confirm');
  const [errorMessage, setErrorMessage] = useState('');
  const { toast } = useToast();

  const handleActivateAndSwap = async () => {
    if (!oldSim?.simNumber || !newSim?.simNumber) return;

    try {
      setStep('activating');

      // Step 1: Insert activation request into external pending_activations
      const { error: activationError } = await externalSupabase
        .from('pending_activations')
        .insert({
          iccid: newSim.simNumber,
          sim_number: newSim.name || newSim.simNumber,
          customer_name: customerName,
          start_date: startDate || null,
          end_date: endDate || null,
          status: 'pending',
        });

      if (activationError) {
        throw new Error(`שגיאה בהפעלת סים: ${activationError.message}`);
      }

      setStep('swapping');

      // Step 2: Insert SIM swap request into external Supabase
      const { error: swapError } = await externalSupabase
        .from('pending_sim_swaps')
        .insert({
          old_iccid: oldSim.simNumber,
          new_iccid: newSim.simNumber,
          customer_name: customerName,
          status: 'pending',
        });

      if (swapError) {
        throw new Error(`שגיאה בהחלפת סים: ${swapError.message}`);
      }

      // Step 3: Update inventory - clear needs_swap on old SIM
      await supabase
        .from('inventory')
        .update({ needs_swap: false })
        .eq('id', oldSim.id);

      setStep('done');

      toast({
        title: 'הפעלה והחלפה הושלמו',
        description: 'הסים החדש הופעל ובקשת ההחלפה נשלחה. התוסף יבצע את ההחלפה.',
      });

      setTimeout(() => {
        onComplete();
        onOpenChange(false);
        setStep('confirm');
      }, 2000);
    } catch (err: any) {
      setStep('error');
      setErrorMessage(err.message || 'שגיאה לא צפויה');
      toast({
        title: 'שגיאה',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    if (step !== 'activating' && step !== 'swapping') {
      onOpenChange(false);
      setStep('confirm');
      setErrorMessage('');
    }
  };

  if (!oldSim || !newSim) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            הפעלה + החלפת סים
          </DialogTitle>
          <DialogDescription>
            הפעלת סים חדש והחלפה עם הסים הישן
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {step === 'confirm' && (
            <>
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <p className="text-sm font-medium text-destructive">סים ישן (להחלפה):</p>
                <p className="text-sm">{oldSim.name} - {oldSim.localNumber || oldSim.israeliNumber}</p>
                <p className="text-xs text-muted-foreground font-mono">ICCID: {oldSim.simNumber}</p>
              </div>

              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                <p className="text-sm font-medium text-primary">סים חדש (להפעלה):</p>
                <p className="text-sm">{newSim.name} - {newSim.localNumber || newSim.israeliNumber}</p>
                <p className="text-xs text-muted-foreground font-mono">ICCID: {newSim.simNumber}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted border">
                <p className="text-xs text-muted-foreground">
                  התהליך יפעיל את הסים החדש ויישלח בקשת החלפה ל-CellStation.
                  לאחר מכן יש ללחוץ על הבוקמרקלט להשלמת הפעולה.
                </p>
              </div>

              <Button onClick={handleActivateAndSwap} className="w-full">
                התחל תהליך
              </Button>
            </>
          )}

          {step === 'activating' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="font-medium">מפעיל סים חדש...</p>
              <p className="text-sm text-muted-foreground">נא להמתין</p>
            </div>
          )}

          {step === 'swapping' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
              <p className="font-medium">שולח בקשת החלפת סים...</p>
              <p className="text-sm text-muted-foreground">נא להמתין</p>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <CheckCircle className="h-10 w-10 text-green-500" />
              <p className="font-medium text-green-700 dark:text-green-400">הפעלה והחלפה הושלמו בהצלחה!</p>
              <p className="text-sm text-muted-foreground">לחץ על הבוקמרקלט להשלמת הפעולה באתר CellStation</p>
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <AlertTriangle className="h-10 w-10 text-destructive" />
              <p className="font-medium text-destructive">שגיאה בתהליך</p>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
              <Button variant="outline" onClick={() => setStep('confirm')}>
                נסה שוב
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
