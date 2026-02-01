import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Camera, AlertCircle, Loader2, Zap, ZapOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

type ScannerState = 'idle' | 'requesting' | 'active' | 'error' | 'stopping';

// Scan area dimensions (percentage of video) - optimized for retail barcodes
const SCAN_AREA_WIDTH_PERCENT = 85;
const SCAN_AREA_HEIGHT_PERCENT = 28;

// Scanning interval in ms (20 attempts per second for fast detection)
const SCAN_INTERVAL_MS = 50;

export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const [state, setState] = useState<ScannerState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
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
      console.log('[ZXing] Torch:', newTorchState ? 'ON' : 'OFF');
    } catch (err) {
      console.warn('[ZXing] Could not toggle torch:', err);
    }
  }, [torchEnabled, torchSupported]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('[ZXing] Cleanup starting...');
    
    // Clear scanning interval
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    // Stop ZXing reader
    if (readerRef.current) {
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

    videoTrackRef.current = null;
    lastScannedRef.current = null;
    setTorchEnabled(false);
    setTorchSupported(false);
    console.log('[ZXing] Cleanup complete');
  }, []);

  // Apply camera optimizations after stream starts
  const applyTrackOptimizations = useCallback(async (track: MediaStreamTrack) => {
    try {
      const capabilities = track.getCapabilities?.() as any;
      const settings: Record<string, any> = {};
      
      // Check torch support
      if (capabilities?.torch) {
        setTorchSupported(true);
        console.log('[ZXing] Torch supported');
      }
      
      // Enable continuous autofocus for better barcode reading
      if (capabilities?.focusMode?.includes('continuous')) {
        settings.focusMode = 'continuous';
      }
      
      // Enable auto exposure for varying lighting
      if (capabilities?.exposureMode?.includes('continuous')) {
        settings.exposureMode = 'continuous';
      }

      // Set zoom to 1x for maximum clarity
      if (capabilities?.zoom) {
        settings.zoom = capabilities.zoom.min || 1;
      }
      
      if (Object.keys(settings).length > 0) {
        await track.applyConstraints(settings);
        console.log('[ZXing] Applied track optimizations:', settings);
      }
    } catch (err) {
      console.warn('[ZXing] Could not apply track optimizations:', err);
    }
  }, []);

  // Get cropped image data from scan area only (no downscaling)
  const getCroppedCanvas = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== 4) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // Calculate scan area in video coordinates (full resolution)
    const scanWidth = Math.floor(videoWidth * (SCAN_AREA_WIDTH_PERCENT / 100));
    const scanHeight = Math.floor(videoHeight * (SCAN_AREA_HEIGHT_PERCENT / 100));
    const scanX = Math.floor((videoWidth - scanWidth) / 2);
    const scanY = Math.floor((videoHeight - scanHeight) / 2);

    // Set canvas to scan area size (no downscaling)
    canvas.width = scanWidth;
    canvas.height = scanHeight;

    // Draw only the scan area portion at full resolution
    ctx.drawImage(
      video,
      scanX, scanY, scanWidth, scanHeight,  // Source rectangle
      0, 0, scanWidth, scanHeight            // Destination rectangle
    );

    return canvas;
  }, []);

  // Single scan attempt
  const performScan = useCallback(async () => {
    if (!mountedRef.current || state !== 'active' || !readerRef.current) {
      return;
    }

    const canvas = getCroppedCanvas();
    if (canvas) {
      try {
        const result = await readerRef.current.decodeFromCanvas(canvas);
        
        if (result && mountedRef.current) {
          const barcodeValue = result.getText();
          
          // Prevent duplicate scans
          if (barcodeValue === lastScannedRef.current) {
            return;
          }
          
          lastScannedRef.current = barcodeValue;
          console.log('[ZXing] Barcode detected:', barcodeValue);
          
          // Stop scanning
          if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
          }
          
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
          return;
        }
      } catch (err) {
        // No barcode found, continue scanning
      }
    }
  }, [state, getCroppedCanvas, onScan, onClose, toast]);

  // Start scanner
  const startScanner = useCallback(async () => {
    if (!mountedRef.current || state === 'active' || state === 'requesting') {
      return;
    }

    setState('requesting');
    setErrorMessage(null);

    try {
      // First, ensure any previous scanner is cleaned up
      cleanup();

      // Configure hints for barcode formats - focus on retail
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      hints.set(DecodeHintType.ASSUME_GS1, false);

      // Create new reader
      const reader = new BrowserMultiFormatReader(hints);
      readerRef.current = reader;

      // Request camera with MAXIMUM supported resolution
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          // Request maximum resolution - device will provide best available
          width: { ideal: 3840, min: 1280 },
          height: { ideal: 2160, min: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      };

      console.log('[ZXing] Requesting camera with constraints:', constraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Apply optimizations to video track
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrackRef.current = videoTrack;
        await applyTrackOptimizations(videoTrack);
        const settings = videoTrack.getSettings();
        console.log('[ZXing] Camera settings:', {
          width: settings.width,
          height: settings.height,
          frameRate: settings.frameRate,
          facingMode: settings.facingMode,
        });
      }

      if (!videoRef.current || !mountedRef.current) {
        throw new Error('Video element not ready');
      }

      // Set video source
      videoRef.current.srcObject = stream;
      
      // Wait for video to be ready
      await new Promise<void>((resolve, reject) => {
        const video = videoRef.current!;
        
        const onLoadedMetadata = () => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
          video.play()
            .then(() => resolve())
            .catch(reject);
        };
        
        const onError = () => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
          reject(new Error('Video failed to load'));
        };
        
        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('error', onError);
      });

      if (mountedRef.current) {
        setState('active');
        console.log('[ZXing] Scanner active, starting interval-based scanning');
        
        // Start high-frequency scanning interval
        scanIntervalRef.current = window.setInterval(() => {
          performScan();
        }, SCAN_INTERVAL_MS);
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
  }, [state, cleanup, applyTrackOptimizations, performScan, toast]);

  // Handle dialog open/close
  useEffect(() => {
    mountedRef.current = true;

    if (isOpen) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startScanner();
      }, 150);
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

  const handleClose = () => {
    cleanup();
    onClose();
  };

  const handleRetry = () => {
    setState('idle');
    setErrorMessage(null);
    setTimeout(startScanner, 150);
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
        
        {/* Hidden canvas for cropping */}
        <canvas ref={canvasRef} className="hidden" />
        
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
        <div className="relative aspect-[3/4] w-full bg-black">
          {/* Video Element - Full resolution, no CSS scaling */}
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

          {/* Scanning Overlay with Focused Area */}
          {state === 'active' && (
            <>
              {/* Dimmed overlay with cutout */}
              <div className="absolute inset-0 pointer-events-none z-10">
                {/* Top dim area */}
                <div 
                  className="absolute top-0 left-0 right-0 bg-black/60"
                  style={{ height: `${(100 - SCAN_AREA_HEIGHT_PERCENT) / 2}%` }}
                />
                {/* Bottom dim area */}
                <div 
                  className="absolute bottom-0 left-0 right-0 bg-black/60"
                  style={{ height: `${(100 - SCAN_AREA_HEIGHT_PERCENT) / 2}%` }}
                />
                {/* Left dim area */}
                <div 
                  className="absolute bg-black/60"
                  style={{ 
                    top: `${(100 - SCAN_AREA_HEIGHT_PERCENT) / 2}%`,
                    bottom: `${(100 - SCAN_AREA_HEIGHT_PERCENT) / 2}%`,
                    left: 0,
                    width: `${(100 - SCAN_AREA_WIDTH_PERCENT) / 2}%`
                  }}
                />
                {/* Right dim area */}
                <div 
                  className="absolute bg-black/60"
                  style={{ 
                    top: `${(100 - SCAN_AREA_HEIGHT_PERCENT) / 2}%`,
                    bottom: `${(100 - SCAN_AREA_HEIGHT_PERCENT) / 2}%`,
                    right: 0,
                    width: `${(100 - SCAN_AREA_WIDTH_PERCENT) / 2}%`
                  }}
                />
                
                {/* Scan area frame */}
                <div 
                  className="absolute border-2 border-primary rounded-lg"
                  style={{
                    top: `${(100 - SCAN_AREA_HEIGHT_PERCENT) / 2}%`,
                    left: `${(100 - SCAN_AREA_WIDTH_PERCENT) / 2}%`,
                    width: `${SCAN_AREA_WIDTH_PERCENT}%`,
                    height: `${SCAN_AREA_HEIGHT_PERCENT}%`,
                  }}
                >
                  {/* Corner markers */}
                  <div className="absolute -top-0.5 -left-0.5 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute -top-0.5 -right-0.5 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute -bottom-0.5 -left-0.5 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                  
                  {/* Scanning line animation */}
                  <div 
                    className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse"
                    style={{ 
                      top: '50%',
                      boxShadow: '0 0 12px 4px hsl(var(--primary) / 0.5)'
                    }} 
                  />
                </div>
              </div>

              {/* Instructions */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent z-20">
                <p className="text-white text-center text-sm font-medium">
                  מקם את הברקוד במסגרת לסריקה
                </p>
                {torchSupported && (
                  <p className="text-white/60 text-center text-xs mt-1">
                    לחץ על ⚡ להפעלת פנס
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}