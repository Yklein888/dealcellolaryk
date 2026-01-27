import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useApproval() {
  const { user } = useAuth();
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkApproval = async () => {
      if (!user) {
        setIsApproved(null);
        setIsLoading(false);
        return;
      }

      try {
        // Use the RPC function to check approval status
        const { data, error } = await supabase.rpc('is_user_approved', {
          _user_id: user.id
        });

        if (error) {
          console.error('Error checking approval:', error);
          setIsApproved(false);
        } else {
          setIsApproved(data);
        }
      } catch (err) {
        console.error('Error in checkApproval:', err);
        setIsApproved(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkApproval();
  }, [user]);

  return { isApproved, isLoading };
}
