import { supabase } from '@/integrations/supabase/client';
import { Repair } from '@/types/rental';
import type { StateSetter } from './types';

export function createRepairOperations(state: StateSetter<Repair>) {
  const addRepair = async (repair: Omit<Repair, 'id'>) => {
    const { data, error } = await supabase
      .from('repairs')
      .insert({
        repair_number: repair.repairNumber,
        device_type: repair.deviceType,
        device_model: repair.deviceModel || null,
        device_cost: repair.deviceCost || null,
        customer_name: repair.customerName,
        customer_phone: repair.customerPhone || null,
        problem_description: repair.problemDescription,
        status: repair.status,
        is_warranty: repair.isWarranty || false,
        received_date: repair.receivedDate,
        completed_date: repair.completedDate || null,
        collected_date: repair.collectedDate || null,
        notes: repair.notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding repair:', error);
      throw error;
    }

    const newRepair = {
      id: data.id,
      repairNumber: data.repair_number,
      deviceType: data.device_type,
      deviceModel: data.device_model || undefined,
      deviceCost: data.device_cost ? Number(data.device_cost) : undefined,
      customerName: data.customer_name,
      customerPhone: data.customer_phone || '',
      problemDescription: data.problem_description,
      status: data.status as 'in_lab' | 'ready' | 'collected',
      isWarranty: data.is_warranty || false,
      receivedDate: data.received_date,
      completedDate: data.completed_date || undefined,
      collectedDate: data.collected_date || undefined,
      notes: data.notes || undefined,
    };
    state.save([newRepair, ...state.data]);
  };

  const updateRepair = async (id: string, repair: Partial<Repair>) => {
    const updateData: Record<string, unknown> = {};
    if (repair.repairNumber !== undefined) updateData.repair_number = repair.repairNumber;
    if (repair.deviceType !== undefined) updateData.device_type = repair.deviceType;
    if (repair.deviceModel !== undefined) updateData.device_model = repair.deviceModel;
    if (repair.deviceCost !== undefined) updateData.device_cost = repair.deviceCost;
    if (repair.customerName !== undefined) updateData.customer_name = repair.customerName;
    if (repair.customerPhone !== undefined) updateData.customer_phone = repair.customerPhone;
    if (repair.problemDescription !== undefined) updateData.problem_description = repair.problemDescription;
    if (repair.status !== undefined) updateData.status = repair.status;
    if (repair.isWarranty !== undefined) updateData.is_warranty = repair.isWarranty;
    if (repair.completedDate !== undefined) updateData.completed_date = repair.completedDate;
    if (repair.collectedDate !== undefined) updateData.collected_date = repair.collectedDate;
    if (repair.notes !== undefined) updateData.notes = repair.notes;

    const { error } = await supabase
      .from('repairs')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error updating repair:', error);
      throw error;
    }

    state.save(state.data.map(r => r.id === id ? { ...r, ...repair } : r));
  };

  const deleteRepair = async (id: string) => {
    const { error } = await supabase
      .from('repairs')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting repair:', error);
      throw error;
    }

    state.save(state.data.filter(r => r.id !== id));
  };

  return { addRepair, updateRepair, deleteRepair };
}
