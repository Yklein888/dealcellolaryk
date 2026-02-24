// Item types for the rental system
// Note: device_simple_europe was removed - use European bundle instead
export type ItemCategory = 
  | 'sim_american'
  | 'sim_european'
  | 'device_simple'
  | 'device_smartphone'
  | 'modem'
  | 'netstick';

// Bundle types
export type BundleType = 
  | 'european_sim_simple'
  | 'european_sim_smartphone';

export interface InventoryItem {
  id: string;
  category: ItemCategory;
  name: string;
  localNumber?: string;
  israeliNumber?: string;
  expiryDate?: string;
  simNumber?: string;
  status: 'available' | 'rented' | 'maintenance';
  notes?: string;
  barcode?: string;
}

export interface Customer {
  id: string;
  name: string;
  address?: string;
  phone: string;
  email?: string;
  notes?: string;
  createdAt: string;
  // Payment token details - only last4 and expiry are exposed for display
  // The actual token (paymentToken) is NEVER sent to the frontend for security
  hasPaymentToken?: boolean; // Indicates if customer has a saved payment method
  paymentTokenLast4?: string;
  paymentTokenExpiry?: string;
}

export interface RentalItem {
  inventoryItemId: string;
  itemCategory: ItemCategory;
  itemName: string;
  pricePerDay?: number;
  hasIsraeliNumber?: boolean;
  isGeneric?: boolean; // If true, not linked to specific inventory item
}

export interface Rental {
  id: string;
  customerId: string;
  customerName: string;
  items: RentalItem[];
  startDate: string;
  endDate: string;
  totalPrice: number;
  currency: 'ILS' | 'USD';
  status: 'active' | 'overdue' | 'returned';
  deposit?: number;
  notes?: string;
  createdAt: string;
  // Pickup time - automatically set for devices and modems
  pickupTime?: string;
  // Overdue charging configuration
  overdueDailyRate?: number;
  overdueGraceDays?: number;
  autoChargeEnabled?: boolean;
}

export interface OverdueCharge {
  id: string;
  rentalId: string;
  customerId?: string;
  chargeDate: string;
  daysOverdue: number;
  amount: number;
  currency: string;
  status: 'pending' | 'charged' | 'failed' | 'waived';
  transactionId?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface CallLog {
  id: string;
  entityType: 'rental' | 'repair';
  entityId: string;
  customerId?: string;
  customerPhone: string;
  callStatus: 'pending' | 'answered' | 'no_answer' | 'busy' | 'callback';
  campaignId?: string;
  callType: 'manual' | 'automatic';
  callMessage?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Repair {
  id: string;
  repairNumber: string;
  deviceType: string;
  deviceModel?: string;
  deviceCost?: number;
  customerName: string;
  customerPhone: string;
  problemDescription: string;
  status: 'in_lab' | 'ready' | 'collected';
  isWarranty?: boolean;
  receivedDate: string;
  completedDate?: string;
  collectedDate?: string;
  notes?: string;
}

export interface DashboardStats {
  activeRentals: number;
  totalCustomers: number;
  itemsInStock: number;
  overdueReturns: number;
  repairsInProgress: number;
  upcomingReturns: number;
  endingToday: number;
}

// Hebrew labels for categories
export const categoryLabels: Record<ItemCategory, string> = {
  sim_american: 'סים אמריקאי',
  sim_european: 'סים אירופאי',
  device_simple: 'מכשיר פשוט',
  device_smartphone: 'סמארטפון',
  modem: 'מודם',
  netstick: 'נטסטיק',
};

export const categoryIcons: Record<ItemCategory, string> = {
  sim_american: '🇺🇸',
  sim_european: '🇪🇺',
  device_simple: '📱',
  device_smartphone: '📲',
  modem: '📡',
  netstick: '📶',
};

export const bundleLabels: Record<BundleType, string> = {
  european_sim_simple: 'סים אירופאי + מכשיר פשוט',
  european_sim_smartphone: 'סים אירופאי + סמארטפון',
};

export const bundleIcons: Record<BundleType, string> = {
  european_sim_simple: '🇪🇺📱',
  european_sim_smartphone: '🇪🇺📲',
};

export const repairStatusLabels: Record<Repair['status'], string> = {
  in_lab: 'במעבדה',
  ready: 'מוכן',
  collected: 'נאסף',
};

export const rentalStatusLabels: Record<Rental['status'], string> = {
  active: 'פעיל',
  overdue: 'באיחור',
  returned: 'הוחזר',
};

// ─── US SIMs ──────────────────────────────────────────────
export type USSimStatus = 'pending' | 'activating' | 'active' | 'returned';

export interface USSim {
  id: string;
  simCompany: string;
  simNumber?: string;
  package?: string;
  pricePerDay?: number;
  localNumber?: string;
  israeliNumber?: string;
  expiryDate?: string;
  status: USSimStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const usSimStatusLabels: Record<USSimStatus, string> = {
  pending: 'ממתין',
  activating: 'בהפעלה',
  active: 'פעיל',
  returned: 'הוחזר',
};
