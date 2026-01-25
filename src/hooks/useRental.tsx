import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { 
  Customer, 
  InventoryItem, 
  Rental, 
  Repair, 
  DashboardStats,
  ItemCategory 
} from '@/types/rental';
import { addDays, isAfter, isBefore, parseISO } from 'date-fns';

// Sample data
const sampleCustomers: Customer[] = [
  {
    id: '1',
    name: 'יוסי כהן',
    phone: '050-1234567',
    address: 'תל אביב, רחוב דיזנגוף 100',
    email: 'yossi@email.com',
    createdAt: '2024-01-15',
  },
  {
    id: '2',
    name: 'מיכל לוי',
    phone: '052-9876543',
    address: 'ירושלים, רחוב יפו 50',
    createdAt: '2024-02-20',
  },
  {
    id: '3',
    name: 'דוד אברהם',
    phone: '054-5555555',
    createdAt: '2024-03-10',
  },
];

const sampleInventory: InventoryItem[] = [
  {
    id: 'inv-1',
    category: 'sim_european',
    name: 'סים אירופאי #001',
    localNumber: '+44-7700-900123',
    israeliNumber: '050-0001111',
    expiryDate: '2025-06-30',
    status: 'available',
  },
  {
    id: 'inv-2',
    category: 'sim_american',
    name: 'סים אמריקאי #001',
    localNumber: '+1-555-123-4567',
    israeliNumber: '050-0002222',
    expiryDate: '2025-08-15',
    status: 'rented',
  },
  {
    id: 'inv-3',
    category: 'device_smartphone',
    name: 'iPhone 14',
    status: 'available',
  },
  {
    id: 'inv-4',
    category: 'device_simple',
    name: 'Nokia 3310',
    status: 'available',
  },
  {
    id: 'inv-5',
    category: 'modem',
    name: 'מודם 4G #001',
    status: 'available',
  },
  {
    id: 'inv-6',
    category: 'netstick',
    name: 'נטסטיק #001',
    status: 'maintenance',
  },
];

const sampleRentals: Rental[] = [
  {
    id: 'rent-1',
    customerId: '1',
    customerName: 'יוסי כהן',
    items: [
      { inventoryItemId: 'inv-2', itemCategory: 'sim_american', itemName: 'סים אמריקאי #001', hasIsraeliNumber: true },
    ],
    startDate: '2024-12-15',
    endDate: '2024-12-25',
    totalPrice: 65,
    currency: 'USD',
    status: 'active',
    deposit: 500,
    createdAt: '2024-12-14',
  },
];

const sampleRepairs: Repair[] = [
  {
    id: 'rep-1',
    repairNumber: '1001',
    deviceType: 'סמארטפון',
    customerName: 'רחל גולדברג',
    customerPhone: '053-1112233',
    problemDescription: 'מסך שבור',
    status: 'in_lab',
    receivedDate: '2024-12-18',
  },
  {
    id: 'rep-2',
    repairNumber: '1002',
    deviceType: 'מודם',
    customerName: 'אבי שמעון',
    customerPhone: '058-4445566',
    problemDescription: 'לא נדלק',
    status: 'ready',
    receivedDate: '2024-12-10',
    completedDate: '2024-12-19',
  },
];

interface RentalContextType {
  customers: Customer[];
  inventory: InventoryItem[];
  rentals: Rental[];
  repairs: Repair[];
  stats: DashboardStats;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => void;
  updateInventoryItem: (id: string, item: Partial<InventoryItem>) => void;
  deleteInventoryItem: (id: string) => void;
  addRental: (rental: Omit<Rental, 'id' | 'createdAt'>) => void;
  updateRental: (id: string, rental: Partial<Rental>) => void;
  returnRental: (id: string) => void;
  addRepair: (repair: Omit<Repair, 'id'>) => void;
  updateRepair: (id: string, repair: Partial<Repair>) => void;
  deleteRepair: (id: string) => void;
  getAvailableItems: (category?: ItemCategory) => InventoryItem[];
  getUpcomingReturns: () => Rental[];
}

const RentalContext = createContext<RentalContextType | undefined>(undefined);

