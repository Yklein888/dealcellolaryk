import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions, PermissionKey } from '@/hooks/usePermissions';
import { useRole } from '@/hooks/useRole';
import { Loader2, Lock } from 'lucide-react';

interface ProtectedByPermissionProps {
  children: ReactNode;
  permission: PermissionKey;
  fallback?: ReactNode;
}

export function ProtectedByPermission({ 
  children, 
  permission,
  fallback 
}: ProtectedByPermissionProps) {
  const { hasPermission, isLoadingMyPermissions } = usePermissions();
  const { isAdmin } = useRole();

  // Admins always have access
  if (isAdmin) {
    return <>{children}</>;
  }

  if (isLoadingMyPermissions) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasPermission(permission)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <Lock className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold mb-2">אין הרשאת גישה</h2>
        <p className="text-muted-foreground max-w-md">
          אין לך הרשאה לצפות בתוכן זה. פנה למנהל המערכת לקבלת גישה.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
