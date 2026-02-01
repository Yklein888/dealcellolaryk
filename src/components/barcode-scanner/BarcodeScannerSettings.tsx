import { useState, useEffect } from 'react';
import { Settings, Camera, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface CameraDevice {
  id: string;
  label: string;
}

interface BarcodeScannerSettingsProps {
  cameras: CameraDevice[];
  selectedCameraId: string | null;
  onCameraSelect: (cameraId: string) => void;
  isLoading?: boolean;
}

const CAMERA_STORAGE_KEY = 'barcode-scanner-preferred-camera';

export function getStoredCameraId(): string | null {
  try {
    return localStorage.getItem(CAMERA_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredCameraId(cameraId: string): void {
  try {
    localStorage.setItem(CAMERA_STORAGE_KEY, cameraId);
  } catch {
    // Ignore storage errors
  }
}

export function BarcodeScannerSettings({
  cameras,
  selectedCameraId,
  onCameraSelect,
  isLoading = false,
}: BarcodeScannerSettingsProps) {
  const [open, setOpen] = useState(false);

  const handleCameraSelect = (cameraId: string) => {
    setStoredCameraId(cameraId);
    onCameraSelect(cameraId);
    setOpen(false);
  };

  // Format camera label for display
  const formatCameraLabel = (label: string, index: number): string => {
    if (!label || label === '') {
      return `מצלמה ${index + 1}`;
    }
    // Shorten long labels
    if (label.length > 30) {
      return label.substring(0, 27) + '...';
    }
    return label;
  };

  // Get short camera type hint
  const getCameraHint = (label: string): string | null => {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('wide') || lowerLabel.includes('ultra')) {
      return 'רחב';
    }
    if (lowerLabel.includes('tele') || lowerLabel.includes('zoom')) {
      return 'טלה';
    }
    if (lowerLabel.includes('macro')) {
      return 'מאקרו';
    }
    if (lowerLabel.includes('front') || lowerLabel.includes('selfie')) {
      return 'קדמית';
    }
    if (lowerLabel.includes('back') || lowerLabel.includes('rear')) {
      return 'אחורית';
    }
    return null;
  };

  if (cameras.length <= 1) {
    return null; // No need for settings if only one camera
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-white/80 hover:text-white hover:bg-white/20"
          disabled={isLoading}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-2 bg-background/95 backdrop-blur-sm"
        align="end"
        sideOffset={8}
      >
        <div className="space-y-2">
          <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Camera className="h-4 w-4" />
            בחר מצלמה
          </div>
          <div className="space-y-1">
            {cameras.map((camera, index) => {
              const isSelected = camera.id === selectedCameraId;
              const hint = getCameraHint(camera.label);
              
              return (
                <button
                  key={camera.id}
                  onClick={() => handleCameraSelect(camera.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors text-right",
                    isSelected
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                    isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                  )}>
                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <div className="flex-1 text-right">
                    <div className="font-medium">
                      {formatCameraLabel(camera.label, index)}
                    </div>
                    {hint && (
                      <div className="text-xs text-muted-foreground">
                        {hint}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="px-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              הבחירה תישמר לשימוש עתידי
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
