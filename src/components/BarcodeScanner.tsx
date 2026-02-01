import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, X, ScanLine, Keyboard } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  buildBarcodeScannerConfig,
  buildBarcodeVideoConstraints,
  pickPreferredCameraId,
  CameraDevice,
  applyTrackOptimizations,
} from '@/lib/barcodeScanner';
import {
  BarcodeScannerSettings,
  getStoredCameraId,
} from '@/components/barcode-scanner/BarcodeScannerSettings';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcodeId: string) => void;
}

// Scanner states for lifecycle management
type ScannerState = 'idle' | 'initializing' | 'running' | 'stopping';

export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [needsUserGesture, setNeedsUserGesture] = useState(true);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerStateRef = useRef<ScannerState>('idle');
  const activeStreamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const pendingStartRef = useRef(false);

  // Explicitly stop all video tracks from a stream
  const stopAllTracks = useCallback((stream: MediaStream | null) => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
          console.log('Stopped track:', track.kind, track.label);
        } catch (e) {
          console.warn('Failed to stop track:', e);
        }
      });
    }
  }, []);

  const formatCameraErrorCode = useCallback((err: any) => {
    const errName = err?.name ? String(err.name) : 'UnknownError';
    const errMsg = err?.message ? String(err.message) : '';
    const errConstraint = err?.constraint ? ` (constraint: ${err.constraint})` : '';
    const errAsString =
      typeof err === 'string'
        ? err
        : typeof err?.toString === 'function'
          ? String(err.toString())
          : '';

    const detail = errMsg || (errAsString && errAsString !== '[object Object]' ? errAsString : '');
    return `${errName}${errConstraint}${detail ? ` - ${detail.slice(0, 120)}` : ''}`;
  }, []);

  // Full cleanup of scanner and all resources
  const cleanupScanner = useCallback(async () => {
    console.log('cleanupScanner called, current state:', scannerStateRef.current);
    
    // If already idle or stopping, don't double-stop
    if (scannerStateRef.current === 'idle' || scannerStateRef.current === 'stopping') {
      console.log('Scanner already idle/stopping, skipping cleanup');
      return;
    }
    
    scannerStateRef.current = 'stopping';
    
    try {
      // First, stop the Html5Qrcode scanner
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          console.log('Scanner getState:', state);
          // Only call stop if scanner is actually running (state 2 = SCANNING)
          if (state === 2) {
            await scannerRef.current.stop();
            console.log('Html5Qrcode stopped successfully');
          }
        } catch (stopErr) {
          console.warn('Error stopping Html5Qrcode:', stopErr);
        }
        scannerRef.current = null;
      }
      
      // Explicitly stop all active video tracks
      stopAllTracks(activeStreamRef.current);
      activeStreamRef.current = null;
      
      // Also try to stop any lingering video elements
      const videoElements = document.querySelectorAll('#barcode-scanner-reader video');
      videoElements.forEach((video) => {
        const videoEl = video as HTMLVideoElement;
        if (videoEl.srcObject) {
          const stream = videoEl.srcObject as MediaStream;
          stopAllTracks(stream);
          videoEl.srcObject = null;
        }
      });
      
    } catch (err) {
      console.warn('Cleanup error:', err);
    } finally {
      scannerStateRef.current = 'idle';
      console.log('Scanner cleanup complete, state now idle');
    }
  }, [stopAllTracks]);

  const handleClose = useCallback(async () => {
    await cleanupScanner();
    
    if (mountedRef.current) {
      setIsScanning(false);
      setIsStarting(false);
      setManualMode(false);
      setManualInput('');
      setNeedsUserGesture(true);
    }
    
    onClose();
  }, [onClose, cleanupScanner]);

  const handleManualSubmit = useCallback(() => {
    const trimmed = manualInput.trim();
    if (trimmed) {
      if (navigator.vibrate) navigator.vibrate(100);
      onScan(trimmed);
      handleClose();
    }
  }, [manualInput, onScan, handleClose]);

  const stopScanner = useCallback(async () => {
    await cleanupScanner();
    
    if (mountedRef.current) {
      setIsScanning(false);
      setIsStarting(false);
    }
  }, [cleanupScanner]);

  // Request camera permission from user gesture
  const preflightCameraPermission = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      const err = new Error('NotSupportedError') as any;
      err.name = 'NotSupportedError';
      throw err;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    // Store reference and stop tracks
    stopAllTracks(stream);
  }, [stopAllTracks]);

  const startScanner = useCallback(
    async (cameraIdOverride?: string) => {
      console.log('startScanner called, current state:', scannerStateRef.current);
      
      // CRITICAL: Prevent starting if already initializing or running
      if (scannerStateRef.current !== 'idle') {
        console.log('Scanner not idle, aborting start. State:', scannerStateRef.current);
        return;
      }
      
      scannerStateRef.current = 'initializing';
      setIsStarting(true);
      setError(null);

      // Add delay to ensure DOM and previous instances are fully cleared
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      // Double-check we're still mounted and should proceed
      if (!mountedRef.current) {
        scannerStateRef.current = 'idle';
        return;
      }

      const scannerId = 'barcode-scanner-reader';
      const scannerElement = document.getElementById(scannerId);

      if (!scannerElement) {
        setError('לא ניתן לאתחל את הסורק');
        setIsStarting(false);
        scannerStateRef.current = 'idle';
        return;
      }

      try {
        // Create fresh scanner instance
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

        // Calculate qrbox dimensions
        const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
        const qrboxWidth = Math.min(containerWidth - 48, 400);
        const qrboxHeight = Math.floor(qrboxWidth * 0.35);

        const onDecoded = (decodedText: string) => {
          if (navigator.vibrate) navigator.vibrate(100);
          onScan(decodedText);
          handleClose();
        };

        const onDecodeError = () => {};

        // Get available cameras
        let cameraList: CameraDevice[] = [];
        let preferredCameraId: string | undefined;
        
        try {
          cameraList = await Html5Qrcode.getCameras();
          setCameras(cameraList);
          
          const storedId = getStoredCameraId();
          preferredCameraId = cameraIdOverride || pickPreferredCameraId(cameraList, storedId);
          
          if (preferredCameraId) {
            setSelectedCameraId(preferredCameraId);
          }
        } catch (camErr) {
          console.warn('Could not enumerate cameras:', camErr);
        }

        const scanConfig = buildBarcodeScannerConfig({ qrboxWidth, qrboxHeight });

        // Try starting with different constraint levels
        const attemptStart = async (
          constraints: MediaTrackConstraints,
          label: string
        ): Promise<boolean> => {
          try {
            console.log(`Attempting start with ${label}:`, constraints);
            await scannerRef.current!.start(
              constraints as any,
              scanConfig as any,
              onDecoded,
              onDecodeError
            );
            
            // After successful start, try to get the active stream and apply optimizations
            try {
              const videoElement = document.querySelector('#barcode-scanner-reader video') as HTMLVideoElement;
              if (videoElement?.srcObject) {
                const stream = videoElement.srcObject as MediaStream;
                activeStreamRef.current = stream;
                
                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack) {
                  await applyTrackOptimizations(videoTrack);
                }
              }
            } catch (optErr) {
              console.warn('Could not apply optimizations:', optErr);
            }
            
            return true;
          } catch (err) {
            console.warn(`${label} failed:`, err);
            return false;
          }
        };

        // Attempt 1: Primary constraints with deviceId
        let started = await attemptStart(
          buildBarcodeVideoConstraints(preferredCameraId, 'primary'),
          'Primary with deviceId'
        );

        // Attempt 2: Fallback constraints with deviceId
        if (!started && preferredCameraId) {
          started = await attemptStart(
            buildBarcodeVideoConstraints(preferredCameraId, 'fallback'),
            'Fallback with deviceId'
          );
        }

        // Attempt 3: Primary constraints without deviceId (facingMode only)
        if (!started) {
          started = await attemptStart(
            buildBarcodeVideoConstraints(undefined, 'primary'),
            'Primary without deviceId'
          );
        }

        // Attempt 4: Fallback constraints without deviceId
        if (!started) {
          started = await attemptStart(
            buildBarcodeVideoConstraints(undefined, 'fallback'),
            'Fallback without deviceId'
          );
        }

        // Attempt 5: Minimal constraints as last resort
        if (!started) {
          started = await attemptStart(
            { facingMode: 'environment' },
            'Minimal constraints'
          );
        }

        if (!started) {
          throw new Error('All camera start attempts failed');
        }

        if (mountedRef.current) {
          setIsStarting(false);
          setIsScanning(true);
          scannerStateRef.current = 'running';
        }
        
      } catch (err: any) {
        console.error('Failed to start scanner:', err);
        console.error('Error details:', {
          name: err?.name,
          message: err?.message,
          constraint: err?.constraint,
          stack: err?.stack?.slice?.(0, 500),
        });

        const fullErrorCode = formatCameraErrorCode(err);

        if (err.name === 'NotAllowedError') {
          setError(
            'נדרשת הרשאת גישה למצלמה. אם כבר אישרת ועדיין יש שגיאה, בדוק גם בהרשאות המערכת: הגדרות אנדרואיד → אפליקציות → Chrome → הרשאות → מצלמה → אפשר.\n' +
              `קוד שגיאה: ${fullErrorCode}`
          );
        } else if (err.name === 'NotFoundError') {
          setError(`לא נמצאה מצלמה במכשיר זה.\nקוד שגיאה: ${fullErrorCode}`);
        } else if (err.name === 'OverconstrainedError') {
          setError(
            'הגדרות המצלמה לא נתמכות במצלמה שנבחרה. נסה לבחור מצלמה אחרת (⚙️) או נסה שוב.\n' +
              `קוד שגיאה: ${fullErrorCode}`
          );
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError(
            'המצלמה תפוסה/לא זמינה כרגע. סגור אפליקציות שמשתמשות במצלמה (WhatsApp/Instagram/מצלמה) ונסה שוב.\n' +
              `קוד שגיאה: ${fullErrorCode}`
          );
        } else if (err.name === 'NotSupportedError') {
          setError(
            `הדפדפן לא תומך בהפעלת מצלמה בצורה הזו. נסה דפדפן אחר או עדכן גרסה.\nקוד שגיאה: ${fullErrorCode}`
          );
        } else {
          setError(`לא ניתן להפעיל את המצלמה. וודא שנתת הרשאות גישה.\nקוד שגיאה: ${fullErrorCode}`);
        }
        
        // Clean up on failure
        await cleanupScanner();
        
        if (mountedRef.current) {
          setIsStarting(false);
          setNeedsUserGesture(true);
        }
      }
    },
    [formatCameraErrorCode, handleClose, onScan, cleanupScanner]
  );

  // Handle camera selection change
  const handleCameraChange = useCallback(async (newCameraId: string) => {
    setSelectedCameraId(newCameraId);
    await stopScanner();
    
    // If permission was already granted, restart with new camera
    if (!needsUserGesture && isOpen && !manualMode) {
      // Wait for cleanup to complete
      await new Promise((resolve) => setTimeout(resolve, 300));
      pendingStartRef.current = true;
    }
  }, [stopScanner, needsUserGesture, isOpen, manualMode]);

  const requestStartFromUserGesture = useCallback(async () => {
    setError(null);

    try {
      // Only do preflight when switching from manual mode
      if (manualMode) {
        await preflightCameraPermission();
      }
      setNeedsUserGesture(false);
    } catch (err: any) {
      console.error('Camera permission preflight failed:', err);
      if (err?.name === 'NotAllowedError') {
        setError('נדרש אישור גישה למצלמה. בדוק שהדפדפן לא חסם את ההרשאה לאתר ונסה שוב.');
      } else if (err?.name === 'NotSupportedError') {
        setError('הדפדפן לא תומך בהפעלת מצלמה במכשיר הזה. נסה דפדפן אחר או עדכן גרסה.');
      } else {
        setError('לא ניתן לבקש הרשאת מצלמה. נסה לרענן את הדף ולנסות שוב.');
      }
      setNeedsUserGesture(true);
      return;
    }

    // If in manual mode, switch to camera UI first
    if (manualMode) {
      pendingStartRef.current = true;
      setManualMode(false);
      return;
    }

    // Camera UI is mounted, start scanner
    await startScanner(selectedCameraId ?? undefined);
  }, [manualMode, preflightCameraPermission, selectedCameraId, startScanner]);

  // Check permission on open
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    
    (async () => {
      try {
        const permissionsApi = (navigator as any).permissions;
        if (!permissionsApi?.query) return;
        const res = await permissionsApi.query({ name: 'camera' as any });
        if (res?.state === 'granted') {
          setNeedsUserGesture(false);
          // Only autostart if camera UI is visible and we're idle
          if (!manualMode && scannerStateRef.current === 'idle') {
            await startScanner(selectedCameraId ?? undefined);
          }
        } else {
          setNeedsUserGesture(true);
        }
      } catch {
        setNeedsUserGesture(true);
      }
    })();
  }, [isOpen, manualMode, selectedCameraId, startScanner]);

  // Handle pending start after mode switch
  useEffect(() => {
    if (!isOpen) return;
    if (manualMode) return;
    if (!pendingStartRef.current) return;
    
    pendingStartRef.current = false;

    if (!needsUserGesture && scannerStateRef.current === 'idle') {
      startScanner(selectedCameraId ?? undefined);
    }
  }, [isOpen, manualMode, needsUserGesture, selectedCameraId, startScanner]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      // Async cleanup on unmount
      cleanupScanner();
    };
  }, [cleanupScanner]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col safe-area-top safe-area-bottom">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-white">
          <Camera className="h-5 w-5" />
          <span className="font-medium">סרוק ברקוד</span>
        </div>
        <div className="flex items-center gap-1">
          <BarcodeScannerSettings
            cameras={cameras}
            selectedCameraId={selectedCameraId}
            onCameraSelect={handleCameraChange}
            isLoading={isStarting}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col" ref={containerRef}>
        {manualMode ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
            <p className="text-white text-center mb-2">הקלד את מספר הברקוד</p>
            <Input
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="לדוגמה: 7290000000000"
              className="text-center text-lg bg-white/10 border-white/30 text-white placeholder:text-white/50"
              autoFocus
              inputMode="numeric"
              onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
            />
            <Button onClick={handleManualSubmit} className="w-full" disabled={!manualInput.trim()}>
              אישור
            </Button>
            <Button
              variant="ghost"
              className="text-white/70"
              onClick={requestStartFromUserGesture}
            >
              חזור לסריקה
            </Button>
          </div>
        ) : (
          <>
            {/* Camera feed */}
            <div className="flex-1 relative bg-black">
              <div
                id="barcode-scanner-reader"
                className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
              />

              {/* User gesture gate */}
              {needsUserGesture && !isStarting && !isScanning && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center px-6">
                  <div className="w-full max-w-sm text-center text-white space-y-3">
                    <div className="text-lg font-semibold">כדי להפעיל מצלמה</div>
                    <div className="text-sm text-white/80 leading-relaxed">
                      לחץ על הכפתור למטה כדי לאשר הרשאת מצלמה בדפדפן.
                    </div>
                    <Button className="w-full" onClick={requestStartFromUserGesture}>
                      הפעל מצלמה
                    </Button>
                  </div>
                </div>
              )}

              {/* Scanning overlay */}
              {isScanning && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className={cn(
                      'relative border-2 border-primary rounded-xl overflow-hidden',
                      'w-[85%] max-w-[400px] h-[30%] min-h-[100px] max-h-[150px]'
                    )}
                  >
                    <div className="absolute inset-x-0 h-0.5 bg-primary animate-scan-line shadow-[0_0_12px_3px] shadow-primary/60" />
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-primary rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-primary rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-primary rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-primary rounded-br-lg" />
                  </div>
                </div>
              )}

              {/* Loading overlay */}
              {isStarting && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3 text-white">
                    <Loader2 className="h-10 w-10 animate-spin" />
                    <span>מאתחל מצלמה...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom controls */}
            <div className="p-4 bg-black/90 backdrop-blur-sm space-y-3">
              {error ? (
                <div className="text-center text-destructive text-sm bg-destructive/20 rounded-lg p-3">
                  {error}
                </div>
              ) : isScanning ? (
                <div className="text-center text-white/70 text-sm flex items-center justify-center gap-2">
                  <ScanLine className="h-4 w-4" />
                  <span>החזק יציב וקרוב לברקוד</span>
                </div>
              ) : needsUserGesture ? (
                <div className="text-center text-white/70 text-sm">
                  לחץ על "הפעל מצלמה" כדי לאשר הרשאה
                </div>
              ) : null}

              <div className="flex gap-3">
                {needsUserGesture && !isScanning && !isStarting ? (
                  <Button className="flex-1" onClick={requestStartFromUserGesture}>
                    <Camera className="h-4 w-4 ml-2" />
                    הפעל מצלמה
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={async () => {
                    await stopScanner();
                    setManualMode(true);
                  }}
                >
                  <Keyboard className="h-4 w-4 ml-2" />
                  הקלדה ידנית
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleClose}>
                  <X className="h-4 w-4 ml-2" />
                  ביטול
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
