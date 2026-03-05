import { useState, useEffect, useCallback, useRef } from 'react';
import { simManagerClient } from '@/integrations/supabase/simManagerClient';
import { USSim, USSimStatus } from '@/types/rental';

type SimRow = {
  id: string;
  sim_company: string;
  sim_number: string | null;
  package: string | null;
  local_number: string | null;
  israeli_number: string | null;
  expiry_date: string | null;
  status: string;
  notes: string | null;
  includes_israeli_number: boolean | null;
  created_at: string;
  updated_at: string;
};

function mapSim(row: SimRow): USSim {
  return {
    id: row.id,
    simCompany: row.sim_company,
    simNumber: row.sim_number ?? undefined,
    package: row.package as any ?? undefined,
    localNumber: row.local_number ?? undefined,
    israeliNumber: row.israeli_number ?? undefined,
    expiryDate: row.expiry_date ?? undefined,
    status: row.status as USSimStatus,
    notes: row.notes ?? undefined,
    includesIsraeliNumber: row.includes_israeli_number ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildStatusChangeMessage(
  sim: USSim,
  oldStatus: USSimStatus,
  newStatus: USSimStatus
): string {
  if (newStatus === 'activating') {
    return `🔄 סים ${sim.simCompany} החל בהפעלה\nממתין למספרים...`;
  }
  if (newStatus === 'active') {
    return `✅ סים ${sim.simCompany} הופעל בהצלחה!\n📱 מספר מקומי: ${sim.localNumber || 'לא מוגדר'}\n🇮🇱 מספר ישראלי: ${sim.israeliNumber || 'לא הוגדר'}\nתוקף: ${sim.expiryDate || 'לא מוגדר'}`;
  }
  if (newStatus === 'returned') {
    return `🔙 סים ${sim.simCompany} הוחזר למלאי`;
  }
  return `📱 סים ${sim.simCompany}: ${newStatus}`;
}

// ── Cache helpers ────────────────────────────────────────────────────────
const CACHE_KEY = 'dealcellular_us_sims_cache';
const CACHE_EXPIRY_KEY = 'dealcellular_us_sims_cache_expiry';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

function getCachedSims(): USSim[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);

    if (cached && expiry && Date.now() < parseInt(expiry)) {
      return JSON.parse(cached);
    }

    // Clear expired cache
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_EXPIRY_KEY);
  } catch (e) {
    console.warn('Failed to read US SIMs cache:', e);
  }
  return null;
}

function setCachedSims(sims: USSim[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(sims));
    localStorage.setItem(CACHE_EXPIRY_KEY, (Date.now() + CACHE_EXPIRY_MS).toString());
  } catch (e) {
    console.warn('Failed to cache US SIMs:', e);
  }
}

