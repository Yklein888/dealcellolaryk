import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Camera, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

type ScannerState = 'idle' | 'requesting' | 'active' | 'error' | 'stopping';

export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const [state, setState] = useState<ScannerState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const { toast } = useToast();

  // Cleanup function
  const cleanup = useCallback(async () => {
    console.log('[ZXing] Cleanup starting...');
    
    // Stop ZXing reader
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch (e) {
        console.warn('[ZXing] Error resetting reader:', e);
      }
      readerRef.current = null;
    }

    // Stop all media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('[ZXing] Track stopped:', track.label);
      });
      streamRef.current = null;
    }

    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    console.log('[ZXing] Cleanup complete');
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

      // Configure hints for barcode formats
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.QR_CODE,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      // Create new reader
      const reader = new BrowserMultiFormatReader(hints);
      readerRef.current = reader;

      // Get available video devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      console.log('[ZXing] Available cameras:', videoDevices.map(d => d.label || d.deviceId));

      // Find rear camera (environment facing)
      let selectedDeviceId: string | undefined;
      
      // Look for back/rear camera
      const backCamera = videoDevices.find(d => {
        const label = (d.label || '').toLowerCase();
        return label.includes('back') || label.includes('rear') || label.includes('environment') || label.includes('אחור');
      });
      
      if (backCamera) {
        selectedDeviceId = backCamera.deviceId;
        console.log('[ZXing] Selected back camera:', backCamera.label);
      } else if (videoDevices.length > 0) {
        // Default to last camera (usually rear on mobile)
        selectedDeviceId = videoDevices[videoDevices.length - 1].deviceId;
        console.log('[ZXing] Defaulting to last camera');
      }

      if (!videoRef.current) {
        throw new Error('Video element not ready');
      }

      // Start continuous decoding
      console.log('[ZXing] Starting continuous decode...');
      
      await reader.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current,
        (result, error) => {
          if (result && mountedRef.current) {
            const barcodeValue = result.getText();
            console.log('[ZXing] Barcode detected:', barcodeValue);
            
            // Vibrate for feedback
            if (navigator.vibrate) {
              navigator.vibrate(100);
            }

            // Call onScan callback
            onScan(barcodeValue);
            
            toast({
              title: 'ברקוד נסרק בהצלחה',
              description: barcodeValue,
            });

            // Close scanner
            onClose();
          }
          // Ignore decode errors - they happen when no barcode is visible
        }
      );

      // Get the stream reference for cleanup
      if (videoRef.current.srcObject) {
        streamRef.current = videoRef.current.srcObject as MediaStream;
      }

      if (mountedRef.current) {
        setState('active');
        console.log('[ZXing] Scanner active');
      }

    } catch (err: any) {
      console.error('[ZXing] Scanner error:', err);
      
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
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setState('stopping');
      cleanup().then(() => {
        if (mountedRef.current) {
          setState('idle');
          setErrorMessage(null);
        }
      });
    }

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [isOpen, startScanner, cleanup]);

  const handleClose = () => {
    cleanup();
    onClose();
  };

  const handleRetry = () => {
    setState('idle');
    setErrorMessage(null);
    setTimeout(startScanner, 100);
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
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-white hover:bg-white/20 h-9 w-9"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Scanner View */}
        <div className="relative aspect-[3/4] w-full bg-black">
          {/* Video Element */}
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
            autoPlay
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

          {/* Scanning Overlay */}
          {state === 'active' && (
            <>
              {/* Scan Line Animation */}
              <div className="absolute inset-0 pointer-events-none z-10">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] max-w-[280px] aspect-[3/2]">
                  {/* Corner markers */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                  
                  {/* Scanning line */}
                  <div className="absolute left-2 right-2 h-0.5 bg-primary/80 animate-pulse" 
                       style={{ 
                         top: '50%',
                         boxShadow: '0 0 8px 2px hsl(var(--primary) / 0.5)'
                       }} 
                  />
                </div>
              </div>

              {/* Instructions */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-white text-center text-sm">
                  כוון את המצלמה אל הברקוד
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
