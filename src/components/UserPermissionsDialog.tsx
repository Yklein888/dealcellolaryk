import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AVAILABLE_PERMISSIONS, usePermissions } from '@/hooks/usePermissions';
import { Loader2, Shield } from 'lucide-react';

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
}

export function UserPermissionsDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
}: UserPermissionsDialogProps) {
  const { setPermission } = usePermissions();
  
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!userId,
  });

  const getPermissionValue = (key: string): boolean => {
    const permission = permissions.find(p => p.permission_key === key);
    return permission ? permission.is_allowed : true; // Default to allowed
  };

  const handleToggle = async (key: string, isAllowed: boolean) => {
    await setPermission.mutateAsync({
      userId,
      permissionKey: key,
      isAllowed,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            ניהול הרשאות
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{userEmail}</p>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {AVAILABLE_PERMISSIONS.map((permission) => (
                <div
                  key={permission.key}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <Label 
                      htmlFor={permission.key} 
                      className="font-medium cursor-pointer"
                    >
                      {permission.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {permission.description}
                    </p>
                  </div>
                  <Switch
                    id={permission.key}
                    checked={getPermissionValue(permission.key)}
                    onCheckedChange={(checked) => handleToggle(permission.key, checked)}
                    disabled={setPermission.isPending}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
