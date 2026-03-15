import { Link, useLocation } from 'react-router-dom';
import { isBefore, parseISO } from 'date-fns';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useRental } from '@/hooks/useRental';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { usePermissions, PermissionKey } from '@/hooks/usePermissions';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  LayoutDashboard, Users, Package, ShoppingCart, Wrench, Smartphone,
  LogOut, Shield, CreditCard, FileText, Store, Settings, Signal, Globe,
  Sun, Moon, ChevronRight, ChevronLeft,
} from 'lucide-react';
import { BiometricSettings } from '@/components/settings/BiometricSettings';
import { NotificationSettings } from '@/components/NotificationSettings';
import { LanguageSettings } from '@/components/settings/LanguageSettings';
import { BusinessSettings } from '@/components/settings/BusinessSettings';
import { ThemeSettings } from '@/components/settings/ThemeSettings';
import { APIKeysSettings } from '@/components/settings/APIKeysSettings';

const NAV_MAIN = [
  { path: '/',          label: 'דאשבורד',   icon: LayoutDashboard, permission: 'view_dashboard' as PermissionKey },
  { path: '/pos',       label: 'קופה',       icon: Store,           permission: 'view_pos' as PermissionKey },
  { path: '/rentals',   label: 'השכרות',     icon: ShoppingCart,    permission: 'view_rentals' as PermissionKey },
  { path: '/customers', label: 'לקוחות',     icon: Users,           permission: 'view_customers' as PermissionKey },
  { path: '/inventory', label: 'מלאי',       icon: Package,         permission: 'view_inventory' as PermissionKey },
  { path: '/repairs',   label: 'תיקונים',    icon: Wrench,          permission: 'view_repairs' as PermissionKey },
];

const NAV_FINANCE = [
  { path: '/cellstation', label: 'סימים אירופה', icon: Signal,    permission: 'view_sim_cards' as PermissionKey },
  { path: '/sims',        label: 'סימים ארה"ב',  icon: Globe,     permission: 'view_inventory' as PermissionKey },
  { path: '/payments',    label: 'תשלומים',      icon: CreditCard, permission: 'view_payments' as PermissionKey },
  { path: '/invoices',    label: 'חשבוניות',     icon: FileText,   permission: 'view_invoices' as PermissionKey },
];

const NAV_ADMIN = [{ path: '/users', label: 'ניהול משתמשים', icon: Shield }];

interface AppSidebarProps {
  onNavigate?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface BadgeInfo { count: number; variant: 'red' | 'green' | 'indigo'; }

interface NavItemProps {
  to: string; label: string; icon: React.ElementType;
  isActive: boolean; isCollapsed: boolean; badge?: BadgeInfo; onClick?: () => void;
}

function NavItem({ to, label, icon: Icon, isActive, isCollapsed, badge, onClick }: NavItemProps) {
  const content = (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'group relative flex items-center rounded-lg transition-all duration-150 select-none',
        isCollapsed ? 'justify-center w-10 h-10 mx-auto' : 'gap-3 px-3 py-2.5 w-full',
        isActive
          ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-semibold'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-100',
      )}
    >
      {isActive && !isCollapsed && (
        <span className="absolute right-0 top-2 bottom-2 w-0.5 rounded-full bg-indigo-500" aria-hidden />
      )}
      <Icon className={cn(
        'flex-shrink-0 transition-colors duration-150',
        isCollapsed ? 'h-5 w-5' : 'h-4 w-4',
        isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300',
      )} />
      {!isCollapsed && <span className="flex-1 text-sm text-right truncate">{label}</span>}
      {!isCollapsed && badge && badge.count > 0 && (
        <span className={cn(
          'text-[11px] font-bold tabular-nums min-w-[20px] px-1.5 py-0.5 rounded-full text-center',
          badge.variant === 'red' ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400'
            : badge.variant === 'green' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
            : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400',
        )}>{badge.count}</span>
      )}
      {isCollapsed && badge && badge.count > 0 && (
        <span className={cn('absolute top-1 right-1 h-2 w-2 rounded-full', badge.variant === 'red' ? 'bg-red-500' : 'bg-emerald-500')} />
      )}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="left" sideOffset={8}><span className="text-xs font-medium">{label}</span></TooltipContent>
      </Tooltip>
    );
  }
  return content;
}

function SectionLabel({ label, isCollapsed }: { label: string; isCollapsed: boolean }) {
  if (isCollapsed) return <div className="my-3 mx-auto h-px w-6 bg-gray-200 dark:bg-white/10" />;
  return (
    <p className="px-3 pt-6 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600 select-none">
      {label}
    </p>
  );
}

