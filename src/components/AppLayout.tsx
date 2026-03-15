import { ReactNode, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator';
import { ConnectionStatusProvider } from '@/hooks/useConnectionStatus';
import { useUSSimNotificationSync } from '@/hooks/useUSSimNotificationSync';
import { useKeyboardShortcuts, KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog';
import { GlobalSearch } from './GlobalSearch';
import { Smartphone, Search, RotateCw } from 'lucide-react';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { BiometricRegistrationBanner } from './BiometricRegistrationBanner';

interface AppLayoutProps {
  children: ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

const PAGE_LABELS: Record<string, string> = {
  '/':            'דאשבורד',
  '/pos':         'קופה',
  '/rentals':     'השכרות',
  '/customers':   'לקוחות',
  '/inventory':   'מלאי',
  '/repairs':     'תיקונים',
  '/cellstation': 'סימים אירופה',
  '/sims':        'סימים ארה"ב',
  '/payments':    'תשלומים',
  '/invoices':    'חשבוניות',
  '/users':       'ניהול משתמשים',
};

export function AppLayout({ children }: AppLayoutProps) {
  useUSSimNotificationSync();

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => window.location.reload(), 300);
  }, []);

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

  const location = useLocation();
  const pageLabel = PAGE_LABELS[location.pathname] ?? '';
  const sidebarWidth = isCollapsed ? 72 : 260;

  return (
    <ConnectionStatusProvider>
      <div className="min-h-screen bg-background">
        {/* Mobile Header */}
        <header
          className="lg:hidden fixed top-0 right-0 left-0 z-50 px-4 py-3 safe-area-top"
          style={{
            background: '#FFFFFF',
            borderBottom: '1px solid #E5E7EB',
            boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ConnectionStatusIndicator />
            </div>
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

        {/* Desktop: content area shifts right of sidebar */}
        <div
          className="hidden lg:flex flex-col min-h-screen transition-all duration-300 ease-in-out"
          style={{ marginRight: `${sidebarWidth}px` }}
        >
          {/* Sticky top header bar */}
          <header
            className="sticky top-0 z-30 flex items-center justify-between px-6 flex-shrink-0"
            style={{
              height: '56px',
              background: 'hsl(var(--card))',
              borderBottom: '1px solid hsl(var(--border))',
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            {/* Left side (RTL: actions on left) */}
            <div className="flex items-center gap-2">
              <ConnectionStatusIndicator />
              <button
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all duration-150"
                style={{
                  color: 'hsl(var(--muted-foreground))',
                  background: 'hsl(var(--muted))',
                  border: '1px solid hsl(var(--border))',
                }}
                onClick={() => setIsSearchOpen(true)}
                aria-label="חיפוש"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="text-xs hidden xl:inline">חיפוש... (Ctrl+K)</span>
              </button>
              <button
                onClick={handleRefresh}
                aria-label="רענן דף"
                title="רענן דף (F5)"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-150"
                style={{
                  color: 'hsl(var(--muted-foreground))',
                  background: 'hsl(var(--muted))',
                  border: '1px solid hsl(var(--border))',
                }}
              >
                <RotateCw
                  className="h-3.5 w-3.5"
                  style={{
                    transition: 'transform 0.4s ease',
                    transform: isRefreshing ? 'rotate(360deg)' : 'rotate(0deg)',
                  }}
                />
                <span className="text-xs">רענון</span>
              </button>
            </div>

            {/* Right side (RTL: page label on right) */}
            {pageLabel && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{pageLabel}</span>
              </div>
            )}
          </header>

          {/* Page content */}
          <main className="flex-1 p-6 lg:p-8">
            {children}
          </main>
        </div>

        {/* Mobile: simple full-width content (no top header overlap) */}
        <main className="lg:hidden min-h-screen p-4 pt-16 pb-20">
          {children}
        </main>

        <MobileBottomNav />
        <PWAInstallPrompt />
        <BiometricRegistrationBanner />

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
