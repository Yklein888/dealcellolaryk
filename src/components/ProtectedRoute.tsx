import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useApproval } from '@/hooks/useApproval';
import { useDeviceApproval } from '@/hooks/useDeviceApproval';
import Auth from '@/pages/Auth';
import { PendingApproval } from '@/components/PendingApproval';
import { PendingDeviceApproval } from '@/components/PendingDeviceApproval';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { isApproved, isLoading: approvalLoading } = useApproval();
  const { isDeviceApproved, isLoading: deviceLoading } = useDeviceApproval();

  if (loading || approvalLoading || deviceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">טוען...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  // User is logged in but not approved
  if (!isApproved) {
    return <PendingApproval userEmail={user.email} />;
  }

  // User is approved but device is not approved
  if (!isDeviceApproved) {
    return <PendingDeviceApproval userEmail={user.email} />;
  }

  return <>{children}</>;
}
