import { Link, useLocation } from 'react-router-dom';
import { isBefore, parseISO } from 'date-fns';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useRental } from '@/hooks/useRental';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { usePermissions, PermissionKey } from '@/hooks/usePermissions';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  Smartphone,
  LogOut,
  Shield,
  CreditCard,
  FileText,
  Store,
  Settings,
  Signal,
  Globe,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavLinkProps {
  to: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  isCollapsed: boolean;
  badge?: { count: number; variant: 'red' | 'green' | 'violet' } | undefined;
  onClick?: () => void;
}

function NavLink({ to, label, icon: Icon, isActive, isCollapsed, badge, onClick }: NavLinkProps) {
  const linkContent = (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'relative flex items-center rounded-lg transition-all duration-150 group',
        isCollapsed
          ? 'justify-center w-10 h-10 mx-auto'
          : 'gap-3 px-3 py-2 w-full',
      )}
      style={
        isActive
          ? {
              background: 'rgba(59,130,246,0.18)',
              borderLeft: isCollapsed ? 'none' : '3px solid #3B82F6',
              color: '#93C5FD',
            }
          : { color: 'hsl(210 35% 62%)' }
      }
    >
      {/* Icon */}
      <div
        className={cn(
          'flex items-center justify-center rounded-md flex-shrink-0 transition-all duration-150',
          isCollapsed ? 'h-9 w-9' : 'h-7 w-7',
        )}
        style={
          isActive
            ? { background: 'rgba(59,130,246,0.22)', color: '#93C5FD' }
            : { color: 'hsl(210 35% 58%)' }
        }
      >
        <Icon className="h-[18px] w-[18px]" />
      </div>

      {/* Label */}
      {!isCollapsed && (
        <span
          className="text-sm font-medium flex-1 text-right truncate"
          style={isActive ? { color: '#93C5FD' } : { color: 'hsl(210 35% 72%)' }}
        >
          {label}
        </span>
      )}

      {/* Badge — expanded */}
      {!isCollapsed && badge && badge.count > 0 && (
        <span
          className="text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
          style={
            badge.variant === 'red'
              ? { background: 'rgba(220,38,38,0.20)', color: '#FCA5A5', border: '1px solid rgba(220,38,38,0.30)' }
              : badge.variant === 'green'
              ? { background: 'rgba(34,197,94,0.20)', color: '#86EFAC', border: '1px solid rgba(34,197,94,0.30)' }
              : { background: 'rgba(59,130,246,0.20)', color: '#93C5FD', border: '1px solid rgba(59,130,246,0.30)' }
          }
        >
          {badge.count}
        </span>
      )}

      {/* Badge dot — collapsed */}
      {isCollapsed && badge && badge.count > 0 && (
        <span
          className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full"
          style={{ background: badge.variant === 'red' ? '#EF4444' : '#22C55E' }}
        />
      )}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="left" sideOffset={8}>
          <span className="text-xs font-medium">{label}</span>
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}

