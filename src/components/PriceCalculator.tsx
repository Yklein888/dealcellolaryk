import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Calculator,
  CalendarIcon,
  Plus,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ItemCategory, categoryLabels, categoryIcons } from '@/types/rental';
import { calculateRentalPrice, formatPrice } from '@/lib/pricing';
import { useExchangeRate, convertUsdToIls } from '@/hooks/useExchangeRate';

interface SelectedItem {
  id: string;
  category: ItemCategory;
  hasIsraeliNumber: boolean;
}

interface PriceCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PriceCalculator({ isOpen, onClose }: PriceCalculatorProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  );
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [newItemCategory, setNewItemCategory] = useState<ItemCategory | ''>('');
  
  const { data: exchangeRate } = useExchangeRate();

  const addItem = () => {
    if (!newItemCategory) return;
    setItems([
      ...items,
      {
        id: `item-${Date.now()}`,
        category: newItemCategory,
        hasIsraeliNumber: false,
      },
    ]);
    setNewItemCategory('');
  };

  const removeItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const toggleIsraeliNumber = (id: string) => {
    setItems(
      items.map((i) =>
        i.id === id ? { ...i, hasIsraeliNumber: !i.hasIsraeliNumber } : i
      )
    );
  };

  const priceResult = useMemo(() => {
    if (!startDate || !endDate || items.length === 0) return null;

    return calculateRentalPrice(
      items.map((i) => ({
        category: i.category,
        hasIsraeliNumber: i.hasIsraeliNumber,
      })),
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
  }, [startDate, endDate, items]);

  const categories: ItemCategory[] = [
    'sim_european',
    'sim_american',
    'device_simple',
    'device_smartphone',
    'modem',
    'netstick',
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            מחשבון מחירים
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Date Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>מתאריך</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-right font-normal',
                      !startDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {startDate
                      ? format(startDate, 'dd/MM/yyyy', { locale: he })
                      : 'בחר תאריך'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>עד תאריך</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-right font-normal',
                      !endDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {endDate
                      ? format(endDate, 'dd/MM/yyyy', { locale: he })
                      : 'בחר תאריך'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Add Items */}
          <div className="space-y-2">
            <Label>הוסף פריטים</Label>
            <div className="flex gap-2">
              <Select
                value={newItemCategory}
                onValueChange={(v) => setNewItemCategory(v as ItemCategory)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="בחר פריט" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {categoryIcons[cat]} {categoryLabels[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addItem} disabled={!newItemCategory}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Selected Items */}
          {items.length > 0 && (
            <div className="space-y-2">
              <Label>פריטים שנבחרו</Label>
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{categoryIcons[item.category]}</span>
                      <span className="font-medium">
                        {categoryLabels[item.category]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.category === 'sim_american' && (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.hasIsraeliNumber}
                            onCheckedChange={() => toggleIsraeliNumber(item.id)}
                          />
                          <span className="text-sm text-muted-foreground">
                            מספר ישראלי
                          </span>
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Price Result */}
          {priceResult && (
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
              <div className="space-y-2 mb-4">
                {priceResult.breakdown.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.item}</span>
                    <span className="flex items-center gap-2">
                      {item.currency}
                      {item.price.toFixed(2)}
                      {item.currency === '$' && exchangeRate && (
                        <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-xs">
                          ≈₪{convertUsdToIls(item.price, exchangeRate).toFixed(2)}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              
              {/* Show USD total with ILS equivalent if there are USD items */}
              {priceResult.usdTotal && priceResult.usdTotal > 0 && exchangeRate && (
                <div className="flex justify-between items-center py-2 border-t border-primary/20 text-sm">
                  <span className="text-muted-foreground">סה"כ דולר בשקלים</span>
                  <span className="font-medium">
                    ${priceResult.usdTotal.toFixed(2)} = ₪{convertUsdToIls(priceResult.usdTotal, exchangeRate).toFixed(2)}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between items-center pt-3 border-t border-primary/20">
                <span className="font-semibold text-lg">סה"כ לתשלום</span>
                <div className="text-left">
                  {priceResult.usdTotal && priceResult.usdTotal > 0 && exchangeRate ? (
                    <span className="text-2xl font-bold text-primary">
                      ₪{((priceResult.ilsTotal || 0) + convertUsdToIls(priceResult.usdTotal, exchangeRate)).toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-2xl font-bold text-primary">
                      {formatPrice(priceResult.total, priceResult.currency)}
                    </span>
                  )}
                </div>
              </div>
              
              {exchangeRate && (
                <div className="text-xs text-muted-foreground mt-2 text-center">
                  שער יציג: ₪{exchangeRate.toFixed(4)} לדולר
                </div>
              )}
            </div>
          )}

          {!priceResult && items.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <Calculator className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>הוסף פריטים כדי לחשב מחיר</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
