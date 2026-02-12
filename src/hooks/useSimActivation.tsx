import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { externalSupabase } from '@/integrations/external-supabase/client';
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
      // Fetch customer info
      let customerName = '';
      let customerPhone = '';
      if (customerId) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('name, phone')
          .eq('id', customerId)
          .single();
        customerName = customerData?.name || '';
        customerPhone = customerData?.phone || '';
      }

      // Fetch rental dates and customer name
      let startDate = '';
      let endDate = '';
      let totalPrice = 0;
      if (rentalId) {
        const { data: rentalData } = await supabase
          .from('rentals')
          .select('start_date, end_date, customer_name, total_price')
          .eq('id', rentalId)
          .single();
        startDate = rentalData?.start_date || '';
        endDate = rentalData?.end_date || '';
        totalPrice = rentalData?.total_price || 0;
        if (!customerName) {
          customerName = rentalData?.customer_name || '';
        }
      }

      // Look up ICCID from external cellstation_sims table
      // simNumber could be the sim_number (short number) or iccid
      let iccid = simNumber;
      let simShortNumber = simNumber;
      
      const { data: externalSim } = await externalSupabase
        .from('cellstation_sims')
        .select('iccid, sim_number')
        .or(`sim_number.eq.${simNumber},iccid.eq.${simNumber}`)
        .limit(1)
        .single();

      if (externalSim) {
        iccid = externalSim.iccid || simNumber;
        simShortNumber = externalSim.sim_number || simNumber;
      }

      // Insert into external pending_activations table
      const { error } = await externalSupabase
        .from('pending_activations')
        .insert({
          iccid: iccid,
          sim_number: simShortNumber,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_price: totalPrice,
          start_date: startDate || null,
          end_date: endDate || null,
          status: 'pending',
        });

      if (error) {
        throw new Error(error.message || 'Failed to create pending activation');
      }

      toast({
        title: 'בקשת הפעלה נוצרה!',
        description: 'הבוקמרקלט יבצע את ההפעלה באתר CellStation',
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
