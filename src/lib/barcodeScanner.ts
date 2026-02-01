export type CameraDevice = { id: string; label: string };

export function pickPreferredCameraId(
  cameras: CameraDevice[],
  storedCameraId?: string | null
): string | undefined {
  // If user has a stored preference that exists in current camera list, use it
  if (storedCameraId && cameras.some((c) => c.id === storedCameraId)) {
    return storedCameraId;
  }
  
  const label = (s: string) => (s || "").toLowerCase();
  // Prefer back/rear/environment camera
  const preferred = cameras.find((c) =>
    /(back|rear|environment|facing back|camera 0|אחור)/.test(label(c.label))
  );
  return (preferred ?? cameras[cameras.length - 1])?.id;
}

export function buildBarcodeScannerConfig(opts: { qrboxWidth: number; qrboxHeight: number }) {
  return {
    // Lower FPS to prioritize resolution and focus quality over frame rate
    fps: 10,
    qrbox: { width: opts.qrboxWidth, height: opts.qrboxHeight },
    aspectRatio: 16 / 9,
    disableFlip: true,
    // Use native BarcodeDetector (Chrome/Android) when available for better performance
    experimentalFeatures: {
      useBarCodeDetectorIfSupported: true,
    },
  };
}

export function buildBarcodeVideoConstraints(
  preferredCameraId?: string,
  mode: "primary" | "fallback" = "primary"
): MediaTrackConstraints {
  // Conservative constraints (more compatible on Android/Chrome).
  // We intentionally avoid advanced constraints here because some devices throw
  // "Cannot transition to a new state, already under transition" under rapid start/stop.
  const base: MediaTrackConstraints = {
    // Resolution: start from 720p (stable); fallback to 480p for problematic devices
    width: mode === "primary" ? { ideal: 1280 } : { ideal: 640 },
    height: mode === "primary" ? { ideal: 720 } : { ideal: 480 },
    frameRate: { ideal: 24, max: 30 },
  };

  if (preferredCameraId) {
    // Use ideal (not exact) to avoid Overconstrained on some Android devices
    base.deviceId = { ideal: preferredCameraId };
  } else {
    base.facingMode = { ideal: "environment" };
  }

  return base;
}

// Helper to apply post-start track optimizations if available
export async function applyTrackOptimizations(videoTrack: MediaStreamTrack) {
  try {
    // Use 'any' to access non-standard but widely supported properties
    const capabilities = videoTrack.getCapabilities?.() as any;
    const settings: Record<string, any> = {};
    
    // Keep this conservative too (some devices are sensitive to applyConstraints)
    if (capabilities?.focusMode?.includes("continuous")) settings.focusMode = "continuous";
    
    if (Object.keys(settings).length > 0) {
      await videoTrack.applyConstraints(settings);
      console.log("Applied track optimizations:", settings);
    }
  } catch (err) {
    console.warn("Could not apply track optimizations:", err);
  }
}
