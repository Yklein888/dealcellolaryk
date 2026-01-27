import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;
// Warning before timeout (5 minutes before)
const WARNING_TIME = 5 * 60 * 1000;

export function useSessionTimeout() {
  const { toast } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const logout = useCallback(async () => {
    console.log('Session timeout - logging out');
    await supabase.auth.signOut();
    toast({
      title: 'נותקת מהמערכת',
      description: 'עקב חוסר פעילות, נותקת אוטומטית לצורכי אבטחה',
      variant: 'destructive',
    });
  }, [toast]);

  const showWarning = useCallback(() => {
    toast({
      title: 'אזהרה - ניתוק בקרוב',
      description: 'תנותק בעוד 5 דקות עקב חוסר פעילות. לחץ על המסך כדי להישאר מחובר.',
    });
  }, [toast]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();

    // Clear existing timers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
    }

    // Set warning timer (25 minutes)
    warningRef.current = setTimeout(() => {
      showWarning();
    }, SESSION_TIMEOUT - WARNING_TIME);

    // Set logout timer (30 minutes)
    timeoutRef.current = setTimeout(() => {
      logout();
    }, SESSION_TIMEOUT);
  }, [logout, showWarning]);

  useEffect(() => {
    // Events that indicate user activity
    const events = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    // Throttle activity updates to prevent excessive resets
    let throttleTimeout: NodeJS.Timeout | null = null;
    const handleActivity = () => {
      if (throttleTimeout) return;
      
      throttleTimeout = setTimeout(() => {
        throttleTimeout = null;
        resetTimer();
      }, 1000); // Throttle to once per second
    };

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Initialize timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningRef.current) {
        clearTimeout(warningRef.current);
      }
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
    };
  }, [resetTimer]);

  return {
    resetTimer,
    lastActivity: lastActivityRef.current,
  };
}