export function useUSSims() {
  const [sims, setSims] = useState<USSim[]>(() => getCachedSims() ?? []);
  const [loading, setLoading] = useState(true);
  const [activatorToken, setActivatorToken] = useState<string | null>(null);
  const [whatsappContact, setWhatsappContact] = useState<string | null>(null);
  const previousSimsRef = useRef<USSim[]>([]);

  const fetchSims = useCallback(async (token?: string) => {
    const t = token ?? activatorToken;
    if (!t) return;
    const { data, error } = await simManagerClient.rpc('get_sims_by_token', { p_token: t });
    if (!error && data) {
      const newSims = (data as SimRow[]).map(mapSim);

      // Cache the results
      setCachedSims(newSims);

      // Detect status changes and send WhatsApp notifications
      if (whatsappContact && previousSimsRef.current.length > 0) {
        for (const newSim of newSims) {
          const oldSim = previousSimsRef.current.find(s => s.id === newSim.id);
          if (oldSim && oldSim.status !== newSim.status) {
            // Status changed - send WhatsApp notification
            try {
              const message = buildStatusChangeMessage(newSim, oldSim.status, newSim.status);
              // Edge function deployed to sim-manager project
              await simManagerClient.functions.invoke('send-whatsapp-notification', {
                body: {
                  phone: whatsappContact,
                  message: message,
                },
              });
            } catch (err) {
              console.warn('Failed to send WhatsApp notification:', err);
            }
          }
        }
      }

      previousSimsRef.current = newSims;
      setSims(newSims);
    }
  }, [activatorToken, whatsappContact]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // Load token and WhatsApp contact (anon can read app_settings)
      const { data: settings } = await simManagerClient
        .from('app_settings')
        .select('key, value');

      if (!mounted) return;

      const tokenSetting = settings?.find(s => s.key === 'us_activator_token');
      const whatsappSetting = settings?.find(s => s.key === 'us_activator_whatsapp');

      if (tokenSetting?.value) {
        setActivatorToken(tokenSetting.value);
        if (whatsappSetting?.value) {
          setWhatsappContact(whatsappSetting.value);
        }

        const { data, error } = await simManagerClient.rpc('get_sims_by_token', { p_token: tokenSetting.value });
        if (mounted && !error && data) {
          const mappedSims = (data as SimRow[]).map(mapSim);
          setSims(mappedSims);
          previousSimsRef.current = mappedSims;
        }
      }
      if (mounted) setLoading(false);
    };

    init();
    return () => { mounted = false; };
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!activatorToken) return;

    const channel = simManagerClient
      .channel('us_sims_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'us_sims' }, () => fetchSims())
      .subscribe();

    return () => { simManagerClient.removeChannel(channel); };
  }, [activatorToken, fetchSims]);

  const addSim = useCallback(async (simCompany: string, simNumber?: string, pkg?: string, notes?: string, includesIsraeli?: boolean) => {
    if (!activatorToken) return { error: new Error('No token') };
    const { data, error } = await simManagerClient.rpc('add_sim_by_token', {
      p_token: activatorToken,
      p_company: simCompany,
      p_sim_number: simNumber || null,
      p_package: pkg || null,
      p_notes: notes || null,
      p_includes_israeli: includesIsraeli || false,
    });
    if (!error) fetchSims();
    const result = data as { error?: string } | null;
    return { error: error ?? (result?.error ? new Error(result.error) : null) };
  }, [activatorToken, fetchSims]);

  const deleteSim = useCallback(async (id: string) => {
    if (!activatorToken) return { error: new Error('No token') };
    const { error } = await simManagerClient.rpc('delete_sim_by_token', {
      p_id: id,
      p_token: activatorToken,
    });
    if (!error) fetchSims();
    return { error };
  }, [activatorToken, fetchSims]);

  const markReturned = useCallback(async (id: string) => {
    if (!activatorToken) return { error: new Error('No token') };
    const { error } = await simManagerClient.rpc('mark_sim_returned_by_token', {
      p_id: id,
      p_token: activatorToken,
    });
    if (!error) fetchSims();
    return { error };
  }, [activatorToken, fetchSims]);

  const renewSim = useCallback(async (id: string, months: number = 1, includesIsraeli?: boolean) => {
    if (!activatorToken) return { error: new Error('No token') };
    const { data, error } = await simManagerClient.rpc('renew_sim_by_token', {
      p_id: id,
      p_token: activatorToken,
      p_months: months,
      p_includes_israeli: includesIsraeli || false,
    });
    if (!error) fetchSims();
    const result = data as { error?: string; new_expiry?: string } | null;
    return { error: error ?? (result?.error ? new Error(result.error) : null), newExpiry: result?.new_expiry };
  }, [activatorToken, fetchSims]);

  const updateWhatsappContact = useCallback(async (phone: string) => {
    const { error } = await simManagerClient
      .from('app_settings')
      .update({ value: phone })
      .eq('key', 'us_activator_whatsapp');
    if (!error) setWhatsappContact(phone);
    return { error };
  }, []);

  return { sims, loading, activatorToken, whatsappContact, addSim, deleteSim, markReturned, renewSim, updateWhatsappContact };
}
