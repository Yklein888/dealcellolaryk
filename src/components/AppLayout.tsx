import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator';
import { ConnectionStatusProvider } from '@/hooks/useConnectionStatus';
import { Smartphone } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <ConnectionStatusProvider>
      <div className="min-h-screen bg-background">
        {/* Mobile Header - Simplified */}
        <header className="lg:hidden fixed top-0 right-0 left-0 z-50 glass-strong border-b border-white/20 px-4 py-3 safe-area-top">
          <div className="flex items-center justify-between">
            <ConnectionStatusIndicator />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
                <Smartphone className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-lg font-bold gradient-text">ניהול השכרות</h1>
            </div>
            <div className="w-10" /> {/* Spacer for centering */}
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

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />
      </div>
    </ConnectionStatusProvider>
  );
}
