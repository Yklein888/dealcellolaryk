import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { CreditCard, Banknote, ArrowRight } from 'lucide-react';
import { PaymentMethod } from '@/types/pos';
import { cn } from '@/lib/utils';

interface POSPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  onConfirmPayment: (method: PaymentMethod, cashReceived?: number) => void;
  isProcessing?: boolean;
}

export function POSPaymentDialog({
  open,
  onOpenChange,
  totalAmount,
  onConfirmPayment,
  isProcessing,
}: POSPaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState<string>('');

  const cashAmount = parseFloat(cashReceived) || 0;
  const change = cashAmount - totalAmount;
  const isValidCash = paymentMethod === 'cash' && cashAmount >= totalAmount;

  const handleConfirm = () => {
    if (!paymentMethod) return;
    
    if (paymentMethod === 'cash') {
      if (!isValidCash) return;
      onConfirmPayment(paymentMethod, cashAmount);
    } else {
      onConfirmPayment(paymentMethod);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setPaymentMethod(null);
      setCashReceived('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">תשלום</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Total Amount */}
          <div className="text-center p-6 bg-muted rounded-lg">
            <p className="text-muted-foreground mb-1">סה"כ לתשלום</p>
            <p className="text-4xl font-bold text-primary">
              ₪{totalAmount.toFixed(2)}
            </p>
          </div>

          {/* Payment Method Selection */}
          <div className="grid grid-cols-2 gap-4">
            <Card
              className={cn(
                "p-6 cursor-pointer transition-all hover:border-primary",
                paymentMethod === 'credit' && "border-primary bg-primary/5"
              )}
              onClick={() => setPaymentMethod('credit')}
            >
              <div className="flex flex-col items-center gap-3">
                <CreditCard className="h-10 w-10 text-primary" />
                <span className="font-medium">אשראי</span>
              </div>
            </Card>

            <Card
              className={cn(
                "p-6 cursor-pointer transition-all hover:border-primary",
                paymentMethod === 'cash' && "border-primary bg-primary/5"
              )}
              onClick={() => setPaymentMethod('cash')}
            >
              <div className="flex flex-col items-center gap-3">
                <Banknote className="h-10 w-10 text-primary" />
                <span className="font-medium">מזומן</span>
              </div>
            </Card>
          </div>

          {/* Cash Amount Input */}
          {paymentMethod === 'cash' && (
            <div className="space-y-4 animate-in slide-in-from-top-2">
              <div className="space-y-2">
                <Label htmlFor="cashReceived">סכום שהתקבל</Label>
                <Input
                  id="cashReceived"
                  type="number"
                  min={0}
                  step="0.01"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="הזן סכום..."
                  className="text-lg h-12"
                  autoFocus
                />
              </div>

              {cashAmount > 0 && (
                <div className={cn(
                  "p-4 rounded-lg text-center",
                  change >= 0 ? "bg-green-100 dark:bg-green-900/20" : "bg-red-100 dark:bg-red-900/20"
                )}>
                  <p className="text-sm text-muted-foreground mb-1">עודף</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    change >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  )}>
                    ₪{change.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isProcessing}
              className="flex-1"
            >
              <ArrowRight className="h-4 w-4 ml-2" />
              חזור
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={
                !paymentMethod || 
                (paymentMethod === 'cash' && !isValidCash) ||
                isProcessing
              }
              className="flex-1"
            >
              {isProcessing ? 'מעבד...' : 'אשר תשלום'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
