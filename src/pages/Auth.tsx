import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { Loader2, Smartphone, Wifi, Wrench, Signal, ShoppingCart, Fingerprint, UserPlus, ChevronDown } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const { isSupported: isBiometricSupported, isLoading: biometricLoading, authenticateWithBiometric, checkAnyCredentials } = useBiometricAuth();
  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  // On mount: check if any credentials exist and auto-trigger on mobile
  useEffect(() => {
    if (!isBiometricSupported) return;
    checkAnyCredentials().then((has) => {
      setHasCredentials(has);
      // Auto-trigger biometric on mobile if credentials exist
      if (has && isMobile && isLogin) {
        setTimeout(() => handleBiometricLogin(), 1800);
      }
    });
  }, [isBiometricSupported, isLogin]);

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
    { icon: Signal,       label: 'SIM ניהול', color: '#06B6D4' },
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
          background: 'linear-gradient(135deg, #0D9488 0%, #06B6D4 50%, #0F766E 100%)',
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
        <div className="lg:hidden" style={{ textAlign: 'center', marginBottom: hasCredentials && isLogin && !showPasswordForm ? 24 : 32 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16,
            background: 'linear-gradient(135deg,#0D9488,#06B6D4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
            boxShadow: '0 4px 16px rgba(13,148,136,0.35)',
          }}>
            <Smartphone style={{ width: 28, height: 28, color: 'white' }} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>DealCell</h2>
        </div>

        {/* ── Mobile Biometric Primary Screen ── */}
        {isLogin && hasCredentials && !showPasswordForm && (
          <div className="lg:hidden" dir="rtl" style={{ maxWidth: 360, width: '100%', margin: '0 auto', textAlign: 'center' }}>
            <style>{`
              @keyframes fingerprintPulse {
                0%, 100% { box-shadow: 0 0 0 0 rgba(13,148,136,0.4), 0 8px 32px rgba(13,148,136,0.35); }
                50% { box-shadow: 0 0 0 18px rgba(13,148,136,0), 0 8px 32px rgba(13,148,136,0.35); }
              }
              @keyframes fingerprintPulse2 {
                0%, 100% { box-shadow: 0 0 0 0 rgba(6,182,212,0.3); }
                50% { box-shadow: 0 0 0 28px rgba(6,182,212,0); }
              }
            `}</style>

            <p style={{ fontSize: 15, color: '#6B7280', marginBottom: 32 }}>
              השתמש בטביעת האצבע שלך לכניסה מהירה
            </p>

            {/* Big pulsing fingerprint button */}
            <button
              onClick={handleBiometricLogin}
              disabled={biometricLoading}
              style={{
                width: 120, height: 120, borderRadius: '50%',
                background: biometricLoading
                  ? 'linear-gradient(135deg,#5EEAD4,#22D3EE)'
                  : 'linear-gradient(135deg,#0D9488,#06B6D4)',
                border: 'none', cursor: biometricLoading ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 32px',
                animation: biometricLoading ? 'none' : 'fingerprintPulse 2s ease-in-out infinite',
                transition: 'all 0.2s',
              }}
            >
              {biometricLoading ? (
                <Loader2 style={{ width: 48, height: 48, color: 'white', animation: 'spin 1s linear infinite' }} />
              ) : (
                <Fingerprint style={{ width: 52, height: 52, color: 'white' }} />
              )}
            </button>

            <p style={{ fontSize: 17, fontWeight: 700, color: '#0F766E', marginBottom: 4 }}>
              {biometricLoading ? 'מאמת...' : 'לחץ לכניסה'}
            </p>
            <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 40 }}>
              טביעת אצבע / Face ID
            </p>

            {/* Switch to password */}
            <button
              onClick={() => setShowPasswordForm(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#6B7280', fontSize: 14, display: 'flex',
                alignItems: 'center', gap: 6, margin: '0 auto',
              }}
            >
              <ChevronDown style={{ width: 16, height: 16 }} />
              כניסה עם סיסמה
            </button>
          </div>
        )}

        <div style={{ maxWidth: 360, width: '100%', margin: '0 auto' }}
          className={isLogin && hasCredentials && !showPasswordForm ? 'hidden lg:block' : ''}
        >
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
                background: loading ? '#A5B4FC' : 'linear-gradient(135deg,#0D9488,#06B6D4)',
                color: 'white',
                fontSize: 15,
                fontWeight: 700,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: loading ? 'none' : '0 4px 14px rgba(13,148,136,0.4)',
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

          {/* Biometric — Desktop only (mobile has full-screen above) */}
          {isLogin && isBiometricSupported && hasCredentials && (
            <div className="hidden lg:block" style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
                <span style={{ fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap' }}>או</span>
                <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
              </div>
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={biometricLoading}
                style={{
                  width: '100%', height: 56, borderRadius: 14,
                  border: '2px solid #CCFBF1',
                  background: 'linear-gradient(135deg, #F0FDFA 0%, #F0FDFA 100%)',
                  cursor: biometricLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(13,148,136,0.12)',
                  opacity: biometricLoading ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!biometricLoading) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#2DD4BF';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(13,148,136,0.25)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#CCFBF1';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(13,148,136,0.12)';
                  (e.currentTarget as HTMLButtonElement).style.transform = '';
                }}
              >
                {biometricLoading ? (
                  <Loader2 style={{ width: 24, height: 24, color: '#0D9488', animation: 'spin 1s linear infinite' }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#0D9488,#06B6D4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 10px rgba(13,148,136,0.35)' }}>
                    <Fingerprint style={{ width: 22, height: 22, color: 'white' }} />
                  </div>
                )}
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#0F766E', margin: 0, lineHeight: 1.2 }}>
                    {biometricLoading ? 'מאמת...' : 'כניסה מהירה'}
                  </p>
                  <p style={{ fontSize: 11, color: '#2DD4BF', margin: 0, marginTop: 2 }}>טביעת אצבע / Face ID</p>
                </div>
              </button>
            </div>
          )}

          <p style={{ marginTop: 28, textAlign: 'center', fontSize: 13, color: '#6B7280' }}>
            {isLogin ? 'אין לך חשבון? ' : 'כבר יש לך חשבון? '}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              style={{ color: '#0D9488', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13 }}
            >
              {isLogin ? 'הרשמה כאן' : 'התחבר כאן'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
