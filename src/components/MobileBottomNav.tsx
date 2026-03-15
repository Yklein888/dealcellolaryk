import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  MoreHorizontal,
  Store,
  Signal,
  Globe,
} from 'lucide-react';
import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Wrench, CreditCard, FileText, Shield, LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BiometricSettings } from '@/components/settings/BiometricSettings';
import { NotificationSettings } from '@/components/NotificationSettings';
import { LanguageSettings } from '@/components/settings/LanguageSettings';
import { BusinessSettings } from '@/components/settings/BusinessSettings';
import { ThemeSettings } from '@/components/settings/ThemeSettings';
import { APIKeysSettings } from '@/components/settings/APIKeysSettings';

const mainNavItems = [
  { path: '/', label: 'ראשי', icon: LayoutDashboard, permission: 'view_dashboard' as const },
  { path: '/rentals', label: 'השכרות', icon: ShoppingCart, permission: 'view_rentals' as const },
  { path: '/customers', label: 'לקוחות', icon: Users, permission: 'view_customers' as const },
];

const moreNavItems = [
  { path: '/inventory', label: 'מלאי', icon: Package, permission: 'view_inventory' as const },
  { path: '/cellstation', label: 'סימים אירופה', icon: Signal, permission: 'view_sim_cards' as const },
  { path: '/sims', label: 'סימים ארה"ב 🇺🇸', icon: Globe, permission: 'view_inventory' as const },
  { path: '/repairs', label: 'תיקונים', icon: Wrench, permission: 'view_repairs' as const },
  { path: '/payments', label: 'תשלומים', icon: CreditCard, permission: 'view_payments' as const },
  { path: '/invoices', label: 'חשבוניות', icon: FileText, permission: 'view_invoices' as const },
];

const adminNavItems = [
  { path: '/users', label: 'ניהול משתמשים', icon: Shield },
];

export function MobileBottomNav() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useRole();
  const { hasPermission } = usePermissions();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const visibleMainItems = mainNavItems.filter((item) => isAdmin || hasPermission(item.permission));
  const visibleMoreItems = moreNavItems.filter((item) => isAdmin || hasPermission(item.permission));
  const isMoreActive = [...moreNavItems, ...adminNavItems].some((item) => isActive(item.path));

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom"
      style={{
        background: 'hsl(var(--card) / 0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid hsl(var(--border))',
      }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {/* Main nav items */}
        {visibleMainItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-xl transition-all duration-150 relative"
            >
              <div
                className={cn(
                  'flex items-center justify-center rounded-xl transition-all duration-150',
                  active ? 'w-10 h-7' : 'w-10 h-7'
                )}
                style={
                  active
                    ? {
                        background: 'var(--brand-alpha-20)',
                      }
                    : {}
                }
              >
                <Icon
                  className={cn(
                    'h-5 w-5 transition-colors duration-150',
                    active ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-[10px] font-semibold leading-tight mt-0.5 transition-colors duration-150',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Settings Button */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-xl transition-all duration-150"
        >
          <div className="flex items-center justify-center w-10 h-7">
            <Settings className="h-5 w-5 text-muted-foreground" />
          </div>
          <span className="text-[10px] font-semibold leading-tight mt-0.5 text-muted-foreground">
            הגדרות
          </span>
        </button>

        {/* More Menu */}
        <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-xl transition-all duration-150">
              <div
                className="flex items-center justify-center w-10 h-7 rounded-xl transition-all duration-150"
                style={
                  isMoreActive
                    ? { background: 'var(--brand-alpha-20)' }
                    : {}
                }
              >
                <MoreHorizontal
                  className={cn(
                    'h-5 w-5 transition-colors duration-150',
                    isMoreActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-[10px] font-semibold leading-tight mt-0.5 transition-colors duration-150',
                  isMoreActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                עוד
              </span>
            </button>
          </SheetTrigger>

          <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-2xl">
            <SheetHeader className="pb-4">
              <SheetTitle className="text-right text-base font-semibold">תפריט נוסף</SheetTitle>
            </SheetHeader>

            <div className="space-y-1 pb-4">
              {visibleMoreItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMoreOpen(false)}
                    className={cn(
                      'flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-150',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted active:bg-muted/70'
                    )}
                  >
                    <div
                      className={cn(
                        'flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0',
                        active ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-medium text-sm">{item.label}</span>
                  </Link>
                );
              })}

              {isAdmin && (
                <>
                  <div className="h-px bg-border my-3" />
                  <p className="text-xs font-semibold text-muted-foreground/60 px-4 mb-1 uppercase tracking-wider">
                    ניהול מערכת
                  </p>
                  {adminNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsMoreOpen(false)}
                        className={cn(
                          'flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-150',
                          active
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground hover:bg-muted active:bg-muted/70'
                        )}
                      >
                        <div
                          className={cn(
                            'flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0',
                            active ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="font-medium text-sm">{item.label}</span>
                      </Link>
                    );
                  })}
                </>
              )}
            </div>

            {/* User section */}
            <div className="border-t border-border pt-4 pb-2">
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-muted/60">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">מחובר כ:</p>
                  <p className="text-sm font-medium truncate text-foreground">{user?.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={signOut}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
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
    </nav>
  );
}
