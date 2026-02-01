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
  const hasStartedRef = useRef(false);
  const pendingStartRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current
        .stop()
        .catch(() => {})
        .finally(() => {
          scannerRef.current = null;
          hasStartedRef.current = false;
          setIsScanning(false);
          setManualMode(false);
          setManualInput('');
          setNeedsUserGesture(true);
          onClose();
        });
    } else {
      hasStartedRef.current = false;
      setIsScanning(false);
      setManualMode(false);
      setManualInput('');
      setNeedsUserGesture(true);
      onClose();
    }
  }, [onClose]);

  const handleManualSubmit = useCallback(() => {
    const trimmed = manualInput.trim();
    if (trimmed) {
      if (navigator.vibrate) navigator.vibrate(100);
      onScan(trimmed);
      handleClose();
    }
  }, [manualInput, onScan, handleClose]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    hasStartedRef.current = false;
    setIsScanning(false);
  }, []);

  // CRITICAL: Ask for camera permission directly from a user gesture.
  // Some browsers will block permission prompts if media capture is initiated from useEffect/setTimeout.
  const preflightCameraPermission = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      const err = new Error('NotSupportedError') as any;
      err.name = 'NotSupportedError';
      throw err;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      // Prefer back camera on mobile; some devices behave better when facingMode is provided.
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    // Stop immediately; we only needed the permission prompt in a gesture context.
    stream.getTracks().forEach((t) => t.stop());
  }, []);

  const startScanner = useCallback(async (cameraIdOverride?: string) => {
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

      // Use full container width for qrbox (larger = easier barcode capture)
      const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
      const qrboxWidth = Math.min(containerWidth - 48, 400);
      const qrboxHeight = Math.floor(qrboxWidth * 0.35);

      const onDecoded = (decodedText: string) => {
        if (navigator.vibrate) navigator.vibrate(100);
        onScan(decodedText);
        handleClose();
      };

      const onDecodeError = () => {};

      // Get available cameras and determine which to use
      let cameraList: CameraDevice[] = [];
      let preferredCameraId: string | undefined;
      
      try {
        cameraList = await Html5Qrcode.getCameras();
        setCameras(cameraList);
        
        // Use override, or stored preference, or auto-detect
        const storedId = getStoredCameraId();
        preferredCameraId = cameraIdOverride || pickPreferredCameraId(cameraList, storedId);
        
        if (preferredCameraId) {
          setSelectedCameraId(preferredCameraId);
        }
      } catch {}

      try {
        const scanConfig = buildBarcodeScannerConfig({ qrboxWidth, qrboxHeight });

        // Attempt 1: primary constraints (may include deviceId exact)
        try {
          const constraints = buildBarcodeVideoConstraints(preferredCameraId, 'primary');
          await scannerRef.current.start(
            constraints as any,
            scanConfig as any,
            onDecoded,
            onDecodeError
          );
        } catch (err1: any) {
          console.warn('Primary camera constraints failed, retrying with fallback:', err1);

          // Attempt 2: fallback constraints (still may include deviceId exact)
          try {
            const fallbackConstraints = buildBarcodeVideoConstraints(preferredCameraId, 'fallback');
            await scannerRef.current.start(
              fallbackConstraints as any,
              scanConfig as any,
              onDecoded,
              onDecodeError
            );
          } catch (err2: any) {
            // Some Android devices reject deviceId constraints even when permission is granted.
            // Attempt 3: try again WITHOUT deviceId (use facingMode instead).
            if (preferredCameraId) {
              console.warn('Fallback with deviceId failed, retrying without deviceId:', err2);
              const noDeviceIdConstraints = buildBarcodeVideoConstraints(undefined, 'fallback');
              await scannerRef.current.start(
                noDeviceIdConstraints as any,
                scanConfig as any,
                onDecoded,
                onDecodeError
              );
            } else {
              throw err2;
            }
          }
        }
      } catch (err: any) {
        throw err;
      }

      setIsStarting(false);
      setIsScanning(true);
    } catch (err: any) {
      // Log full error details for debugging
      console.error('Failed to start scanner:', err);
      console.error('Error details:', {
        name: err?.name,
        message: err?.message,
        constraint: err?.constraint,
        stack: err?.stack?.slice?.(0, 500),
      });

      const errName = err?.name ? String(err.name) : 'UnknownError';
      const errMsg = err?.message ? String(err.message) : '';
      const errConstraint = err?.constraint ? ` (constraint: ${err.constraint})` : '';
      const fullErrorCode = `${errName}${errConstraint}${errMsg ? ` - ${errMsg.slice(0, 80)}` : ''}`;

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
        setError(`הדפדפן לא תומך בהפעלת מצלמה בצורה הזו. נסה דפדפן אחר או עדכן גרסה.\nקוד שגיאה: ${fullErrorCode}`);
      } else {
        setError(`לא ניתן להפעיל את המצלמה. וודא שנתת הרשאות גישה.\nקוד שגיאה: ${fullErrorCode}`);
      }
      setIsStarting(false);
      hasStartedRef.current = false;
      setNeedsUserGesture(true);
    }
  }, [handleClose, onScan]);

  // Handle camera selection change
  const handleCameraChange = useCallback(async (newCameraId: string) => {
    setSelectedCameraId(newCameraId);
    await stopScanner();
    // If permission was already granted and user is scanning, restart immediately.
    if (!needsUserGesture && isOpen && !manualMode) {
      pendingStartRef.current = true;
    }
  }, [stopScanner, needsUserGesture, isOpen, manualMode]);

  const requestStartFromUserGesture = useCallback(async () => {
    setError(null);

    try {
      await preflightCameraPermission();
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

    // If we're in manual mode, render the camera UI first, then start.
    if (manualMode) {
      pendingStartRef.current = true;
      setManualMode(false);
      return;
    }

    // Camera UI is already mounted → start immediately.
    startScanner(selectedCameraId ?? undefined);
  }, [manualMode, preflightCameraPermission, selectedCameraId, startScanner]);

  // When opening, if permission already granted, we can autostart safely.
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    // Keep manualMode as-is; don't force switching user flow.
    (async () => {
      try {
        const permissionsApi = (navigator as any).permissions;
        if (!permissionsApi?.query) return;
        const res = await permissionsApi.query({ name: 'camera' as any });
        if (res?.state === 'granted') {
          setNeedsUserGesture(false);
          // Only autostart if camera UI is visible.
          if (!manualMode && !hasStartedRef.current) {
            startScanner(selectedCameraId ?? undefined);
          }
        } else {
          setNeedsUserGesture(true);
        }
      } catch {
        // If we can't detect, fall back to requiring a user gesture.
        setNeedsUserGesture(true);
      }
    })();
  }, [isOpen, manualMode, selectedCameraId, startScanner]);

  // Start after manual mode switch when the UI is mounted.
  useEffect(() => {
    if (!isOpen) return;
    if (manualMode) return;
    if (!pendingStartRef.current) return;
    pendingStartRef.current = false;

    if (!needsUserGesture && !hasStartedRef.current) {
      startScanner(selectedCameraId ?? undefined);
    }
  }, [isOpen, manualMode, needsUserGesture, selectedCameraId, startScanner]);

  // Cleanup on unmount / close
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []);

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

              {/* User gesture gate (permission prompt) */}
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
                  לחץ על “הפעל מצלמה” כדי לאשר הרשאה
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
                  onClick={() => {
                    if (scannerRef.current) {
                      scannerRef.current.stop().catch(() => {});
                      scannerRef.current = null;
                      hasStartedRef.current = false;
                      setIsScanning(false);
                    }
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
