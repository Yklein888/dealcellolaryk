import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  RefreshCw,
  Package,
  Smartphone,
  Zap,
  Users,
  CloudDownload,
  Search,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeftRight,
  Loader2,
  Printer,
  Calculator,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useRental } from '@/hooks/useRental';
import { printCallingInstructions } from '@/lib/callingInstructions';
import { 
  calculateRentalPrice, 
  getExcludedDaysBreakdown, 
  EUROPEAN_BUNDLE_DEVICE_RATE 
} from '@/lib/pricing';
import { ItemCategory } from '@/types/rental';

// ============================================
// Cell Station Dashboard v5.0
// סנכרון + הפעלות + החלפות + חישוב מחירים
// ============================================

const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzKhHEQeldMrsNjL8RZMigkPvIKJDRSWD0WoDYpyGPAmGxBYFxDi_9EiUldFjnZ6TIE/exec';

// === Types ===
interface Rental {
  rental_id: string;
  id: string;
  sim: string;
  local_number: string;
  israel_number: string;
  plan: string;
  start_date: string;
  end_date: string;
  days: string;
  customer_name: string;
  customer_phone: string;
  status: string;
}

interface InventoryItem {
  id: string;
  sim: string;
  local_number: string;
  israel_number: string;
  plan: string;
  expiry: string;
  status: 'active' | 'inactive';
}

interface Customer {
  name: string;
  phone: string;
  rentals_count: number;
  last_rental: string;
}

interface Stats {
  total_inventory: number;
  active_inventory: number;
  inactive_inventory: number;
  available_for_rent: number;
  total_rentals: number;
  ending_today: number;
  ending_tomorrow: number;
  ended: number;
}

interface PendingAction {
  action: string;
  sim?: string;
  customer_name?: string;
  old_sim?: string;
  new_sim?: string;
}

interface CalculatedPrice {
  total: number;
  breakdown: Array<{ item: string; price: number; currency: string; details?: string }>;
  businessDaysInfo?: { 
    businessDays: number; 
    excludedDates: string[];
    totalDays: number;
    saturdays: number;
    holidays: number;
  };
}

// === Stat Card Component ===
function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  variant = 'default',
  highlight = false 
}: { 
  title: string; 
  value: number; 
  icon: React.ElementType;
  variant?: 'default' | 'warning' | 'success' | 'destructive' | 'primary';
  highlight?: boolean;
}) {
  const variantStyles = {
    default: 'border-border/50',
    warning: 'border-warning/50 bg-warning/5',
    success: 'border-success/50 bg-success/5',
    destructive: 'border-destructive/50 bg-destructive/5',
    primary: 'border-primary/50 bg-primary/5',
  };

  const iconStyles = {
    default: 'text-muted-foreground',
    warning: 'text-warning',
    success: 'text-success',
    destructive: 'text-destructive',
    primary: 'text-primary',
  };

  return (
    <Card className={cn(
      'glass-card transition-all duration-200',
      variantStyles[variant],
      highlight && 'ring-2 ring-warning animate-pulse'
    )}>
      <CardContent className="p-4 text-center">
        <Icon className={cn('h-6 w-6 mx-auto mb-2', iconStyles[variant])} />
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{title}</div>
      </CardContent>
    </Card>
  );
}

// === Helper Functions ===
const parseExpiryDate = (expiry: string): string | undefined => {
  if (!expiry) return undefined;
  const parts = expiry.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return undefined;
};

const getSimExpiryWarning = (sim: InventoryItem, endDate: string): string | null => {
  if (!sim.expiry || !endDate) return null;
  
  const parts = sim.expiry.split('/');
  if (parts.length !== 3) return null;
  
  const expiryDate = new Date(
    parseInt(parts[2]), 
    parseInt(parts[1]) - 1, 
    parseInt(parts[0])
  );
  const rentalEnd = new Date(endDate);
  
  if (expiryDate < rentalEnd) {
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return `⚠️ הסים יפוג ב-${daysUntilExpiry} ימים - לפני סיום ההשכרה!`;
  }
  return null;
};