export function AppSidebar({ onNavigate, isCollapsed = false, onToggleCollapse }: AppSidebarProps) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useRole();
  const { hasPermission } = usePermissions();
  const { theme, setTheme } = useTheme();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { rentals, repairs } = useRental();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueCount = rentals.filter((r) => r.status === 'active' && isBefore(parseISO(r.endDate), today)).length;
  const readyRepairsCount = repairs.filter((r) => r.status === 'ready').length;

  const badges: Record<string, BadgeInfo> = {
    '/rentals': { count: overdueCount, variant: 'red' },
    '/repairs': { count: readyRepairsCount, variant: 'green' },
  };

  const visibleMain    = NAV_MAIN.filter((i)    => isAdmin || hasPermission(i.permission));
  const visibleFinance = NAV_FINANCE.filter((i) => isAdmin || hasPermission(i.permission));
  const toggleTheme    = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  const userEmail      = user?.email ?? 'admin@dealcell.co.il';
  const userInitials   = userEmail.slice(0, 2).toUpperCase();

  return (
    <aside className={cn(
      'fixed right-0 top-0 z-40 h-screen flex flex-col transition-all duration-300 ease-in-out',
      'bg-white dark:bg-[hsl(var(--sidebar-background))]',
      'border-l border-gray-200 dark:border-[hsl(var(--sidebar-border))]',
      isCollapsed ? 'w-[72px]' : 'w-[260px]',
    )}>
      {/* ── Logo ── */}
      <div className={cn(
        'flex items-center h-16 flex-shrink-0 border-b border-gray-100 dark:border-white/5',
        isCollapsed ? 'justify-center px-3 relative' : 'px-5 gap-3',
      )}>
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }}
        >
          <Smartphone className="h-5 w-5 text-white" />
        </div>

        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-gray-900 dark:text-white leading-none">DealCell</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-semibold text-emerald-500 tracking-wider uppercase">Live</span>
            </div>
          </div>
        )}

        {!isCollapsed ? (
          <button
            onClick={onToggleCollapse}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
            aria-label="כווץ תפריט"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCollapse}
                className="absolute -left-3 top-5 flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 text-gray-400 hover:text-gray-700 shadow-sm transition-all"
                aria-label="הרחב תפריט"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={8}><span className="text-xs">הרחב תפריט</span></TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className={cn('flex-1 overflow-y-auto scrollbar-hide py-3', isCollapsed ? 'px-2' : 'px-3')}>
        <SectionLabel label="ראשי" isCollapsed={isCollapsed} />
        <div className="flex flex-col gap-0.5">
          {visibleMain.map((item) => (
            <NavItem
              key={item.path} to={item.path} label={item.label} icon={item.icon}
              isActive={location.pathname === item.path} isCollapsed={isCollapsed}
              badge={badges[item.path]} onClick={onNavigate}
            />
          ))}
        </div>

        {visibleFinance.length > 0 && (
          <>
            <SectionLabel label="כספים וסימים" isCollapsed={isCollapsed} />
            <div className="flex flex-col gap-0.5">
              {visibleFinance.map((item) => (
                <NavItem
                  key={item.path} to={item.path} label={item.label} icon={item.icon}
                  isActive={location.pathname === item.path} isCollapsed={isCollapsed}
                  badge={badges[item.path]} onClick={onNavigate}
                />
              ))}
            </div>
          </>
        )}

        {isAdmin && (
          <>
            <SectionLabel label="ניהול" isCollapsed={isCollapsed} />
            <div className="flex flex-col gap-0.5">
              {NAV_ADMIN.map((item) => (
                <NavItem
                  key={item.path} to={item.path} label={item.label} icon={item.icon}
                  isActive={location.pathname === item.path} isCollapsed={isCollapsed}
                  onClick={onNavigate}
                />
              ))}
            </div>
          </>
        )}
      </nav>

      {/* ── Footer ── */}
      <div className={cn(
        'flex-shrink-0 border-t border-gray-100 dark:border-white/5',
        isCollapsed ? 'p-2 flex flex-col items-center gap-1.5' : 'p-3 space-y-2',
      )}>
        {!isCollapsed && (
          <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
            >
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{userEmail}</p>
              <p className="text-[10px] text-gray-400">{isAdmin ? 'מנהל מערכת' : 'משתמש'}</p>
            </div>
          </div>
        )}

        {!isCollapsed ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
            >
              <Settings className="h-3.5 w-3.5" />
              הגדרות
            </button>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button onClick={toggleTheme} className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                  {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top"><span className="text-xs">{theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}</span></TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button onClick={signOut} className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top"><span className="text-xs">התנתק</span></TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white cursor-default" style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
                  {userInitials}
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8}><span className="text-xs">{userEmail}</span></TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button onClick={() => setIsSettingsOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                  <Settings className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8}><span className="text-xs">הגדרות</span></TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button onClick={toggleTheme} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8}><span className="text-xs">{theme === 'dark' ? 'בהיר' : 'כהה'}</span></TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button onClick={signOut} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8}><span className="text-xs">התנתק</span></TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />הגדרות</DialogTitle>
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
