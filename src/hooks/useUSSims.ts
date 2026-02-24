import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { USSim, USSimStatus } from '@/types/rental';

type SimRow = {
  id: string;
  sim_company: string;
  package: string | null;
  local_number: string | null;
  israeli_number: string | null;
  expiry_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapSim(row: SimRow): USSim {
  return {
    id: row.id,
    simCompany: row.sim_company,
    package: row.package ?? undefined,
    localNumber: row.local_number ?? undefined,
    israeliNumber: row.israeli_number ?? undefined,
    expiryDate: row.expiry_date ?? undefined,
    status: row.status as USSimStatus,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useUSSims() {
  const [sims, setSims] = useState<USSim[]>([]);
  const [loading, setLoading] = useState(true);
  const [activatorToken, setActivatorToken] = useState<string | null>(null);

  const fetchSims = useCallback(async () => {
    const { data, error } = await supabase
      .from('us_sims')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setSims((data as SimRow[]).map(mapSim));
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // Load the activator token once (it's static)
      const { data: setting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'us_activator_token')
        .single();
      if (mounted && setting) setActivatorToken(setting.value);

      // Load SIMs
      const { data, error } = await supabase
        .from('us_sims')
        .select('*')
        .order('created_at', { ascending: false });
      if (mounted && !error && data) {
        setSims((data as SimRow[]).map(mapSim));
      }
      if (mounted) setLoading(false);
    };

    init();

    // Realtime: refresh when any SIM row changes
    const channel = supabase
      .channel('us_sims_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'us_sims' }, fetchSims)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [fetchSims]);

  const addSim = useCallback(async (simCompany: string, pkg?: string, notes?: string) => {
    const { error } = await supabase.from('us_sims').insert({
      sim_company: simCompany,
      package: pkg || null,
      notes: notes || null,
    });
    if (!error) fetchSims();
    return { error };
  }, [fetchSims]);

  const deleteSim = useCallback(async (id: string) => {
    const { error } = await supabase.from('us_sims').delete().eq('id', id);
    if (!error) fetchSims();
    return { error };
  }, [fetchSims]);

  const markReturned = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('us_sims')
      .update({ status: 'returned', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) fetchSims();
    return { error };
  }, [fetchSims]);

  return { sims, loading, activatorToken, addSim, deleteSim, markReturned };
}
