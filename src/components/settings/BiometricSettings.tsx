import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Fingerprint, Trash2, Smartphone, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface SavedCredential {
  id: string;
  credential_id: string;
  device_name: string | null;
  created_at: string;
  last_used_at: string | null;
}

export function BiometricSettings() {
  const { isSupported, registerBiometric } = useBiometricAuth();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [credentials, setCredentials] = useState<SavedCredential[]>([]);

  useEffect(() => {
    if (user) {
      fetchCredentials();
    }
  }, [user]);

  const fetchCredentials = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('user_webauthn_credentials')
      .select('id, credential_id, device_name, created_at, last_used_at')
      .eq('user_id', user.id);

    if (!error && data) {
      setCredentials(data);
    }
  };

  const handleRegister = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const success = await registerBiometric(user.id, user.email || 'user@app.com');
      if (success) {
        fetchCredentials();
      }
    } catch (error: any) {
      console.error('Biometric registration error:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לרשום טביעת אצבע',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  const handleDelete = async (credentialId: string) => {
    const { error } = await supabase
      .from('user_webauthn_credentials')
      .delete()
      .eq('id', credentialId);

    if (error) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן למחוק את ההתקן',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'נמחק',
        description: 'ההתקן הוסר מהחשבון',
      });
      fetchCredentials();
    }
  };

  if (!isSupported) {
    return (
      <Card className="border-warning/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-warning">
            <AlertCircle className="h-5 w-5" />
            אימות ביומטרי לא זמין
          </CardTitle>
          <CardDescription>
            הדפדפן או המכשיר שלך אינם תומכים באימות ביומטרי, או שאינך משתמש בחיבור HTTPS.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5" />
          אימות ביומטרי
        </CardTitle>
        <CardDescription>
          התחבר עם טביעת אצבע או Face ID במקום סיסמה
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Registered Devices */}
        {credentials.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">התקנים רשומים:</p>
            {credentials.map((cred) => (
              <div
                key={cred.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">
                      {cred.device_name || 'התקן לא ידוע'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      נרשם: {format(new Date(cred.created_at), 'dd/MM/yyyy', { locale: he })}
                      {cred.last_used_at && (
                        <> • שימוש אחרון: {format(new Date(cred.last_used_at), 'dd/MM/yyyy', { locale: he })}</>
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(cred.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Register New Device */}
        <Button
          onClick={handleRegister}
          disabled={isLoading}
          variant={credentials.length > 0 ? 'outline' : 'default'}
          className="w-full"
        >
          <Fingerprint className="h-4 w-4 ml-2" />
          {credentials.length > 0 ? 'הוסף התקן נוסף' : 'הוסף טביעת אצבע'}
        </Button>

        {credentials.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" />
            אימות ביומטרי פעיל
          </div>
        )}
      </CardContent>
    </Card>
  );
}
