import { InventoryItem, Rental, ItemCategory } from '@/types/rental';
import { addDays, isBefore, parseISO } from 'date-fns';

export function createRentalValidation(
  inventory: InventoryItem[],
  rentals: Rental[]
) {
  const getAvailableItems = (category?: ItemCategory) => {
    // Get IDs of items currently in active/overdue rentals (as backup check)
    const rentedItemIds = new Set<string>();
    rentals
      .filter(r => r.status !== 'returned')
      .forEach(r => {
        r.items.forEach(item => {
          if (item.inventoryItemId && !item.isGeneric) {
            rentedItemIds.add(item.inventoryItemId);
          }
        });
      });
    
    return inventory.filter(item => 
      item.status === 'available' && 
      !rentedItemIds.has(item.id) &&
      (!category || item.category === category)
    );
  };

  const getUpcomingReturns = () => {
    const today = new Date();
    const threeDaysFromNow = addDays(today, 3);
    return rentals.filter(r => 
      r.status === 'active' && 
      isBefore(parseISO(r.endDate), threeDaysFromNow)
    );
  };

  return { getAvailableItems, getUpcomingReturns };
}
