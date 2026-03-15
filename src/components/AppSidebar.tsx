import { Link, useLocation } from 'react-router-dom';
import { isBefore, parseISO } from 'date-fns';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useRental } from '@/hooks/useRental';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { usePermissions, PermissionKey } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
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
        'flex items-center gap-3 rounded-lg transition-all duration-150 group relative',
        isCollapsed ? 'justify-center px-0 py-2.5 w-full' : 'px-3 py-2',
        isActive
          ? 'text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      )}
      style={
        isActive
          ? {
              background: 'var(--brand-alpha-10)',
              border: '1px solid var(--brand-border)',
            }
          : {
              border: '1px solid transparent',
            }
      }
    >
      {/* Icon */}
      <div
        className={cn(
          'flex items-center justify-center rounded-lg flex-shrink-0 transition-all duration-150',
          isCollapsed ? 'h-8 w-8' : 'h-7 w-7',
          isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
        )}
        style={isActive ? { background: 'var(--brand-alpha-20)' } : {}}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Label — hidden when collapsed */}
      {!isCollapsed && (
        <span className="text-sm font-medium flex-1 text-right truncate">{label}</span>
      )}

      {/* Badge */}
      {!isCollapsed && badge && badge.count > 0 && (
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
          style={
            badge.variant === 'red'
              ? {
                  background: 'hsl(var(--destructive) / 0.12)',
                  color: 'hsl(var(--destructive))',
                  border: '1px solid hsl(var(--destructive) / 0.25)',
                }
              : badge.variant === 'green'
              ? {
                  background: 'hsl(var(--success) / 0.12)',
                  color: 'hsl(var(--success))',
                  border: '1px solid hsl(var(--success) / 0.25)',
                }
              : {
                  background: 'var(--brand-alpha-10)',
                  color: 'hsl(var(--primary))',
                  border: '1px solid var(--brand-border)',
                }
          }
        >
          {badge.count}
        </span>
      )}

      {/* Collapsed badge dot */}
      {isCollapsed && badge && badge.count > 0 && (
        <span
          className="absolute top-1 right-1 h-2 w-2 rounded-full"
          style={
            badge.variant === 'red'
              ? { background: 'hsl(var(--destructive))' }
              : { background: 'hsl(var(--success))' }
          }
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
    return <div className="my-1 border-t border-border/50" />;
  }
  return (
    <p
      className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest"
      style={{ color: 'hsl(var(--muted-foreground) / 0.5)' }}
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

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

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
          'flex items-center gap-3 flex-shrink-0',
          isCollapsed ? 'justify-center p-3 py-4' : 'p-4'
        )}
        style={{ borderBottom: '1px solid hsl(var(--sidebar-border))' }}
      >
        {/* Brand icon */}
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
            boxShadow: 'var(--shadow-brand)',
          }}
        >
          <Smartphone className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
        </div>

        {/* Name + status — hidden when collapsed */}
        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <h1
              className="text-sm font-semibold truncate text-foreground"
              style={{ letterSpacing: '-0.01em' }}
            >
              DealCell
            </h1>
            <div className="flex items-center gap-1 mt-0.5">
              <span
                className="block h-1.5 w-1.5 rounded-full"
                style={{
                  background: 'hsl(var(--success))',
                }}
              />
              <span
                className="text-[10px] font-semibold"
                style={{ color: 'hsl(var(--success))', letterSpacing: '0.06em' }}
              >
                LIVE
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav
        className={cn(
          'flex flex-col gap-0.5 flex-1 overflow-y-auto scrollbar-hide',
          isCollapsed ? 'px-2 py-3 items-center' : 'px-3 py-3'
        )}
      >
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

        {/* Collapse toggle button — at bottom of nav */}
        <div className="mt-auto pt-3">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCollapse}
                className={cn(
                  'flex items-center justify-center rounded-lg h-8 transition-all duration-150 text-muted-foreground hover:text-foreground hover:bg-muted',
                  isCollapsed ? 'w-8 mx-auto' : 'w-full'
                )}
                style={{ border: '1px solid transparent' }}
                aria-label={isCollapsed ? 'הרחב תפריט' : 'כווץ תפריט'}
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <div className="flex items-center gap-2 px-2 text-xs font-medium w-full">
                    <PanelLeftClose className="h-4 w-4 flex-shrink-0" />
                    <span>כווץ תפריט</span>
                  </div>
                )}
              </button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="left" sideOffset={8}>
                <span className="text-xs">הרחב תפריט</span>
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </nav>

      {/* ── Footer ── */}
      <div
        className={cn('flex-shrink-0 p-3', isCollapsed && 'flex flex-col items-center gap-2')}
        style={{ borderTop: '1px solid hsl(var(--sidebar-border))' }}
      >
        {/* User chip — hidden when collapsed, show avatar only */}
        {!isCollapsed ? (
          <div
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 mb-2"
            style={{
              background: 'hsl(var(--muted))',
              border: '1px solid hsl(var(--border))',
            }}
          >
            {/* Avatar */}
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 text-[11px] font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
              }}
            >
              {user?.email?.slice(0, 2).toUpperCase() ?? 'YK'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate text-foreground/90">
                {user?.email ?? 'admin'}
              </p>
              <p className="text-[10px] text-muted-foreground">Administrator</p>
            </div>
          </div>
        ) : (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white cursor-default"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
                }}
              >
                {user?.email?.slice(0, 2).toUpperCase() ?? 'YK'}
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={8}>
              <span className="text-xs">{user?.email ?? 'admin'}</span>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Action buttons */}
        {!isCollapsed ? (
          <div className="flex gap-1.5">
            {/* Settings */}
            <Button
              variant="ghost"
              className="flex-1 justify-start gap-2 text-xs h-8 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings className="h-3.5 w-3.5" />
              הגדרות
            </Button>

            {/* Theme toggle */}
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground flex-shrink-0"
                  onClick={toggleTheme}
                >
                  {theme === 'dark' ? (
                    <Sun className="h-3.5 w-3.5" />
                  ) : (
                    <Moon className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <span className="text-xs">{theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}</span>
              </TooltipContent>
            </Tooltip>

            {/* Sign out */}
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={signOut}
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <span className="text-xs">התנתק</span>
              </TooltipContent>
            </Tooltip>
          </div>
        ) : (
          /* Collapsed footer: stacked icon buttons */
          <>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={() => setIsSettingsOpen(true)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8}>
                <span className="text-xs">הגדרות</span>
              </TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={toggleTheme}
                >
                  {theme === 'dark' ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8}>
                <span className="text-xs">{theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}</span>
              </TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
                  onClick={signOut}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8}>
                <span className="text-xs">התנתק</span>
              </TooltipContent>
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
