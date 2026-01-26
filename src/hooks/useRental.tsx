import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
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
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => Promise<void>;
  updateInventoryItem: (id: string, item: Partial<InventoryItem>) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  addRental: (rental: Omit<Rental, 'id' | 'createdAt'>) => Promise<void>;
  updateRental: (id: string, rental: Partial<Rental>) => Promise<void>;
  returnRental: (id: string) => Promise<void>;
  addRepair: (repair: Omit<Repair, 'id'>) => Promise<void>;
  updateRepair: (id: string, repair: Partial<Repair>) => Promise<void>;
  deleteRepair: (id: string) => Promise<void>;
  getAvailableItems: (category?: ItemCategory) => InventoryItem[];
  getUpcomingReturns: () => Rental[];
  refreshData: () => Promise<void>;
}

const RentalContext = createContext<RentalContextType | undefined>(undefined);

export function RentalProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Fetch all data from database
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (customersError) throw customersError;
      
      // Fetch inventory
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (inventoryError) throw inventoryError;
      
      // Fetch rentals with their items
      const { data: rentalsData, error: rentalsError } = await supabase
        .from('rentals')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (rentalsError) throw rentalsError;

      // Fetch rental items
      const { data: rentalItemsData, error: rentalItemsError } = await supabase
        .from('rental_items')
        .select('*');
      
      if (rentalItemsError) throw rentalItemsError;
      
      // Fetch repairs
      const { data: repairsData, error: repairsError } = await supabase
        .from('repairs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (repairsError) throw repairsError;
      
      // Map database format to app format
      setCustomers(customersData?.map(c => ({
        id: c.id,
        name: c.name,
        address: c.address || undefined,
        phone: c.phone,
        email: c.email || undefined,
        creditCard: c.credit_card || undefined,
        notes: c.notes || undefined,
        createdAt: c.created_at.split('T')[0],
      })) || []);

      setInventory(inventoryData?.map(i => ({
        id: i.id,
        category: i.category as ItemCategory,
        name: i.name,
        localNumber: i.local_number || undefined,
        israeliNumber: i.israeli_number || undefined,
        expiryDate: i.expiry_date || undefined,
        status: i.status as 'available' | 'rented' | 'maintenance',
        notes: i.notes || undefined,
      })) || []);

      // Group rental items by rental_id
      const itemsByRental: Record<string, typeof rentalItemsData> = {};
      rentalItemsData?.forEach(item => {
        if (!itemsByRental[item.rental_id]) {
          itemsByRental[item.rental_id] = [];
        }
        itemsByRental[item.rental_id].push(item);
      });

      setRentals(rentalsData?.map(r => ({
        id: r.id,
        customerId: r.customer_id || '',
        customerName: r.customer_name,
        items: (itemsByRental[r.id] || []).map(item => ({
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
        createdAt: r.created_at.split('T')[0],
      })) || []);

      setRepairs(repairsData?.map(r => ({
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
      })) || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'שגיאה בטעינת נתונים',
        description: 'לא ניתן לטעון את הנתונים מהשרת',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  const addCustomer = async (customer: Omit<Customer, 'id' | 'createdAt'>) => {
    const { data, error } = await supabase
      .from('customers')
      .insert({
        name: customer.name,
        address: customer.address || null,
        phone: customer.phone,
        email: customer.email || null,
        credit_card: customer.creditCard || null,
        notes: customer.notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding customer:', error);
      throw error;
    }

    setCustomers(prev => [{
      id: data.id,
      name: data.name,
      address: data.address || undefined,
      phone: data.phone,
      email: data.email || undefined,
      creditCard: data.credit_card || undefined,
      notes: data.notes || undefined,
      createdAt: data.created_at.split('T')[0],
    }, ...prev]);
  };

  const updateCustomer = async (id: string, customer: Partial<Customer>) => {
    const { error } = await supabase
      .from('customers')
      .update({
        name: customer.name,
        address: customer.address || null,
        phone: customer.phone,
        email: customer.email || null,
        credit_card: customer.creditCard || null,
        notes: customer.notes || null,
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating customer:', error);
      throw error;
    }

    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...customer } : c));
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

    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  const addInventoryItem = async (item: Omit<InventoryItem, 'id'>) => {
    const { data, error } = await supabase
      .from('inventory')
      .insert({
        category: item.category,
        name: item.name,
        local_number: item.localNumber || null,
        israeli_number: item.israeliNumber || null,
        expiry_date: item.expiryDate || null,
        status: item.status,
        notes: item.notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding inventory item:', error);
      throw error;
    }

    setInventory(prev => [{
      id: data.id,
      category: data.category as ItemCategory,
      name: data.name,
      localNumber: data.local_number || undefined,
      israeliNumber: data.israeli_number || undefined,
      expiryDate: data.expiry_date || undefined,
      status: data.status as 'available' | 'rented' | 'maintenance',
      notes: data.notes || undefined,
    }, ...prev]);
  };

  const updateInventoryItem = async (id: string, item: Partial<InventoryItem>) => {
    const updateData: Record<string, unknown> = {};
    if (item.category !== undefined) updateData.category = item.category;
    if (item.name !== undefined) updateData.name = item.name;
    if (item.localNumber !== undefined) updateData.local_number = item.localNumber;
    if (item.israeliNumber !== undefined) updateData.israeli_number = item.israeliNumber;
    if (item.expiryDate !== undefined) updateData.expiry_date = item.expiryDate;
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

    setInventory(prev => prev.map(i => i.id === id ? { ...i, ...item } : i));
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

    setInventory(prev => prev.filter(i => i.id !== id));
  };

  const addRental = async (rental: Omit<Rental, 'id' | 'createdAt'>) => {
    // First, insert the rental
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
            item_category: item.itemCategory,
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

    // Update inventory status for non-generic items
    for (const item of rental.items) {
      if (!item.isGeneric && item.inventoryItemId) {
        await updateInventoryItem(item.inventoryItemId, { status: 'rented' });
      }
    }

    // Refresh data to get the complete rental with items
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

    const { error } = await supabase
      .from('rentals')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error updating rental:', error);
      throw error;
    }

    setRentals(prev => prev.map(r => r.id === id ? { ...r, ...rental } : r));
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

    setRepairs(prev => [{
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
    }, ...prev]);
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

    setRepairs(prev => prev.map(r => r.id === id ? { ...r, ...repair } : r));
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
