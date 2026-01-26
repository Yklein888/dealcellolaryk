import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function NotificationSettings() {
  const { isSupported, isSubscribed, permission, requestPermission } = usePushNotifications();

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            התראות פוש
          </CardTitle>
          <CardDescription>
            הדפדפן שלך לא תומך בהתראות פוש
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isSubscribed ? (
            <BellRing className="h-5 w-5 text-primary" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          התראות פוש
        </CardTitle>
        <CardDescription>
          {isSubscribed
            ? 'התראות פוש מופעלות - תקבל התראות על השכרות ותיקונים'
            : 'הפעל התראות כדי לקבל עדכונים על השכרות שמגיע זמן החזרתן'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {permission === 'denied' ? (
          <p className="text-sm text-destructive">
            התראות נחסמו. ניתן לשנות זאת בהגדרות הדפדפן.
          </p>
        ) : (
          <Button
            onClick={requestPermission}
            variant={isSubscribed ? 'outline' : 'default'}
            disabled={isSubscribed}
          >
            {isSubscribed ? 'התראות מופעלות ✓' : 'הפעל התראות'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
