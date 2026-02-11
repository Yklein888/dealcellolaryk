import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { externalSupabase } from '@/integrations/external-supabase/client';

/**
 * Hook to sync SIM expiry dates and status from sim_cards table to inventory table.
 * Matches by sim_number (ICCID) as primary key.
 * Runs on mount and every 5 minutes.
 */
export const useSyncSimExpiry = () => {
  const syncExpiry = useCallback(async () => {
    try {
      // Get all SIM cards from external CellStation DB
      const { data: rawSims, error: simError } = await externalSupabase
        .from('cellstation_sims')
        .select('sim_number, expiry_date, status_detail, israeli_number, local_number');

      if (simError || !rawSims) {
        console.error('Error fetching cellstation_sims for sync:', simError);
        return;
      }

      // Map external fields to internal format
      const simCards = rawSims.map((s: any) => {
        const statusLower = (s.status_detail || '').toLowerCase();
        return {
          sim_number: s.sim_number,
          israeli_number: s.israeli_number,
          local_number: s.local_number,
          expiry_date: s.expiry_date,
          is_active: statusLower === 'active' || statusLower === 'rented',
          is_rented: statusLower === 'rented',
        };
      });

      // Get all SIM inventory items
      const { data: inventoryItems, error: invError } = await supabase
        .from('inventory')
        .select('id, sim_number, israeli_number, local_number, expiry_date, cellstation_status')
        .in('category', ['sim_european', 'sim_american']);

      if (invError || !inventoryItems) {
        console.error('Error fetching inventory for sync:', invError);
        return;
      }

      // Build lookup maps for sim_cards
      const simByIccid = new Map<string, any>();
      const simByIsraeli = new Map<string, any>();
      for (const sim of simCards) {
        if (sim.sim_number) simByIccid.set(normalizeNumber(sim.sim_number), sim);
        if (sim.israeli_number) simByIsraeli.set(normalizeNumber(sim.israeli_number), sim);
      }

      let synced = 0;
      const now = new Date().toISOString();

      for (const inv of inventoryItems) {
        const normSim = normalizeNumber(inv.sim_number);
        const normIsraeli = normalizeNumber(inv.israeli_number);
        const matchedSim = (normSim && simByIccid.get(normSim)) || (normIsraeli && simByIsraeli.get(normIsraeli));

        if (matchedSim) {
          const cellstationStatus = matchedSim.is_rented ? 'rented' : matchedSim.is_active ? 'active' : 'inactive';
          const newExpiry = matchedSim.expiry_date || null;

          // Only update if something changed
          if (inv.expiry_date !== newExpiry || inv.cellstation_status !== cellstationStatus) {
            await supabase
              .from('inventory')
              .update({
                expiry_date: newExpiry,
                cellstation_status: cellstationStatus,
                last_sync: now,
              })
              .eq('id', inv.id);
            synced++;
          }
        }
      }

      if (synced > 0) {
        console.log(`✅ Synced ${synced} inventory items with CellStation data`);
      }
    } catch (err) {
      console.error('Error in SIM expiry sync:', err);
    }
  }, []);

  useEffect(() => {
    syncExpiry();
    const interval = setInterval(syncExpiry, 5 * 60 * 1000); // Every 5 minutes
    return () => clearInterval(interval);
  }, [syncExpiry]);

  return { syncExpiry };
};

function normalizeNumber(value: string | null | undefined): string {
  if (!value) return '';
  let str = String(value).replace(/[-\s]/g, '').toLowerCase();
  if (str.startsWith('0722') || str.startsWith('0752')) {
    str = str.substring(1);
  }
  if (str.startsWith('44') && str.length > 10) {
    str = str.substring(2);
  }
  return str;
}
