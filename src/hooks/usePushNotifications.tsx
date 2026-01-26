import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const { toast } = useToast();

  useEffect(() => {
    // Check if push notifications are supported
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
      setIsSubscribed(Notification.permission === 'granted');
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast({
        title: 'לא נתמך',
        description: 'הדפדפן שלך לא תומך בהתראות פוש',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      setIsSubscribed(result === 'granted');

      if (result === 'granted') {
        toast({
          title: 'התראות הופעלו',
          description: 'תקבל התראות על השכרות שמגיע זמן החזרתן',
        });
        return true;
      } else if (result === 'denied') {
        toast({
          title: 'התראות נחסמו',
          description: 'ניתן לשנות זאת בהגדרות הדפדפן',
          variant: 'destructive',
        });
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן להפעיל התראות',
        variant: 'destructive',
      });
      return false;
    }
  }, [isSupported, toast]);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSubscribed) return;

    // Show notification using the Notification API
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          dir: 'rtl',
          lang: 'he',
          ...options,
        });
      });
    } else {
      // Fallback to regular notification
      new Notification(title, {
        icon: '/pwa-192x192.png',
        dir: 'rtl',
        lang: 'he',
        ...options,
      });
    }
  }, [isSubscribed]);

  const notifyRentalDue = useCallback((customerName: string, endDate: string) => {
    showNotification('תזכורת החזרה', {
      body: `ההשכרה של ${customerName} מסתיימת ב-${endDate}`,
      tag: 'rental-due',
    });
  }, [showNotification]);

  const notifyRepairReady = useCallback((customerName: string, repairNumber: string) => {
    showNotification('תיקון מוכן לאיסוף', {
      body: `התיקון ${repairNumber} של ${customerName} מוכן`,
      tag: 'repair-ready',
    });
  }, [showNotification]);

  return {
    isSupported,
    isSubscribed,
    permission,
    requestPermission,
    showNotification,
    notifyRentalDue,
    notifyRepairReady,
  };
}
