import { supabase } from '@/integrations/supabase/client';
import { Rental } from '@/types/rental';
import type { RentalItemUpdate, StateSetter } from './types';

interface RentalItemOperationsDeps {
  rentals: StateSetter<Rental>;
  fetchData: () => Promise<void>;
}

export function createRentalItemOperations(deps: RentalItemOperationsDeps) {
  const { rentals, fetchData } = deps;

  const updateRentalItems = async (rentalId: string, newItems: RentalItemUpdate[], newTotalPrice: number) => {
    const existingRental = rentals.data.find(r => r.id === rentalId);
    if (!existingRental) throw new Error('השכרה לא נמצאה');

    // Get current items from the rental
    const currentItemIds = existingRental.items
      .filter(item => !item.isGeneric && item.inventoryItemId)
      .map(item => item.inventoryItemId);

    // Get new item IDs
    const newItemIds = newItems
      .filter(item => !item.isGeneric && item.inventoryItemId)
      .map(item => item.inventoryItemId);

    // Items to release (in current but not in new)
    const itemsToRelease = currentItemIds.filter(id => !newItemIds.includes(id));
    
    // Items to mark as rented (in new but not in current)
    const itemsToRent = newItemIds.filter(id => !currentItemIds.includes(id));

    // Verify new items are available
    if (itemsToRent.length > 0) {
      const { data: availableCheck, error: checkError } = await supabase
        .from('inventory')
        .select('id, status, name')
        .in('id', itemsToRent);
      
      if (checkError) throw new Error('שגיאה בבדיקת זמינות המלאי');
      
      const unavailable = availableCheck?.filter(item => item.status !== 'available');
      if (unavailable && unavailable.length > 0) {
        const names = unavailable.map(i => i.name).join(', ');
        throw new Error(`הפריטים הבאים כבר לא זמינים: ${names}`);
      }
    }

    // Step 1: Delete existing rental items
    const { error: deleteError } = await supabase
      .from('rental_items')
      .delete()
      .eq('rental_id', rentalId);
    
    if (deleteError) throw deleteError;

    // Step 2: Insert new rental items
    if (newItems.length > 0) {
      const { error: insertError } = await supabase
        .from('rental_items')
        .insert(
          newItems.map(item => ({
            rental_id: rentalId,
            inventory_item_id: item.isGeneric ? null : item.inventoryItemId,
            item_category: item.itemCategory as any,
            item_name: item.itemName,
            price_per_day: item.pricePerDay || null,
            has_israeli_number: item.hasIsraeliNumber || false,
            is_generic: item.isGeneric || false,
          }))
        );
      
      if (insertError) throw insertError;
    }

    // Step 3: Update rental total price
    const { error: updateError } = await supabase
      .from('rentals')
      .update({ total_price: newTotalPrice, updated_at: new Date().toISOString() })
      .eq('id', rentalId);
    
    if (updateError) throw updateError;

    // Step 4: Release old inventory items
    if (itemsToRelease.length > 0) {
      const { error: releaseError } = await supabase
        .from('inventory')
        .update({ status: 'available' })
        .in('id', itemsToRelease);
      
      if (releaseError) throw releaseError;
    }

    // Step 5: Mark new items as rented
    if (itemsToRent.length > 0) {
      const { error: rentError } = await supabase
        .from('inventory')
        .update({ status: 'rented' })
        .in('id', itemsToRent);
      
      if (rentError) throw rentError;
    }

    // Refresh all data to ensure consistency
    await fetchData();
  };

  return { updateRentalItems };
}
