import { useState, useEffect, useRef, createContext, useContext, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Customer, 
  InventoryItem, 
  Rental, 
  Repair, 
  DashboardStats,
  ItemCategory 
} from '@/types/rental';
import { useToast } from '@/hooks/use-toast';

// Import sub-modules
import { CACHE_KEYS, loadCachedData, saveToCache } from './rental/types';
import { createCustomerOperations } from './rental/useCustomerOperations';
import { createInventoryOperations } from './rental/useInventoryOperations';
import { createRentalOperations } from './rental/useRentalOperations';
import { createRentalItemOperations } from './rental/useRentalItemOperations';
import { createRepairOperations } from './rental/useRepairOperations';
import { calculateStats } from './rental/useRentalStats';
import { createRentalValidation } from './rental/useRentalValidation';
import type { RentalItemUpdate } from './rental/types';

interface RentalContextType {
  customers: Customer[];
  inventory: InventoryItem[];
  rentals: Rental[];
  repairs: Repair[];
  stats: DashboardStats;
  loading: boolean;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Promise<void>;
  updateCustomer: (id: string, customer: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  clearCustomerPaymentToken: (id: string) => Promise<void>;
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => Promise<void>;
  updateInventoryItem: (id: string, item: Partial<InventoryItem>) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  addRental: (rental: Omit<Rental, 'id' | 'createdAt'>) => Promise<void>;
  updateRental: (id: string, rental: Partial<Rental>) => Promise<void>;
  updateRentalItems: (rentalId: string, newItems: RentalItemUpdate[], newTotalPrice: number) => Promise<void>;
  returnRental: (id: string) => Promise<void>;
  deleteRental: (id: string) => Promise<void>;
  addRepair: (repair: Omit<Repair, 'id'>) => Promise<void>;
  updateRepair: (id: string, repair: Partial<Repair>) => Promise<void>;
  deleteRepair: (id: string) => Promise<void>;
  getAvailableItems: (category?: ItemCategory) => InventoryItem[];
  getUpcomingReturns: () => Rental[];
  refreshData: () => Promise<void>;
}

const RentalContext = createContext<RentalContextType | undefined>(undefined);

export function RentalProvider({ children }: { children: ReactNode }) {
  // Initialize all states from cache for instant display
  const [customers, setCustomers] = useState<Customer[]>(() => loadCachedData<Customer>(CACHE_KEYS.customers));
  const [inventory, setInventory] = useState<InventoryItem[]>(() => loadCachedData<InventoryItem>(CACHE_KEYS.inventory));
  const [rentals, setRentals] = useState<Rental[]>(() => loadCachedData<Rental>(CACHE_KEYS.rentals));
  const [repairs, setRepairs] = useState<Repair[]>(() => loadCachedData<Repair>(CACHE_KEYS.repairs));
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  // Background retry state
  const backgroundRetryRef = useRef(0);
  const backgroundRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Debounce ref for realtime updates
  const realtimeDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Save functions that also update cache
  const saveCustomers = useCallback((data: Customer[]) => {
    setCustomers(data);
    saveToCache(CACHE_KEYS.customers, data);
  }, []);

  const saveInventory = useCallback((data: InventoryItem[]) => {
    setInventory(data);
    saveToCache(CACHE_KEYS.inventory, data);
  }, []);

  const saveRentals = useCallback((data: Rental[]) => {
    setRentals(data);
    saveToCache(CACHE_KEYS.rentals, data);
  }, []);

  const saveRepairs = useCallback((data: Repair[]) => {
    setRepairs(data);
    saveToCache(CACHE_KEYS.repairs, data);
  }, []);

  // Schedule a background retry after 30 seconds
  const scheduleBackgroundRetry = useCallback(() => {
    if (backgroundRetryTimeoutRef.current) {
      clearTimeout(backgroundRetryTimeoutRef.current);
    }
    
    if (backgroundRetryRef.current >= 3) {
      console.log('Max background retries reached');
      return;
    }

    backgroundRetryTimeoutRef.current = setTimeout(() => {
      backgroundRetryRef.current += 1;
      console.log(`Background retry attempt ${backgroundRetryRef.current}/3`);
      fetchData(0, true);
    }, 30000);
  }, []);

  // Fetch all data from database with retry logic
  const fetchData = async (retryCount = 0, isBackgroundRetry = false) => {
    const maxRetries = 3;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    type QueryResult<T> = { data: T[] | null; error: unknown | null };

    const runFetchesOnce = async () => {
      const results = await Promise.allSettled([
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        supabase.rpc('get_stock_items'),
        supabase.from('rentals').select('*').order('created_at', { ascending: false }),
        supabase.from('rental_items').select('*'),
        supabase.from('repairs').select('*').order('created_at', { ascending: false }),
      ]);

      return {
        customers: results[0],
        inventory: results[1],
        rentals: results[2],
        rentalItems: results[3],
        repairs: results[4],
      };
    };

    try {
      if (!isBackgroundRetry) {
        setLoading(true);
      }

      const res = await runFetchesOnce();

      // Retry when we hit network-level failures
      const hasNetworkFailure = Object.values(res).some(
        (r) => r.status === 'rejected' && 
          (String((r as PromiseRejectedResult).reason).toLowerCase().includes('failed to fetch') ||
           String((r as PromiseRejectedResult).reason).toLowerCase().includes('timeout'))
      );
      if (hasNetworkFailure && retryCount < maxRetries && !isBackgroundRetry) {
        await sleep(1500 * (retryCount + 1));
        return fetchData(retryCount + 1, isBackgroundRetry);
      }

      const failedParts: string[] = [];
      let anyDataFetched = false;

      // Customers
      if (res.customers.status === 'fulfilled') {
        const { data, error } = res.customers.value as QueryResult<any>;
        if (error) {
          failedParts.push('לקוחות');
        } else {
          anyDataFetched = true;
          const customerData = (data || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            address: c.address || undefined,
            phone: c.phone,
            email: c.email || undefined,
            notes: c.notes || undefined,
            createdAt: String(c.created_at).split('T')[0],
            hasPaymentToken: !!(c.payment_token && c.payment_token.length > 0),
            paymentTokenLast4: c.payment_token_last4 || undefined,
            paymentTokenExpiry: c.payment_token_expiry || undefined,
          }));
          saveCustomers(customerData);
        }
      } else {
        failedParts.push('לקוחות');
      }

      // Inventory
      if (res.inventory.status === 'fulfilled') {
        const { data, error } = res.inventory.value as QueryResult<any>;
        if (error) {
          failedParts.push('מלאי');
        } else {
          anyDataFetched = true;
          const nextInventory = (data || []).map((i: any) => ({
            id: i.id,
            category: i.category as ItemCategory,
            name: i.name,
            localNumber: i.local_number || undefined,
            israeliNumber: i.israeli_number || undefined,
            expiryDate: i.expiry_date || undefined,
            simNumber: i.sim_number || undefined,
            status: i.status as 'available' | 'rented' | 'maintenance',
            notes: i.notes || undefined,
            barcode: i.barcode || undefined,
          }));
          saveInventory(nextInventory);
        }
      } else {
        failedParts.push('מלאי');
      }

      // Rentals + Rental Items
      let rentalsData: any[] | null = null;
      let rentalsOk = false;
      if (res.rentals.status === 'fulfilled') {
        const { data, error } = res.rentals.value as QueryResult<any>;
        if (error) {
          failedParts.push('השכרות');
        } else {
          rentalsData = data;
          rentalsOk = true;
          anyDataFetched = true;
        }
      } else {
        failedParts.push('השכרות');
      }

      let rentalItemsData: any[] = [];
      if (res.rentalItems.status === 'fulfilled') {
        const { data, error } = res.rentalItems.value as QueryResult<any>;
        if (error) {
          failedParts.push('פריטי השכרה');
        } else {
          rentalItemsData = data || [];
        }
      } else {
        failedParts.push('פריטי השכרה');
      }

      if (rentalsOk) {
        const itemsByRental: Record<string, any[]> = {};
        rentalItemsData.forEach((item: any) => {
          if (!itemsByRental[item.rental_id]) itemsByRental[item.rental_id] = [];
          itemsByRental[item.rental_id].push(item);
        });

        const rentalsFormatted = (rentalsData || []).map((r: any) => ({
          id: r.id,
          customerId: r.customer_id || '',
          customerName: r.customer_name,
          items: (itemsByRental[r.id] || []).map((item: any) => ({
            inventoryItemId: item.inventory_item_id || '',
            itemCategory: item.item_category as ItemCategory,
            itemName: item.item_name,
            pricePerDay: item.price_per_day ? Number(item.price_per_day) : undefined,
            hasIsraeliNumber: item.has_israeli_number || false,
            isGeneric: item.is_generic || false,
          })),
          startDate: r.start_date,
          endDate: r.end_date,
          totalPrice: Number(r.total_price),
          currency: r.currency as 'ILS' | 'USD',
          status: r.status as 'active' | 'overdue' | 'returned',
          deposit: r.deposit ? Number(r.deposit) : undefined,
          notes: r.notes || undefined,
          createdAt: String(r.created_at).split('T')[0],
          pickupTime: r.pickup_time || undefined,
          overdueDailyRate: r.overdue_daily_rate ? Number(r.overdue_daily_rate) : undefined,
          overdueGraceDays: r.overdue_grace_days ?? 0,
          autoChargeEnabled: r.auto_charge_enabled ?? false,
        }));
        saveRentals(rentalsFormatted);
      }

      // Repairs
      if (res.repairs.status === 'fulfilled') {
        const { data, error } = res.repairs.value as QueryResult<any>;
        if (error) {
          failedParts.push('תיקונים');
        } else {
          anyDataFetched = true;
          const repairsFormatted = (data || []).map((r: any) => ({
            id: r.id,
            repairNumber: r.repair_number,
            deviceType: r.device_type,
            deviceModel: r.device_model || undefined,
            deviceCost: r.device_cost ? Number(r.device_cost) : undefined,
            customerName: r.customer_name,
            customerPhone: r.customer_phone || '',
            problemDescription: r.problem_description,
            status: r.status as 'in_lab' | 'ready' | 'collected',
            isWarranty: r.is_warranty || false,
            receivedDate: r.received_date,
            completedDate: r.completed_date || undefined,
            collectedDate: r.collected_date || undefined,
            notes: r.notes || undefined,
          }));
          saveRepairs(repairsFormatted);
        }
      } else {
        failedParts.push('תיקונים');
      }

      // Handle notifications based on failure status
      if (failedParts.length > 0) {
        const uniqueFailed = Array.from(new Set(failedParts));
        const allFailed = uniqueFailed.length >= 4;

        const hasSomeCachedData = customers.length > 0 || inventory.length > 0 || rentals.length > 0 || repairs.length > 0;

        if (isBackgroundRetry) {
          if (anyDataFetched) {
            toast({
              title: 'הנתונים עודכנו',
              description: 'חלק מהנתונים עודכנו בהצלחה מהשרת.',
            });
            backgroundRetryRef.current = 0;
          }
        } else if (hasSomeCachedData && !allFailed) {
          toast({
            title: 'מוצג מהמטמון המקומי',
            description: `הנתונים שלך בטוחים. ננסה לסנכרן ברקע עוד מעט...`,
          });
        } else if (allFailed) {
          toast({
            title: 'שגיאה בטעינת נתונים',
            description: 'לא ניתן לטעון את הנתונים מהשרת. נסה לרענן את הדף.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'חלק מהנתונים לא נטענו',
            description: `נכשל בטעינת: ${uniqueFailed.join(', ')}. שאר הנתונים נטענו.`,
            variant: 'destructive',
          });
        }

        if (!isBackgroundRetry && failedParts.length > 0 && backgroundRetryRef.current < 3) {
          scheduleBackgroundRetry();
        }
      } else {
        backgroundRetryRef.current = 0;
        if (isBackgroundRetry) {
          toast({
            title: 'הסנכרון הושלם',
            description: 'כל הנתונים עודכנו בהצלחה מהשרת.',
          });
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      
      const hasSomeCachedData = customers.length > 0 || inventory.length > 0 || rentals.length > 0 || repairs.length > 0;
      
      if (isBackgroundRetry) {
        console.log('Background retry failed, will try again...');
      } else if (hasSomeCachedData) {
        toast({
          title: 'מוצג מהמטמון המקומי',
          description: 'בעיית רשת זמנית. הנתונים שלך בטוחים. ננסה לסנכרן ברקע.',
        });
        scheduleBackgroundRetry();
      } else {
        toast({
          title: 'שגיאה בטעינת נתונים',
          description: 'לא ניתן לטעון את הנתונים מהשרת. נסה לרענן את הדף.',
          variant: 'destructive',
        });
      }
    } finally {
      if (!isBackgroundRetry) {
        setLoading(false);
      }
    }
  };

  // Debounced fetch for realtime - coalesces multiple rapid changes into one fetch
  const debouncedFetchData = useCallback(() => {
    if (realtimeDebounceRef.current) {
      clearTimeout(realtimeDebounceRef.current);
    }
    realtimeDebounceRef.current = setTimeout(() => {
      fetchData(0, true);
    }, 1000);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (backgroundRetryTimeoutRef.current) {
        clearTimeout(backgroundRetryTimeoutRef.current);
      }
      if (realtimeDebounceRef.current) {
        clearTimeout(realtimeDebounceRef.current);
      }
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, []);

  // Real-time subscriptions with enhanced reconnection
  useEffect(() => {
    let retryCount = 0;
    const maxRetry = 10;

    const setupChannel = () => {
      const channel = supabase
        .channel('realtime-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rentals' }, () => {
          console.log('[Realtime] rentals changed');
          debouncedFetchData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rental_items' }, () => {
          console.log('[Realtime] rental_items changed');
          debouncedFetchData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
          console.log('[Realtime] inventory changed');
          debouncedFetchData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
          console.log('[Realtime] customers changed');
          debouncedFetchData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'repairs' }, () => {
          console.log('[Realtime] repairs changed');
          debouncedFetchData();
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Realtime] Connected successfully');
            retryCount = 0;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[Realtime] Connection issue, retrying...');
            if (retryCount < maxRetry) {
              const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
              retryCount++;
              setTimeout(() => {
                supabase.removeChannel(channel);
                setupChannel();
              }, delay);
            }
          }
        });

      return channel;
    };

    const channel = setupChannel();

    // Re-sync when tab becomes visible again
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Realtime] Tab visible, refreshing data');
        debouncedFetchData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [debouncedFetchData]);

  // Stats calculation with useMemo
  const stats = useMemo(() => calculateStats(customers, inventory, rentals, repairs), [customers, inventory, rentals, repairs]);

  // Create state setters for sub-modules
  const customersState = useMemo(() => ({ data: customers, save: saveCustomers }), [customers, saveCustomers]);
  const inventoryState = useMemo(() => ({ data: inventory, save: saveInventory }), [inventory, saveInventory]);
  const rentalsState = useMemo(() => ({ data: rentals, save: saveRentals }), [rentals, saveRentals]);
  const repairsState = useMemo(() => ({ data: repairs, save: saveRepairs }), [repairs, saveRepairs]);

  // Compose operations from sub-modules
  const customerOps = useMemo(() => createCustomerOperations(customersState), [customersState]);
  const inventoryOps = useMemo(() => createInventoryOperations(inventoryState), [inventoryState]);
  const repairOps = useMemo(() => createRepairOperations(repairsState), [repairsState]);
  
  const rentalOps = useMemo(() => createRentalOperations({
    rentals: rentalsState,
    inventory: inventoryState,
    fetchData,
    updateInventoryItem: inventoryOps.updateInventoryItem,
  }), [rentalsState, inventoryState, inventoryOps.updateInventoryItem]);

  const rentalItemOps = useMemo(() => createRentalItemOperations({
    rentals: rentalsState,
    fetchData,
  }), [rentalsState]);

  const validation = useMemo(() => createRentalValidation(inventory, rentals), [inventory, rentals]);

  const refreshData = useCallback(async () => {
    await fetchData();
  }, []);

  const contextValue = useMemo(() => ({
    customers,
    inventory,
    rentals,
    repairs,
    stats,
    loading,
    ...customerOps,
    ...inventoryOps,
    ...rentalOps,
    updateRentalItems: rentalItemOps.updateRentalItems,
    ...repairOps,
    ...validation,
    refreshData,
  }), [customers, inventory, rentals, repairs, stats, loading, customerOps, inventoryOps, rentalOps, rentalItemOps, repairOps, validation, refreshData]);

  return (
    <RentalContext.Provider value={contextValue}>
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