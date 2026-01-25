import { ReactNode, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { Menu, X } from 'lucide-react';
import { Button } from './ui/button';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 right-0 left-0 z-50 bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center justify-between">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
        <h1 className="text-lg font-bold text-foreground">ניהול השכרות</h1>
        <div className="w-10" /> {/* Spacer for centering */}
      </header>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile, visible on desktop */}
      <div className={`
        lg:block
        ${isMobileMenuOpen ? 'block' : 'hidden'}
      `}>
        <AppSidebar onNavigate={() => setIsMobileMenuOpen(false)} />
      </div>

      {/* Main Content */}
      <main className="lg:mr-64 min-h-screen p-4 pt-20 lg:pt-8 lg:p-8">
        {children}
      </main>
    </div>
  );
}
