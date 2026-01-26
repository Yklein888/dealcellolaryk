import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  ShoppingCart, 
  Wrench,
  ChevronRight,
  Smartphone,
  LogOut
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'דאשבורד', icon: LayoutDashboard },
  { path: '/rentals', label: 'השכרות', icon: ShoppingCart },
  { path: '/customers', label: 'לקוחות', icon: Users },
  { path: '/inventory', label: 'מלאי', icon: Package },
  { path: '/repairs', label: 'תיקונים', icon: Wrench },
];

interface AppSidebarProps {
  onNavigate?: () => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const location = useLocation();
  const { user, signOut } = useAuth();

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
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300',
                'hover:bg-white/40 hover:shadow-sm group',
                isActive && 'bg-gradient-to-l from-primary/20 to-primary/5 text-primary shadow-sm border border-primary/20'
              )}
            >
              <Icon className={cn(
                'h-5 w-5 transition-all duration-300',
                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground group-hover:scale-110'
              )} />
              <span className={cn(
                'font-medium transition-colors duration-300',
                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
              )}>
                {item.label}
              </span>
              {isActive && (
                <ChevronRight className="h-4 w-4 mr-auto text-primary animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User & Logout */}
      <div className="absolute bottom-0 right-0 left-0 p-4 border-t border-white/10">
        <div className="rounded-xl glass-subtle p-3 mb-3">
          <p className="text-xs text-muted-foreground">מחובר כ:</p>
          <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive/10 transition-all duration-300"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          התנתק
        </Button>
      </div>
    </aside>
  );
}
