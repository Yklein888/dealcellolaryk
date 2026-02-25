import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook that periodically checks if US SIM numbers are ready
 * and sends notifications to customers
 */
export function useUSSimNotificationSync() {
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const checkUSSimUpdates = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('notify-us-sim-ready', {
          body: { action: 'check-updates' },
        });

        if (error) {
          console.error('Error checking US SIM updates:', error);
        } else {
          console.log('[US SIM Sync] Update check result:', data);
        }
      } catch (err) {
        console.error('[US SIM Sync] Error invoking function:', err);
      }
    };

    // Run immediately on mount
    checkUSSimUpdates();

    // Then check every 5 minutes
    intervalId = setInterval(() => {
      checkUSSimUpdates();
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);
}
