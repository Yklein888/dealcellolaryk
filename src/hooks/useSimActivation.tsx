import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type ActivationStatus = 'none' | 'pending' | 'activated' | 'failed';

export interface SimActivationData {
  simNumber: string;
  activationStatus: ActivationStatus;
  activationRequestedAt: string | null;
  activationCompletedAt: string | null;
  linkedRentalId: string | null;
  linkedCustomerId: string | null;
}



export function useSimActivation() {
  const { toast } = useToast();
  const [activatingSimNumbers, setActivatingSimNumbers] = useState<Set<string>>(new Set());

  const requestActivation = async (
    simNumber: string,
    rentalId?: string,
    customerId?: string
  ): Promise<boolean> => {
    if (!simNumber) {
      toast({
        title: 'שגיאה',
        description: 'מספר סים חסר',
        variant: 'destructive',
      });
      return false;
    }

    setActivatingSimNumbers(prev => new Set(prev).add(simNumber));

    try {
      // Fetch customer name if customer_id provided
      let customerName = '';
      if (customerId) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('name')
          .eq('id', customerId)
          .single();
        customerName = customerData?.name || '';
      }

      // Fetch rental dates if rental_id provided
      let startDate = '';
      let endDate = '';
      if (rentalId) {
        const { data: rentalData } = await supabase
          .from('rentals')
          .select('start_date, end_date, customer_name')
          .eq('id', rentalId)
          .single();
        startDate = rentalData?.start_date || '';
        endDate = rentalData?.end_date || '';
        // Use rental customer name if no customer id provided
        if (!customerName) {
          customerName = rentalData?.customer_name || '';
        }
      }

      // Send activation request via Edge Function (bypasses CORS)
      const { error } = await supabase.functions.invoke('sim-activation-request', {
        body: {
          sim_number: simNumber,
          rental_id: rentalId,
          customer_id: customerId,
          customer_name: customerName,
          start_date: startDate,
          end_date: endDate,
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to send activation request');
      }

      toast({
        title: 'הפקודה נשלחה!',
        description: 'כעת לחץ על ה-Bookmarklet באתר CellStation',
      });

      return true;
    } catch (error) {
      console.error('Error requesting SIM activation:', error);
      toast({
        title: 'שגיאה בבקשת הפעלה',
        description: error instanceof Error ? error.message : 'לא ניתן לשלוח בקשת הפעלה',
        variant: 'destructive',
      });
      return false;
    } finally {
      setActivatingSimNumbers(prev => {
        const next = new Set(prev);
        next.delete(simNumber);
        return next;
      });
    }
  };

  const getActivationStatus = async (simNumber: string): Promise<SimActivationData | null> => {
    try {
      const { data, error } = await supabase
        .from('sim_cards')
        .select('sim_number, activation_status, activation_requested_at, activation_completed_at, linked_rental_id, linked_customer_id')
        .eq('sim_number', simNumber)
        .single();

      if (error || !data) return null;

      return {
        simNumber: data.sim_number || '',
        activationStatus: (data.activation_status as ActivationStatus) || 'none',
        activationRequestedAt: data.activation_requested_at,
        activationCompletedAt: data.activation_completed_at,
        linkedRentalId: data.linked_rental_id,
        linkedCustomerId: data.linked_customer_id,
      };
    } catch {
      return null;
    }
  };

  const isActivating = (simNumber: string) => activatingSimNumbers.has(simNumber);

  return {
    requestActivation,
    getActivationStatus,
    isActivating,
  };
}
