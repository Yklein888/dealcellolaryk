import { ItemCategory, BundleType, Customer, InventoryItem, RentalItem } from '@/types/rental';

export interface SelectedItem {
  inventoryItemId: string;
  category: ItemCategory;
  name: string;
  hasIsraeliNumber: boolean;
  isGeneric?: boolean;
  includeEuropeanDevice?: boolean;
}

export interface RentalFormData {
  customerId: string;
  deposit: string;
  notes: string;
}

// Category color mappings
export const categoryColors: Record<ItemCategory, { bg: string; border: string; hover: string }> = {
  sim_american: { 
    bg: 'bg-red-50 dark:bg-red-950/30', 
    border: 'border-red-200 dark:border-red-800', 
    hover: 'hover:border-red-400 dark:hover:border-red-600' 
  },
  sim_european: { 
    bg: 'bg-blue-50 dark:bg-blue-950/30', 
    border: 'border-blue-200 dark:border-blue-800', 
    hover: 'hover:border-blue-400 dark:hover:border-blue-600' 
  },
  device_simple: { 
    bg: 'bg-green-50 dark:bg-green-950/30', 
    border: 'border-green-200 dark:border-green-800', 
    hover: 'hover:border-green-400 dark:hover:border-green-600' 
  },
  device_smartphone: { 
    bg: 'bg-purple-50 dark:bg-purple-950/30', 
    border: 'border-purple-200 dark:border-purple-800', 
    hover: 'hover:border-purple-400 dark:hover:border-purple-600' 
  },
  modem: { 
    bg: 'bg-orange-50 dark:bg-orange-950/30', 
    border: 'border-orange-200 dark:border-orange-800', 
    hover: 'hover:border-orange-400 dark:hover:border-orange-600' 
  },
  netstick: { 
    bg: 'bg-cyan-50 dark:bg-cyan-950/30', 
    border: 'border-cyan-200 dark:border-cyan-800', 
    hover: 'hover:border-cyan-400 dark:hover:border-cyan-600' 
  },
};

export const isSim = (category: ItemCategory) => 
  category === 'sim_american' || category === 'sim_european';

export type SimValidityStatus = 'valid' | 'warning' | 'expired';
