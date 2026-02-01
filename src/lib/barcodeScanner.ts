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
  // Primary mode: Request high resolution (1080p) with advanced focus constraints
  // Fallback mode: More conservative 720p if device rejects primary
  
  // NOTE:
  // - Avoid strict constraints (`exact`/`min`) because many Android devices reject them.
  // - If a specific cameraId is provided, prefer `deviceId` and avoid adding `facingMode`
  //   (some browsers treat the combination as overconstrained).
  const base: MediaTrackConstraints = {
    // Resolution: prioritize 1080p for clarity, fallback to 720p
    width: mode === "primary" ? { ideal: 1920 } : { ideal: 1280 },
    height: mode === "primary" ? { ideal: 1080 } : { ideal: 720 },

    // Lower frame rate to give camera more time for focus and exposure
    frameRate: mode === "primary" ? { ideal: 15, max: 20 } : { ideal: 24, max: 30 },
  };

  if (preferredCameraId) {
    base.deviceId = { exact: preferredCameraId };
  } else {
    base.facingMode = { ideal: "environment" };
  }

  if (mode === "primary") {
    // Advanced constraints for better barcode scanning
    // These are critical for focus and image quality
    (base as any).advanced = [
      // Continuous autofocus is critical for barcode scanning
      { focusMode: "continuous" } as any,
      // Continuous exposure helps with varying lighting
      { exposureMode: "continuous" } as any,
      // Auto white balance
      { whiteBalanceMode: "continuous" } as any,
      // Slight zoom helps camera focus on barcode without getting too close
      { zoom: 1.5 } as any,
    ];
  }

  return base;
}

// Helper to apply post-start track optimizations if available
export async function applyTrackOptimizations(videoTrack: MediaStreamTrack) {
  try {
    // Use 'any' to access non-standard but widely supported properties
    const capabilities = videoTrack.getCapabilities?.() as any;
    const settings: Record<string, any> = {};
    
    // Apply continuous focus if supported
    if (capabilities?.focusMode?.includes("continuous")) {
      settings.focusMode = "continuous";
    }
    
    // Apply continuous exposure if supported
    if (capabilities?.exposureMode?.includes("continuous")) {
      settings.exposureMode = "continuous";
    }
    
    // Apply zoom if supported (1.5x is good for barcodes)
    if (capabilities?.zoom) {
      const minZoom = capabilities.zoom.min || 1;
      const maxZoom = capabilities.zoom.max || 1;
      const targetZoom = Math.min(Math.max(1.5, minZoom), maxZoom);
      settings.zoom = targetZoom;
    }

    // Apply higher contrast if supported (helps barcode edges on some devices)
    if (capabilities?.contrast) {
      const minC = capabilities.contrast.min ?? 0;
      const maxC = capabilities.contrast.max ?? minC;
      // Prefer higher contrast, but don't assume a specific scale
      settings.contrast = maxC;
    }
    
    if (Object.keys(settings).length > 0) {
      await videoTrack.applyConstraints(settings);
      console.log("Applied track optimizations:", settings);
    }
  } catch (err) {
    console.warn("Could not apply track optimizations:", err);
  }
}
