import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Utility functions for base64 conversion
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown Device';
}

export function useBiometricAuth() {
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check WebAuthn support - requires HTTPS
    const checkSupport = async () => {
      const supported = 
        typeof window !== 'undefined' &&
        window.PublicKeyCredential !== undefined &&
        (window.location.protocol === 'https:' || window.location.hostname === 'localhost');
      
      setIsSupported(supported);
    };
    
    checkSupport();
  }, []);

  // Check if user has registered biometric
  const checkRegistration = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_webauthn_credentials')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      if (error) throw error;
      setIsRegistered(data && data.length > 0);
      return data && data.length > 0;
    } catch (error) {
      console.error('Error checking biometric registration:', error);
      return false;
    }
  }, []);

  // Register biometric credential
  const registerBiometric = async (userId: string, userEmail: string) => {
    if (!isSupported) {
      toast({
        title: 'לא נתמך',
        description: 'הדפדפן שלך לא תומך באימות ביומטרי',
        variant: 'destructive',
      });
      return false;
    }

    setIsLoading(true);

    try {
      // Generate challenge
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { 
            name: "ניהול השכרות",
            id: window.location.hostname,
          },
          user: {
            id: new TextEncoder().encode(userId),
            name: userEmail,
            displayName: userEmail.split('@')[0],
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" }, // ES256
            { alg: -257, type: "public-key" }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform", // Built-in biometric
            userVerification: "required",
            residentKey: "preferred",
          },
          timeout: 60000,
          attestation: "none",
        },
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('לא הצלחנו ליצור credential');
      }

      const response = credential.response as AuthenticatorAttestationResponse;
      
      // Save credential to database
      const { error } = await supabase.from('user_webauthn_credentials').insert({
        user_id: userId,
        credential_id: arrayBufferToBase64(credential.rawId),
        public_key: arrayBufferToBase64(response.getPublicKey() || new ArrayBuffer(0)),
        device_name: getDeviceName(),
      });

      if (error) throw error;

      setIsRegistered(true);
      toast({
        title: 'נרשם בהצלחה!',
        description: 'עכשיו תוכל להתחבר עם טביעת אצבע',
      });

      return true;
    } catch (error: any) {
      console.error('Error registering biometric:', error);
      
      // Handle specific WebAuthn errors
      if (error.name === 'NotAllowedError') {
        toast({
          title: 'בוטל',
          description: 'הרישום בוטל או שהזמן פג',
          variant: 'destructive',
        });
      } else if (error.name === 'InvalidStateError') {
        toast({
          title: 'כבר רשום',
          description: 'טביעת האצבע כבר רשומה למשתמש זה',
        });
      } else {
        toast({
          title: 'שגיאה ברישום',
          description: error.message || 'לא ניתן לרשום טביעת אצבע',
          variant: 'destructive',
        });
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Authenticate with biometric
  const authenticateWithBiometric = async (): Promise<string | null> => {
    if (!isSupported) {
      toast({
        title: 'לא נתמך',
        description: 'הדפדפן שלך לא תומך באימות ביומטרי',
        variant: 'destructive',
      });
      return null;
    }

    setIsLoading(true);

    try {
      // Get all stored credentials
      const { data: credentials, error } = await supabase
        .from('user_webauthn_credentials')
        .select('credential_id, user_id');

      if (error) throw error;
      if (!credentials || credentials.length === 0) {
        toast({
          title: 'אין רישום',
          description: 'לא נמצאה טביעת אצבע רשומה. יש להתחבר עם סיסמה ולרשום טביעת אצבע בהגדרות.',
          variant: 'destructive',
        });
        return null;
      }

      const challenge = crypto.getRandomValues(new Uint8Array(32));

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          allowCredentials: credentials.map((c) => ({
            type: "public-key" as const,
            id: base64ToArrayBuffer(c.credential_id),
          })),
          userVerification: "required",
          timeout: 60000,
        },
      }) as PublicKeyCredential;

      if (!assertion) {
        throw new Error('אימות נכשל');
      }

      // Find matching credential
      const assertionId = arrayBufferToBase64(assertion.rawId);
      const matched = credentials.find((c) => c.credential_id === assertionId);

      if (!matched) {
        throw new Error('לא נמצא credential תואם');
      }

      // Update last used timestamp
      await supabase
        .from('user_webauthn_credentials')
        .update({ last_used_at: new Date().toISOString() })
        .eq('credential_id', assertionId);

      return matched.user_id;
    } catch (error: any) {
      console.error('Error authenticating with biometric:', error);

      if (error.name === 'NotAllowedError') {
        toast({
          title: 'בוטל',
          description: 'האימות בוטל או שהזמן פג',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'שגיאה באימות',
          description: error.message || 'לא ניתן לאמת עם טביעת אצבע',
          variant: 'destructive',
        });
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Remove biometric credential
  const removeBiometric = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_webauthn_credentials')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      setIsRegistered(false);
      toast({
        title: 'הוסר בהצלחה',
        description: 'טביעת האצבע הוסרה מהחשבון',
      });
      return true;
    } catch (error) {
      console.error('Error removing biometric:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן להסיר את טביעת האצבע',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    isSupported,
    isRegistered,
    isLoading,
    checkRegistration,
    registerBiometric,
    authenticateWithBiometric,
    removeBiometric,
  };
}
