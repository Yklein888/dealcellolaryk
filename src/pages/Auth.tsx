import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { Loader2, Smartphone, Wifi, Wrench, Signal, ShoppingCart, Fingerprint, UserPlus } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const { isSupported: isBiometricSupported, isLoading: biometricLoading, authenticateWithBiometric } = useBiometricAuth();

  const handleBiometricLogin = async () => {
    const userId = await authenticateWithBiometric();
    if (userId) {
      toast({ title: 'התחברת בהצלחה!', description: 'ברוך הבא למערכת' });
      window.location.reload();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
      }
    } else {
      if (!displayName.trim()) {
        toast({ title: 'שגיאה', description: 'יש להזין שם מלא', variant: 'destructive' });
        setLoading(false);
        return;
      }
      const { error, data } = await signUp(email, password);
      if (error) {
        toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
      } else if (data?.user) {
        await supabase.from('pending_users').insert({
          user_id: data.user.id,
          display_name: displayName.trim(),
          email: email,
        });
        toast({
          title: 'נרשמת בהצלחה!',
          description: 'הבקשה שלך נשלחה לאישור. תוכל להיכנס לאחר אישור מנהל.',
        });
        await supabase.auth.signOut();
        setIsLogin(true);
        setEmail('');
        setPassword('');
        setDisplayName('');
      }
    }
    setLoading(false);
  };

  const features = [
    { icon: ShoppingCart, label: 'השכרות',   color: '#3B82F6' },
    { icon: Signal,       label: 'SIM ניהול', color: '#8B5CF6' },
    { icon: Wrench,       label: 'תיקונים',   color: '#F59E0B' },
    { icon: Wifi,         label: 'מלאי',       color: '#22C55E' },
  ];

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        display: 'flex',
        fontFamily: "'Heebo', 'Inter', sans-serif",
      }}
    >
      {/* Left panel — branding (hidden on mobile) */}
      <div
        style={{
          flex: 1,
          background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #4F46E5 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '48px 40px',
          position: 'relative',
          overflow: 'hidden',
        }}
        className="hidden lg:flex"
      >
        {/* Background circles */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 360 }}>
          {/* Logo */}
          <div style={{
            width: 80, height: 80, borderRadius: 20, background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 28px',
            border: '1px solid rgba(255,255,255,0.25)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          }}>
            <Smartphone style={{ width: 40, height: 40, color: 'white' }} />
          </div>

          <h1 style={{ fontSize: 36, fontWeight: 800, color: 'white', margin: '0 0 12px', lineHeight: 1.15 }}>
            DealCell
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.75)', margin: '0 0 48px', lineHeight: 1.6 }}>
            מערכת ניהול מתקדמת לחנויות<br />השכרת מכשירים וסימים
          </p>

          {/* Feature list */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {features.map(({ icon: Icon, label, color }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.10)',
                borderRadius: 12,
                padding: '16px 12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                border: '1px solid rgba(255,255,255,0.15)',
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon style={{ width: 18, height: 18, color: 'white' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{label}</span>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 40, fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}>
            DEAL CELLULAR © 2025
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{
        width: '100%',
        maxWidth: 480,
        background: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '48px 40px',
        overflowY: 'auto',
      }}>
        {/* Mobile logo */}
        <div className="lg:hidden" style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16,
            background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
            boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
          }}>
            <Smartphone style={{ width: 28, height: 28, color: 'white' }} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>DealCell</h2>
        </div>

        <div style={{ maxWidth: 360, width: '100%', margin: '0 auto' }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
            {isLogin ? 'ברוך הבא 👋' : 'יצירת חשבון'}
          </h2>
          <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 32px' }}>
            {isLogin ? 'הכנס את פרטי ההתחברות שלך' : 'מלא את הפרטים — דרוש אישור מנהל'}
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {!isLogin && (
              <div>
                <Label htmlFor="displayName" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  שם מלא
                </Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="ישראל ישראלי"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required={!isLogin}
                  style={{ height: 44, borderRadius: 10, fontSize: 14, direction: 'rtl' }}
                />
              </div>
            )}

            <div>
              <Label htmlFor="email" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                אימייל
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
                style={{ height: 44, borderRadius: 10, fontSize: 14 }}
              />
            </div>

            <div>
              <Label htmlFor="password" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                סיסמה
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                dir="ltr"
                style={{ height: 44, borderRadius: 10, fontSize: 14 }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                height: 48,
                borderRadius: 12,
                background: loading ? '#A5B4FC' : 'linear-gradient(135deg,#6366F1,#8B5CF6)',
                color: 'white',
                fontSize: 15,
                fontWeight: 700,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: loading ? 'none' : '0 4px 14px rgba(99,102,241,0.4)',
                transition: 'all 0.2s',
                marginTop: 4,
              }}
            >
              {loading ? (
                <><Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />מעבד...</>
              ) : isLogin ? (
                'כניסה למערכת'
              ) : (
                <><UserPlus style={{ width: 18, height: 18 }} />שלח בקשת הרשמה</>
              )}
            </button>
          </form>

          {/* Biometric */}
          {isLogin && isBiometricSupported && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
                <span style={{ fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap' }}>או התחבר עם</span>
                <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
              </div>
              <Button
                type="button"
                variant="outline"
                style={{ width: '100%', height: 44, borderRadius: 10, fontSize: 14, gap: 8 }}
                onClick={handleBiometricLogin}
                disabled={biometricLoading}
              >
                {biometricLoading ? <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" /> : <Fingerprint style={{ width: 18, height: 18 }} />}
                טביעת אצבע / Face ID
              </Button>
            </div>
          )}

          <p style={{ marginTop: 28, textAlign: 'center', fontSize: 13, color: '#6B7280' }}>
            {isLogin ? 'אין לך חשבון? ' : 'כבר יש לך חשבון? '}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              style={{ color: '#6366F1', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13 }}
            >
              {isLogin ? 'הרשמה כאן' : 'התחבר כאן'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
