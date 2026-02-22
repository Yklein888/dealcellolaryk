import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ============================================================
// CellStation DB + Edge Function - גישה ישירה דרך fetch
// ללא Supabase client שני - יציב לנצח, ללא ERR_FAILED
// ============================================================
const CS_URL = 'https://hlswvjyegirbhoszrqyo.supabase.co';
const CS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3d2anllZ2lyYmhvc3pycXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3OTg4MTAsImV4cCI6MjA4NjM3NDgxMH0.KNRl4-S-XxVMcaoPPQXV5gLi6W9yYNWeHqtMok-Mpg8';

const csHeaders = {
  'apikey': CS_KEY,
  'Authorization': `Bearer ${CS_KEY}`,
  'Content-Type': 'application/json',
};

// קריאה לטבלה
async function csSelect(path: string): Promise<any[]> {
  const res = await fetch(`${CS_URL}/rest/v1/${path}`, { headers: csHeaders });
  if (!res.ok) throw new Error(`csSelect failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// מחיקה
async function csDelete(path: string): Promise<void> {
  const res = await fetch(`${CS_URL}/rest/v1/${path}`, {
    method: 'DELETE', headers: csHeaders
  });
  if (!res.ok) throw new Error(`csDelete failed: ${res.status} ${await res.text()}`);
}

// הכנסה
async function csInsert(table: string, data: any[]): Promise<void> {
  const res = await fetch(`${CS_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...csHeaders, 'Prefer': 'return=minimal' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`csInsert failed: ${res.status} ${await res.text()}`);
}

// עדכון
async function csUpdate(table: string, match: string, data: any): Promise<void> {
  const res = await fetch(`${CS_URL}/rest/v1/${table}?${match}`, {
    method: 'PATCH',
    headers: { ...csHeaders, 'Prefer': 'return=minimal' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`csUpdate failed: ${res.status} ${await res.text()}`);
}

// קריאה ל-Edge Function
async function csEdgeFunction(action: string, params: any = {}): Promise<any> {
  const res = await fetch(`${CS_URL}/functions/v1/cellstation-api`, {
    method: 'POST',
    headers: csHeaders,
    body: JSON.stringify({ action, params }),
  });
  if (!res.ok) throw new Error(`Edge function error: ${res.status} ${await res.text()}`);
  const result = await res.json();
  if (!result.success) throw new Error(result.error || `${action} failed`);
  return result;
}

// ============================================================

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
  const match = note.match(/^(.+?)(?:\s*[\d\-+()\\s]{7,}|$)/);
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

  const fetchSims = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await csSelect('cellstation_sims?select=*&order=status.asc,expiry_date.asc');
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
      console.log('🚀 Starting sync with CellStation...');
      const data = await csEdgeFunction('sync_csv');
      
      const sims = data.sims || [];
      console.log(`✅ Received ${sims.length} SIMs from CellStation`);
      
      if (sims.length === 0) {
        toast({
          title: "אין סימים",
          description: "לא התקבלו סימים מ-CellStation. בדוק את פרטי ההתחברות.",
          variant: "destructive",
        });
        return;
      }
      
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
        // מחק הכל ו-insert מחדש - מטפל גם בהחלפות ICCID
        await csDelete('cellstation_sims?id=neq.00000000-0000-0000-0000-000000000000');
        await csInsert('cellstation_sims', records);
      }

      // Cross-reference with inventory
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

  const activateSim = useCallback(async (params: {
    iccid: string;
    product: string;
    start_rental: string;
    end_rental: string;
    price: string;
    days: string;
    note: string;
  }) => {
    setIsActivating(true);
    try {
      const data = await csEdgeFunction('activate_sim', params);
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
    iccid: string;
    start_rental: string;
    end_rental: string;
    price: string;
    days: string;
    note: string;
  }) => {
    setIsActivating(true);
    try {
      await csEdgeFunction('activate_sim', { ...params, product: '' });
      // עדכן סטטוס ב-DB
      await csUpdate('cellstation_sims', `iccid=eq.${encodeURIComponent(params.iccid)}`, {
        status: 'rented', status_detail: 'active'
      });
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
    rental_id: string;
    current_sim: string;
    current_iccid: string;
    swap_msisdn: string;
    swap_iccid: string;
  }) => {
    setIsSwapping(true);
    try {
      const data = await csEdgeFunction('swap_sim', params);
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
    product: string;
    start_rental: string;
    end_rental: string;
    price: string;
    note: string;
    current_sim: string;
    current_iccid: string;
    swap_iccid: string;
  }, onProgress?: (step: string, percent: number) => void) => {
    try {
      onProgress?.('מפעיל סים...', 10);
      setActivateAndSwapProgress('מפעיל סים...');
      
      const startTime = Date.now();
      const totalWait = 80000;
      
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const percent = Math.min(90, Math.round((elapsed / totalWait) * 90));
        if (elapsed < 10000) {
          onProgress?.('מפעיל סים...', percent);
          setActivateAndSwapProgress('מפעיל סים...');
        } else if (elapsed < 65000) {
          onProgress?.('ממתין 60 שניות...', percent);
          setActivateAndSwapProgress('ממתין 60 שניות...');
        } else {
          onProgress?.('מחליף סים...', percent);
          setActivateAndSwapProgress('מחליף סים...');
        }
      }, 1000);

      let data: any;
      try {
        data = await csEdgeFunction('activate_and_swap', params);
      } finally {
        clearInterval(progressInterval);
      }

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
    simCards,
    isLoading,
    isSyncing,
    isActivating,
    isSwapping,
    activateAndSwapProgress,
    syncSims,
    activateSim,
    activateSimWithStatus,
    swapSim,
    activateAndSwap,
    stats,
    fetchSims,
  };
}
