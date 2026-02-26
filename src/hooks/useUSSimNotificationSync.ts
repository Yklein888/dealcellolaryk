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
        const response = await fetch('/api/notify-us-sim-ready', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'check-updates' }),
        });

        if (!response.ok) {
          console.error('Error checking US SIM updates:', response.statusText);
        } else {
          const data = await response.json();
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
