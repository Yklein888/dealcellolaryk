import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Camera, Loader2, X, ScanLine } from 'lucide-react';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcodeId: string) => void;
}

export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasStartedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startScanner = useCallback(async () => {
    if (hasStartedRef.current) return;
    
    hasStartedRef.current = true;
    setIsStarting(true);
    setError(null);

    const scannerId = 'barcode-scanner-reader';
    const scannerElement = document.getElementById(scannerId);
    
    if (!scannerElement) {
      setError('לא ניתן לאתחל את הסורק');
      setIsStarting(false);
      hasStartedRef.current = false;
      return;
    }

    try {
      scannerRef.current = new Html5Qrcode(scannerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });
      
      // Get container dimensions for optimal qrbox
      const containerWidth = containerRef.current?.clientWidth || 300;
      const qrboxWidth = Math.min(containerWidth - 40, 280);
      const qrboxHeight = Math.floor(qrboxWidth * 0.4); // Barcode aspect ratio
      
      await scannerRef.current.start(
        { facingMode: 'environment' },
        { 
          fps: 20, // Faster scanning
          qrbox: { width: qrboxWidth, height: qrboxHeight },
          aspectRatio: 16/9, // Better for barcodes
          disableFlip: false,
        },
        (decodedText) => {
          // Successfully scanned - provide haptic feedback if available
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
          onScan(decodedText);
          handleClose();
        },
        () => {
          // QR code not found - this is normal, just scanning
        }
      );
      
      setIsStarting(false);
      setIsScanning(true);
    } catch (err: any) {
      console.error('Failed to start scanner:', err);
      if (err.name === 'NotAllowedError') {
        setError('נדרשת הרשאת גישה למצלמה. אנא אשר את הבקשה ונסה שוב.');
      } else if (err.name === 'NotFoundError') {
        setError('לא נמצאה מצלמה במכשיר זה.');
      } else {
        setError('לא ניתן להפעיל את המצלמה. וודא שנתת הרשאות גישה.');
      }
      setIsStarting(false);
      hasStartedRef.current = false;
    }
  }, [onScan]);

  useEffect(() => {
    if (isOpen && !hasStartedRef.current) {
      // Small delay to ensure dialog is rendered
      const timer = setTimeout(startScanner, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, startScanner]);

  const handleClose = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {
        // Ignore stop errors
      }).finally(() => {
        scannerRef.current = null;
        hasStartedRef.current = false;
        setIsScanning(false);
        onClose();
      });
    } else {
      hasStartedRef.current = false;
      setIsScanning(false);
      onClose();
    }
  }, [onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            סרוק ברקוד מוצר
          </DialogTitle>
          <DialogDescription>
            כוון את המצלמה לעבר הברקוד שעל המוצר
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-0" ref={containerRef}>
          {/* Scanner Container */}
          <div className="relative bg-black">
            <div 
              id="barcode-scanner-reader" 
              className="w-full aspect-[4/3]"
            />
            
            {/* Scanning overlay with animated line */}
            {isScanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-[70%] h-[25%] border-2 border-primary rounded-lg overflow-hidden">
                  {/* Animated scanning line */}
                  <div className="absolute inset-x-0 h-0.5 bg-primary animate-scan-line shadow-[0_0_8px_2px] shadow-primary/50" />
                  
                  {/* Corner accents */}
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary" />
                </div>
              </div>
            )}
            
            {/* Loading overlay */}
            {isStarting && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-white">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="text-sm">מאתחל מצלמה...</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Error state */}
          {error && (
            <div className="text-center text-destructive text-sm p-4 bg-destructive/10">
              {error}
            </div>
          )}
          
          {/* Hint text */}
          {isScanning && !error && (
            <div className="text-center text-muted-foreground text-xs py-2 px-4 flex items-center justify-center gap-2">
              <ScanLine className="h-4 w-4" />
              <span>החזק את המכשיר יציב וקרוב לברקוד</span>
            </div>
          )}
          
          {/* Cancel button */}
          <div className="p-4 pt-2">
            <Button variant="outline" onClick={handleClose} className="w-full">
              <X className="h-4 w-4 ml-2" />
              ביטול
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
