import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  ShoppingCart, 
  Wrench,
  ChevronRight,
  Smartphone
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'דאשבורד', icon: LayoutDashboard },
  { path: '/rentals', label: 'השכרות', icon: ShoppingCart },
  { path: '/customers', label: 'לקוחות', icon: Users },
  { path: '/inventory', label: 'מלאי', icon: Package },
  { path: '/repairs', label: 'תיקונים', icon: Wrench },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="fixed right-0 top-0 z-40 h-screen w-64 bg-sidebar border-l border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-3 p-6 border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
          <Smartphone className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">ניהול השכרות</h1>
          <p className="text-xs text-muted-foreground">מערכת מקצועית</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                'hover:bg-sidebar-accent group',
                isActive && 'bg-primary/10 text-primary'
              )}
            >
              <Icon className={cn(
                'h-5 w-5 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
              )} />
              <span className={cn(
                'font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
              )}>
                {item.label}
              </span>
              {isActive && (
                <ChevronRight className="h-4 w-4 mr-auto text-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 right-0 left-0 p-4 border-t border-sidebar-border">
        <div className="rounded-lg bg-sidebar-accent p-4">
          <p className="text-sm font-medium text-foreground">גרסה 1.0</p>
          <p className="text-xs text-muted-foreground">כל הזכויות שמורות</p>
        </div>
      </div>
    </aside>
  );
}
