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
      const { data, error } = await supabase.functions.invoke('sim-activation-request', {
        body: {
          sim_number: simNumber,
          rental_id: rentalId || null,
          customer_id: customerId || null,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'בקשת הפעלה נשלחה',
        description: `הסים ${simNumber} סומן להפעלה. הפעל את ה-Bookmarklet באתר CellStation.`,
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
