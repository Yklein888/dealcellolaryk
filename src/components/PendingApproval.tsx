import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PendingApprovalProps {
  userEmail?: string;
}

export function PendingApproval({ userEmail }: PendingApprovalProps) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-warning/20 text-warning mx-auto mb-4">
            <Clock className="w-8 h-8" />
          </div>
          <CardTitle className="text-xl">ממתין לאישור</CardTitle>
          <CardDescription className="text-base">
            החשבון שלך נמצא בהמתנה לאישור מנהל
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">נרשמת עם האימייל:</p>
            <p className="font-medium" dir="ltr">{userEmail}</p>
          </div>
          
          <p className="text-sm text-muted-foreground text-center">
            מנהל המערכת יבדוק את הבקשה שלך ויאשר אותה בהקדם האפשרי.
            תוכל להיכנס למערכת לאחר קבלת האישור.
          </p>

          <Button 
            variant="outline" 
            className="w-full gap-2"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            התנתק וחזור למסך הכניסה
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
