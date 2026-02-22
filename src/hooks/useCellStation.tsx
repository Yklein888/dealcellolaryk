import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ── CellStation helpers ─────────────────────────────────────────────────────
// Vercel API route - same origin, no CORS issues
const CS_API = 'https://hlswvjyegirbhoszrqyo.supabase.co/functions/v1/cellstation-api';

async function csInvoke(action: string, params: any): Promise<any> {
  const res = await fetch(CS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`API error: ${res.status} ${t.slice(0, 200)}`); }
  return res.json();
}
// ────────────────────────────────────────────────────────────────────────────

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
  const match = note.match(/^(.+?)(?:\s*[\d\-+()\s]{7,}|$)/);
  return match?.[1]?.trim() || note.trim() || null;
}

function parseDate(dateStr: string | null): string | null {
  if (!dateStr || dateStr === '') return null;
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
  const [isActivating, setIsActivating] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [activateAndSwapProgress, setActivateAndSwapProgress] = useState<string | null>(null);
  const { toast } = useToast();

  // fetchSims - דרך Edge Function כדי למנוע CORS
  const fetchSims = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await csInvoke('get_sims', {});
      if (data?.success && Array.isArray(data.sims)) {
        setSimCards(data.sims as CellStationSim[]);
      } else {
        console.error('get_sims failed:', data);
        setSimCards([]);
      }
    } catch (e: any) {
      console.error('Failed to fetch sims:', e);
      setSimCards([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncSims = useCallback(async () => {
    setIsSyncing(true);
    try {
      console.log('🚀 Starting sync with CellStation...');
      const data = await csInvoke('sync_csv', {});
      console.log('📦 sync_csv response:', data);

      if (!data?.success) throw new Error(data?.error || 'Sync failed');

      const sims = data.sims || [];
      console.log(`✅ Received ${sims.length} SIMs from CellStation`);

      if (sims.length === 0) {
        toast({ title: "אין סימים", description: "לא התקבלו סימים מ-CellStation.", variant: "destructive" });
        return;
      }

      // Cross-reference with inventory
      const now = new Date().toISOString();
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
          last_sync: now,
        };
      }).filter((r: any) => r.iccid);

      if (records.length > 0) {
        await csInvoke('upsert_sims', { records });
      }

      const { data: inventoryItems } = await supabase
        .from('inventory' as any)
        .select('id, sim_number, expiry_date, status')
        .not('sim_number', 'is', null);

      if (inventoryItems && inventoryItems.length > 0) {
        for (const inv of inventoryItems as any[]) {
          const matched = records.find((r: any) => r.iccid === inv.sim_number);
          if (matched) {
            const updates: any = {};
            if (matched.expiry_date && matched.expiry_date !== inv.expiry_date) updates.expiry_date = matched.expiry_date;
            if (matched.status === 'available' && inv.status === 'rented') updates.needs_swap = true;
            if (matched.status_detail) updates.cellstation_status = matched.status_detail;
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

  const activateSim = useCallback(async (params: {
    iccid: string; product: string; start_rental: string; end_rental: string;
    price: string; days: string; note: string;
  }) => {
    setIsActivating(true);
    try {
      const data = await csInvoke('activate_sim', params);
      if (!data?.success) throw new Error(data?.error || 'Activation failed');
      toast({ title: 'הסים הופעל בהצלחה' });
      return data;
    } catch (e: any) {
      toast({ title: 'שגיאה בהפעלת סים', description: e.message, variant: 'destructive' });
      throw e;
    } finally {
      setIsActivating(false);
    }
  }, [toast]);

  const activateSimWithStatus = useCallback(async (params: {
    iccid: string; start_rental: string; end_rental: string;
    price: string; days: string; note: string;
  }) => {
    setIsActivating(true);
    try {
      const data = await csInvoke('activate_sim', { ...params, product: '' });
      if (!data?.success) throw new Error(data?.error || 'Activation failed');
      // עדכן סטטוס דרך Edge Function
      await csInvoke('update_sim_status', { iccid: params.iccid, status: 'rented', status_detail: 'active' });
      toast({ title: 'הסים הופעל בהצלחה ועבר למושכרים ✅' });
      await fetchSims();
      return { success: true };
    } catch (e: any) {
      toast({ title: 'שגיאה בהפעלת סים', description: e.message, variant: 'destructive' });
      return { success: false, error: e.message };
    } finally {
      setIsActivating(false);
    }
  }, [fetchSims, toast]);

  const swapSim = useCallback(async (params: {
    rental_id: string; current_sim: string; current_iccid: string;
    swap_msisdn: string; swap_iccid: string;
  }) => {
    setIsSwapping(true);
    try {
      const data = await csInvoke('swap_sim', params);
      if (!data?.success) throw new Error(data?.error || 'Swap failed');
      toast({ title: 'הסים הוחלף בהצלחה' });
      return data;
    } catch (e: any) {
      toast({ title: 'שגיאה בהחלפת סים', description: e.message, variant: 'destructive' });
      throw e;
    } finally {
      setIsSwapping(false);
    }
  }, [toast]);

  const activateAndSwap = useCallback(async (params: {
    product: string; start_rental: string; end_rental: string; price: string;
    note: string; current_sim: string; current_iccid: string; swap_iccid: string;
  }, onProgress?: (step: string, percent: number) => void) => {
    try {
      onProgress?.('מפעיל סים...', 10);
      setActivateAndSwapProgress('מפעיל סים...');
      const startTime = Date.now();
      const totalWait = 80000;
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const percent = Math.min(90, Math.round((elapsed / totalWait) * 90));
        if (elapsed < 10000) { onProgress?.('מפעיל סים...', percent); setActivateAndSwapProgress('מפעיל סים...'); }
        else if (elapsed < 65000) { onProgress?.('ממתין 60 שניות...', percent); setActivateAndSwapProgress('ממתין 60 שניות...'); }
        else { onProgress?.('מחליף סים...', percent); setActivateAndSwapProgress('מחליף סים...'); }
      }, 1000);
      let data: any;
      try {
        data = await csInvoke('activate_and_swap', params);
      } finally {
        clearInterval(progressInterval);
      }
      if (!data?.success) throw new Error(data?.error || 'Activate and swap failed');
      onProgress?.('הושלם!', 100);
      setActivateAndSwapProgress('הושלם!');
      toast({ title: 'הפעלה והחלפה הושלמו בהצלחה!' });
      await fetchSims();
      return data;
    } catch (e: any) {
      setActivateAndSwapProgress(null);
      toast({ title: 'שגיאה', description: e.message, variant: 'destructive' });
      throw e;
    } finally {
      setTimeout(() => setActivateAndSwapProgress(null), 2000);
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

  return {
    simCards, isLoading, isSyncing, isActivating, isSwapping,
    activateAndSwapProgress, syncSims, activateSim, activateSimWithStatus,
    swapSim, activateAndSwap, stats, fetchSims,
  };
}
