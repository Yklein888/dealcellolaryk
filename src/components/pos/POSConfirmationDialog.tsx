import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ProcessingSaleState } from '@/types/pos';
import { CheckCircle, XCircle, Mail, Printer, RotateCcw, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface POSConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: ProcessingSaleState;
  onNewSale: () => void;
}

export function POSConfirmationDialog({
  open,
  onOpenChange,
  state,
  onNewSale,
}: POSConfirmationDialogProps) {
  const isSuccess = state.step === 'completed';
  const isFailed = state.step === 'failed';

  const handleNewSale = () => {
    onOpenChange(false);
    onNewSale();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            {isSuccess ? 'העסקה הושלמה!' : 'שגיאה בעסקה'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Icon */}
          <div className="flex justify-center">
            {isSuccess ? (
              <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
            ) : (
              <div className="h-20 w-20 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <XCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
              </div>
            )}
          </div>

          {/* Success Details */}
          {isSuccess && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">מספר מסמך:</span>
                  <span className="font-bold">{state.documentNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">סוג מסמך:</span>
                  <span className="font-medium">{state.documentType}</span>
                </div>
                {state.cashChange !== null && state.cashChange > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>עודף:</span>
                    <span className="font-bold text-lg">₪{state.cashChange.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Document Actions */}
              <div className="flex gap-3">
                {state.documentUrl && state.documentUrl !== '#' && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(state.documentUrl!, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 ml-2" />
                    צפה במסמך
                  </Button>
                )}
                <Button variant="outline" className="flex-1">
                  <Mail className="h-4 w-4 ml-2" />
                  שלח ללקוח
                </Button>
                <Button variant="outline" className="flex-1">
                  <Printer className="h-4 w-4 ml-2" />
                  הדפס
                </Button>
              </div>
            </div>
          )}

          {/* Error Details */}
          {isFailed && (
            <div className="bg-red-100 dark:bg-red-900/20 p-4 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-center">
                {state.error || 'שגיאה לא ידועה'}
              </p>
            </div>
          )}

          {/* New Sale Button */}
          <Button
            onClick={handleNewSale}
            className="w-full h-12 text-lg"
            size="lg"
          >
            <RotateCcw className="h-5 w-5 ml-2" />
            מכירה חדשה
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
