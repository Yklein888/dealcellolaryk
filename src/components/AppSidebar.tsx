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
  Circle,
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

  const { rentals, repairs } = useRental();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdueCount = rentals.filter(
    (r) => r.status === 'active' && isBefore(parseISO(r.endDate), today)
  ).length;
  const readyRepairsCount = repairs.filter((r) => r.status === 'ready').length;

  const navBadges: Record<string, { count: number; variant: 'red' | 'green' | 'violet' }> = {
    '/rentals': { count: overdueCount, variant: 'red' },
    '/repairs': { count: readyRepairsCount, variant: 'green' },
  };

  const visibleNavItems = navItems.filter(item => isAdmin || hasPermission(item.permission));

  return (
    <aside
      className="fixed right-0 top-0 z-40 h-screen w-64 flex flex-col"
      style={{
        background: 'hsl(230 14% 7%)',
        borderLeft: '1px solid hsl(230 14% 11%)',
      }}
    >
      {/* ── Logo ── */}
      <div
        className="flex items-center gap-3 p-5"
        style={{ borderBottom: '1px solid hsl(230 14% 11%)' }}
      >
        {/* Gem icon */}
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, hsl(252 85% 68%), hsl(268 80% 72%))',
            boxShadow: '0 4px 18px rgba(124,109,250,0.38)',
          }}
        >
          <Smartphone className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1
            className="text-sm font-semibold truncate"
            style={{ color: 'hsl(225 20% 94%)', letterSpacing: '-0.01em' }}
          >
            DealCell
          </h1>
          {/* Live dot */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <div
              className="flex items-center gap-1 rounded-full px-1.5 py-0.5"
              style={{
                background: 'rgba(52,211,153,0.12)',
                border: '1px solid rgba(52,211,153,0.22)',
              }}
            >
              <span
                className="block h-1.5 w-1.5 rounded-full"
                style={{ background: 'rgb(52,211,153)', boxShadow: '0 0 6px rgb(52,211,153)' }}
              />
              <span style={{ fontSize: 10, color: 'rgb(52,211,153)', fontWeight: 600, letterSpacing: '0.06em' }}>
                LIVE
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto scrollbar-hide">
        {/* Main group */}
        <p
          className="px-3 pt-2 pb-1"
          style={{ fontSize: 10, color: 'hsl(225 10% 30%)', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 600 }}
        >
          ראשי
        </p>

        {visibleNavItems.slice(0, 6).map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          const badge = navBadges[item.path];

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group',
                'hover:text-foreground',
                isActive ? 'nav-item-premium active' : 'nav-item-premium'
              )}
              style={isActive ? {
                background: 'linear-gradient(135deg, rgba(124,109,250,0.18), rgba(167,139,250,0.1))',
                border: '1px solid rgba(124,109,250,0.22)',
                color: 'hsl(225 20% 94%)',
              } : {
                border: '1px solid transparent',
                color: 'hsl(225 10% 42%)',
              }}
            >
              {/* Icon container */}
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 transition-all duration-200"
                style={isActive ? {
                  background: 'rgba(124,109,250,0.2)',
                } : {
                  background: 'transparent',
                }}
              >
                <Icon
                  className="h-4 w-4 transition-all duration-200"
                  style={isActive
                    ? { color: 'hsl(252 85% 78%)' }
                    : { color: 'hsl(225 10% 38%)' }
                  }
                />
              </div>

              <span className="text-sm font-medium flex-1 text-right" style={{ letterSpacing: '0.005em' }}>
                {item.label}
              </span>

              {badge && badge.count > 0 ? (
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                  style={badge.variant === 'red'
                    ? { background: 'rgba(248,113,113,0.14)', color: 'rgb(248,113,113)', border: '1px solid rgba(248,113,113,0.22)' }
                    : { background: 'rgba(52,211,153,0.14)', color: 'rgb(52,211,153)', border: '1px solid rgba(52,211,153,0.22)' }
                  }
                >
                  {badge.count}
                </span>
              ) : isActive ? (
                <ChevronRight
                  className="h-3.5 w-3.5"
                  style={{ color: 'rgba(167,139,250,0.7)' }}
                />
              ) : null}
            </Link>
          );
        })}

        {/* Finance group */}
        <p
          className="px-3 pt-4 pb-1"
          style={{ fontSize: 10, color: 'hsl(225 10% 30%)', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 600 }}
        >
          כספים
        </p>

        {visibleNavItems.slice(6).map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200"
              style={isActive ? {
                background: 'linear-gradient(135deg, rgba(124,109,250,0.18), rgba(167,139,250,0.1))',
                border: '1px solid rgba(124,109,250,0.22)',
                color: 'hsl(225 20% 94%)',
              } : {
                border: '1px solid transparent',
                color: 'hsl(225 10% 42%)',
              }}
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0"
                style={isActive ? { background: 'rgba(124,109,250,0.2)' } : { background: 'transparent' }}
              >
                <Icon
                  className="h-4 w-4"
                  style={isActive ? { color: 'hsl(252 85% 78%)' } : { color: 'hsl(225 10% 38%)' }}
                />
              </div>
              <span className="text-sm font-medium flex-1 text-right">{item.label}</span>
              {isActive && <ChevronRight className="h-3.5 w-3.5" style={{ color: 'rgba(167,139,250,0.7)' }} />}
            </Link>
          );
        })}

        {/* Admin group */}
        {isAdmin && (
          <>
            <p
              className="px-3 pt-4 pb-1"
              style={{ fontSize: 10, color: 'hsl(225 10% 30%)', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 600 }}
            >
              ניהול
            </p>
            {adminNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200"
                  style={isActive ? {
                    background: 'linear-gradient(135deg, rgba(124,109,250,0.18), rgba(167,139,250,0.1))',
                    border: '1px solid rgba(124,109,250,0.22)',
                    color: 'hsl(225 20% 94%)',
                  } : {
                    border: '1px solid transparent',
                    color: 'hsl(225 10% 42%)',
                  }}
                >
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0"
                    style={isActive ? { background: 'rgba(124,109,250,0.2)' } : {}}
                  >
                    <Icon
                      className="h-4 w-4"
                      style={isActive ? { color: 'hsl(252 85% 78%)' } : { color: 'hsl(225 10% 38%)' }}
                    />
                  </div>
                  <span className="text-sm font-medium flex-1 text-right">{item.label}</span>
                  {isActive && <ChevronRight className="h-3.5 w-3.5" style={{ color: 'rgba(167,139,250,0.7)' }} />}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* ── Footer ── */}
      <div
        className="p-3"
        style={{ borderTop: '1px solid hsl(230 14% 11%)' }}
      >
        {/* User chip */}
        <div
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 mb-2 cursor-pointer transition-all duration-200"
          style={{
            background: 'hsl(230 14% 10%)',
            border: '1px solid hsl(230 14% 14%)',
          }}
        >
          {/* Avatar */}
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, hsl(252 85% 68%), hsl(268 80% 72%))',
              fontSize: 12,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            {user?.email?.slice(0, 2).toUpperCase() ?? 'YK'}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-xs font-medium truncate"
              style={{ color: 'hsl(225 20% 85%)' }}
            >
              {user?.email ?? 'admin'}
            </p>
            <p
              className="text-xs"
              style={{ color: 'hsl(225 10% 35%)', fontSize: 10 }}
            >
              Administrator
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="flex-1 justify-start gap-2 text-xs h-9 rounded-xl transition-all duration-200"
            style={{ color: 'hsl(225 10% 42%)', background: 'transparent' }}
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings className="h-3.5 w-3.5" />
            הגדרות
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl transition-all duration-200"
            style={{ color: 'hsl(225 10% 38%)', background: 'transparent' }}
            onClick={signOut}
          >
            <LogOut className="h-3.5 w-3.5" />
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
