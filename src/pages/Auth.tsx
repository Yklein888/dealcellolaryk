import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { Loader2, Phone, Smartphone, Wifi, UserPlus, Fingerprint } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const { isSupported: isBiometricSupported, isLoading: biometricLoading, authenticateWithBiometric } = useBiometricAuth();

  // Handle biometric login
  const handleBiometricLogin = async () => {
    const userId = await authenticateWithBiometric();
    if (userId) {
      // User authenticated via biometric - they should already have a session
      // The WebAuthn credential is tied to their account
      toast({
        title: 'התחברת בהצלחה!',
        description: 'ברוך הבא למערכת',
      });
      // Refresh the page to trigger auth state check
      window.location.reload();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        toast({
          title: 'שגיאה',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      // Validate display name
      if (!displayName.trim()) {
        toast({
          title: 'שגיאה',
          description: 'יש להזין שם מלא',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const { error, data } = await signUp(email, password);
      
      if (error) {
        toast({
          title: 'שגיאה',
          description: error.message,
          variant: 'destructive',
        });
      } else if (data?.user) {
        // Insert pending user record with display name
        const { error: pendingError } = await supabase
          .from('pending_users')
          .insert({
            user_id: data.user.id,
            display_name: displayName.trim(),
            email: email
          });

        if (pendingError) {
          console.error('Error creating pending user:', pendingError);
        }

        toast({
          title: 'נרשמת בהצלחה!',
          description: 'הבקשה שלך נשלחה לאישור. תוכל להיכנס למערכת לאחר אישור מנהל.',
        });
        
        // Sign out immediately - user needs approval first
        await supabase.auth.signOut();
        
        setIsLogin(true);
        setEmail('');
        setPassword('');
        setDisplayName('');
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        {/* Logo/Brand Area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground mb-4 shadow-lg">
            <Smartphone className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">ניהול השכרות</h1>
          <p className="text-muted-foreground mt-1">מערכת ניהול השכרות ותיקונים</p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">
              {isLogin ? 'התחברות למערכת' : 'הרשמה למערכת'}
            </CardTitle>
            <CardDescription>
              {isLogin 
                ? 'הזן את פרטי ההתחברות שלך'
                : 'צור חשבון חדש - נדרש אישור מנהל'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">שם מלא</Label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="ישראל ישראלי"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required={!isLogin}
                    className="text-right"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">אימייל</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">סיסמה</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    מעבד...
                  </>
                ) : (
                  isLogin ? 'התחבר' : (
                    <>
                      <UserPlus className="ml-2 h-4 w-4" />
                      שלח בקשת הרשמה
                    </>
                  )
                )}
              </Button>
            </form>

            {/* Biometric Login Button */}
            {isLogin && isBiometricSupported && (
              <div className="mt-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">או</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-4 h-12 text-base"
                  onClick={handleBiometricLogin}
                  disabled={biometricLoading}
                >
                  {biometricLoading ? (
                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Fingerprint className="ml-2 h-5 w-5" />
                  )}
                  התחבר עם טביעת אצבע
                </Button>
              </div>
            )}

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-primary hover:underline"
              >
                {isLogin 
                  ? 'אין לך חשבון? הרשם כאן'
                  : 'כבר יש לך חשבון? התחבר כאן'}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Features Preview */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="p-3 rounded-lg bg-card/50">
            <Phone className="w-5 h-5 mx-auto mb-1 text-primary" />
            <span className="text-xs text-muted-foreground">השכרות</span>
          </div>
          <div className="p-3 rounded-lg bg-card/50">
            <Wifi className="w-5 h-5 mx-auto mb-1 text-primary" />
            <span className="text-xs text-muted-foreground">מלאי SIM</span>
          </div>
          <div className="p-3 rounded-lg bg-card/50">
            <Smartphone className="w-5 h-5 mx-auto mb-1 text-primary" />
            <span className="text-xs text-muted-foreground">תיקונים</span>
          </div>
        </div>
      </div>
    </div>
  );
}
