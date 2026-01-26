import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/PageHeader';
import { RequireAdmin } from '@/components/RequireAdmin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Shield, User, Crown, RefreshCw, Mail, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  role: 'admin' | 'user';
  role_id?: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    userId: string;
    newRole: 'admin' | 'user';
    userEmail: string;
  } | null>(null);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch user roles - we can only access what RLS allows
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, role, created_at');

      if (rolesError) {
        throw rolesError;
      }

      // Map to user format - using role data we have access to
      const usersWithRoles: UserWithRole[] = (roles || []).map((r) => ({
        id: r.user_id,
        email: 'משתמש', // We don't have access to auth.users email directly
        created_at: r.created_at,
        role: r.role as 'admin' | 'user',
        role_id: r.id,
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'שגיאה',
        description: 'לא הצלחנו לטעון את רשימת המשתמשים',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = (userId: string, newRole: 'admin' | 'user', userEmail: string) => {
    setConfirmDialog({
      open: true,
      userId,
      newRole,
      userEmail,
    });
  };

  const confirmRoleChange = async () => {
    if (!confirmDialog) return;

    const { userId, newRole } = confirmDialog;
    setUpdating(userId);

    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      setUsers(users.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ));

      toast({
        title: 'התפקיד עודכן',
        description: `המשתמש עודכן ל${newRole === 'admin' ? 'מנהל' : 'משתמש רגיל'}`,
      });
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'שגיאה',
        description: 'לא הצלחנו לעדכן את התפקיד',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
      setConfirmDialog(null);
    }
  };

  return (
    <RequireAdmin>
      <div className="animate-fade-in">
        <PageHeader
          title="ניהול משתמשים"
          description="ניהול הרשאות ותפקידים במערכת"
        >
          <Button
            variant="outline"
            onClick={fetchUsers}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            רענן
          </Button>
        </PageHeader>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20">
                <Crown className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">מנהלים</p>
                <p className="text-2xl font-bold text-foreground">
                  {users.filter(u => u.role === 'admin').length}
                </p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">משתמשים</p>
                <p className="text-2xl font-bold text-foreground">
                  {users.filter(u => u.role === 'user').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Users List */}
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">משתמשים רשומים</h2>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              אין משתמשים רשומים
            </p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 rounded-xl glass border border-white/20 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                      user.role === 'admin' 
                        ? 'bg-gradient-to-br from-primary to-accent' 
                        : 'bg-muted'
                    }`}>
                      {user.role === 'admin' ? (
                        <Crown className="h-6 w-6 text-white" />
                      ) : (
                        <User className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">
                          {user.email}
                        </p>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role === 'admin' ? 'מנהל' : 'משתמש'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(parseISO(user.created_at), 'dd/MM/yyyy', { locale: he })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Select
                    value={user.role}
                    onValueChange={(value: 'admin' | 'user') => 
                      handleRoleChange(user.id, value, user.email)
                    }
                    disabled={updating === user.id}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4" />
                          מנהל
                        </div>
                      </SelectItem>
                      <SelectItem value="user">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          משתמש
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Confirm Dialog */}
        <AlertDialog 
          open={confirmDialog?.open} 
          onOpenChange={(open) => !open && setConfirmDialog(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>שינוי תפקיד</AlertDialogTitle>
              <AlertDialogDescription>
                האם אתה בטוח שברצונך לשנות את התפקיד של {confirmDialog?.userEmail} ל
                {confirmDialog?.newRole === 'admin' ? 'מנהל' : 'משתמש רגיל'}?
                {confirmDialog?.newRole === 'admin' && (
                  <span className="block mt-2 text-warning font-medium">
                    ⚠️ מנהל יכול לגשת לכל הפונקציות במערכת ולשנות תפקידים של משתמשים אחרים.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ביטול</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRoleChange}>
                אישור
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RequireAdmin>
  );
}
