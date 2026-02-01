import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, AlertTriangle, Check, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaymentConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  originalAmount: number;
  currency: 'ILS' | 'USD';
  customerName: string;
  cardLast4?: string;
  cardExpiry?: string;
  onConfirm: (amount: number) => void;
  isProcessing: boolean;
}

export function PaymentConfirmationDialog({
  isOpen,
  onOpenChange,
  originalAmount,
  currency,
  customerName,
  cardLast4,
  cardExpiry,
  onConfirm,
  isProcessing,
}: PaymentConfirmationDialogProps) {
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [editedAmount, setEditedAmount] = useState(originalAmount.toString());
  const [amountError, setAmountError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setIsEditingAmount(false);
      setEditedAmount(originalAmount.toString());
      setAmountError(null);
    }
  }, [isOpen, originalAmount]);

  const currencySymbol = currency === 'USD' ? '$' : '₪';

  const validateAmount = (value: string): boolean => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      setAmountError('יש להזין סכום תקין');
      return false;
    }
    if (num > 100000) {
      setAmountError('הסכום גבוה מדי');
      return false;
    }
    setAmountError(null);
    return true;
  };

  const handleAmountChange = (value: string) => {
    // Allow only numbers and decimal point
    const sanitized = value.replace(/[^0-9.]/g, '');
    setEditedAmount(sanitized);
    if (sanitized) {
      validateAmount(sanitized);
    } else {
      setAmountError(null);
    }
  };

  const handleConfirmPayment = () => {
    const finalAmount = isEditingAmount ? parseFloat(editedAmount) : originalAmount;
    
    if (isEditingAmount && !validateAmount(editedAmount)) {
      return;
    }
    
    onConfirm(finalAmount);
  };

  const finalAmount = isEditingAmount ? parseFloat(editedAmount) || 0 : originalAmount;
  const amountChanged = isEditingAmount && finalAmount !== originalAmount;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CreditCard className="h-5 w-5 text-primary" />
            אישור תשלום
          </DialogTitle>
          <DialogDescription>
            אנא אשר את פרטי התשלום לפני החיוב
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Customer info */}
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">לקוח</p>
            <p className="font-medium">{customerName}</p>
          </div>

          {/* Saved card info */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">כרטיס שמור</p>
            </div>
            <p className="font-medium font-mono">
              •••• •••• •••• {cardLast4 || '****'}
            </p>
            {cardExpiry && (
              <p className="text-xs text-muted-foreground mt-1">
                תוקף: {cardExpiry}
              </p>
            )}
          </div>

          {/* Amount section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>סכום לחיוב</Label>
              {!isEditingAmount && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingAmount(true)}
                  className="h-7 gap-1 text-xs"
                >
                  <Pencil className="h-3 w-3" />
                  עריכה
                </Button>
              )}
            </div>

            {isEditingAmount ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{currencySymbol}</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={editedAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className={cn(
                      "text-2xl font-bold h-14 text-center",
                      amountError && "border-destructive focus-visible:ring-destructive"
                    )}
                    autoFocus
                  />
                </div>
                {amountError && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {amountError}
                  </p>
                )}
                {amountChanged && !amountError && (
                  <p className="text-sm text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    הסכום שונה מהמקור ({currencySymbol}{originalAmount.toFixed(2)})
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditingAmount(false);
                    setEditedAmount(originalAmount.toString());
                    setAmountError(null);
                  }}
                >
                  ביטול עריכה
                </Button>
              </div>
            ) : (
              <div className="text-4xl font-bold text-center py-4 text-primary">
                {currencySymbol}{originalAmount.toFixed(2)}
              </div>
            )}
          </div>

          {/* Warning */}
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                לחיצה על "אשר וחייב" תבצע חיוב מיידי בכרטיס האשראי השמור.
                פעולה זו אינה ניתנת לביטול.
              </span>
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            ביטול
          </Button>
          <Button
            onClick={handleConfirmPayment}
            disabled={isProcessing || !!amountError}
            className="gap-2"
          >
            {isProcessing ? (
              <>
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                מעבד...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                אשר וחייב {currencySymbol}{finalAmount.toFixed(2)}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}