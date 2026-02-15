import { supabase } from '@/integrations/supabase/client';
import { InventoryItem, ItemCategory } from '@/types/rental';
import type { StateSetter } from './types';

export function createInventoryOperations(state: StateSetter<InventoryItem>) {
  const addInventoryItem = async (item: Omit<InventoryItem, 'id'>) => {
    const { data, error } = await supabase
      .from('inventory')
      .insert({
        category: item.category as any,
        name: item.name,
        local_number: item.localNumber || null,
        israeli_number: item.israeliNumber || null,
        expiry_date: item.expiryDate || null,
        sim_number: item.simNumber || null,
        status: item.status,
        notes: item.notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding inventory item:', error);
      throw error;
    }

    const newItem = {
      id: data.id,
      category: data.category as ItemCategory,
      name: data.name,
      localNumber: data.local_number || undefined,
      israeliNumber: data.israeli_number || undefined,
      expiryDate: data.expiry_date || undefined,
      simNumber: data.sim_number || undefined,
      status: data.status as 'available' | 'rented' | 'maintenance',
      notes: data.notes || undefined,
      barcode: data.barcode || undefined,
    };
    state.save([newItem, ...state.data]);
  };

  const updateInventoryItem = async (id: string, item: Partial<InventoryItem>) => {
    const updateData: Record<string, unknown> = {};
    if (item.category !== undefined) updateData.category = item.category;
    if (item.name !== undefined) updateData.name = item.name;
    if (item.localNumber !== undefined) updateData.local_number = item.localNumber;
    if (item.israeliNumber !== undefined) updateData.israeli_number = item.israeliNumber;
    if (item.expiryDate !== undefined) updateData.expiry_date = item.expiryDate;
    if (item.simNumber !== undefined) updateData.sim_number = item.simNumber;
    if (item.status !== undefined) updateData.status = item.status;
    if (item.notes !== undefined) updateData.notes = item.notes;

    const { error } = await supabase
      .from('inventory')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error updating inventory item:', error);
      throw error;
    }

    state.save(state.data.map(i => i.id === id ? { ...i, ...item } : i));
  };

  const deleteInventoryItem = async (id: string) => {
    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting inventory item:', error);
      throw error;
    }

    state.save(state.data.filter(i => i.id !== id));
  };

  return { addInventoryItem, updateInventoryItem, deleteInventoryItem };
}
