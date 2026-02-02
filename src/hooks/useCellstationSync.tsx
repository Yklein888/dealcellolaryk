import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SimCard {
  id: string;
  short_number: string | null;
  local_number: string | null;
  israeli_number: string | null;
  sim_number: string | null;
  expiry_date: string | null;
  is_rented: boolean | null;
  is_active: boolean | null;
  status: string | null;
  package_name: string | null;
  notes: string | null;
  last_synced: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useCellstationSync() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: simCards = [], isLoading, refetch, isRefetching } = useQuery({
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

  // Real-time subscription for sim_cards table
  useEffect(() => {
    const channel = supabase
      .channel('sim_cards_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sim_cards',
        },
        () => {
          // Refetch data when any change occurs
          queryClient.invalidateQueries({ queryKey: ['sim_cards'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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

  return {
    simCards,
    isLoading,
    isRefreshing: isRefetching,
    refreshData,
  };
}
