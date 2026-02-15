import { Customer, InventoryItem, Rental, Repair, ItemCategory } from '@/types/rental';

export interface RentalItemUpdate {
  inventoryItemId: string;
  itemCategory: ItemCategory;
  itemName: string;
  pricePerDay?: number;
  hasIsraeliNumber?: boolean;
  isGeneric?: boolean;
}

export interface StateSetter<T> {
  data: T[];
  save: (data: T[]) => void;
}

export interface RentalState {
  customers: StateSetter<Customer>;
  inventory: StateSetter<InventoryItem>;
  rentals: StateSetter<Rental>;
  repairs: StateSetter<Repair>;
  fetchData: (retryCount?: number, isBackgroundRetry?: boolean) => Promise<void>;
}

// Cache keys for all data types
export const CACHE_KEYS = {
  customers: 'dealcell_cache_customers_v1',
  inventory: 'dealcell_cache_inventory_v1',
  rentals: 'dealcell_cache_rentals_v1',
  repairs: 'dealcell_cache_repairs_v1',
};

// Generic cache functions
export const loadCachedData = <T,>(key: string): T[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

export const saveToCache = <T,>(key: string, data: T[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore storage quota / private mode errors
  }
};
