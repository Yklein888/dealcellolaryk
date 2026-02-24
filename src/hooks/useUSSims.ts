import { useState, useEffect, useCallback } from 'react';
import { simManagerClient } from '@/integrations/supabase/simManagerClient';
import { USSim, USSimStatus } from '@/types/rental';

type SimRow = {
  id: string;
  sim_company: string;
  sim_number: string | null;
  package: string | null;
  price_per_day: number | null;
  local_number: string | null;
  israeli_number: string | null;
  expiry_date: string | null;
  status: string;
  notes: string | null;
  renewal_contact: string | null;
  renewal_method: string | null;
  includes_israeli_number: boolean | null;
  created_at: string;
  updated_at: string;
};

function mapSim(row: SimRow): USSim {
  return {
    id: row.id,
    simCompany: row.sim_company,
    simNumber: row.sim_number ?? undefined,
    package: row.package ?? undefined,
    pricePerDay: row.price_per_day ?? undefined,
    localNumber: row.local_number ?? undefined,
    israeliNumber: row.israeli_number ?? undefined,
    expiryDate: row.expiry_date ?? undefined,
    status: row.status as USSimStatus,
    notes: row.notes ?? undefined,
    renewalContact: row.renewal_contact ?? undefined,
    renewalMethod: row.renewal_method ?? undefined,
    includesIsraeliNumber: row.includes_israeli_number ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useUSSims() {
  const [sims, setSims] = useState<USSim[]>([]);
  const [loading, setLoading] = useState(true);
  const [activatorToken, setActivatorToken] = useState<string | null>(null);

  const fetchSims = useCallback(async (token?: string) => {
    const t = token ?? activatorToken;
    if (!t) return;
    const { data, error } = await simManagerClient.rpc('get_sims_by_token', { p_token: t });
    if (!error && data) {
      setSims((data as SimRow[]).map(mapSim));
    }
  }, [activatorToken]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // Load token (anon can read app_settings due to anon_read_settings policy)
      const { data: setting } = await simManagerClient
        .from('app_settings')
        .select('value')
        .eq('key', 'us_activator_token')
        .single();

      if (!mounted) return;

      if (setting) {
        setActivatorToken(setting.value);
        const { data, error } = await simManagerClient.rpc('get_sims_by_token', { p_token: setting.value });
        if (mounted && !error && data) {
          setSims((data as SimRow[]).map(mapSim));
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

  const addSim = useCallback(async (simCompany: string, simNumber?: string, pkg?: string, notes?: string, price?: number) => {
    if (!activatorToken) return { error: new Error('No token') };
    const { data, error } = await simManagerClient.rpc('add_sim_by_token', {
      p_token: activatorToken,
      p_company: simCompany,
      p_sim_number: simNumber || null,
      p_package: pkg || null,
      p_notes: notes || null,
      p_price_per_day: price || null,
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

  const renewSim = useCallback(async (id: string, months: number = 1, contact?: string, method?: string, includesIsraeli?: boolean) => {
    if (!activatorToken) return { error: new Error('No token') };
    const { data, error } = await simManagerClient.rpc('renew_sim_by_token', {
      p_id: id,
      p_token: activatorToken,
      p_months: months,
      p_contact: contact || null,
      p_method: method || null,
      p_includes_israeli: includesIsraeli || false,
    });
    if (!error) fetchSims();
    const result = data as { error?: string; new_expiry?: string } | null;
    return { error: error ?? (result?.error ? new Error(result.error) : null), newExpiry: result?.new_expiry };
  }, [activatorToken, fetchSims]);

  return { sims, loading, activatorToken, addSim, deleteSim, markReturned, renewSim };
}
