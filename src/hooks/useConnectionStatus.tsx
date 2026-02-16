import { useState, useEffect, useCallback, useRef, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

type ConnectionState = 'connected' | 'connecting' | 'disconnected';

interface ConnectionStatusContextType {
  status: ConnectionState;
  lastSyncAt: Date | null;
  isOnline: boolean;
}

const ConnectionStatusContext = createContext<ConnectionStatusContextType>({
  status: 'connecting',
  lastSyncAt: null,
  isOnline: true,
});

export function ConnectionStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionState>('connecting');
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const retryRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  const connect = useCallback(() => {
    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase.channel('connection-status-monitor');
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        setStatus('connected');
        setLastSyncAt(new Date());
        retryCountRef.current = 0;
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setStatus('connected');
          setLastSyncAt(new Date());
          retryCountRef.current = 0;
          // Track presence
          channel.track({ online_at: new Date().toISOString() });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setStatus('disconnected');
          // Exponential backoff retry
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
          retryCountRef.current += 1;
          retryRef.current = setTimeout(connect, delay);
        } else if (status === 'CLOSED') {
          setStatus('disconnected');
        }
      });
  }, []);

  // Network status listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Reconnect when back online
      connect();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setStatus('disconnected');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial connection
    connect();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (retryRef.current) {
        clearTimeout(retryRef.current);
      }
    };
  }, [connect]);

  return (
    <ConnectionStatusContext.Provider value={{ status, lastSyncAt, isOnline }}>
      {children}
    </ConnectionStatusContext.Provider>
  );
}

export function useConnectionStatus() {
  return useContext(ConnectionStatusContext);
}
