import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Monitor, LogOut, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';

interface PendingDeviceApprovalProps {
  userEmail?: string;
}

export function PendingDeviceApproval({ userEmail }: PendingDeviceApprovalProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Force page reload to recheck device status
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 text-orange-600 mx-auto mb-4">
            <Monitor className="w-8 h-8" />
          </div>
          <CardTitle className="text-xl">מכשיר לא מאושר</CardTitle>
          <CardDescription className="text-base">
            מכשיר זה עדיין לא אושר לשימוש במערכת
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">מחובר עם:</p>
            <p className="font-medium" dir="ltr">{userEmail}</p>
          </div>
          
          <div className="bg-orange-50 dark:bg-orange-950/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
            <p className="text-sm text-orange-800 dark:text-orange-200 text-center">
              🔒 לאבטחת המערכת, כל מכשיר חדש דורש אישור מנהל.
              <br />
              נשלחה בקשה למנהל לאישור המכשיר שלך.
            </p>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            לאחר שהמנהל יאשר את המכשיר, תוכל לגשת למערכת.
            לחץ על "רענן" כדי לבדוק אם המכשיר אושר.
          </p>

          <div className="flex gap-3">
            <Button 
              variant="default" 
              className="flex-1 gap-2"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              רענן
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 gap-2"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              התנתק
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
