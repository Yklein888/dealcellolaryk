import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CellStationSim {
  id: string;
  sim_number: string | null;
  uk_number: string | null;
  il_number: string | null;
  iccid: string | null;
  status: string | null;
  status_detail: string | null;
  expiry_date: string | null;
  plan: string | null;
  start_date: string | null;
  end_date: string | null;
  customer_name: string | null;
  note: string | null;
  last_sync: string | null;
}

interface SyncStats {
  total: number;
  available: number;
  rented: number;
  expired: number;
  expiring: number;
}

function parseStatusRaw(statusRaw: string | null): { status: string; status_detail: string } {
  if (!statusRaw) return { status: 'available', status_detail: 'unknown' };
  const s = statusRaw.trim();
  if (s.startsWith('בשכירות')) return { status: 'rented', status_detail: 'active' };
  if (s.startsWith('זמין - תקין')) return { status: 'available', status_detail: 'valid' };
  if (s.startsWith('זמין - קרוב לפקיעה')) return { status: 'available', status_detail: 'expiring' };
  if (s.startsWith('זמין - פג תוקף')) return { status: 'available', status_detail: 'expired' };
  return { status: 'available', status_detail: 'unknown' };
}

function extractCustomerName(note: string | null): string | null {
  if (!note) return null;
  // Extract text before phone number pattern
  const match = note.match(/^(.+?)(?:\s*[\d\-+()\s]{7,}|$)/);
  return match?.[1]?.trim() || note.trim() || null;
}

function parseDate(dateStr: string | null): string | null {
  if (!dateStr || dateStr === '') return null;
  // Try DD/MM/YYYY format
  const parts = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (parts) {
    return `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  }
  return dateStr;
}

export function useCellStation() {
  const [simCards, setSimCards] = useState<CellStationSim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const fetchSims = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('cellstation_sims')
        .select('*')
        .order('status', { ascending: true })
        .order('expiry_date', { ascending: true });
      if (error) throw error;
      setSimCards((data as CellStationSim[]) || []);
    } catch (e: any) {
      console.error('Failed to fetch sims:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncSims = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('cellstation-api', {
        body: { action: 'sync_csv', params: {} },
      });
      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error || 'Sync failed');

      const sims = data.sims || [];
      const now = new Date().toISOString();

      // Prepare upsert records
      const records = sims.map((sim: any) => {
        const { status, status_detail } = parseStatusRaw(sim.status_raw);
        return {
          iccid: sim.iccid,
          sim_number: sim.sim_number,
          uk_number: sim.uk_number,
          il_number: sim.il_number,
          status,
          status_detail,
          expiry_date: parseDate(sim.expiry_date),
          plan: sim.plan,
          start_date: parseDate(sim.start_date),
          end_date: parseDate(sim.end_date),
          customer_name: extractCustomerName(sim.note),
          note: sim.note,
          last_sync: now,
        };
      }).filter((r: any) => r.iccid);

      if (records.length > 0) {
        const { error: upsertError } = await supabase
          .from('cellstation_sims')
          .upsert(records, { onConflict: 'iccid' });
        if (upsertError) throw upsertError;
      }

      // Cross-reference with inventory: match iccid = sim_number in inventory
      const { data: inventoryItems } = await supabase
        .from('inventory' as any)
        .select('id, sim_number, expiry_date, status')
        .not('sim_number', 'is', null);

      if (inventoryItems && inventoryItems.length > 0) {
        for (const inv of inventoryItems as any[]) {
          const matched = records.find((r: any) => r.iccid === inv.sim_number);
          if (matched) {
            const updates: any = {};
            if (matched.expiry_date && matched.expiry_date !== inv.expiry_date) {
              updates.expiry_date = matched.expiry_date;
            }
            // If cellstation says available but inventory says rented = needs swap
            if (matched.status === 'available' && inv.status === 'rented') {
              updates.needs_swap = true;
            }
            if (matched.status_detail) {
              updates.cellstation_status = matched.status_detail;
            }
            if (Object.keys(updates).length > 0) {
              updates.last_sync = now;
              await supabase.from('inventory' as any).update(updates).eq('id', inv.id);
            }
          }
        }
      }

      toast({ title: 'סנכרון הושלם', description: `${records.length} סימים עודכנו` });
      await fetchSims();
    } catch (e: any) {
      toast({ title: 'שגיאת סנכרון', description: e.message, variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  }, [fetchSims, toast]);

  useEffect(() => { fetchSims(); }, [fetchSims]);

  const stats: SyncStats = {
    total: simCards.length,
    available: simCards.filter(s => s.status === 'available' && s.status_detail === 'valid').length,
    rented: simCards.filter(s => s.status === 'rented').length,
    expired: simCards.filter(s => s.status_detail === 'expired').length,
    expiring: simCards.filter(s => s.status_detail === 'expiring').length,
  };

  return { simCards, isLoading, isSyncing, syncSims, stats };
}
