import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ── CellStation helpers ─────────────────────────────────────────────────────
// Vercel API route - same origin, no CORS issues
const CS_API = '/api/cellstation';

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

// Module-level SIM cache - persists across navigations (avoids full reload on tab switch)
let simsCache: { data: CellStationSim[]; ts: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
  const fetchSims = useCallback(async (force = false) => {
    if (!force && simsCache && (Date.now() - simsCache.ts) < CACHE_TTL_MS) {
      setSimCards(simsCache.data);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await csInvoke('get_sims', {});
      if (data?.success && Array.isArray(data.sims)) {
        simsCache = { data: data.sims as CellStationSim[], ts: Date.now() };
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
      const data = await csInvoke('sync_csv', {});
      if (!data?.success) throw new Error(data?.error || 'Sync failed');
      const sims = data.sims || [];
      if (sims.length === 0) {
        toast({ title: "אין סימים", description: "לא התקבלו סימים מ-CellStation.", variant: "destructive" });
        return;
      }
      simsCache = { data: sims as CellStationSim[], ts: Date.now() };
      setSimCards(sims as CellStationSim[]);
      toast({ title: 'סנכרון הושלם', description: `${sims.length} סימים נטענו` });
    } catch (e: any) {
      toast({ title: 'שגיאת סנכרון', description: e.message, variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  }, [toast]);

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
      toast({ title: 'הסים הופעל בהצלחה ✅' });
      simsCache = null;
      await fetchSims(true);
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
      // Step 1: Activate new SIM (API waits 20s internally)
      onProgress?.('מפעיל סים חדש...', 5);
      setActivateAndSwapProgress('מפעיל סים חדש...');

      const startTime = Date.now();
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min(55, Math.round((elapsed / 25000) * 55));
        onProgress?.('מפעיל סים חדש...', 5 + pct);
        setActivateAndSwapProgress('מפעיל סים חדש...');
      }, 500);

      let data: any;
      try {
        data = await csInvoke('activate_and_swap', params);
      } finally {
        clearInterval(progressInterval);
      }

      if (!data?.success) throw new Error(data?.error || 'Activation failed');

      // Step 2: Refresh SIMs list so new SIM appears as active
      onProgress?.('מרענן רשימת סימים...', 65);
      setActivateAndSwapProgress('מרענן רשימת סימים...');
      simsCache = null;
      await fetchSims(true);

      // Step 3: Perform the swap
      onProgress?.('מבצע החלפת סים...', 78);
      setActivateAndSwapProgress('מבצע החלפת סים...');
      const swapData = await csInvoke('swap_sim', {
        current_sim: params.current_sim,
        swap_iccid: params.swap_iccid,
        swap_msisdn: '',
      });

      if (!swapData?.success) throw new Error(swapData?.error || 'Swap failed');

      onProgress?.('הושלם!', 100);
      setActivateAndSwapProgress('הושלם!');
      toast({ title: 'הפעלה והחלפה הושלמו בהצלחה! ✅' });
      simsCache = null;
      await fetchSims(true);
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