// === Main Component ===
export function CellStationDashboard() {
  const { toast } = useToast();
  const { 
    addRental, 
    addInventoryItem, 
    inventory: supabaseInventory,
    customers: supabaseCustomers,
    refreshData: refreshSupabaseData 
  } = useRental();

  // State
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [availableSims, setAvailableSims] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('rentals');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // Activate form state
  const [selectedSim, setSelectedSim] = useState<InventoryItem | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [price, setPrice] = useState('');
  const [includeDevice, setIncludeDevice] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  // Calculated price state
  const [calculatedPrice, setCalculatedPrice] = useState<CalculatedPrice | null>(null);

  // Success dialog state
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [lastActivation, setLastActivation] = useState<{
    sim: InventoryItem;
    customerName: string;
    customerPhone: string;
    price: number;
    startDate: string;
    endDate: string;
  } | null>(null);

  // Replace form state
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [newSim, setNewSim] = useState('');

  // === Calculate price effect ===
  useEffect(() => {
    if (!selectedSim || !startDate || !endDate) {
      setCalculatedPrice(null);
      return;
    }

    try {
      const items: Array<{ category: ItemCategory; includeEuropeanDevice?: boolean }> = [
        { category: 'sim_european' as ItemCategory, includeEuropeanDevice: includeDevice }
      ];

      const result = calculateRentalPrice(items, startDate, endDate);
      setCalculatedPrice({
        total: result.ilsTotal || result.total,
        breakdown: result.breakdown,
        businessDaysInfo: result.businessDaysInfo
      });
    } catch (err) {
      console.error('Error calculating price:', err);
      setCalculatedPrice(null);
    }
  }, [selectedSim, startDate, endDate, includeDevice]);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(WEBAPP_URL);
      const data = await res.json();

      if (data.success !== false) {
        setRentals(data.rentals || []);
        setInventory(data.inventory || []);
        setAvailableSims(data.available_sims || []);
        setStats(data.stats || null);
        setPendingAction(data.pending || null);
      } else {
        setError(data.error || 'שגיאה בטעינת נתונים');
      }
    } catch (err) {
      setError('שגיאה בחיבור - לחץ על הסימנייה ב-Cell Station לסנכרון ראשוני');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch(WEBAPP_URL + '?action=customers');
      const data = await res.json();
      if (data.customers) setCustomers(data.customers);
    } catch (e) {}
  };

  useEffect(() => {
    fetchData();
    fetchCustomers();
  }, []);

  // Quick date helpers
  const setQuickDate = (days: number) => {
    const today = new Date();
    const start = format(today, 'yyyy-MM-dd');
    const end = format(addDays(today, days - 1), 'yyyy-MM-dd');
    setStartDate(start);
    setEndDate(end);
  };

  // Filter rentals
  const filteredRentals = useMemo(() => rentals.filter(r =>
    !searchTerm ||
    r.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.local_number?.includes(searchTerm) ||
    r.sim?.includes(searchTerm)
  ), [rentals, searchTerm]);

  // Filter inventory by status and search term
  const filteredInventory = useMemo(() => {
    let result = inventory;
    
    // Filter by status
    if (statusFilter === 'active') {
      result = result.filter(s => s.status === 'active');
    } else if (statusFilter === 'inactive') {
      result = result.filter(s => s.status === 'inactive');
    }
    
    // Filter by search term
    if (searchTerm) {
      result = result.filter(s =>
        s.local_number?.includes(searchTerm) ||
        s.sim?.includes(searchTerm) ||
        s.id?.includes(searchTerm)
      );
    }
    
    return result;
  }, [inventory, searchTerm, statusFilter]);

  // Get status variant
  const getStatusVariant = (status: string): 'default' | 'destructive' | 'warning' | 'success' => {
    if (status === 'הסתיים' || status === 'ended') return 'destructive';
    if (status === 'מסתיים היום!' || status.includes('היום')) return 'warning';
    if (status === 'מסתיים מחר' || status.includes('מחר')) return 'warning';
    return 'success';
  };

  // Reset form
  const resetForm = () => {
    setSelectedSim(null);
    setCustomerName('');
    setCustomerPhone('');
    setStartDate('');
    setEndDate('');
    setPrice('');
    setIncludeDevice(false);
    setCalculatedPrice(null);
  };

  // Print instructions helper
  const handlePrintInstructions = async (sim: InventoryItem) => {
    try {
      await printCallingInstructions(
        sim.israel_number,
        sim.local_number,
        `SIM-${sim.sim.slice(-8)}`,
        false, // סים אירופאי
        sim.plan,
        sim.expiry
      );
      toast({ title: '🖨️ הודפס בהצלחה', description: 'ההוראות נשלחו למדפסת' });
    } catch (error) {
      console.error('Print error:', error);
      toast({ title: 'שגיאה בהדפסה', variant: 'destructive' });
    }
  };

  // Send activate request with Supabase sync
  const handleActivate = async () => {
    if (!selectedSim || !customerName || !startDate || !endDate) {
      toast({
        title: 'שגיאה',
        description: 'נא למלא את כל השדות',
        variant: 'destructive',
      });
      return;
    }

    setIsActivating(true);

    try {
      // Step 1: Send to Google Script
      const res = await fetch(WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'activate',
          sim: selectedSim.sim,
          customer_name: customerName,
          customer_phone: customerPhone,
          start_date: startDate,
          end_date: endDate,
          price: calculatedPrice?.total || parseFloat(price) || 0,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'שגיאה בשליחה ל-Google Script');
      }

      // Step 2: Add to Supabase inventory if not exists
      const existingItem = supabaseInventory.find(i => i.simNumber === selectedSim.sim);
      let inventoryItemId = existingItem?.id;

      if (!existingItem) {
        try {
          await addInventoryItem({
            category: 'sim_european' as ItemCategory,
            name: `סים ${selectedSim.local_number}`,
            localNumber: selectedSim.local_number || undefined,
            israeliNumber: selectedSim.israel_number || undefined,
            expiryDate: parseExpiryDate(selectedSim.expiry),
            simNumber: selectedSim.sim,
            status: 'available',
          });
          // Wait a bit for the inventory to update
          await new Promise(resolve => setTimeout(resolve, 500));
          await refreshSupabaseData();
          // Try to get the new item ID
          const updatedInventory = supabaseInventory;
          const newItem = updatedInventory.find(i => i.simNumber === selectedSim.sim);
          inventoryItemId = newItem?.id;
        } catch (err) {
          console.error('Error adding to Supabase inventory:', err);
          // Continue anyway - the rental can still be created
        }
      }

      // Step 3: Create rental in Supabase
      const rentalItems = [
        {
          inventoryItemId: inventoryItemId || '',
          itemCategory: 'sim_european' as ItemCategory,
          itemName: `סים אירופאי - ${selectedSim.local_number}`,
          hasIsraeliNumber: !!selectedSim.israel_number,
          isGeneric: !inventoryItemId, // Mark as generic if no inventory ID
        }
      ];

      // Add device to bundle if selected
      if (includeDevice) {
        rentalItems.push({
          inventoryItemId: '',
          itemCategory: 'device_simple' as ItemCategory,
          itemName: 'מכשיר פשוט (באנדל אירופאי)',
          hasIsraeliNumber: false,
          isGeneric: true,
        });
      }

      try {
        await addRental({
          customerId: '',
          customerName,
          items: rentalItems,
          startDate,
          endDate,
          totalPrice: calculatedPrice?.total || parseFloat(price) || 0,
          currency: 'ILS',
          status: 'active',
          notes: `הופעל מ-CellStation | טלפון: ${customerPhone}`,
        });
      } catch (err) {
        console.error('Error creating Supabase rental:', err);
        // Show warning but don't fail completely
        toast({
          title: 'אזהרה',
          description: 'ההפעלה נשלחה אך נכשלה בשמירה למערכת המקומית',
          variant: 'destructive',
        });
      }

      // Step 4: Show success dialog
      setLastActivation({
        sim: selectedSim,
        customerName,
        customerPhone,
        price: calculatedPrice?.total || parseFloat(price) || 0,
        startDate,
        endDate,
      });
      setShowSuccessDialog(true);

      // Reset form and refresh
      resetForm();
      fetchData();
      refreshSupabaseData();

    } catch (err: any) {
      toast({
        title: 'שגיאה',
        description: err.message || 'נכשל בהפעלה',
        variant: 'destructive',
      });
    } finally {
      setIsActivating(false);
    }
  };

  // Send replace request
  const handleReplace = async () => {
    if (!selectedRental || !newSim) {
      toast({
        title: 'שגיאה',
        description: 'נא לבחור השכרה ולהזין מספר סים חדש',
        variant: 'destructive',
      });
      return;
    }

    if (newSim.length < 19 || newSim.length > 20) {
      toast({
        title: 'שגיאה',
        description: 'מספר סים חייב להיות 19-20 ספרות',
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await fetch(WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'replace_sim',
          old_sim: selectedRental.sim,
          new_sim: newSim,
          rental_id: selectedRental.rental_id,
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast({
          title: '✅ החלפה נשמרה!',
          description: `סים ישן: ${selectedRental.local_number} → סים חדש: ${newSim.slice(-6)}`,
        });

        setSelectedRental(null);
        setNewSim('');
        fetchData();
      } else {
        toast({
          title: 'שגיאה',
          description: data.error || 'לא ידוע',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'שגיאה בשליחה',
        variant: 'destructive',
      });
    }
  };

  // Cancel pending
  const handleCancelPending = async () => {
    try {
      await fetch(WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel_pending' }),
      });
      setPendingAction(null);
      fetchData();
      toast({
        title: 'בוטל',
        description: 'הפעולה הממתינה בוטלה',
      });
    } catch (e) {}
  };

  // Expiry warning for selected SIM
  const expiryWarning = selectedSim && endDate ? getSimExpiryWarning(selectedSim, endDate) : null;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Smartphone className="h-8 w-8 text-primary" />
            Cell Station
          </h1>
          <p className="text-muted-foreground">
            ניהול סימים והשכרות עם סנכרון Supabase
          </p>
        </div>
        <Button
          onClick={fetchData}
          disabled={loading}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {loading ? 'טוען...' : 'רענן'}
        </Button>
      </div>

      {/* Pending Action Alert */}
      {pendingAction && (
        <Card className="border-warning bg-warning/10">
          <CardContent className="p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-warning" />
              <div>
                <span className="font-bold text-warning">פעולה ממתינה: </span>
                {pendingAction.action === 'activate' && (
                  <span>הפעלת השכרה - {pendingAction.customer_name} - SIM: {pendingAction.sim?.slice(-6)}</span>
                )}
                {pendingAction.action === 'replace_sim' && (
                  <span>החלפת סים - מ-{pendingAction.old_sim?.slice(-6)} ל-{pendingAction.new_sim?.slice(-6)}</span>
                )}
                <span className="text-sm text-muted-foreground block">לך ל-Cell Station ולחץ על הסימנייה</span>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={handleCancelPending}>
              ביטול
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard title="השכרות" value={stats.total_rentals} icon={Package} variant="primary" />
          <StatCard title="היום!" value={stats.ending_today} icon={AlertTriangle} variant="warning" highlight={stats.ending_today > 0} />
          <StatCard title="מחר" value={stats.ending_tomorrow} icon={Calendar} variant="warning" />
          <StatCard title="הסתיימו" value={stats.ended} icon={XCircle} variant="destructive" />
          <StatCard title="מלאי" value={stats.total_inventory} icon={Smartphone} />
          <StatCard title="פעילים" value={stats.active_inventory} icon={CheckCircle} variant="success" />
          <StatCard title="פנויים" value={stats.available_for_rent} icon={Zap} variant="success" />
          <StatCard title="לא פעילים" value={stats.inactive_inventory} icon={XCircle} />
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-4">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="rentals" className="gap-2">
            <Package className="h-4 w-4" />
            השכרות ({rentals.length})
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2">
            <Smartphone className="h-4 w-4" />
            מלאי ({inventory.length})
          </TabsTrigger>
          <TabsTrigger value="activate" className="gap-2">
            <Zap className="h-4 w-4" />
            הפעלה חדשה
          </TabsTrigger>
          <TabsTrigger value="replace" className="gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            החלפת סים
          </TabsTrigger>
        </TabsList>

        {/* Rentals Tab */}
        <TabsContent value="rentals">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="relative mb-4">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="🔍 חיפוש לפי שם לקוח או מספר..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRentals.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  אין השכרות להצגה
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">לקוח</TableHead>
                        <TableHead className="text-right">טלפון</TableHead>
                        <TableHead className="text-right">מספר מקומי</TableHead>
                        <TableHead className="text-right">תוכנית</TableHead>
                        <TableHead className="text-right">התחלה</TableHead>
                        <TableHead className="text-right">סיום</TableHead>
                        <TableHead className="text-right">ימים</TableHead>
                        <TableHead className="text-right">סטטוס</TableHead>
                        <TableHead className="text-right">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRentals.map((rental, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{rental.customer_name}</TableCell>
                          <TableCell>{rental.customer_phone}</TableCell>
                          <TableCell className="font-mono text-sm">{rental.local_number}</TableCell>
                          <TableCell>{rental.plan}</TableCell>
                          <TableCell>{rental.start_date}</TableCell>
                          <TableCell>{rental.end_date}</TableCell>
                          <TableCell className="text-center">{rental.days}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(rental.status)}>
                              {rental.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedRental(rental);
                                  setActiveTab('replace');
                                }}
                                className="gap-1"
                              >
                                <ArrowLeftRight className="h-3 w-3" />
                                החלפה
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory">
          <Card className="glass-card">
            <CardContent className="pt-6">
              {/* Search and Filter Row */}
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="🔍 חיפוש לפי מספר..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10"
                  />
                </div>
                
                {/* Status Filter */}
                <Select
                  value={statusFilter}
                  onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}
                >
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="סינון לפי סטטוס" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">📋 הכל ({inventory.length})</SelectItem>
                    <SelectItem value="active">🟢 פעילים ({inventory.filter(s => s.status === 'active').length})</SelectItem>
                    <SelectItem value="inactive">🔴 לא פעילים ({inventory.filter(s => s.status === 'inactive').length})</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">ID</TableHead>
                        <TableHead className="text-right">מספר מקומי</TableHead>
                        <TableHead className="text-right">מספר ישראלי</TableHead>
                        <TableHead className="text-right">תוכנית</TableHead>
                        <TableHead className="text-right">תוקף</TableHead>
                        <TableHead className="text-right">סטטוס</TableHead>
                        <TableHead className="text-right">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInventory.map((item, idx) => (
                        <TableRow
                          key={idx}
                          className={cn(
                            item.status === 'active' ? 'bg-success/5' : 'bg-destructive/5'
                          )}
                        >
                          <TableCell>{item.id}</TableCell>
                          <TableCell className="font-mono">{item.local_number}</TableCell>
                          <TableCell className="font-mono">{item.israel_number}</TableCell>
                          <TableCell>{item.plan}</TableCell>
                          <TableCell>{item.expiry}</TableCell>
                          <TableCell>
                            <Badge variant={item.status === 'active' ? 'success' : 'destructive'}>
                              {item.status === 'active' ? '🟢 פעיל' : '🔴 לא פעיל'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {/* Always show print button */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePrintInstructions(item)}
                                title="הדפס הוראות חיוג"
                              >
                                <Printer className="h-3 w-3" />
                              </Button>
                              
                              {/* Activate button for active SIMs */}
                              {item.status === 'active' && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => {
                                    setSelectedSim(item);
                                    setActiveTab('activate');
                                  }}
                                  className="gap-1"
                                >
                                  <Zap className="h-3 w-3" />
                                  הפעל
                                </Button>
                              )}
                              
                              {/* For inactive SIMs - show a disabled button with tooltip */}
                              {item.status === 'inactive' && (
                                <Badge variant="secondary" className="text-xs">
                                  לא פעיל
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activate Tab */}
        <TabsContent value="activate">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                הפעלת השכרה חדשה
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {/* SIM Selection */}
                <div className="space-y-4">
                  <div>
                    <label className="block font-medium mb-2">📱 בחר סים פנוי:</label>
                    <Select
                      value={selectedSim?.sim || ''}
                      onValueChange={(value) => {
                        const sim = availableSims.find((s) => s.sim === value);
                        setSelectedSim(sim || null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="-- בחר סים --" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSims.map((sim, idx) => (
                          <SelectItem key={idx} value={sim.sim}>
                            {sim.local_number} - {sim.plan} (תוקף: {sim.expiry})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedSim && (
                    <Card className="bg-success/10 border-success/30">
                      <CardContent className="p-4 text-sm space-y-1">
                        <div><strong>ID:</strong> {selectedSim.id}</div>
                        <div><strong>ICCID:</strong> {selectedSim.sim}</div>
                        <div><strong>🇮🇱 מספר ישראלי:</strong> {selectedSim.israel_number || 'אין'}</div>
                        <div><strong>📞 מספר מקומי:</strong> {selectedSim.local_number}</div>
                        <div><strong>📅 תוקף:</strong> {selectedSim.expiry}</div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Expiry Warning */}
                  {expiryWarning && (
                    <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg text-warning">
                      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                      <span className="text-sm font-medium">{expiryWarning}</span>
                    </div>
                  )}
                </div>

                {/* Customer Details */}
                <div className="space-y-4">
                  <div>
                    <label className="block font-medium mb-1">👤 שם לקוח:</label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="שם הלקוח"
                      list="customers-list"
                    />
                    <datalist id="customers-list">
                      {customers.map((c, i) => (
                        <option key={i} value={c.name}>
                          {c.phone}
                        </option>
                      ))}
                      {supabaseCustomers.map((c, i) => (
                        <option key={`sb-${i}`} value={c.name}>
                          {c.phone}
                        </option>
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block font-medium mb-1">📞 טלפון לקוח:</label>
                    <Input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="05X-XXXXXXX"
                    />
                  </div>

                  {/* Quick Date Buttons */}
                  <div>
                    <label className="block font-medium mb-2">📅 תקופה:</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Button size="sm" variant="outline" onClick={() => setQuickDate(7)}>
                        שבוע
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setQuickDate(14)}>
                        שבועיים
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setQuickDate(30)}>
                        חודש
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm mb-1">התחלה:</label>
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">סיום:</label>
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Device Bundle Option */}
                  <div className="flex items-center space-x-2 space-x-reverse p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <Checkbox
                      id="include-device"
                      checked={includeDevice}
                      onCheckedChange={(checked) => setIncludeDevice(checked === true)}
                    />
                    <label
                      htmlFor="include-device"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      📦 הוסף מכשיר פשוט (+{EUROPEAN_BUNDLE_DEVICE_RATE}₪ ליום עסקים)
                    </label>
                  </div>

                  {/* Price Display */}
                  {calculatedPrice && (
                    <Card className="bg-primary/10 border-primary/30">
                      <CardContent className="p-4">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Calculator className="h-4 w-4" />
                          💰 פירוט מחיר
                        </h4>
                        <div className="space-y-2">
                          {calculatedPrice.breakdown.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>{item.item}</span>
                              <span className="font-mono">{item.currency}{item.price.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                        {calculatedPrice.businessDaysInfo && (
                          <div className="text-xs text-muted-foreground mt-3 pt-2 border-t border-primary/20">
                            <div>סה"כ ימים: {calculatedPrice.businessDaysInfo.totalDays}</div>
                            <div>ימי עסקים: {calculatedPrice.businessDaysInfo.businessDays}</div>
                            {calculatedPrice.businessDaysInfo.excludedDates.length > 0 && (
                              <div className="mt-1">
                                הוחרגו: {calculatedPrice.businessDaysInfo.excludedDates.slice(0, 3).join(', ')}
                                {calculatedPrice.businessDaysInfo.excludedDates.length > 3 && '...'}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="border-t border-primary/30 pt-3 mt-3 flex justify-between font-bold text-lg">
                          <span>סה"כ לתשלום:</span>
                          <span className="text-primary">₪{calculatedPrice.total.toFixed(2)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Button
                    onClick={handleActivate}
                    disabled={!selectedSim || !customerName || !startDate || !endDate || isActivating}
                    className="w-full gap-2"
                    size="lg"
                  >
                    {isActivating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    {isActivating ? 'שולח...' : '⚡ הפעל והשכר'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Replace Tab */}
        <TabsContent value="replace">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-primary" />
                החלפת סים בהשכרה קיימת
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Rental Selection */}
                <div className="space-y-4">
                  <div>
                    <label className="block font-medium mb-2">בחר השכרה:</label>
                    <Select
                      value={selectedRental?.sim || ''}
                      onValueChange={(value) => {
                        const rental = rentals.find((r) => r.sim === value);
                        setSelectedRental(rental || null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="-- בחר השכרה --" />
                      </SelectTrigger>
                      <SelectContent>
                        {rentals.map((r, idx) => (
                          <SelectItem key={idx} value={r.sim}>
                            {r.customer_name} - {r.local_number} (עד {r.end_date})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedRental && (
                    <Card className="bg-primary/10 border-primary/30">
                      <CardContent className="p-4 text-sm space-y-1">
                        <div><strong>לקוח:</strong> {selectedRental.customer_name}</div>
                        <div><strong>SIM נוכחי:</strong> {selectedRental.sim}</div>
                        <div><strong>מספר מקומי:</strong> {selectedRental.local_number}</div>
                        <div><strong>תאריכים:</strong> {selectedRental.start_date} - {selectedRental.end_date}</div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* New SIM Input */}
                <div className="space-y-4">
                  <div>
                    <label className="block font-medium mb-1">מספר סים חדש (ICCID):</label>
                    <Input
                      value={newSim}
                      onChange={(e) => setNewSim(e.target.value.replace(/\D/g, ''))}
                      className="font-mono"
                      placeholder="19-20 ספרות"
                      maxLength={20}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      {newSim.length}/20 ספרות
                      {newSim.length >= 19 && newSim.length <= 20 && ' ✅'}
                    </p>
                  </div>

                  <Card className="bg-warning/10 border-warning/30">
                    <CardContent className="p-4">
                      <p className="font-medium text-warning flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        שים לב!
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        החלפת סים היא פעולה בלתי הפיכה. הסים הישן יימחק לצמיתות.
                      </p>
                    </CardContent>
                  </Card>

                  <Button
                    onClick={handleReplace}
                    disabled={!selectedRental || newSim.length < 19}
                    className="w-full gap-2"
                    size="lg"
                    variant="secondary"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    שלח להחלפה
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-success">
              <CheckCircle className="h-6 w-6" />
              ההפעלה נשלחה בהצלחה!
            </DialogTitle>
            <DialogDescription>
              הפעולה נשמרה ומחכה לביצוע בסימנייה
            </DialogDescription>
          </DialogHeader>
          
          {lastActivation && (
            <div className="space-y-4">
              <Card className="bg-muted/50">
                <CardContent className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>📱 SIM:</span>
                    <span className="font-mono">{lastActivation.sim.local_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>👤 לקוח:</span>
                    <span>{lastActivation.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>📅 תקופה:</span>
                    <span>{lastActivation.startDate} - {lastActivation.endDate}</span>
                  </div>
                  <div className="flex justify-between font-bold text-primary">
                    <span>💰 מחיר:</span>
                    <span>₪{lastActivation.price.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/30 rounded-lg text-sm">
                <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                <span>נוצרה השכרה חדשה במערכת Supabase</span>
              </div>

              <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm">
                <Clock className="h-4 w-4 text-warning flex-shrink-0" />
                <span>עכשיו לחץ על הסימנייה באתר CellStation להשלמת ההפעלה</span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="default"
                  className="flex-1 gap-2"
                  onClick={() => {
                    handlePrintInstructions(lastActivation.sim);
                  }}
                >
                  <Printer className="h-4 w-4" />
                  🖨️ הדפס הוראות
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowSuccessDialog(false)}
                >
                  ← חזור לדאשבורד
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CellStationDashboard;
