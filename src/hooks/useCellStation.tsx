import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ── CellStation Edge Function ──────────────────────────────────────────────
const CS_URL = 'https://hlswvjyegirbhoszrqyo.supabase.co';
const CS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3d2anllZ2lyYmhvc3pycXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3OTg4MTAsImV4cCI6MjA4NjM3NDgxMH0.KNRl4-S-XxVMcaoPPQXV5gLi6W9yYNWeHqtMok-Mpg8';

// כל הפעולות עוברות דרך Edge Function - פותר CORS
async function csInvoke(action: string, params: any): Promise<any> {
  const res = await fetch(`${CS_URL}/functions/v1/cellstation-api`, {
    method: 'POST',
    headers: { 'apikey': CS_KEY, 'Authorization': `Bearer ${CS_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Edge Function error: ${res.status} ${t.slice(0, 200)}`); }
  return res.json();
}
// ──────────────────────────────────────────────────────────────────────────

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

export function useCellStation() {
  const [simCards, setSimCards] = useState<CellStationSim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [activateAndSwapProgress, setActivateAndSwapProgress] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSims = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await csInvoke('get_sims', {});
      if (data?.success) {
        setSimCards((data.sims as CellStationSim[]) || []);
      } else {
        console.error('Failed to fetch sims:', data?.error);
      }
    } catch (e: any) {
      console.error('Failed to fetch sims:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncSims = useCallback(async () => {
    setIsSyncing(true);
    try {
      console.log('🚀 Starting sync with CellStation...');
      const data = await csInvoke('sync_csv', {});

      if (!data?.success) {
        throw new Error(data?.error || 'Sync failed');
      }

      const count = data.count || 0;
      console.log(`✅ Synced ${count} SIMs`);

      // עדכן רשימת סימים מהתשובה
      if (data.sims) {
        setSimCards(data.sims as CellStationSim[]);
      }

      // Cross-reference with inventory
      if (data.sims && data.sims.length > 0) {
        const { data: inventoryItems } = await supabase
          .from('inventory' as any)
          .select('id, sim_number, expiry_date, status')
          .not('sim_number', 'is', null);

        if (inventoryItems && inventoryItems.length > 0) {
          const now = new Date().toISOString();
          for (const inv of inventoryItems as any[]) {
            const matched = data.sims.find((r: any) => r.iccid === inv.sim_number);
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
      }

      toast({ title: 'סנכרון הושלם', description: `${count} סימים עודכנו` });
    } catch (e: any) {
      toast({ title: 'שגיאת סנכרון', description: e.message, variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  }, [fetchSims, toast]);

  const activateSim = useCallback(async (params: {
    iccid: string; product: string; start_rental: string; end_rental: string; price: string; days: string; note: string;
  }) => {
    setIsActivating(true);
    try {
      const data = await csInvoke('activate_sim', params);
      if (!data?.success) throw new Error(data?.error || 'Activation failed');
      toast({ title: 'הסים הופעל בהצלחה' });
      await fetchSims();
      return data;
    } catch (e: any) {
      toast({ title: 'שגיאה בהפעלת סים', description: e.message, variant: 'destructive' });
      throw e;
    } finally {
      setIsActivating(false);
    }
  }, [fetchSims, toast]);

  const activateSimWithStatus = useCallback(async (params: {
    iccid: string; start_rental: string; end_rental: string; price: string; days: string; note: string;
  }) => {
    setIsActivating(true);
    try {
      const data = await csInvoke('activate_sim', { ...params, product: '' });
      if (!data?.success) throw new Error(data?.error || 'Activation failed');
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
    rental_id: string; current_sim: string; current_iccid: string; swap_msisdn: string; swap_iccid: string;
  }) => {
    setIsSwapping(true);
    try {
      const data = await csInvoke('swap_sim', params);
      if (!data?.success) throw new Error(data?.error || 'Swap failed');
      toast({ title: 'הסים הוחלף בהצלחה' });
      await fetchSims();
      return data;
    } catch (e: any) {
      toast({ title: 'שגיאה בהחלפת סים', description: e.message, variant: 'destructive' });
      throw e;
    } finally {
      setIsSwapping(false);
    }
  }, [fetchSims, toast]);

  const activateAndSwap = useCallback(async (params: {
    product: string; start_rental: string; end_rental: string; price: string; note: string;
    current_sim: string; current_iccid: string; swap_iccid: string;
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
      try { data = await csInvoke('activate_and_swap', params); }
      finally { clearInterval(progressInterval); }

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
    simCards, isLoading, isSyncing, isActivating, isSwapping, activateAndSwapProgress,
    syncSims, activateSim, activateSimWithStatus, swapSim, activateAndSwap, stats, fetchSims,
  };
}
