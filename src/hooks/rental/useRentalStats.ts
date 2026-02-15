import { Customer, InventoryItem, Rental, Repair, DashboardStats } from '@/types/rental';
import { addDays, isBefore, isAfter, parseISO } from 'date-fns';

// Helper function to check if item is truly available (status + valid expiry for SIMs)
export function isItemTrulyAvailable(item: InventoryItem): boolean {
  if (item.status !== 'available') return false;
  
  // For SIMs, check expiry date
  const isSim = item.category === 'sim_american' || item.category === 'sim_european';
  if (isSim && item.expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = parseISO(item.expiryDate);
    return isAfter(expiryDate, today) || expiryDate.getTime() === today.getTime();
  }
  
  return true;
}

export function calculateStats(
  customers: Customer[],
  inventory: InventoryItem[],
  rentals: Rental[],
  repairs: Repair[]
): DashboardStats {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfTomorrow = addDays(today, 1);
  const threeDaysFromNow = addDays(today, 3);
  
  const activeRentals = rentals.filter(r => r.status === 'active').length;
  
  const overdueReturns = rentals.filter(r => {
    if (r.status !== 'active') return false;
    const endDate = parseISO(r.endDate);
    return isBefore(endDate, today);
  }).length;
  
  const endingToday = rentals.filter(r => {
    if (r.status !== 'active') return false;
    const endDate = parseISO(r.endDate);
    return !isBefore(endDate, today) && isBefore(endDate, startOfTomorrow);
  }).length;
  
  const upcomingReturns = rentals.filter(r => {
    if (r.status !== 'active') return false;
    const endDate = parseISO(r.endDate);
    return !isBefore(endDate, startOfTomorrow) && isBefore(endDate, threeDaysFromNow);
  }).length;
  
  const repairsInProgress = repairs.filter(r => r.status === 'in_lab').length;
  const itemsInStock = inventory.filter(isItemTrulyAvailable).length;

  return {
    activeRentals,
    totalCustomers: customers.length,
    itemsInStock,
    overdueReturns,
    repairsInProgress,
    upcomingReturns,
    endingToday,
  };
}
