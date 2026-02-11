import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { externalSupabase } from '@/integrations/external-supabase/client';
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

interface CellstationSimRow {
  id: string;
  sim_number: string | null;
  status_detail: string | null;
  plan: string | null;
  expiry_date: string | null;
  [key: string]: any;
}

function mapToSimCard(row: CellstationSimRow): SimCard {
  const statusLower = (row.status_detail || '').toLowerCase();
  const isActive = statusLower === 'active' || statusLower === 'פעיל';
  const isRented = statusLower === 'rented' || statusLower === 'מושכר';

  return {
    id: row.id,
    sim_number: row.sim_number,
    local_number: row.local_number || null,
    israeli_number: row.israeli_number || null,
    short_number: row.short_number || null,
    expiry_date: row.expiry_date,
    is_active: isActive || isRented,
    is_rented: isRented,
    status: row.status_detail,
    package_name: row.plan,
    notes: null,
    last_synced: new Date().toISOString(),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
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

  return {
    simCards,
    isLoading,
    isSyncing: isRefetching,
    isRefreshing: isRefetching,
    syncSims,
    refreshData,
  };
}
