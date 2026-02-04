import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Camera, AlertCircle, Loader2, Zap, ZapOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

type ScannerState = 'idle' | 'requesting' | 'active' | 'error' | 'stopping';

const SCANNER_CONTAINER_ID = 'barcode-scanner-container';

export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const [state, setState] = useState<ScannerState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountedRef = useRef(true);
  const lastScannedRef = useRef<string | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const { toast } = useToast();

  // Toggle torch/flashlight
  const toggleTorch = useCallback(async () => {
    if (!videoTrackRef.current || !torchSupported) return;
    
    try {
      const newTorchState = !torchEnabled;
      await videoTrackRef.current.applyConstraints({
        advanced: [{ torch: newTorchState } as any]
      });
      setTorchEnabled(newTorchState);
      console.log('[Html5Qrcode] Torch:', newTorchState ? 'ON' : 'OFF');
    } catch (err) {
      console.warn('[Html5Qrcode] Could not toggle torch:', err);
    }
  }, [torchEnabled, torchSupported]);

  // Cleanup function
  const cleanup = useCallback(async () => {
    console.log('[Html5Qrcode] Cleanup starting...');
    
    if (scannerRef.current) {
      try {
        const isScanning = scannerRef.current.isScanning;
        if (isScanning) {
          await scannerRef.current.stop();
          console.log('[Html5Qrcode] Scanner stopped');
        }
      } catch (err) {
        console.warn('[Html5Qrcode] Error stopping scanner:', err);
      }
      scannerRef.current = null;
    }

    videoTrackRef.current = null;
    lastScannedRef.current = null;
    setTorchEnabled(false);
    setTorchSupported(false);
    console.log('[Html5Qrcode] Cleanup complete');
  }, []);

  // Start scanner
  const startScanner = useCallback(async () => {
    if (!mountedRef.current || state === 'active' || state === 'requesting') {
      return;
    }

    setState('requesting');
    setErrorMessage(null);

    try {
      // First, ensure any previous scanner is cleaned up
      await cleanup();

      // Wait for DOM element to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      const containerElement = document.getElementById(SCANNER_CONTAINER_ID);
      if (!containerElement) {
        throw new Error('Scanner container not found');
      }

      // Create scanner instance
      const scanner = new Html5Qrcode(SCANNER_CONTAINER_ID);
      scannerRef.current = scanner;

      // Scanner configuration - optimized for barcodes
      const config = {
        fps: 15,
        qrbox: { width: 350, height: 150 },
        aspectRatio: 2.0,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ]
      };

      // Camera configuration - HIGH RESOLUTION
      const cameraConfig = {
        facingMode: "environment",
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 }
      };

      console.log('[Html5Qrcode] Starting scanner with config:', config);

      await scanner.start(
        cameraConfig,
        config,
        (decodedText) => {
          // Prevent duplicate scans
          if (decodedText === lastScannedRef.current) {
            return;
          }
          
          lastScannedRef.current = decodedText;
          console.log('[Html5Qrcode] Barcode detected:', decodedText);
          
          // Vibrate for feedback
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }

          // Call onScan callback
          onScan(decodedText);
          
          toast({
            title: 'ברקוד נסרק בהצלחה',
            description: decodedText,
          });

          // Close scanner
          onClose();
        },
        () => {
          // Scanning errors - ignore (no barcode found yet)
        }
      );

      // Get video track for torch control
      try {
        const videoElement = containerElement.querySelector('video');
        if (videoElement && videoElement.srcObject) {
          const stream = videoElement.srcObject as MediaStream;
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            videoTrackRef.current = videoTrack;
            
            // Check torch support
            const capabilities = videoTrack.getCapabilities?.() as any;
            if (capabilities?.torch) {
              setTorchSupported(true);
              console.log('[Html5Qrcode] Torch supported');
            }

            const settings = videoTrack.getSettings();
            console.log('[Html5Qrcode] Camera settings:', {
              width: settings.width,
              height: settings.height,
              frameRate: settings.frameRate,
              facingMode: settings.facingMode,
            });
          }
        }
      } catch (err) {
        console.warn('[Html5Qrcode] Could not get video track:', err);
      }

      if (mountedRef.current) {
        setState('active');
        console.log('[Html5Qrcode] Scanner active');
      }

    } catch (err: any) {
      console.error('[Html5Qrcode] Scanner error:', err);
      
      let message = 'שגיאה בהפעלת המצלמה';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'נא לאשר גישה למצלמה בהגדרות הדפדפן';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'לא נמצאה מצלמה במכשיר';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = 'המצלמה בשימוש על ידי אפליקציה אחרת';
      } else if (err.name === 'OverconstrainedError') {
        message = 'המצלמה לא תומכת בהגדרות הנדרשות';
      } else if (err.message) {
        message = `שגיאה: ${err.message}`;
      }

      if (mountedRef.current) {
        setErrorMessage(message);
        setState('error');
        toast({
          title: 'שגיאה',
          description: message,
          variant: 'destructive',
        });
      }
    }
  }, [state, cleanup, onScan, onClose, toast]);

  // Handle dialog open/close
  useEffect(() => {
    mountedRef.current = true;

    if (isOpen) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startScanner();
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setState('stopping');
      cleanup();
      setState('idle');
      setErrorMessage(null);
    }

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [isOpen, startScanner, cleanup]);

  const handleClose = async () => {
    await cleanup();
    onClose();
  };

  const handleRetry = () => {
    setState('idle');
    setErrorMessage(null);
    setTimeout(startScanner, 200);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent 
        className="p-0 gap-0 max-w-lg w-[95vw] bg-black overflow-hidden"
        aria-describedby="barcode-scanner-description"
      >
        <DialogTitle className="sr-only">סורק ברקוד</DialogTitle>
        <p id="barcode-scanner-description" className="sr-only">
          כוון את המצלמה אל הברקוד לסריקה אוטומטית
        </p>
        
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/70 to-transparent">
          <span className="text-white font-medium flex items-center gap-2">
            <Camera className="h-5 w-5" />
            סורק ברקוד
          </span>
          <div className="flex items-center gap-2">
            {/* Torch button */}
            {torchSupported && state === 'active' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTorch}
                className="text-white hover:bg-white/20 h-9 w-9"
              >
                {torchEnabled ? (
                  <Zap className="h-5 w-5 text-yellow-400" />
                ) : (
                  <ZapOff className="h-5 w-5" />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="text-white hover:bg-white/20 h-9 w-9"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Scanner View */}
        <div className="relative w-full bg-black" style={{ height: '400px' }}>
          {/* Scanner Container - html5-qrcode will render here */}
          <div 
            id={SCANNER_CONTAINER_ID}
            className="w-full h-full"
            style={{ 
              width: '100%',
              maxWidth: '500px',
              height: '300px',
              margin: '50px auto 0',
            }}
          />

          {/* Loading State */}
          {(state === 'idle' || state === 'requesting') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="text-white text-center">
                {state === 'requesting' ? 'מבקש גישה למצלמה...' : 'טוען סורק...'}
              </p>
            </div>
          )}

          {/* Error State */}
          {state === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-10 p-6">
              <AlertCircle className="h-16 w-16 text-destructive mb-4" />
              <p className="text-white text-center mb-6 text-lg">
                {errorMessage || 'שגיאה בהפעלת המצלמה'}
              </p>
              <Button onClick={handleRetry} variant="secondary" size="lg">
                נסה שוב
              </Button>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="p-4 bg-black/90 text-center">
          <p className="text-white/80 text-sm">
            כוון את הברקוד לתוך המסגרת
          </p>
          <p className="text-white/50 text-xs mt-1">
            רזולוציה גבוהה • 15 FPS • CODE-128, EAN-13, ITF
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