function SectionLabel({ label, isCollapsed }: { label: string; isCollapsed: boolean }) {
  if (isCollapsed) {
    return <div className="my-2 h-px mx-2" style={{ background: 'hsl(var(--sidebar-border))' }} />;
  }
  return (
    <p
      className="px-3 pt-5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] select-none"
      style={{ color: 'hsl(210 30% 42%)' }}
    >
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
  const overdueCount = rentals.filter(
    (r) => r.status === 'active' && isBefore(parseISO(r.endDate), today)
  ).length;
  const readyRepairsCount = repairs.filter((r) => r.status === 'ready').length;

  const navBadges: Record<string, { count: number; variant: 'red' | 'green' | 'violet' }> = {
    '/rentals': { count: overdueCount, variant: 'red' },
    '/repairs': { count: readyRepairsCount, variant: 'green' },
  };

  const visibleNavItems = navItems.filter((item) => isAdmin || hasPermission(item.permission));
  const mainItems = visibleNavItems.slice(0, 6);
  const financeItems = visibleNavItems.slice(6);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? 'YK';

  return (
    <aside
      className={cn(
        'fixed right-0 top-0 z-40 h-screen flex flex-col transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-[68px]' : 'w-64'
      )}
      style={{
        background: 'hsl(var(--sidebar-background))',
        borderLeft: '1px solid hsl(var(--sidebar-border))',
      }}
    >
      {/* ── Logo ── */}
      <div
        className={cn(
          'flex items-center gap-3 h-[60px] flex-shrink-0 px-4',
          isCollapsed && 'justify-center px-3'
        )}
        style={{ borderBottom: '1px solid hsl(var(--sidebar-border))' }}
      >
        {/* Brand icon */}
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0"
          style={{
            background: 'var(--gradient-primary)',
            boxShadow: 'var(--shadow-brand)',
          }}
        >
          <Smartphone style={{ width: 16, height: 16, color: 'white' }} />
        </div>

        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-bold tracking-tight truncate" style={{ color: '#F1F5F9' }}>
              DealCell
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="block h-1.5 w-1.5 rounded-full"
                style={{ background: '#22C55E' }}
              />
              <span className="text-[10px] font-semibold tracking-wider" style={{ color: '#4ADE80' }}>
                LIVE
              </span>
            </div>
          </div>
        )}

        {/* Collapse toggle — inside header for clean look */}
        {!isCollapsed && (
          <button
            onClick={onToggleCollapse}
            className="flex h-7 w-7 items-center justify-center rounded-md transition-all duration-150 flex-shrink-0"
            style={{ color: 'hsl(210 30% 48%)', background: 'transparent' }}
            aria-label="כווץ תפריט"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav
        className={cn(
          'flex flex-col gap-0.5 flex-1 overflow-y-auto scrollbar-hide py-3',
          isCollapsed ? 'px-2 items-center' : 'px-3'
        )}
      >
        {/* Collapsed: expand button at top */}
        {isCollapsed && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCollapse}
                className="flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150 mb-2"
                style={{ color: 'hsl(210 30% 48%)' }}
                aria-label="הרחב תפריט"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={8}>
              <span className="text-xs">הרחב תפריט</span>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Main group */}
        <SectionLabel label="ראשי" isCollapsed={isCollapsed} />
        {mainItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            label={item.label}
            icon={item.icon}
            isActive={location.pathname === item.path}
            isCollapsed={isCollapsed}
            badge={navBadges[item.path]}
            onClick={onNavigate}
          />
        ))}

        {/* Finance group */}
        {financeItems.length > 0 && (
          <>
            <SectionLabel label="כספים" isCollapsed={isCollapsed} />
            {financeItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                label={item.label}
                icon={item.icon}
                isActive={location.pathname === item.path}
                isCollapsed={isCollapsed}
                badge={navBadges[item.path]}
                onClick={onNavigate}
              />
            ))}
          </>
        )}

        {/* Admin group */}
        {isAdmin && (
          <>
            <SectionLabel label="ניהול" isCollapsed={isCollapsed} />
            {adminNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                label={item.label}
                icon={item.icon}
                isActive={location.pathname === item.path}
                isCollapsed={isCollapsed}
                onClick={onNavigate}
              />
            ))}
          </>
        )}
      </nav>

      {/* ── Footer ── */}
      <div
        className={cn(
          'flex-shrink-0',
          isCollapsed ? 'p-2 flex flex-col items-center gap-1.5' : 'p-3'
        )}
        style={{ borderTop: '1px solid hsl(var(--sidebar-border))' }}
      >
        {/* User chip — expanded */}
        {!isCollapsed && (
          <div
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 mb-2"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 text-[11px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
            >
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: '#E2E8F0' }}>
                {user?.email ?? 'admin'}
              </p>
              <p className="text-[10px]" style={{ color: 'hsl(210 30% 48%)' }}>Administrator</p>
            </div>
          </div>
        )}

        {/* Collapsed: avatar */}
        {isCollapsed && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white cursor-default"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
              >
                {userInitials}
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={8}>
              <span className="text-xs">{user?.email ?? 'admin'}</span>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Action row — expanded */}
        {!isCollapsed ? (
          <div className="flex items-center gap-1">
            <button
              className="flex flex-1 items-center justify-start gap-2 text-xs h-8 rounded-lg px-2 transition-all duration-150"
              style={{ color: 'hsl(210 30% 52%)' }}
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings className="h-3.5 w-3.5 flex-shrink-0" />
              הגדרות
            </button>

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150"
                  style={{ color: 'hsl(210 30% 52%)' }}
                  onClick={toggleTheme}
                >
                  {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <span className="text-xs">{theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}</span>
              </TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150"
                  style={{ color: 'hsl(210 30% 52%)' }}
                  onClick={signOut}
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <span className="text-xs">התנתק</span>
              </TooltipContent>
            </Tooltip>
          </div>
        ) : (
          /* Collapsed: icon stack */
          <>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150"
                  style={{ color: 'hsl(210 30% 52%)' }}
                  onClick={() => setIsSettingsOpen(true)}
                >
                  <Settings className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8}><span className="text-xs">הגדרות</span></TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150"
                  style={{ color: 'hsl(210 30% 52%)' }}
                  onClick={toggleTheme}
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8}><span className="text-xs">{theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}</span></TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150"
                  style={{ color: 'hsl(210 30% 52%)' }}
                  onClick={signOut}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8}><span className="text-xs">התנתק</span></TooltipContent>
            </Tooltip>
          </>
        )}
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
