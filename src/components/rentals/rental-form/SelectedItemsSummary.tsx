import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ShoppingCart, Printer, Loader2, AlertTriangle } from 'lucide-react';
import { InventoryItem, categoryIcons } from '@/types/rental';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, parseISO, isBefore } from 'date-fns';
import { printCallingInstructions, downloadCallingInstructions } from '@/lib/callingInstructions';
import { SelectedItem, categoryColors, isSim } from './types';

type SimValidity = 'valid' | 'warning' | 'expired';

function checkSimValidity(item: InventoryItem, endDate: Date | undefined): SimValidity {
  if (!isSim(item.category)) return 'valid';
  if (!item.expiryDate) return 'valid';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = parseISO(item.expiryDate);
  if (isBefore(expiry, today)) return 'expired';
  if (!endDate) return 'valid';
  if (isBefore(expiry, endDate)) return 'warning';
  return 'valid';
}

interface SelectedItemsSummaryProps {
  selectedItems: SelectedItem[];
  inventory: InventoryItem[];
  endDate: Date | undefined;
  onRemoveItem: (inventoryItemId: string) => void;
  onToggleIsraeliNumber: (inventoryItemId: string) => void;
  onToggleEuropeanDevice: (inventoryItemId: string) => void;
}

export function SelectedItemsSummary({
  selectedItems,
  inventory,
  endDate,
  onRemoveItem,
  onToggleIsraeliNumber,
  onToggleEuropeanDevice,
}: SelectedItemsSummaryProps) {
  const { toast } = useToast();
  const [downloadingInstructions, setDownloadingInstructions] = useState<string | null>(null);

  if (selectedItems.length === 0) return null;

  const handlePrint = async (itemId: string, israeliNumber?: string, localNumber?: string, barcode?: string) => {
    if (!israeliNumber && !localNumber) {
      toast({ title: 'אין מספרים', description: 'לסים זה אין מספר ישראלי או מקומי מוגדר', variant: 'destructive' });
      return;
    }
    setDownloadingInstructions(itemId);
    try {
      await printCallingInstructions(israeliNumber, localNumber, barcode);
      toast({ title: 'פותח חלון הדפסה', description: 'בחר מדפסת והדפס את ההוראות' });
    } catch {
      try {
        await downloadCallingInstructions(israeliNumber, localNumber, barcode);
        toast({ title: 'הקובץ הורד', description: 'פתח את הקובץ והדפס אותו ידנית' });
      } catch {
        toast({ title: 'שגיאה', description: 'לא ניתן ליצור את קובץ ההוראות', variant: 'destructive' });
      }
    } finally {
      setDownloadingInstructions(null);
    }
  };

  return (
    <div className="space-y-3 p-4 sm:p-5 rounded-xl sm:rounded-2xl border bg-card shadow-sm">
      <Label className="flex items-center gap-2 text-sm sm:text-base font-semibold">
        <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
        פריטים נבחרים ({selectedItems.length})
      </Label>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {selectedItems.map((item) => {
          const isEuropeanSimFromInventory = item.category === 'sim_european' && !item.isGeneric;
          const inventoryItem = inventory.find(i => i.id === item.inventoryItemId);
          const validity = inventoryItem ? checkSimValidity(inventoryItem, endDate) : 'valid';

          return (
            <div
              key={item.inventoryItemId}
              className={cn(
                "flex flex-col p-2 rounded-lg border",
                categoryColors[item.category].bg,
                categoryColors[item.category].border,
                validity === 'warning' && "ring-2 ring-amber-400/50"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{categoryIcons[item.category]}</span>
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {item.category === 'sim_american' && (
                    <div className="flex items-center gap-1 mr-2">
                      <Checkbox checked={item.hasIsraeliNumber} onCheckedChange={() => onToggleIsraeliNumber(item.inventoryItemId)} />
                      <Label className="text-xs">ישראלי (+$10)</Label>
                    </div>
                  )}
                  {item.category === 'sim_european' && (
                    <div className="flex items-center gap-1 mr-2">
                      <Checkbox checked={item.includeEuropeanDevice} onCheckedChange={() => onToggleEuropeanDevice(item.inventoryItemId)} />
                      <Label className="text-xs">+ מכשיר (₪5/יום)</Label>
                    </div>
                  )}
                  {item.category === 'sim_european' && inventoryItem && (inventoryItem.localNumber || inventoryItem.israeliNumber) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={downloadingInstructions === item.inventoryItemId}
                      onClick={() => handlePrint(
                        item.inventoryItemId,
                        inventoryItem.israeliNumber || undefined,
                        inventoryItem.localNumber || undefined,
                        inventoryItem.barcode || undefined
                      )}
                      className="h-7 w-7 p-0"
                      title="הדפס הוראות חיוג"
                    >
                      {downloadingInstructions === item.inventoryItemId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Printer className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => onRemoveItem(item.inventoryItemId)}
                  >
                    ×
                  </Button>
                </div>
              </div>
              {validity === 'warning' && inventoryItem?.expiryDate && (
                <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3" />
                  <span>
                    תוקף הסים יפוג ב-{format(parseISO(inventoryItem.expiryDate), 'dd/MM/yy')} - לפני סיום ההשכרה!
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
