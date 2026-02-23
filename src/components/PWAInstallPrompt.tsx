import { useState, useEffect } from 'react';
import { X, Smartphone, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Don't show if already in standalone mode (installed as PWA)
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if ((window.navigator as Navigator & { standalone?: boolean }).standalone) return;

    // Check if dismissed recently
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_DURATION) return;

    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
    setIsIOS(ios);

    if (ios) {
      // iOS doesn't support beforeinstallprompt — show manual instructions after 3s
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }

    // Chrome/Android — listen for the install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 2000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    setIsInstalling(true);
    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        dismiss();
      }
    } finally {
      setIsInstalling(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="lg:hidden fixed bottom-16 left-2 right-2 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-sm shadow-xl p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-md">
            <Smartphone className="h-5 w-5 text-white" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground text-sm">הוסף לדף הבית</p>
            {isIOS ? (
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                לחץ על{' '}
                <Share className="inline h-3 w-3 mx-0.5" />
                {' '}ואחר כך "הוסף למסך הבית"
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">
                גישה מהירה ישירות מהמסך הראשי
              </p>
            )}
          </div>

          {/* Dismiss */}
          <button
            onClick={dismiss}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Action buttons */}
        {!isIOS && installPrompt && (
          <div className="flex gap-2 mt-3">
            <Button
              variant="glow"
              size="sm"
              className="flex-1"
              onClick={handleInstall}
              disabled={isInstalling}
            >
              {isInstalling ? 'מתקין...' : 'הוסף עכשיו'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={dismiss}
              className="text-muted-foreground"
            >
              אחר כך
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
