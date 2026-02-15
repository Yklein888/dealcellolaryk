import { supabase } from '@/integrations/supabase/client';
import { Customer } from '@/types/rental';
import type { StateSetter } from './types';

export function createCustomerOperations(state: StateSetter<Customer>) {
  const addCustomer = async (customer: Omit<Customer, 'id' | 'createdAt'>) => {
    const { data, error } = await supabase
      .from('customers')
      .insert({
        name: customer.name,
        address: customer.address || null,
        phone: customer.phone,
        email: customer.email || null,
        notes: customer.notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding customer:', error);
      throw error;
    }

    const newCustomer = {
      id: data.id,
      name: data.name,
      address: data.address || undefined,
      phone: data.phone,
      email: data.email || undefined,
      notes: data.notes || undefined,
      createdAt: data.created_at.split('T')[0],
      hasPaymentToken: false,
      paymentTokenLast4: undefined,
      paymentTokenExpiry: undefined,
    };
    state.save([newCustomer, ...state.data]);
  };

  const updateCustomer = async (id: string, customer: Partial<Customer>) => {
    const { error } = await supabase
      .from('customers')
      .update({
        name: customer.name,
        address: customer.address || null,
        phone: customer.phone,
        email: customer.email || null,
        notes: customer.notes || null,
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating customer:', error);
      throw error;
    }

    state.save(state.data.map(c => c.id === id ? { ...c, ...customer } : c));
  };

  const deleteCustomer = async (id: string) => {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }

    state.save(state.data.filter(c => c.id !== id));
  };

  const clearCustomerPaymentToken = async (id: string) => {
    const { error } = await supabase
      .from('customers')
      .update({
        payment_token: null,
        payment_token_last4: null,
        payment_token_expiry: null,
        payment_token_updated_at: null,
      })
      .eq('id', id);

    if (error) {
      console.error('Error clearing payment token:', error);
      throw error;
    }

    state.save(state.data.map(c => c.id === id ? { 
      ...c, 
      hasPaymentToken: false,
      paymentTokenLast4: undefined,
      paymentTokenExpiry: undefined,
    } : c));
  };

  return { addCustomer, updateCustomer, deleteCustomer, clearCustomerPaymentToken };
}
