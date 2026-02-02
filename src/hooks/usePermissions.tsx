import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const AVAILABLE_PERMISSIONS = [
  { key: 'view_dashboard', label: 'דאשבורד', description: 'צפייה בדאשבורד הראשי' },
  { key: 'view_pos', label: 'קופה', description: 'גישה למערכת הקופה' },
  { key: 'view_rentals', label: 'השכרות', description: 'צפייה וניהול השכרות' },
  { key: 'view_customers', label: 'לקוחות', description: 'צפייה וניהול לקוחות' },
  { key: 'view_inventory', label: 'מלאי', description: 'צפייה וניהול מלאי' },
  { key: 'view_repairs', label: 'תיקונים', description: 'צפייה וניהול תיקונים' },
  { key: 'view_payments', label: 'תשלומים', description: 'צפייה בהיסטוריית תשלומים' },
  { key: 'view_invoices', label: 'חשבוניות', description: 'צפייה וניהול חשבוניות' },
  { key: 'view_sim_cards', label: 'סימים CellStation', description: 'צפייה וסנכרון סימים מ-CellStation' },
] as const;

export type PermissionKey = typeof AVAILABLE_PERMISSIONS[number]['key'];

interface UserPermission {
  id: string;
  user_id: string;
  permission_key: string;
  is_allowed: boolean;
  created_at: string;
  updated_at: string;
}

export function usePermissions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get current user's permissions
  const { data: myPermissions = [], isLoading: isLoadingMyPermissions } = useQuery({
    queryKey: ['my-permissions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data as UserPermission[];
    },
    enabled: !!user,
  });

  // Check if current user has a specific permission
  const hasPermission = (permissionKey: PermissionKey): boolean => {
    const permission = myPermissions.find(p => p.permission_key === permissionKey);
    // Default to true if no explicit permission is set
    return permission ? permission.is_allowed : true;
  };

  // Get all permissions for a specific user (admin only)
  const getUserPermissions = (userId: string) => {
    return useQuery({
      queryKey: ['user-permissions', userId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('user_permissions')
          .select('*')
          .eq('user_id', userId);
        
        if (error) throw error;
        return data as UserPermission[];
      },
    });
  };

  // Set permission for a user (admin only)
  const setPermission = useMutation({
    mutationFn: async ({ 
      userId, 
      permissionKey, 
      isAllowed 
    }: { 
      userId: string; 
      permissionKey: string; 
      isAllowed: boolean;
    }) => {
      const { data, error } = await supabase
        .from('user_permissions')
        .upsert({
          user_id: userId,
          permission_key: permissionKey,
          is_allowed: isAllowed,
        }, {
          onConflict: 'user_id,permission_key',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['my-permissions'] });
      toast.success('ההרשאה עודכנה בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה בעדכון הרשאה: ' + error.message);
    },
  });

  // Delete permission (revert to default)
  const deletePermission = useMutation({
    mutationFn: async ({ userId, permissionKey }: { userId: string; permissionKey: string }) => {
      const { error } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('permission_key', permissionKey);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['my-permissions'] });
    },
  });

  return {
    myPermissions,
    isLoadingMyPermissions,
    hasPermission,
    getUserPermissions,
    setPermission,
    deletePermission,
  };
}
