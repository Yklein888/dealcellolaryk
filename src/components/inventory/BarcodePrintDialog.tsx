import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { BarcodeDisplay } from '@/components/BarcodeDisplay';
import { InventoryItem, categoryLabels } from '@/types/rental';
import { Printer, Check } from 'lucide-react';
import { useState } from 'react';

interface BarcodePrintDialogProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
}

export function BarcodePrintDialog({ isOpen, onClose, items }: BarcodePrintDialogProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set(items.map(i => i.id)));
  const printRef = useRef<HTMLDivElement>(null);

  const toggleItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    setSelectedItems(new Set(items.map(i => i.id)));
  };

  const deselectAll = () => {
    setSelectedItems(new Set());
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const selectedItemsArray = items.filter(item => selectedItems.has(item.id));

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <title>הדפסת ברקודים</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: Arial, sans-serif;
            padding: 10mm;
            direction: rtl;
          }
          .barcode-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 5mm;
          }
          .barcode-item {
            border: 1px solid #ddd;
            padding: 3mm;
            text-align: center;
            page-break-inside: avoid;
          }
          .barcode-item h4 {
            font-size: 10pt;
            margin-bottom: 2mm;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .barcode-item p {
            font-size: 8pt;
            color: #666;
            margin-bottom: 2mm;
          }
          .barcode-item svg {
            max-width: 100%;
            height: 40px;
          }
          @media print {
            .barcode-grid {
              grid-template-columns: repeat(3, 1fr);
            }
          }
        </style>
      </head>
      <body>
        <div class="barcode-grid">
          ${selectedItemsArray.map(item => `
            <div class="barcode-item">
              <h4>${item.name}</h4>
              <p>${categoryLabels[item.category]}</p>
              <svg id="barcode-${item.id}"></svg>
            </div>
          `).join('')}
        </div>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js"></script>
        <script>
          document.querySelectorAll('[id^="barcode-"]').forEach(svg => {
            const itemId = svg.id.replace('barcode-', '');
            const items = ${JSON.stringify(selectedItemsArray)};
            const item = items.find(i => i.id === itemId);
            if (item && item.barcode) {
              JsBarcode(svg, item.barcode, {
                format: "CODE128",
                width: 1.5,
                height: 40,
                displayValue: true,
                fontSize: 10,
                margin: 2
              });
            }
          });
          window.onload = function() {
            setTimeout(() => {
              window.print();
              window.close();
            }, 500);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const itemsWithBarcodes = items.filter(item => item.barcode);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            הדפסת ברקודים
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 py-2 border-b">
          <p className="text-sm text-muted-foreground">
            נבחרו {selectedItems.size} מתוך {itemsWithBarcodes.length} פריטים
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              בחר הכל
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll}>
              נקה בחירה
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {itemsWithBarcodes.map(item => (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedItems.has(item.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => toggleItem(item.id)}
              >
                <Checkbox
                  checked={selectedItems.has(item.id)}
                  onCheckedChange={() => toggleItem(item.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{categoryLabels[item.category]}</p>
                </div>
                {item.barcode && (
                  <div className="shrink-0">
                    <BarcodeDisplay code={item.barcode} height={30} width={1} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {itemsWithBarcodes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>אין פריטים עם ברקודים להדפסה</p>
              <p className="text-sm mt-1">הוסף פריטים חדשים - ברקוד ייווצר אוטומטית</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={handlePrint}
            disabled={selectedItems.size === 0}
            className="flex-1"
          >
            <Printer className="h-4 w-4 ml-2" />
            הדפס {selectedItems.size} ברקודים
          </Button>
          <Button variant="outline" onClick={onClose}>
            ביטול
          </Button>
        </div>

        {/* Hidden print content reference */}
        <div ref={printRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
