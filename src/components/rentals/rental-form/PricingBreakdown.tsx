import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DualCurrencyPrice } from '@/components/DualCurrencyPrice';
import { SelectedItem } from './types';

interface PriceBreakdownItem {
  item: string;
  price: number;
  currency: string;
}

interface PricingResult {
  total: number;
  currency: 'ILS' | 'USD';
  breakdown: PriceBreakdownItem[];
}

interface PricingBreakdownProps {
  previewPrice: PricingResult | null;
  deposit: string;
  notes: string;
  autoActivateSim: boolean;
  hasEuropeanSim: boolean;
  onDepositChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onAutoActivateChange: (checked: boolean) => void;
}

export function PricingBreakdown({
  previewPrice,
  deposit,
  notes,
  autoActivateSim,
  hasEuropeanSim,
  onDepositChange,
  onNotesChange,
  onAutoActivateChange,
}: PricingBreakdownProps) {
  return (
    <>
      {/* Price Preview */}
      {previewPrice && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30">
          <p className="text-sm text-muted-foreground mb-2">פירוט מחיר:</p>
          {previewPrice.breakdown.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span>{item.item}</span>
              <DualCurrencyPrice
                amount={item.price}
                currency={item.currency === '$' ? 'USD' : 'ILS'}
                showTooltip={false}
              />
            </div>
          ))}
          <div className="border-t border-primary/30 mt-2 pt-2 flex justify-between font-bold text-lg">
            <span>סה"כ</span>
            <span className="text-primary">
              <DualCurrencyPrice amount={previewPrice.total} currency={previewPrice.currency} />
            </span>
          </div>
        </div>
      )}

      {/* Deposit & Notes */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-2">
          <Label className="text-sm">פיקדון</Label>
          <Input
            type="number"
            value={deposit}
            onChange={(e) => onDepositChange(e.target.value)}
            placeholder="₪0"
            className="h-10 sm:h-11"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">הערות</Label>
          <Input
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="הערות..."
            className="h-10 sm:h-11"
          />
        </div>
      </div>

      {/* Auto-activate SIM */}
      {hasEuropeanSim && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 border border-primary/30">
          <Checkbox
            id="autoActivateSim"
            checked={autoActivateSim}
            onCheckedChange={(checked) => onAutoActivateChange(checked === true)}
          />
          <div className="flex-1">
            <Label htmlFor="autoActivateSim" className="text-sm font-medium cursor-pointer">
              ⚡ הפעל סים אוטומטית
            </Label>
            <p className="text-xs text-muted-foreground">
              הסים יישלח להפעלה מיד עם יצירת ההשכרה
            </p>
          </div>
        </div>
      )}
    </>
  );
}
