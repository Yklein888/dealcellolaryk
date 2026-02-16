import { useRef, useCallback, useEffect } from 'react';
import { useConnectionStatus } from './useConnectionStatus';

interface QueuedAction {
  id: string;
  action: () => Promise<void>;
  description: string;
  timestamp: number;
}

/**
 * Queues async actions during network failures and replays them on reconnect.
 */
export function useOfflineQueue() {
  const { isOnline, status } = useConnectionStatus();
  const queueRef = useRef<QueuedAction[]>([]);
  const processingRef = useRef(false);

  const enqueue = useCallback((action: () => Promise<void>, description: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    queueRef.current.push({ id, action, description, timestamp: Date.now() });
    return id;
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) return;
    processingRef.current = true;

    const queue = [...queueRef.current];
    queueRef.current = [];

    for (const item of queue) {
      try {
        await item.action();
      } catch (err) {
        console.error(`[OfflineQueue] Failed to replay: ${item.description}`, err);
        // Re-queue failed items
        queueRef.current.push(item);
      }
    }
    processingRef.current = false;
  }, []);

  // Process queue when coming back online
  useEffect(() => {
    if (isOnline && status === 'connected' && queueRef.current.length > 0) {
      processQueue();
    }
  }, [isOnline, status, processQueue]);

  return {
    enqueue,
    queueLength: queueRef.current.length,
  };
}
