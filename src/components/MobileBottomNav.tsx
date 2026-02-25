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
  Globe
} from 'lucide-react';
import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Wrench, CreditCard, FileText, Shield, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from './ui/button';

const mainNavItems = [
  { path: '/', label: 'ראשי', icon: LayoutDashboard, permission: 'view_dashboard' as const },
  { path: '/pos', label: 'קופה', icon: Store, permission: 'view_pos' as const },
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

  const isActive = (path: string) => location.pathname === path;

  // Filter nav items by permission (admins see all)
  const visibleMainItems = mainNavItems.filter(item => isAdmin || hasPermission(item.permission));
  const visibleMoreItems = moreNavItems.filter(item => isAdmin || hasPermission(item.permission));
  const isMoreActive = [...moreNavItems, ...adminNavItems].some(item => isActive(item.path));

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 glass-strong border-t border-white/20 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {visibleMainItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center flex-1 py-2 mx-0.5 rounded-xl transition-all duration-200',
                active
                  ? 'text-white bg-gradient-to-b from-primary to-accent shadow-md scale-[1.04]'
                  : 'text-muted-foreground hover:text-foreground active:bg-muted/50'
              )}
            >
              <Icon className={cn(
                'h-5 w-5 mb-1 transition-all duration-200',
                active ? 'scale-110' : ''
              )} />
              <span className={cn('text-[10px] font-semibold leading-tight', active && 'text-white')}>{item.label}</span>
            </Link>
          );
        })}

        {/* More Menu */}
        <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                'flex flex-col items-center justify-center flex-1 py-2 mx-0.5 rounded-xl transition-all duration-200',
                isMoreActive
                  ? 'text-white bg-gradient-to-b from-primary to-accent shadow-md scale-[1.04]'
                  : 'text-muted-foreground hover:text-foreground active:bg-muted/50'
              )}
            >
              <MoreHorizontal className={cn(
                'h-5 w-5 mb-1 transition-all duration-200',
                isMoreActive ? 'scale-110' : ''
              )} />
              <span className={cn('text-[10px] font-semibold leading-tight', isMoreActive && 'text-white')}>עוד</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-3xl">
            <SheetHeader className="pb-4">
              <SheetTitle className="text-right">תפריט נוסף</SheetTitle>
            </SheetHeader>
            
            <div className="space-y-2 pb-4">
              {visibleMoreItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMoreOpen(false)}
                    className={cn(
                      'flex items-center gap-4 p-4 rounded-2xl transition-all duration-200',
                      active 
                        ? 'bg-primary/10 text-primary' 
                        : 'hover:bg-muted active:bg-muted/70'
                    )}
                  >
                    <div className={cn(
                      'flex items-center justify-center w-12 h-12 rounded-xl',
                      active ? 'bg-primary text-white' : 'bg-muted'
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-medium text-base">{item.label}</span>
                  </Link>
                );
              })}

              {isAdmin && (
                <>
                  <div className="h-px bg-border my-4" />
                  <p className="text-xs text-muted-foreground px-4 mb-2">ניהול מערכת</p>
                  {adminNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsMoreOpen(false)}
                        className={cn(
                          'flex items-center gap-4 p-4 rounded-2xl transition-all duration-200',
                          active 
                            ? 'bg-primary/10 text-primary' 
                            : 'hover:bg-muted active:bg-muted/70'
                        )}
                      >
                        <div className={cn(
                          'flex items-center justify-center w-12 h-12 rounded-xl',
                          active ? 'bg-primary text-white' : 'bg-muted'
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="font-medium text-base">{item.label}</span>
                      </Link>
                    );
                  })}
                </>
              )}
            </div>

            {/* User Section */}
            <div className="border-t border-border pt-4 pb-2">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/50">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">מחובר כ:</p>
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={signOut}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
