import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Camera, Loader2, X } from 'lucide-react';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcodeId: string) => void;
}

export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (isOpen && !hasStartedRef.current) {
      hasStartedRef.current = true;
      setIsStarting(true);
      setError(null);

      // Small delay to ensure dialog is rendered
      const timer = setTimeout(() => {
        const scannerId = 'barcode-scanner-reader';
        const scannerElement = document.getElementById(scannerId);
        
        if (!scannerElement) {
          setError('לא ניתן לאתחל את הסורק');
          setIsStarting(false);
          return;
        }

        scannerRef.current = new Html5Qrcode(scannerId);
        
        scannerRef.current.start(
          { facingMode: 'environment' },
          { 
            fps: 10, 
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.5,
          },
          (decodedText) => {
            // Successfully scanned
            onScan(decodedText);
            handleClose();
          },
          () => {
            // QR code not found - this is normal, just scanning
          }
        ).then(() => {
          setIsStarting(false);
        }).catch((err) => {
          console.error('Failed to start scanner:', err);
          setError('לא ניתן להפעיל את המצלמה. וודא שנתת הרשאות גישה למצלמה.');
          setIsStarting(false);
        });
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {
        // Ignore stop errors
      }).finally(() => {
        scannerRef.current = null;
        hasStartedRef.current = false;
        onClose();
      });
    } else {
      hasStartedRef.current = false;
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            סרוק ברקוד מוצר
          </DialogTitle>
          <DialogDescription>
            כוון את המצלמה לעבר הברקוד שעל המוצר
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Scanner Container */}
          <div 
            id="barcode-scanner-reader" 
            className="w-full aspect-[4/3] bg-muted rounded-lg overflow-hidden"
          />
          
          {/* Loading state */}
          {isStarting && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>מאתחל מצלמה...</span>
            </div>
          )}
          
          {/* Error state */}
          {error && (
            <div className="text-center text-destructive text-sm p-3 bg-destructive/10 rounded-lg">
              {error}
            </div>
          )}
          
          {/* Cancel button */}
          <Button variant="outline" onClick={handleClose} className="w-full">
            <X className="h-4 w-4 ml-2" />
            ביטול
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
