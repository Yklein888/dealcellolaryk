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
  // Serialize start/stop operations to avoid html5-qrcode "already under transition" race
  const opQueueRef = useRef<Promise<void>>(Promise.resolve());

  const runExclusive = useCallback(async (fn: () => Promise<void>) => {
    const run = opQueueRef.current.then(fn, fn);
    // Keep queue always-resolving so one failure doesn't block subsequent operations
    opQueueRef.current = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }, []);

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
    return runExclusive(async () => {
      console.log('cleanupScanner called, current state:', scannerStateRef.current);

      // If already stopping, don't double-stop (but still allow cleanup calls while idle)
      if (scannerStateRef.current === 'stopping') {
        console.log('Scanner already stopping, skipping cleanup');
        return;
      }

      scannerStateRef.current = 'stopping';

      try {
        // Stop Html5Qrcode if exists
        if (scannerRef.current) {
          const instance = scannerRef.current;
          try {
            const state = instance.getState?.();
            console.log('Scanner getState:', state);
            // state 2 = SCANNING in html5-qrcode
            if (state === 2) {
              await instance.stop();
            } else {
              // Some implementations throw if stop() called when not running
              await (instance as any).stop?.();
            }
          } catch (stopErr) {
            console.warn('Error stopping Html5Qrcode:', stopErr);
          }
          try {
            await (instance as any).clear?.();
          } catch (clearErr) {
            // clear() is not typed in all versions
            console.warn('Error clearing Html5Qrcode:', clearErr);
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

        // Clear the reader container to remove stale DOM/video nodes
        const reader = document.getElementById('barcode-scanner-reader');
        if (reader) reader.innerHTML = '';
      } catch (err) {
        console.warn('Cleanup error:', err);
      } finally {
        scannerStateRef.current = 'idle';
        console.log('Scanner cleanup complete, state now idle');
      }
    });
  }, [runExclusive, stopAllTracks]);

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
      return runExclusive(async () => {
        console.log('startScanner called, current state:', scannerStateRef.current);

        // 1) Lifecycle Management: Prevent start() during initializing/running/stopping
        if (scannerStateRef.current !== 'idle') {
          console.log('Scanner not idle, aborting start. State:', scannerStateRef.current);
          return;
        }

        scannerStateRef.current = 'initializing';
        setIsStarting(true);
        setError(null);

        // 3) Delay: ensure DOM / previous instances fully cleared
        await new Promise((resolve) => setTimeout(resolve, 300));

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

        const makeInstance = () =>
          new Html5Qrcode(scannerId, {
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
          if (preferredCameraId) setSelectedCameraId(preferredCameraId);
        } catch (camErr) {
          console.warn('Could not enumerate cameras:', camErr);
        }

        const scanConfig = buildBarcodeScannerConfig({ qrboxWidth, qrboxHeight });

        // Ensure we never re-use a potentially half-transitioned instance.
        const disposeInstance = async (instance: Html5Qrcode | null) => {
          if (!instance) return;
          try {
            const state = instance.getState?.();
            if (state === 2) {
              await instance.stop();
            } else {
              await (instance as any).stop?.();
            }
          } catch {}
          try {
            await (instance as any).clear?.();
          } catch {}
        };

        let lastErr: any = null;
        const attemptStartFresh = async (constraints: MediaTrackConstraints, label: string) => {
          try {
            // Hard reset between attempts
            await disposeInstance(scannerRef.current);
            scannerRef.current = null;
            stopAllTracks(activeStreamRef.current);
            activeStreamRef.current = null;

            const reader = document.getElementById(scannerId);
            if (reader) reader.innerHTML = '';
            document.querySelectorAll('#barcode-scanner-reader video').forEach((v) => {
              const ve = v as HTMLVideoElement;
              if (ve.srcObject) {
                stopAllTracks(ve.srcObject as MediaStream);
                ve.srcObject = null;
              }
            });

            await new Promise((r) => setTimeout(r, 250));

            console.log(`Attempting start with ${label}:`, constraints);
            scannerRef.current = makeInstance();
            await scannerRef.current.start(
              constraints as any,
              scanConfig as any,
              onDecoded,
              onDecodeError
            );

            // After successful start, grab active stream and apply optimizations
            try {
              const videoElement = document.querySelector(
                '#barcode-scanner-reader video'
              ) as HTMLVideoElement;
              if (videoElement?.srcObject) {
                const stream = videoElement.srcObject as MediaStream;
                activeStreamRef.current = stream;
                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack) await applyTrackOptimizations(videoTrack);
              }
            } catch (optErr) {
              console.warn('Could not apply optimizations:', optErr);
            }

            return true;
          } catch (err) {
            lastErr = err;
            console.warn(`${label} failed:`, err);
            return false;
          }
        };

        try {
          // Attempts: strict -> relaxed
          let started = await attemptStartFresh(
            buildBarcodeVideoConstraints(preferredCameraId, 'primary'),
            'Primary with deviceId'
          );

          if (!started && preferredCameraId) {
            started = await attemptStartFresh(
              buildBarcodeVideoConstraints(preferredCameraId, 'fallback'),
              'Fallback with deviceId'
            );
          }

          if (!started) {
            started = await attemptStartFresh(
              buildBarcodeVideoConstraints(undefined, 'primary'),
              'Primary without deviceId'
            );
          }

          if (!started) {
            started = await attemptStartFresh(
              buildBarcodeVideoConstraints(undefined, 'fallback'),
              'Fallback without deviceId'
            );
          }

          if (!started) {
            started = await attemptStartFresh({ facingMode: { ideal: 'environment' } }, 'Minimal constraints');
          }

          if (!started) {
            // Surface the real underlying error instead of the generic wrapper
            throw lastErr ?? new Error('All camera start attempts failed');
          }

          if (mountedRef.current) {
            setIsStarting(false);
            setIsScanning(true);
            scannerStateRef.current = 'running';
          }
        } catch (err: any) {
          console.error('Failed to start scanner:', err);

          const fullErrorCode = formatCameraErrorCode(err);

          if (err?.name === 'NotAllowedError') {
            setError(
              'נדרשת הרשאת גישה למצלמה. אם כבר אישרת ועדיין יש שגיאה, בדוק גם בהרשאות המערכת: הגדרות אנדרואיד → אפליקציות → Chrome → הרשאות → מצלמה → אפשר.\n' +
                `קוד שגיאה: ${fullErrorCode}`
            );
          } else if (err?.name === 'NotFoundError') {
            setError(`לא נמצאה מצלמה במכשיר זה.\nקוד שגיאה: ${fullErrorCode}`);
          } else if (err?.name === 'OverconstrainedError') {
            setError(
              'הגדרות המצלמה לא נתמכות במצלמה שנבחרה. נסה לבחור מצלמה אחרת (⚙️) או נסה שוב.\n' +
                `קוד שגיאה: ${fullErrorCode}`
            );
          } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
            setError(
              'המצלמה תפוסה/לא זמינה כרגע. סגור אפליקציות שמשתמשות במצלמה (WhatsApp/Instagram/מצלמה) ונסה שוב.\n' +
                `קוד שגיאה: ${fullErrorCode}`
            );
          } else if (err?.name === 'NotSupportedError') {
            setError(
              `הדפדפן לא תומך בהפעלת מצלמה בצורה הזו. נסה דפדפן אחר או עדכן גרסה.\nקוד שגיאה: ${fullErrorCode}`
            );
          } else {
            setError(`לא ניתן להפעיל את המצלמה. וודא שנתת הרשאות גישה.\nקוד שגיאה: ${fullErrorCode}`);
          }

          await cleanupScanner();

          if (mountedRef.current) {
            setIsStarting(false);
            setNeedsUserGesture(true);
          }
        }
      });
    },
    [cleanupScanner, formatCameraErrorCode, handleClose, onScan, runExclusive, stopAllTracks]
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
