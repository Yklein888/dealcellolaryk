import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PendingActivation {
  simNumber: string;
  activationRequestedAt: string;
  linkedRentalId: string | null;
  linkedCustomerId: string | null;
  israeliNumber: string | null;
  localNumber: string | null;
}

export function usePendingActivations() {
  const [pendingActivations, setPendingActivations] = useState<PendingActivation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch pending activations
  const fetchPendingActivations = async () => {
    try {
      const { data, error } = await supabase
        .from('sim_cards')
        .select('sim_number, activation_requested_at, linked_rental_id, linked_customer_id, israeli_number, local_number')
        .eq('activation_status', 'pending')
        .order('activation_requested_at', { ascending: false });

      if (error) throw error;

      setPendingActivations(
        (data || []).map(item => ({
          simNumber: item.sim_number || '',
          activationRequestedAt: item.activation_requested_at || '',
          linkedRentalId: item.linked_rental_id,
          linkedCustomerId: item.linked_customer_id,
          israeliNumber: item.israeli_number,
          localNumber: item.local_number,
        }))
      );
    } catch (error) {
      console.error('Error fetching pending activations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingActivations();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('pending-activations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sim_cards',
        },
        (payload) => {
          // Refetch when any sim_card changes
          if (payload.new && 'activation_status' in payload.new) {
            fetchPendingActivations();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    pendingActivations,
    pendingCount: pendingActivations.length,
    isLoading,
    refetch: fetchPendingActivations,
  };
}
