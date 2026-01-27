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
import { Shield, User, Crown, RefreshCw, Calendar, UserPlus, Check, X, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  role: 'admin' | 'user';
  role_id?: string;
  is_approved: boolean;
}

interface PendingUser {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  created_at: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
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
      // Fetch user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, role, created_at, is_approved');

      if (rolesError) {
        throw rolesError;
      }

      // Fetch pending users
      const { data: pending, error: pendingError } = await supabase
        .from('pending_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (pendingError) {
        console.error('Error fetching pending users:', pendingError);
      }

      // Map pending users to get email/name for approved users
      const pendingMap = new Map((pending || []).map(p => [p.user_id, p]));

      // Map to user format
      const usersWithRoles: UserWithRole[] = (roles || []).map((r) => {
        const pendingInfo = pendingMap.get(r.user_id);
        return {
          id: r.user_id,
          email: pendingInfo?.email || pendingInfo?.display_name || 'משתמש',
          created_at: r.created_at,
          role: r.role as 'admin' | 'user',
          role_id: r.id,
          is_approved: r.is_approved,
        };
      });

      // Filter out approved users from pending list
      const approvedUserIds = new Set(usersWithRoles.filter(u => u.is_approved).map(u => u.id));
      const filteredPending = (pending || []).filter(p => !approvedUserIds.has(p.user_id));

      setUsers(usersWithRoles.filter(u => u.is_approved));
      setPendingUsers(filteredPending);
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

  const approveUser = async (pendingUser: PendingUser) => {
    setUpdating(pendingUser.user_id);
    try {
      // Update user_roles to set is_approved = true
      const { error: approveError } = await supabase
        .from('user_roles')
        .update({ is_approved: true })
        .eq('user_id', pendingUser.user_id);

      if (approveError) throw approveError;

      // Remove from pending_users
      await supabase
        .from('pending_users')
        .delete()
        .eq('user_id', pendingUser.user_id);

      toast({
        title: 'המשתמש אושר',
        description: `${pendingUser.display_name} יכול כעת להיכנס למערכת`,
      });

      fetchUsers();
    } catch (error) {
      console.error('Error approving user:', error);
      toast({
        title: 'שגיאה',
        description: 'לא הצלחנו לאשר את המשתמש',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const rejectUser = async (pendingUser: PendingUser) => {
    setUpdating(pendingUser.user_id);
    try {
      // Delete from user_roles
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', pendingUser.user_id);

      if (roleError) throw roleError;

      // Delete from pending_users
      await supabase
        .from('pending_users')
        .delete()
        .eq('user_id', pendingUser.user_id);

      toast({
        title: 'המשתמש נדחה',
        description: 'הבקשה נמחקה מהמערכת',
      });

      fetchUsers();
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast({
        title: 'שגיאה',
        description: 'לא הצלחנו לדחות את המשתמש',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
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
        <div className="grid grid-cols-3 gap-4 mb-6">
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

          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-warning/30 to-warning/20">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ממתינים</p>
                <p className="text-2xl font-bold text-foreground">
                  {pendingUsers.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Users */}
        {pendingUsers.length > 0 && (
          <div className="stat-card mb-6 border-warning/30 border-2">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="h-5 w-5 text-warning" />
              <h2 className="text-lg font-semibold">בקשות הרשמה ממתינות</h2>
              <Badge variant="secondary" className="bg-warning/20 text-warning">
                {pendingUsers.length}
              </Badge>
            </div>

            <div className="space-y-3">
              {pendingUsers.map((pending) => (
                <div
                  key={pending.id}
                  className="flex items-center justify-between p-4 rounded-xl glass border border-warning/30 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/20">
                      <Clock className="h-6 w-6 text-warning" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {pending.display_name}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span dir="ltr">{pending.email}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(parseISO(pending.created_at), 'dd/MM/yyyy HH:mm', { locale: he })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => approveUser(pending)}
                      disabled={updating === pending.user_id}
                      className="gap-1"
                    >
                      <Check className="h-4 w-4" />
                      אשר
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => rejectUser(pending)}
                      disabled={updating === pending.user_id}
                      className="gap-1"
                    >
                      <X className="h-4 w-4" />
                      דחה
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users List */}
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">משתמשים פעילים</h2>
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
