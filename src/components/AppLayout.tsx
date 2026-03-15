import { ReactNode, useState, useEffect, useCallback } from 'react';
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

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

export function AppLayout({ children }: AppLayoutProps) {
  useUSSimNotificationSync();

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Sidebar collapse state, persisted to localStorage
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
    } catch {
      // localStorage not available
    }
  }, [isCollapsed]);

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const shortcuts: KeyboardShortcut[] = [
    { keys: ['Control', 'k'], description: 'חיפוש גלובלי', action: () => setIsSearchOpen(true) },
    { keys: ['?'], description: 'עזרה ושוורטקטים', action: () => setIsHelpOpen(true) },
    {
      keys: ['Escape'],
      description: 'סגור',
      action: () => {
        setIsHelpOpen(false);
        setIsSearchOpen(false);
      },
    },
  ];

  useKeyboardShortcuts(shortcuts);

  const sidebarWidth = isCollapsed ? 68 : 256;

  return (
    <ConnectionStatusProvider>
      <div className="min-h-screen bg-background">
        {/* Mobile Header */}
        <header
          className="lg:hidden fixed top-0 right-0 left-0 z-50 px-4 py-3 safe-area-top"
          style={{
            background: 'hsl(var(--card) / 0.97)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid hsl(var(--border))',
          }}
        >
          <div className="flex items-center justify-between">
            <ConnectionStatusIndicator />
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
                  boxShadow: 'var(--shadow-brand)',
                }}
              >
                <Smartphone className="h-4 w-4 text-white" />
              </div>
              <h1
                className="text-base font-semibold text-foreground"
                style={{ letterSpacing: '-0.01em' }}
              >
                DealCell
              </h1>
            </div>
            <div className="w-10" />
          </div>
        </header>

        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <AppSidebar
            isCollapsed={isCollapsed}
            onToggleCollapse={handleToggleCollapse}
          />
        </div>

        {/* Main Content — shifts based on sidebar width */}
        <main
          className="min-h-screen p-4 pt-16 pb-20 lg:pt-8 lg:pb-8 lg:p-8 transition-all duration-300 ease-in-out"
          style={{ marginRight: `${sidebarWidth}px` }}
          // On mobile, no sidebar so override the margin
        >
          <style>{`
            @media (max-width: 1023px) {
              main { margin-right: 0 !important; }
            }
          `}</style>
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
