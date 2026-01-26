import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type AppRole = 'admin' | 'user';

interface RoleContextType {
  role: AppRole | null;
  isAdmin: boolean;
  isLoading: boolean;
  refetchRole: () => Promise<void>;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRole = async () => {
    if (!user) {
      setRole(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching role:', error);
        setRole('user'); // Default to user role on error
      } else if (data) {
        setRole(data.role as AppRole);
      } else {
        setRole('user'); // Default to user if no role found
      }
    } catch (err) {
      console.error('Error in fetchRole:', err);
      setRole('user');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRole();
  }, [user]);

  const refetchRole = async () => {
    setIsLoading(true);
    await fetchRole();
  };

  return (
    <RoleContext.Provider value={{
      role,
      isAdmin: role === 'admin',
      isLoading,
      refetchRole
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
