import { useState, useEffect } from 'react';
import { Fingerprint, X, Shield, Zap } from 'lucide-react';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { useAuth } from '@/hooks/useAuth';

const DISMISS_KEY = 'biometric-prompt-dismissed-at';
const SNOOZE_DAYS = 7;

export function BiometricRegistrationBanner() {
  const { user } = useAuth();
  const { isSupported, checkRegistration, registerBiometric } = useBiometricAuth();
  const [visible, setVisible] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user || !isSupported) return;

    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const daysSince = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSince < SNOOZE_DAYS) return;
    }

    checkRegistration(user.id).then((registered) => {
      if (!registered) {
        setTimeout(() => setVisible(true), 1200);
      }
    });
  }, [user, isSupported, checkRegistration]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const handleRegister = async () => {
    if (!user) return;
    setRegistering(true);
    const success = await registerBiometric(user.id, user.email || '');
    setRegistering(false);
    if (success) {
      setDone(true);
      setTimeout(() => setVisible(false), 2500);
    }
  };

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes slideUpSheet {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes fadeInOverlay {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes popIn {
          0%   { transform: scale(0.5); opacity: 0; }
          70%  { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes slideUpBanner {
          from { transform: translateY(120%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* ── MOBILE: full bottom sheet ── */}
      <div dir="rtl" className="lg:hidden">
        {/* Overlay */}
        <div
          onClick={handleDismiss}
          style={{
            position: 'fixed', inset: 0, zIndex: 998,
            background: 'rgba(0,0,0,0.45)',
            animation: 'fadeInOverlay 0.3s ease',
          }}
        />

        {/* Sheet */}
        <div
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            zIndex: 999,
            background: 'white',
            borderRadius: '24px 24px 0 0',
            padding: '8px 24px 40px',
            animation: 'slideUpSheet 0.4s cubic-bezier(0.32,0.72,0,1)',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
          }}
        >
          {/* Handle */}
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E5E7EB', margin: '12px auto 24px' }} />

          {/* Close */}
          <button
            onClick={handleDismiss}
            style={{
              position: 'absolute', top: 20, left: 20,
              width: 32, height: 32, borderRadius: 10,
              background: '#F3F4F6', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X style={{ width: 16, height: 16, color: '#6B7280' }} />
          </button>

          {done ? (
            /* Success state */
            <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
              <div style={{
                width: 80, height: 80, borderRadius: 24,
                background: 'linear-gradient(135deg,#059669,#10B981)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
                boxShadow: '0 8px 24px rgba(5,150,105,0.4)',
                animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1)',
              }}>
                <Fingerprint style={{ width: 40, height: 40, color: 'white' }} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>
                נרשמת בהצלחה! 🎉
              </h2>
              <p style={{ fontSize: 15, color: '#6B7280', margin: 0 }}>
                בפעם הבאה תוכל להיכנס עם טביעת אצבע
              </p>
            </div>
          ) : (
            /* Registration offer */
            <>
              {/* Hero icon */}
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{
                  width: 88, height: 88, borderRadius: 26,
                  background: 'linear-gradient(135deg,#0D9488,#06B6D4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 18px',
                  boxShadow: '0 10px 30px rgba(13,148,136,0.4)',
                }}>
                  <Fingerprint style={{ width: 46, height: 46, color: 'white' }} />
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>
                  כניסה מהירה עם טביעת אצבע
                </h2>
                <p style={{ fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
                  הירשם פעם אחת ותיכנס בשנייה<br />בכל כניסה הבאה
                </p>
              </div>

              {/* Benefits */}
              <div style={{
                display: 'flex', gap: 12, marginBottom: 24,
                background: '#F0FDFA', borderRadius: 14, padding: '14px 16px',
              }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: '#CCFBF1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Zap style={{ width: 16, height: 16, color: '#0D9488' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#0F766E', textAlign: 'center' }}>כניסה מהירה</span>
                </div>
                <div style={{ width: 1, background: '#CCFBF1' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: '#CCFBF1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Shield style={{ width: 16, height: 16, color: '#0D9488' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#0F766E', textAlign: 'center' }}>מאובטח לחלוטין</span>
                </div>
                <div style={{ width: 1, background: '#CCFBF1' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: '#CCFBF1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Fingerprint style={{ width: 16, height: 16, color: '#0D9488' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#0F766E', textAlign: 'center' }}>ללא סיסמה</span>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={handleRegister}
                disabled={registering}
                style={{
                  width: '100%', height: 54,
                  borderRadius: 16,
                  background: registering ? '#A5B4FC' : 'linear-gradient(135deg,#0D9488,#06B6D4)',
                  color: 'white', fontSize: 16, fontWeight: 700,
                  border: 'none', cursor: registering ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: registering ? 'none' : '0 6px 20px rgba(13,148,136,0.45)',
                  marginBottom: 12,
                  transition: 'all 0.2s',
                }}
              >
                <Fingerprint style={{ width: 22, height: 22 }} />
                {registering ? 'ממתין לאישור...' : 'הוסף טביעת אצבע עכשיו'}
              </button>

              <button
                onClick={handleDismiss}
                style={{
                  width: '100%', height: 44,
                  borderRadius: 12, background: 'transparent',
                  color: '#9CA3AF', fontSize: 14, fontWeight: 500,
                  border: 'none', cursor: 'pointer',
                }}
              >
                אחר כך
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── DESKTOP: corner banner ── */}
      <div
        dir="rtl"
        className="hidden lg:block"
        style={{
          position: 'fixed', bottom: 24, left: 24,
          zIndex: 999,
          animation: 'slideUpBanner 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div style={{
          background: done
            ? 'linear-gradient(135deg,#059669,#10B981)'
            : 'linear-gradient(135deg,#0D9488,#06B6D4)',
          borderRadius: 20, padding: '16px 18px',
          boxShadow: '0 8px 32px rgba(13,148,136,0.45)',
          display: 'flex', alignItems: 'center', gap: 12,
          width: 320, transition: 'background 0.5s',
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 13,
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, border: '1px solid rgba(255,255,255,0.3)',
          }}>
            <Fingerprint style={{ width: 24, height: 24, color: 'white' }} />
          </div>

          <div style={{ flex: 1 }}>
            {done ? (
              <>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: 0 }}>נרשמת בהצלחה! 🎉</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', margin: '2px 0 0' }}>עכשיו אפשר להתחבר עם טביעת אצבע</p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: '0 0 8px' }}>כניסה מהירה עם טביעת אצבע</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleRegister}
                    disabled={registering}
                    style={{
                      height: 30, paddingInline: 14, borderRadius: 8,
                      background: 'white', color: '#0D9488',
                      fontSize: 12, fontWeight: 700, border: 'none',
                      cursor: registering ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <Fingerprint style={{ width: 13, height: 13 }} />
                    {registering ? 'מאמת...' : 'הוסף עכשיו'}
                  </button>
                  <button
                    onClick={handleDismiss}
                    style={{
                      height: 30, paddingInline: 10, borderRadius: 8,
                      background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)',
                      fontSize: 12, fontWeight: 500,
                      border: '1px solid rgba(255,255,255,0.25)', cursor: 'pointer',
                    }}
                  >
                    אחר כך
                  </button>
                </div>
              </>
            )}
          </div>

          {!done && (
            <button
              onClick={handleDismiss}
              style={{
                width: 26, height: 26, borderRadius: 7,
                background: 'rgba(255,255,255,0.15)', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, alignSelf: 'flex-start',
              }}
            >
              <X style={{ width: 13, height: 13, color: 'white' }} />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
