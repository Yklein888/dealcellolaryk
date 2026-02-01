import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SimCard {
  id: string;
  local_number: string | null;
  israeli_number: string | null;
  sim_number: string | null;
  expiry_date: string | null;
  is_rented: boolean;
  status: string;
  package_name: string | null;
  notes: string | null;
  last_synced: string;
  created_at: string;
  updated_at: string;
}

export function useCellstationSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: simCards = [], isLoading, refetch } = useQuery({
    queryKey: ['sim_cards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sim_cards')
        .select('*')
        .order('expiry_date', { ascending: true });

      if (error) {
        console.error('Error fetching SIM cards:', error);
        throw error;
      }

      return data as SimCard[];
    },
  });

  const syncSims = async () => {
    setIsSyncing(true);
    
    try {
      toast({
        title: 'מסנכרן סימים...',
        description: 'מתחבר לפורטל CellStation',
      });

      const { data, error } = await supabase.functions.invoke('sync-cellstation');

      if (error) {
        throw new Error(error.message || 'שגיאה בסנכרון');
      }

      if (!data.success) {
        throw new Error(data.error || 'שגיאה בסנכרון');
      }

      toast({
        title: 'סנכרון הצליח!',
        description: `סונכרנו ${data.count} סימים`,
      });

      // Refresh the data
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['sim_cards'] });

    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: 'שגיאה בסנכרון',
        description: error.message || 'לא ניתן היה לסנכרן את הסימים',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    simCards,
    isLoading,
    isSyncing,
    syncSims,
    refetch,
  };
}
