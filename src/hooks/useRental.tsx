import { useState, useEffect, useRef, createContext, useContext, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Customer, 
  InventoryItem, 
  Rental, 
  Repair, 
  DashboardStats,
  ItemCategory 
} from '@/types/rental';
import { addDays, isAfter, isBefore, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface RentalItemUpdate {
  inventoryItemId: string;
  itemCategory: ItemCategory;
  itemName: string;
  pricePerDay?: number;
  hasIsraeliNumber?: boolean;
  isGeneric?: boolean;
}

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

// Cache keys for all data types
const CACHE_KEYS = {
  customers: 'dealcell_cache_customers_v1',
  inventory: 'dealcell_cache_inventory_v1',
  rentals: 'dealcell_cache_rentals_v1',
  repairs: 'dealcell_cache_repairs_v1',
};

// Generic cache functions
const loadCachedData = <T,>(key: string): T[] => {
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

const saveToCache = <T,>(key: string, data: T[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore storage quota / private mode errors
  }
};

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

  // Fetch all data from database with retry logic.
  // IMPORTANT: one failed table fetch should NOT block the others (e.g. inventory failure shouldn't hide customers).
  const fetchData = async (retryCount = 0, isBackgroundRetry = false) => {
    const maxRetries = 3;

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    type QueryResult<T> = { data: T[] | null; error: unknown | null };

    const runFetchesOnce = async () => {
      const results = await Promise.allSettled([
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        // Use RPC to avoid "/inventory" path being blocked by browser extensions/antivirus
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
      // Only show loading on initial load, not background retries
      if (!isBackgroundRetry) {
        setLoading(true);
      }

      const res = await runFetchesOnce();

      // Retry when we hit network-level failures (e.g. "Failed to fetch", "timeout")
      const hasNetworkFailure = Object.values(res).some(
        (r) => r.status === 'rejected' && 
          (String((r as PromiseRejectedResult).reason).toLowerCase().includes('failed to fetch') ||
           String((r as PromiseRejectedResult).reason).toLowerCase().includes('timeout'))
      );
      if (hasNetworkFailure && retryCount < maxRetries && !isBackgroundRetry) {
        // Exponential backoff: 1.5s, 3s, 4.5s
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
          const customerData = (data || []).map((c) => ({
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
            cellstationStatus: i.cellstation_status || undefined,
            lastSync: i.last_sync || undefined,
            needsSwap: i.needs_swap || false,
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
        rentalItemsData.forEach((item) => {
          if (!itemsByRental[item.rental_id]) itemsByRental[item.rental_id] = [];
          itemsByRental[item.rental_id].push(item);
        });

        const rentalsFormatted = (rentalsData || []).map((r) => ({
          id: r.id,
          customerId: r.customer_id || '',
          customerName: r.customer_name,
          items: (itemsByRental[r.id] || []).map((item) => ({
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
          const repairsFormatted = (data || []).map((r) => ({
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
        const allFailed = uniqueFailed.length >= 4; // customers+inventory+rentals+repairs (rentalItems is auxiliary)

        // Check if we have cached data to show
        const hasCachedCustomers = customers.length > 0;
        const hasCachedInventory = inventory.length > 0;
        const hasCachedRentals = rentals.length > 0;
        const hasCachedRepairs = repairs.length > 0;
        const hasSomeCachedData = hasCachedCustomers || hasCachedInventory || hasCachedRentals || hasCachedRepairs;

        if (isBackgroundRetry) {
          // Silent background retry - only show toast on success or final failure
          if (anyDataFetched) {
            // Some data was refreshed successfully
            toast({
              title: 'הנתונים עודכנו',
              description: 'חלק מהנתונים עודכנו בהצלחה מהשרת.',
            });
            backgroundRetryRef.current = 0;
          }
          // Don't show error on background retry, just schedule another attempt if needed
        } else if (hasSomeCachedData && !allFailed) {
          // Show gentle message when we have cached data to display
          toast({
            title: 'מוצג מהמטמון המקומי',
            description: `הנתונים שלך בטוחים. ננסה לסנכרן ברקע עוד מעט...`,
          });
        } else if (allFailed) {
          // All data failed and no cache - show error
          toast({
            title: 'שגיאה בטעינת נתונים',
            description: 'לא ניתן לטעון את הנתונים מהשרת. נסה לרענן את הדף.',
            variant: 'destructive',
          });
        } else {
          // Partial failure without cache - still show warning but softer
          toast({
            title: 'חלק מהנתונים לא נטענו',
            description: `נכשל בטעינת: ${uniqueFailed.join(', ')}. שאר הנתונים נטענו.`,
            variant: 'destructive',
          });
        }

        // Schedule background retry if we have failures
        if (!isBackgroundRetry && failedParts.length > 0 && backgroundRetryRef.current < 3) {
          scheduleBackgroundRetry();
        }
      } else {
        // All data loaded successfully
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
      
      // Check if we have cached data
      const hasSomeCachedData = customers.length > 0 || inventory.length > 0 || rentals.length > 0 || repairs.length > 0;
      
      if (isBackgroundRetry) {
        // Silent on background retry failure
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (backgroundRetryTimeoutRef.current) {
        clearTimeout(backgroundRetryTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // Helper function to check if item is truly available (status + valid expiry for SIMs)
  const isItemTrulyAvailable = (item: InventoryItem): boolean => {
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
  };

  const calculateStats = (): DashboardStats => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfTomorrow = addDays(today, 1);
    const threeDaysFromNow = addDays(today, 3);
    
    const activeRentals = rentals.filter(r => r.status === 'active').length;
    
    // Overdue = endDate is BEFORE today (strictly before start of today)
    const overdueReturns = rentals.filter(r => {
      if (r.status !== 'active') return false;
      const endDate = parseISO(r.endDate);
      return isBefore(endDate, today);
    }).length;
    
    // Ending today = endDate is exactly today
    const endingToday = rentals.filter(r => {
      if (r.status !== 'active') return false;
      const endDate = parseISO(r.endDate);
      return !isBefore(endDate, today) && isBefore(endDate, startOfTomorrow);
    }).length;
    
    // Upcoming = endDate is after today but within 3 days (tomorrow, day after, etc.)
    const upcomingReturns = rentals.filter(r => {
      if (r.status !== 'active') return false;
      const endDate = parseISO(r.endDate);
      return !isBefore(endDate, startOfTomorrow) && isBefore(endDate, threeDaysFromNow);
    }).length;
    
    const repairsInProgress = repairs.filter(r => r.status === 'in_lab').length;
    // Count only truly available items (with valid expiry for SIMs)
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
  };

  const [stats, setStats] = useState<DashboardStats>(calculateStats());

  useEffect(() => {
    setStats(calculateStats());
  }, [customers, inventory, rentals, repairs]);

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
    saveCustomers([newCustomer, ...customers]);
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

    saveCustomers(customers.map(c => c.id === id ? { ...c, ...customer } : c));
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

    saveCustomers(customers.filter(c => c.id !== id));
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

    saveCustomers(customers.map(c => c.id === id ? { 
      ...c, 
      hasPaymentToken: false,
      paymentTokenLast4: undefined,
      paymentTokenExpiry: undefined,
    } : c));
  };

  const addInventoryItem = async (item: Omit<InventoryItem, 'id'>) => {
    const { data, error } = await supabase
      .from('inventory')
      .insert({
        category: item.category as any, // Type assertion for new enum values
        name: item.name,
        local_number: item.localNumber || null,
        israeli_number: item.israeliNumber || null,
        expiry_date: item.expiryDate || null,
        sim_number: item.simNumber || null,
        status: item.status,
        notes: item.notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding inventory item:', error);
      throw error;
    }

    const newItem = {
      id: data.id,
      category: data.category as ItemCategory,
      name: data.name,
      localNumber: data.local_number || undefined,
      israeliNumber: data.israeli_number || undefined,
      expiryDate: data.expiry_date || undefined,
      simNumber: data.sim_number || undefined,
      status: data.status as 'available' | 'rented' | 'maintenance',
      notes: data.notes || undefined,
      barcode: data.barcode || undefined,
    };
    saveInventory([newItem, ...inventory]);
  };

  const updateInventoryItem = async (id: string, item: Partial<InventoryItem>) => {
    const updateData: Record<string, unknown> = {};
    if (item.category !== undefined) updateData.category = item.category;
    if (item.name !== undefined) updateData.name = item.name;
    if (item.localNumber !== undefined) updateData.local_number = item.localNumber;
    if (item.israeliNumber !== undefined) updateData.israeli_number = item.israeliNumber;
    if (item.expiryDate !== undefined) updateData.expiry_date = item.expiryDate;
    if (item.simNumber !== undefined) updateData.sim_number = item.simNumber;
    if (item.status !== undefined) updateData.status = item.status;
    if (item.notes !== undefined) updateData.notes = item.notes;

    const { error } = await supabase
      .from('inventory')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error updating inventory item:', error);
      throw error;
    }

    saveInventory(inventory.map(i => i.id === id ? { ...i, ...item } : i));
  };

  const deleteInventoryItem = async (id: string) => {
    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting inventory item:', error);
      throw error;
    }

    saveInventory(inventory.filter(i => i.id !== id));
  };

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
            item_category: item.itemCategory as any, // Type assertion for new enum values
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

    saveRentals(rentals.map(r => r.id === id ? { ...r, ...rental } : r));
  };

  // Update rental items - add/remove items from an existing rental
  const updateRentalItems = async (rentalId: string, newItems: RentalItemUpdate[], newTotalPrice: number) => {
    const existingRental = rentals.find(r => r.id === rentalId);
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

  const returnRental = async (id: string) => {
    const rental = rentals.find(r => r.id === id);
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
    // First delete rental items
    const { error: itemsError } = await supabase
      .from('rental_items')
      .delete()
      .eq('rental_id', id);

    if (itemsError) {
      console.error('Error deleting rental items:', itemsError);
      throw itemsError;
    }

    // Then delete the rental
    const { error } = await supabase
      .from('rentals')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting rental:', error);
      throw error;
    }

    saveRentals(rentals.filter(r => r.id !== id));
  };

  const addRepair = async (repair: Omit<Repair, 'id'>) => {
    const { data, error } = await supabase
      .from('repairs')
      .insert({
        repair_number: repair.repairNumber,
        device_type: repair.deviceType,
        device_model: repair.deviceModel || null,
        device_cost: repair.deviceCost || null,
        customer_name: repair.customerName,
        customer_phone: repair.customerPhone || null,
        problem_description: repair.problemDescription,
        status: repair.status,
        is_warranty: repair.isWarranty || false,
        received_date: repair.receivedDate,
        completed_date: repair.completedDate || null,
        collected_date: repair.collectedDate || null,
        notes: repair.notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding repair:', error);
      throw error;
    }

    const newRepair = {
      id: data.id,
      repairNumber: data.repair_number,
      deviceType: data.device_type,
      deviceModel: data.device_model || undefined,
      deviceCost: data.device_cost ? Number(data.device_cost) : undefined,
      customerName: data.customer_name,
      customerPhone: data.customer_phone || '',
      problemDescription: data.problem_description,
      status: data.status as 'in_lab' | 'ready' | 'collected',
      isWarranty: data.is_warranty || false,
      receivedDate: data.received_date,
      completedDate: data.completed_date || undefined,
      collectedDate: data.collected_date || undefined,
      notes: data.notes || undefined,
    };
    saveRepairs([newRepair, ...repairs]);
  };

  const updateRepair = async (id: string, repair: Partial<Repair>) => {
    const updateData: Record<string, unknown> = {};
    if (repair.repairNumber !== undefined) updateData.repair_number = repair.repairNumber;
    if (repair.deviceType !== undefined) updateData.device_type = repair.deviceType;
    if (repair.deviceModel !== undefined) updateData.device_model = repair.deviceModel;
    if (repair.deviceCost !== undefined) updateData.device_cost = repair.deviceCost;
    if (repair.customerName !== undefined) updateData.customer_name = repair.customerName;
    if (repair.customerPhone !== undefined) updateData.customer_phone = repair.customerPhone;
    if (repair.problemDescription !== undefined) updateData.problem_description = repair.problemDescription;
    if (repair.status !== undefined) updateData.status = repair.status;
    if (repair.isWarranty !== undefined) updateData.is_warranty = repair.isWarranty;
    if (repair.completedDate !== undefined) updateData.completed_date = repair.completedDate;
    if (repair.collectedDate !== undefined) updateData.collected_date = repair.collectedDate;
    if (repair.notes !== undefined) updateData.notes = repair.notes;

    const { error } = await supabase
      .from('repairs')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error updating repair:', error);
      throw error;
    }

    saveRepairs(repairs.map(r => r.id === id ? { ...r, ...repair } : r));
  };

  const deleteRepair = async (id: string) => {
    const { error } = await supabase
      .from('repairs')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting repair:', error);
      throw error;
    }

    saveRepairs(repairs.filter(r => r.id !== id));
  };

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
      !rentedItemIds.has(item.id) && // Double-check: not in any active rental
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

  const refreshData = async () => {
    await fetchData();
  };

  return (
    <RentalContext.Provider value={{
      customers,
      inventory,
      rentals,
      repairs,
      stats,
      loading,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      clearCustomerPaymentToken,
      addInventoryItem,
      updateInventoryItem,
      deleteInventoryItem,
      addRental,
      updateRental,
      updateRentalItems,
      returnRental,
      deleteRental,
      addRepair,
      updateRepair,
      deleteRepair,
      getAvailableItems,
      getUpcomingReturns,
      refreshData,
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
