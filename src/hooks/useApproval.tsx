import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

export function useApproval() {
  const { user } = useAuth();
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsApproved(null);
      setIsLoading(false);
      return;
    }
    // All authenticated users are automatically approved
    setIsApproved(true);
    setIsLoading(false);
  }, [user]);

  return { isApproved, isLoading };
}