export function RentalProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>(sampleCustomers);
  const [inventory, setInventory] = useState<InventoryItem[]>(sampleInventory);
  const [rentals, setRentals] = useState<Rental[]>(sampleRentals);
  const [repairs, setRepairs] = useState<Repair[]>(sampleRepairs);

  const calculateStats = (): DashboardStats => {
    const today = new Date();
    const threeDaysFromNow = addDays(today, 3);
    
    const activeRentals = rentals.filter(r => r.status === 'active').length;
    const overdueReturns = rentals.filter(r => 
      r.status === 'active' && isBefore(parseISO(r.endDate), today)
    ).length;
    const upcomingReturns = rentals.filter(r => 
      r.status === 'active' && 
      isAfter(parseISO(r.endDate), today) && 
      isBefore(parseISO(r.endDate), threeDaysFromNow)
    ).length;
    const repairsInProgress = repairs.filter(r => r.status === 'in_lab').length;
    const itemsInStock = inventory.filter(i => i.status === 'available').length;

    return {
      activeRentals,
      totalCustomers: customers.length,
      itemsInStock,
      overdueReturns,
      repairsInProgress,
      upcomingReturns,
    };
  };

  const [stats, setStats] = useState<DashboardStats>(calculateStats());

  useEffect(() => {
    setStats(calculateStats());
  }, [customers, inventory, rentals, repairs]);

  const addCustomer = (customer: Omit<Customer, 'id' | 'createdAt'>) => {
    const newCustomer: Customer = {
      ...customer,
      id: `cust-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setCustomers(prev => [...prev, newCustomer]);
  };

  const updateCustomer = (id: string, customer: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...customer } : c));
  };

  const deleteCustomer = (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  const addInventoryItem = (item: Omit<InventoryItem, 'id'>) => {
    const newItem: InventoryItem = {
      ...item,
      id: `inv-${Date.now()}`,
    };
    setInventory(prev => [...prev, newItem]);
  };

  const updateInventoryItem = (id: string, item: Partial<InventoryItem>) => {
    setInventory(prev => prev.map(i => i.id === id ? { ...i, ...item } : i));
  };

  const deleteInventoryItem = (id: string) => {
    setInventory(prev => prev.filter(i => i.id !== id));
  };

  const addRental = (rental: Omit<Rental, 'id' | 'createdAt'>) => {
    const newRental: Rental = {
      ...rental,
      id: `rent-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setRentals(prev => [...prev, newRental]);
    
    // Update inventory status
    rental.items.forEach(item => {
      updateInventoryItem(item.inventoryItemId, { status: 'rented' });
    });
  };

  const updateRental = (id: string, rental: Partial<Rental>) => {
    setRentals(prev => prev.map(r => r.id === id ? { ...r, ...rental } : r));
  };

  const returnRental = (id: string) => {
    const rental = rentals.find(r => r.id === id);
    if (rental) {
      rental.items.forEach(item => {
        updateInventoryItem(item.inventoryItemId, { status: 'available' });
      });
      updateRental(id, { status: 'returned' });
    }
  };

  const addRepair = (repair: Omit<Repair, 'id'>) => {
    const newRepair: Repair = {
      ...repair,
      id: `rep-${Date.now()}`,
    };
    setRepairs(prev => [...prev, newRepair]);
  };

  const updateRepair = (id: string, repair: Partial<Repair>) => {
    setRepairs(prev => prev.map(r => r.id === id ? { ...r, ...repair } : r));
  };

  const deleteRepair = (id: string) => {
    setRepairs(prev => prev.filter(r => r.id !== id));
  };

  const getAvailableItems = (category?: ItemCategory) => {
    return inventory.filter(item => 
      item.status === 'available' && 
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

  return (
    <RentalContext.Provider value={{
      customers,
      inventory,
      rentals,
      repairs,
      stats,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      addInventoryItem,
      updateInventoryItem,
      deleteInventoryItem,
      addRental,
      updateRental,
      returnRental,
      addRepair,
      updateRepair,
      deleteRepair,
      getAvailableItems,
      getUpcomingReturns,
    }}>
      {children}
    </RentalContext.Provider>
  );
}

export function useRental() {
  const context = useContext(RentalContext);
  if (!context) {
    throw new Error('useRental must be used within a RentalProvider');
  }
  return context;
}
