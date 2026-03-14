import { ReactNode, useState, useCallback } from 'react';
import { AppSidebar } from './AppSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator';
import { ConnectionStatusProvider } from '@/hooks/useConnectionStatus';
import { useUSSimNotificationSync } from '@/hooks/useUSSimNotificationSync';
import { useKeyboardShortcuts, KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog';
import { GlobalSearch } from './GlobalSearch';
import { Smartphone } from 'lucide-react';
import { PWAInstallPrompt } from './PWAInstallPrompt';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  useUSSimNotificationSync();

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const shortcuts: KeyboardShortcut[] = [
    { keys: ['Control', 'k'], description: 'חיפוש גלובלי', action: () => setIsSearchOpen(true) },
    { keys: ['?'], description: 'עזרה ושוורטקטים', action: () => setIsHelpOpen(true) },
    { keys: ['Escape'], description: 'סגור', action: () => { setIsHelpOpen(false); setIsSearchOpen(false); } },
  ];

  useKeyboardShortcuts(shortcuts);

  return (
    <ConnectionStatusProvider>
      <div
        className="min-h-screen"
        style={{ background: 'hsl(228 15% 5%)' }}
      >
        {/* Mobile Header */}
        <header
          className="lg:hidden fixed top-0 right-0 left-0 z-50 px-4 py-3 safe-area-top"
          style={{
            background: 'hsl(230 14% 7% / 0.97)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid hsl(230 14% 11%)',
          }}
        >
          <div className="flex items-center justify-between">
            <ConnectionStatusIndicator />
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, hsl(252 85% 68%), hsl(268 80% 72%))',
                  boxShadow: '0 2px 10px rgba(124,109,250,0.3)',
                }}
              >
                <Smartphone className="h-4 w-4 text-white" />
              </div>
              <h1
                className="text-base font-semibold bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(135deg, hsl(252 85% 78%), hsl(268 80% 82%))', letterSpacing: '-0.01em' }}
              >
                DealCell
              </h1>
            </div>
            <div className="w-10" />
          </div>
        </header>

        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <AppSidebar />
        </div>

        {/* Main Content */}
        <main className="lg:mr-64 min-h-screen p-4 pt-16 pb-20 lg:pt-8 lg:pb-8 lg:p-8">
          {children}
        </main>

        <MobileBottomNav />
        <PWAInstallPrompt />

        <KeyboardShortcutsDialog
          open={isHelpOpen}
          onOpenChange={setIsHelpOpen}
          shortcuts={[
            { keys: ['Control', 'k'], description: 'חיפוש גלובלי' },
            { keys: ['Escape'], description: 'סגור דיאלוג' },
            { keys: ['?'], description: 'הצג עזרה זו' },
          ]}
        />

        <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      </div>
    </ConnectionStatusProvider>
  );
}
