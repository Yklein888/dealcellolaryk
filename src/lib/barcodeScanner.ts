export type CameraDevice = { id: string; label: string };

export function pickPreferredCameraId(cameras: CameraDevice[]) {
  const label = (s: string) => (s || "").toLowerCase();
  const preferred = cameras.find((c) => /(back|rear|environment|facing back|camera 0|אחור)/.test(label(c.label)));
  return (preferred ?? cameras[cameras.length - 1])?.id;
}

export function buildBarcodeScannerConfig(opts: { qrboxWidth: number; qrboxHeight: number }) {
  return {
    // Lower FPS tends to help autofocus stability and reduces CPU load.
    fps: 12,
    qrbox: { width: opts.qrboxWidth, height: opts.qrboxHeight },
    aspectRatio: 16 / 9,
    disableFlip: true,
    // Use native BarcodeDetector (Chrome/Android) when available for better barcode performance.
    experimentalFeatures: {
      useBarCodeDetectorIfSupported: true,
    },
  };
}

export function buildBarcodeVideoConstraints(
  preferredCameraId?: string,
  mode: "primary" | "fallback" = "primary"
): MediaTrackConstraints {
  const base: MediaTrackConstraints = {
    ...(preferredCameraId
      ? { deviceId: { exact: preferredCameraId } }
      : { facingMode: { ideal: "environment" } }),
    // 1080p often looks "sharp" but can hurt autofocus on some Android devices.
    // 720p is usually the sweet spot for barcode scanning.
    width: mode === "primary" ? { ideal: 1280, min: 960 } : { ideal: 1280 },
    height: mode === "primary" ? { ideal: 720, min: 540 } : { ideal: 720 },
    frameRate: mode === "primary" ? { ideal: 30, min: 15 } : { ideal: 24, min: 12 },
  };

  if (mode === "primary") {
    // These are supported on many Android Chrome devices but not all.
    // If the browser rejects them, we retry with a fallback config.
    (base as any).advanced = [
      { focusMode: "continuous" } as any,
      { exposureMode: "continuous" } as any,
      { whiteBalanceMode: "continuous" } as any,
      // Some devices benefit from a small zoom for barcodes.
      { zoom: 2 } as any,
    ];
  }

  return base;
}
