import { ReactNode } from 'react';
import { useRole } from '@/hooks/useRole';
import { ShieldX } from 'lucide-react';

interface RequireAdminProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireAdmin({ children, fallback }: RequireAdminProps) {
  const { isAdmin, isLoading } = useRole();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-pulse text-muted-foreground">בודק הרשאות...</div>
      </div>
    );
  }

  if (!isAdmin) {
    if (fallback) return <>{fallback}</>;
    
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <ShieldX className="h-10 w-10 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">אין לך הרשאה</h2>
        <p className="text-muted-foreground max-w-md">
          עמוד זה נגיש למנהלים בלבד. אם אתה צריך גישה, פנה למנהל המערכת.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
