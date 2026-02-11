import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { externalSupabase } from '@/integrations/external-supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SimCard {
  id: string;
  sim_number: string | null;      // account number (e.g. 884066)
  uk_number: string | null;       // UK phone number
  il_number: string | null;       // Israeli phone number
  iccid: string | null;           // SIM ICCID
  status: string | null;          // available/rented
  status_detail: string | null;   // valid/expired/expiring/ok
  plan_expiry: string | null;     // plan expiry date
  plan_type: string | null;       // data/voice
  start_date: string | null;      // rental start
  end_date: string | null;        // rental end
  customer_name: string | null;   // customer name
  created_at: string | null;
  updated_at: string | null;
  // Computed fields for backward compat
  short_number: string | null;
  local_number: string | null;
  israeli_number: string | null;
  expiry_date: string | null;
  is_rented: boolean | null;
  is_active: boolean | null;
  package_name: string | null;
  notes: string | null;
  last_synced: string | null;
}

interface CellstationSimRow {
  id: string;
  sim_number: string | null;
  uk_number: string | null;
  il_number: string | null;
  iccid: string | null;
  status: string | null;
  status_detail: string | null;
  expiry_date: string | null;
  plan: string | null;
  plan_type: string | null;
  start_date: string | null;
  end_date: string | null;
  customer_name: string | null;
  last_sync: string | null;
  created_at: string | null;
  [key: string]: any;
}

function mapToSimCard(row: CellstationSimRow): SimCard {
  const statusLower = (row.status || '').toLowerCase();
  const statusDetailLower = (row.status_detail || '').toLowerCase();
  const isRented = statusLower === 'rented';
  const isActive = statusDetailLower === 'valid' || statusDetailLower === 'ok' || statusDetailLower === 'expiring';

  return {
    id: row.id,
    sim_number: row.sim_number,
    uk_number: row.uk_number,
    il_number: row.il_number,
    iccid: row.iccid,
    status: row.status,
    status_detail: row.status_detail,
    plan_expiry: row.expiry_date,
    plan_type: row.plan_type,
    start_date: row.start_date,
    end_date: row.end_date,
    customer_name: row.customer_name,
    created_at: row.created_at || null,
    updated_at: null,
    // Backward compat mapped fields
    short_number: row.sim_number,
    local_number: row.uk_number,
    israeli_number: row.il_number,
    expiry_date: row.expiry_date,
    is_rented: isRented,
    is_active: isActive,
    package_name: row.plan || row.plan_type,
    notes: null,
    last_synced: row.last_sync || new Date().toISOString(),
  };
}

export function useCellstationSync() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: simCards = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['cellstation_sims_external'],
    queryFn: async () => {
      const { data, error } = await externalSupabase
        .from('cellstation_sims')
        .select('*')
        .order('expiry_date', { ascending: true });

      if (error) {
        console.error('Error fetching from external cellstation_sims:', error);
        throw error;
      }

      return (data as CellstationSimRow[]).map(mapToSimCard);
    },
  });

  // Real-time subscription on external DB
  useEffect(() => {
    const channel = externalSupabase
      .channel('cellstation_sims_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cellstation_sims',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['cellstation_sims_external'] });
        }
      )
      .subscribe();

    return () => {
      externalSupabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Insert a SIM swap request into external Supabase
  const requestSimSwap = async (oldIccid: string, newIccid: string, customerName: string) => {
    const { error } = await externalSupabase
      .from('pending_sim_swaps')
      .insert({
        old_iccid: oldIccid,
        new_iccid: newIccid,
        customer_name: customerName,
        status: 'pending',
      });

    if (error) {
      console.error('Error inserting pending_sim_swaps:', error);
      throw error;
    }
  };

  const syncSims = async () => {
    try {
      toast({
        title: 'מרענן נתונים...',
        description: 'טוען נתונים עדכניים מ-CellStation',
      });
      await refetch();
      toast({
        title: 'הנתונים עודכנו',
        description: `${simCards.length} סימים נטענו בהצלחה`,
      });
    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: 'שגיאה בטעינה',
        description: error.message || 'לא ניתן היה לטעון את הנתונים',
        variant: 'destructive',
      });
    }
  };

  const refreshData = async () => {
    try {
      await refetch();
      toast({
        title: 'הנתונים עודכנו',
        description: 'הנתונים נטענו מחדש בהצלחה',
      });
    } catch (error: any) {
      console.error('Refresh error:', error);
      toast({
        title: 'שגיאה ברענון',
        description: error.message || 'לא ניתן היה לרענן את הנתונים',
        variant: 'destructive',
      });
    }
  };

  // Get rented SIMs (replaces Google Apps Script rental fetch)
  const rentedSims = simCards.filter(sim => sim.is_rented);

  return {
    simCards,
    rentedSims,
    isLoading,
    isSyncing: isRefetching,
    isRefreshing: isRefetching,
    syncSims,
    refreshData,
    requestSimSwap,
  };
}
