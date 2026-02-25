import { Link, useLocation } from 'react-router-dom';
import { isBefore, parseISO } from 'date-fns';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useRental } from '@/hooks/useRental';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { usePermissions, PermissionKey } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  ShoppingCart, 
  Wrench,
  ChevronRight,
  Smartphone,
  LogOut,
  Shield,
  CreditCard,
  FileText,
  Store,
  Settings,
  Fingerprint,
  Signal,
  Globe,
} from 'lucide-react';
import { BiometricSettings } from '@/components/settings/BiometricSettings';
import { NotificationSettings } from '@/components/NotificationSettings';
import { LanguageSettings } from '@/components/settings/LanguageSettings';
import { BusinessSettings } from '@/components/settings/BusinessSettings';
import { ThemeSettings } from '@/components/settings/ThemeSettings';
import { APIKeysSettings } from '@/components/settings/APIKeysSettings';

const navItems = [
  { path: '/', label: 'דאשבורד', icon: LayoutDashboard, permission: 'view_dashboard' as PermissionKey },
  { path: '/pos', label: 'קופה', icon: Store, permission: 'view_pos' as PermissionKey },
  { path: '/rentals', label: 'השכרות', icon: ShoppingCart, permission: 'view_rentals' as PermissionKey },
  { path: '/customers', label: 'לקוחות', icon: Users, permission: 'view_customers' as PermissionKey },
  { path: '/inventory', label: 'מלאי', icon: Package, permission: 'view_inventory' as PermissionKey },
  
  { path: '/repairs', label: 'תיקונים', icon: Wrench, permission: 'view_repairs' as PermissionKey },
  { path: '/cellstation', label: 'סימים אירופה', icon: Signal, permission: 'view_sim_cards' as PermissionKey },
  { path: '/sims', label: 'סימים ארה"ב', icon: Globe, permission: 'view_inventory' as PermissionKey },
  { path: '/payments', label: 'תשלומים', icon: CreditCard, permission: 'view_payments' as PermissionKey },
  { path: '/invoices', label: 'חשבוניות', icon: FileText, permission: 'view_invoices' as PermissionKey },
];

const adminNavItems = [
  { path: '/users', label: 'ניהול משתמשים', icon: Shield },
];

interface AppSidebarProps {
  onNavigate?: () => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useRole();
  const { hasPermission } = usePermissions();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Live badge counts for desktop nav
  const { rentals, repairs } = useRental();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdueCount = rentals.filter(
    (r) => r.status === 'active' && isBefore(parseISO(r.endDate), today)
  ).length;
  const readyRepairsCount = repairs.filter((r) => r.status === 'ready').length;
  const navBadges: Record<string, { count: number; activeColor: string; inactiveColor: string }> = {
    '/rentals': { count: overdueCount, activeColor: 'bg-white/30 text-white', inactiveColor: 'bg-destructive text-white' },
    '/repairs': { count: readyRepairsCount, activeColor: 'bg-white/30 text-white', inactiveColor: 'bg-green-500 text-white' },
  };

  // Filter nav items by permission (admins see all)
  const visibleNavItems = navItems.filter(item => isAdmin || hasPermission(item.permission));

  return (
    <aside className="fixed right-0 top-0 z-40 h-screen w-64 glass-strong border-l border-white/20 shadow-[var(--shadow-glass)]">
      {/* Logo */}
      <div className="flex items-center gap-3 p-6 border-b border-white/10">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg">
          <Smartphone className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">ניהול השכרות</h1>
          <p className="text-xs text-muted-foreground">מערכת מקצועית</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1.5 p-4">
        {visibleNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300',
                'hover:bg-primary/10 hover:shadow-sm group',
                isActive
                  ? 'bg-gradient-to-l from-primary to-accent text-white shadow-md scale-[1.01]'
                  : ''
              )}
            >
              <Icon className={cn(
                'h-5 w-5 transition-all duration-300',
                isActive ? 'text-white' : 'text-muted-foreground group-hover:text-primary group-hover:scale-110'
              )} />
              <span className={cn(
                'font-semibold transition-colors duration-300',
                isActive ? 'text-white' : 'text-muted-foreground group-hover:text-foreground'
              )}>
                {item.label}
              </span>
              {navBadges[item.path]?.count > 0 && (
                <span className={`mr-auto text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                  isActive ? navBadges[item.path].activeColor : navBadges[item.path].inactiveColor
                }`}>
                  {navBadges[item.path].count}
                </span>
              )}
              {isActive && !navBadges[item.path]?.count && (
                <ChevronRight className="h-4 w-4 mr-auto text-white/80" />
              )}
            </Link>
          );
        })}

        {/* Admin Section */}
        {isAdmin && (
          <>
            <div className="my-2 px-4">
              <div className="h-px bg-white/20" />
              <p className="text-xs text-muted-foreground mt-2 mb-1">ניהול</p>
            </div>
            {adminNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300',
                    'hover:bg-primary/10 hover:shadow-sm group',
                    isActive
                      ? 'bg-gradient-to-l from-primary to-accent text-white shadow-md scale-[1.01]'
                      : ''
                  )}
                >
                  <Icon className={cn(
                    'h-5 w-5 transition-all duration-300',
                    isActive ? 'text-white' : 'text-muted-foreground group-hover:text-primary group-hover:scale-110'
                  )} />
                  <span className={cn(
                    'font-semibold transition-colors duration-300',
                    isActive ? 'text-white' : 'text-muted-foreground group-hover:text-foreground'
                  )}>
                    {item.label}
                  </span>
                  {isActive && (
                    <ChevronRight className="h-4 w-4 mr-auto text-white/80" />
                  )}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User & Settings */}
      <div className="absolute bottom-0 right-0 left-0 p-4 border-t border-white/10">
        <div className="rounded-xl glass-subtle p-3 mb-3">
          <p className="text-xs text-muted-foreground">מחובר כ:</p>
          <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-300"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings className="h-4 w-4" />
            הגדרות
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive/10 transition-all duration-300"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              הגדרות
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <BiometricSettings />
            <ThemeSettings />
            <LanguageSettings />
            <NotificationSettings />
            <BusinessSettings />
            <APIKeysSettings />
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
