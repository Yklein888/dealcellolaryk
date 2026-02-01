import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Pencil, 
  Plus, 
  ExternalLink,
  Phone,
  Calendar,
  ScanBarcode,
  Printer
} from 'lucide-react';
import { InventoryItem, categoryLabels, categoryIcons } from '@/types/rental';
import { useNavigate } from 'react-router-dom';
import { BarcodeDisplay } from '@/components/BarcodeDisplay';

interface QuickActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  onEdit?: (item: InventoryItem) => void;
  onAddToRental?: (item: InventoryItem) => void;
}

export function QuickActionDialog({ 
  isOpen, 
  onClose, 
  item,
  onEdit,
  onAddToRental 
}: QuickActionDialogProps) {
  const navigate = useNavigate();

  if (!item) return null;

  const statusLabels = {
    available: 'זמין',
    rented: 'מושכר',
    maintenance: 'בתחזוקה',
  };

  const statusVariants = {
    available: 'bg-success/20 text-success border-success/30',
    rented: 'bg-primary/20 text-primary border-primary/30',
    maintenance: 'bg-warning/20 text-warning border-warning/30',
  };

  const isSim = item.category === 'sim_european' || item.category === 'sim_american';

  const handleGoToInventory = () => {
    navigate('/inventory');
    onClose();
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(item);
    }
    onClose();
  };

  const handleAddToRental = () => {
    if (onAddToRental) {
      onAddToRental(item);
    }
    onClose();
  };

  const printSimLabel = () => {
    if (!item) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const localDisplay = item.localNumber || '---';
    const israeliDisplay = item.israeliNumber || null;
    const simDisplay = item.simNumber || '---';
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <title>מדבקת סים</title>
        <style>
          @page { size: 4cm 6cm; margin: 2mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            font-size: 8pt;
            width: 4cm;
            height: 6cm;
            padding: 3mm;
            direction: rtl;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .field { 
            margin-bottom: 2mm; 
            text-align: center;
            width: 100%;
          }
          .label { font-size: 6pt; color: #666; margin-bottom: 0.5mm; }
          .value { font-size: 9pt; font-weight: bold; }
          .sim-number { font-size: 7pt; font-weight: bold; word-break: break-all; }
          .barcode { margin-top: 2mm; text-align: center; }
          .barcode svg { max-width: 100%; height: 20px; }
        </style>
      </head>
      <body>
        <div class="field">
          <div class="label">מספר מקומי:</div>
          <div class="value">${localDisplay}</div>
        </div>
        ${israeliDisplay ? `
        <div class="field">
          <div class="label">מספר ישראלי:</div>
          <div class="value">${israeliDisplay}</div>
        </div>
        ` : ''}
        <div class="field">
          <div class="label">מספר סים:</div>
          <div class="sim-number">${simDisplay}</div>
        </div>
        <div class="barcode">
          <svg id="barcode"></svg>
        </div>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js"></script>
        <script>
          JsBarcode("#barcode", "${item.barcode || ''}", {
            format: "CODE128",
            width: 1,
            height: 20,
            displayValue: true,
            fontSize: 7,
            margin: 1
          });
          window.onload = function() {
            setTimeout(() => {
              window.print();
              window.close();
            }, 300);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            פעולות מהירות
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Item Details */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{categoryIcons[item.category]}</span>
                <div>
                  <p className="font-bold text-lg">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{categoryLabels[item.category]}</p>
                </div>
              </div>
              <Badge className={`${statusVariants[item.status]} border`}>
                {statusLabels[item.status]}
              </Badge>
            </div>
            
            {/* SIM Details */}
            {isSim && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                {item.israeliNumber && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>🇮🇱 {item.israeliNumber}</span>
                  </div>
                )}
                {item.localNumber && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>🌍 {item.localNumber}</span>
                  </div>
                )}
                {item.expiryDate && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>תוקף: {item.expiryDate}</span>
                  </div>
                )}
                {item.simNumber && (
                  <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                    <ScanBarcode className="h-3.5 w-3.5" />
                    <span>ICCID: {item.simNumber}</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Barcode */}
            {item.barcode && (
              <div className="flex justify-center pt-2 border-t border-border">
                <BarcodeDisplay code={item.barcode} height={50} width={1.5} />
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="space-y-2">
            {item.status === 'available' && onAddToRental && (
              <Button onClick={handleAddToRental} className="w-full" variant="glow">
                <Plus className="h-4 w-4 ml-2" />
                הוסף להשכרה חדשה
              </Button>
            )}

            {isSim && item.barcode && (
              <Button onClick={printSimLabel} variant="outline" className="w-full">
                <Printer className="h-4 w-4 ml-2" />
                הדפס מדבקה
              </Button>
            )}
            
            {onEdit && (
              <Button onClick={handleEdit} variant="outline" className="w-full">
                <Pencil className="h-4 w-4 ml-2" />
                ערוך פריט
              </Button>
            )}
            
            <Button onClick={handleGoToInventory} variant="outline" className="w-full">
              <ExternalLink className="h-4 w-4 ml-2" />
              עבור לדף מלאי
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
