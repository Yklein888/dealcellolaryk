import { supabase } from '@/integrations/supabase/client';
import { Rental, InventoryItem, ItemCategory } from '@/types/rental';
import type { RentalItemUpdate, StateSetter } from './types';

interface RentalOperationsDeps {
  rentals: StateSetter<Rental>;
  inventory: StateSetter<InventoryItem>;
  fetchData: () => Promise<void>;
  updateInventoryItem: (id: string, item: Partial<InventoryItem>) => Promise<void>;
}

export function createRentalOperations(deps: RentalOperationsDeps) {
  const { rentals, fetchData, updateInventoryItem } = deps;

  const addRental = async (rental: Omit<Rental, 'id' | 'createdAt'>) => {
    // Step 1: Collect all non-generic inventory item IDs
    const nonGenericItemIds = rental.items
      .filter(item => !item.isGeneric && item.inventoryItemId)
      .map(item => item.inventoryItemId);

    // Step 2: Verify all items are still available in the database
    if (nonGenericItemIds.length > 0) {
      const { data: currentInventory, error: checkError } = await supabase
        .from('inventory')
        .select('id, status, name')
        .in('id', nonGenericItemIds);
      
      if (checkError) {
        console.error('Error checking inventory availability:', checkError);
        throw new Error('שגיאה בבדיקת זמינות המלאי');
      }

      const unavailableItems = currentInventory?.filter(
        item => item.status !== 'available'
      );
      
      if (unavailableItems && unavailableItems.length > 0) {
        const itemNames = unavailableItems.map(i => i.name).join(', ');
        throw new Error(`הפריטים הבאים כבר לא זמינים: ${itemNames}`);
      }
    }

    // Step 3: Insert the rental
    const { data: rentalData, error: rentalError } = await supabase
      .from('rentals')
      .insert({
        customer_id: rental.customerId || null,
        customer_name: rental.customerName,
        start_date: rental.startDate,
        end_date: rental.endDate,
        total_price: rental.totalPrice,
        currency: rental.currency,
        status: rental.status,
        deposit: rental.deposit || null,
        notes: rental.notes || null,
        pickup_time: rental.pickupTime || null,
        overdue_daily_rate: rental.overdueDailyRate || null,
        overdue_grace_days: rental.overdueGraceDays ?? 0,
        auto_charge_enabled: rental.autoChargeEnabled ?? false,
      })
      .select()
      .single();

    if (rentalError) {
      console.error('Error adding rental:', rentalError);
      throw rentalError;
    }

    // Then, insert rental items
    if (rental.items.length > 0) {
      const { error: itemsError } = await supabase
        .from('rental_items')
        .insert(
          rental.items.map(item => ({
            rental_id: rentalData.id,
            inventory_item_id: item.isGeneric ? null : item.inventoryItemId,
            item_category: item.itemCategory as any,
            item_name: item.itemName,
            price_per_day: item.pricePerDay || null,
            has_israeli_number: item.hasIsraeliNumber || false,
            is_generic: item.isGeneric || false,
          }))
        );

      if (itemsError) {
        console.error('Error adding rental items:', itemsError);
        throw itemsError;
      }
    }

    // Step 4: Update ALL inventory items to rented in a single batch operation
    if (nonGenericItemIds.length > 0) {
      const { error: updateError } = await supabase
        .from('inventory')
        .update({ status: 'rented' })
        .in('id', nonGenericItemIds);
      
      if (updateError) {
        console.error('Error updating inventory status:', updateError);
        throw new Error('שגיאה בעדכון סטטוס המלאי');
      }
    }

    // Step 5: Refresh all data to ensure state is synchronized
    await fetchData();
  };

  const updateRental = async (id: string, rental: Partial<Rental>) => {
    const updateData: Record<string, unknown> = {};
    if (rental.customerName !== undefined) updateData.customer_name = rental.customerName;
    if (rental.startDate !== undefined) updateData.start_date = rental.startDate;
    if (rental.endDate !== undefined) updateData.end_date = rental.endDate;
    if (rental.totalPrice !== undefined) updateData.total_price = rental.totalPrice;
    if (rental.currency !== undefined) updateData.currency = rental.currency;
    if (rental.status !== undefined) updateData.status = rental.status;
    if (rental.deposit !== undefined) updateData.deposit = rental.deposit;
    if (rental.notes !== undefined) updateData.notes = rental.notes;
    if (rental.overdueDailyRate !== undefined) updateData.overdue_daily_rate = rental.overdueDailyRate;
    if (rental.overdueGraceDays !== undefined) updateData.overdue_grace_days = rental.overdueGraceDays;
    if (rental.autoChargeEnabled !== undefined) updateData.auto_charge_enabled = rental.autoChargeEnabled;

    const { error } = await supabase
      .from('rentals')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error updating rental:', error);
      throw error;
    }

    rentals.save(rentals.data.map(r => r.id === id ? { ...r, ...rental } : r));
  };

  const returnRental = async (id: string) => {
    const rental = rentals.data.find(r => r.id === id);
    if (rental) {
      for (const item of rental.items) {
        if (!item.isGeneric && item.inventoryItemId) {
          await updateInventoryItem(item.inventoryItemId, { status: 'available' });
        }
      }
      await updateRental(id, { status: 'returned' });
    }
  };

  const deleteRental = async (id: string) => {
    const { error: itemsError } = await supabase
      .from('rental_items')
      .delete()
      .eq('rental_id', id);

    if (itemsError) {
      console.error('Error deleting rental items:', itemsError);
      throw itemsError;
    }

    const { error } = await supabase
      .from('rentals')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting rental:', error);
      throw error;
    }

    rentals.save(rentals.data.filter(r => r.id !== id));
  };

  return { addRental, updateRental, returnRental, deleteRental };
}
