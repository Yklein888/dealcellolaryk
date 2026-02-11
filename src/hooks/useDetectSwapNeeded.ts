import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to detect SIM cards that need replacement.
 * A SIM needs swap when:
 * - It's in an active/overdue rental in our system (inventory.status = 'rented')
 * - But CellStation shows it as available (sim_cards.is_rented = false)
 * This means the SIM expired/was deactivated while the rental is still running.
 */
export const useDetectSwapNeeded = () => {
  const detectSwapNeeded = useCallback(async () => {
    try {
      // Get inventory SIM items that are currently rented
      const { data: rentedSims, error: invError } = await supabase
        .from('inventory')
        .select('id, sim_number, israeli_number')
        .in('category', ['sim_european', 'sim_american'])
        .eq('status', 'rented');

      if (invError || !rentedSims) {
        console.error('Error fetching rented SIMs:', invError);
        return;
      }

      // Get all sim_cards
      const { data: simCards, error: simError } = await supabase
        .from('sim_cards')
        .select('sim_number, israeli_number, is_rented, is_active');

      if (simError || !simCards) {
        console.error('Error fetching sim_cards:', simError);
        return;
      }

      // Build lookup
      const simByIccid = new Map<string, any>();
      const simByIsraeli = new Map<string, any>();
      for (const sim of simCards) {
        if (sim.sim_number) simByIccid.set(normalizeNumber(sim.sim_number), sim);
        if (sim.israeli_number) simByIsraeli.set(normalizeNumber(sim.israeli_number), sim);
      }

      let flagged = 0;
      let cleared = 0;

      for (const inv of rentedSims) {
        const normSim = normalizeNumber(inv.sim_number);
        const normIsraeli = normalizeNumber(inv.israeli_number);
        const matchedSim = (normSim && simByIccid.get(normSim)) || (normIsraeli && simByIsraeli.get(normIsraeli));

        if (matchedSim && !matchedSim.is_rented) {
          // SIM is available in CellStation but rented in our system → needs swap
          await supabase
            .from('inventory')
            .update({ needs_swap: true })
            .eq('id', inv.id);
          flagged++;
        } else if (matchedSim && matchedSim.is_rented) {
          // SIM is still rented in CellStation → clear swap flag if set
          await supabase
            .from('inventory')
            .update({ needs_swap: false })
            .eq('id', inv.id);
          cleared++;
        }
      }

      if (flagged > 0 || cleared > 0) {
        console.log(`🔄 Swap detection: ${flagged} flagged, ${cleared} cleared`);
      }
    } catch (err) {
      console.error('Error in swap detection:', err);
    }
  }, []);

  return { detectSwapNeeded };
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
