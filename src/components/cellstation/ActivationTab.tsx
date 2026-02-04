import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { 
  Zap, CalendarIcon, User, Check, Printer, ArrowRight, AlertCircle, 
  Loader2, Plus, Smartphone, Clock, AlertTriangle, Search, History 
} from 'lucide-react';
import { SimCard } from '@/hooks/useCellstationSync';
import { Customer, InventoryItem, ItemCategory } from '@/types/rental';
import { useToast } from '@/hooks/use-toast';
import { useSimActivation } from '@/hooks/useSimActivation';
import { printCallingInstructions } from '@/lib/callingInstructions';
import { calculateEuropeanSimPrice, getExcludedDaysBreakdown, EUROPEAN_BUNDLE_DEVICE_RATE } from '@/lib/pricing';
import { format, addDays, differenceInDays, parseISO, isBefore } from 'date-fns';
import { he } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw5Zv5OWnH8UI0dCzfBR37maMDRf0NwIsX8PxREugD5lSSLKC2KYx9P72c0qQkb-TpA/exec";

// Note templates
const NOTE_TEMPLATES = [
  { label: '🌟 VIP', value: 'לקוח VIP - עדיפות בשירות' },
  { label: '💼 עסקי', value: 'לקוח עסקי - נדרש חשבונית' },
  { label: '👨‍👩‍👧‍👦 משפחה', value: 'משפחה - מספר משתמשים' },
  { label: '🔄 חוזר', value: 'לקוח חוזר - הנחה מיוחדת' },
  { label: '📞 התקשרות', value: 'נדרשת התקשרות לפני סיום' },
];

// Quick date presets
const DATE_PRESETS = [
  { label: 'שבוע', days: 7 },
  { label: 'שבועיים', days: 14 },
  { label: 'חודש', days: 30 },
  { label: '6 שבועות', days: 42 },
];

interface ActivationTabProps {
  simCards: SimCard[];
  customers: Customer[];
  inventory: InventoryItem[];
  selectedSim: SimCard | null;
  onSimChange: (sim: SimCard | null) => void;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Promise<void>;
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => Promise<void>;
  addRental: (rental: any) => Promise<void>;
}

interface RecentActivation {
  id: string;
  simNumber: string;
  customerName: string;
  startDate: string;
  createdAt: string;
}

export function ActivationTab({
  simCards,
  customers,
  inventory,
  selectedSim,
  onSimChange,
  addCustomer,
  addInventoryItem,
  addRental,
}: ActivationTabProps) {
  const { toast } = useToast();
  const { isActivating } = useSimActivation();
  
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(addDays(new Date(), 7));
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [activationResult, setActivationResult] = useState<{
    simNumber: string;
    customerName: string;
    startDate: string;
    endDate: string;
    localNumber?: string;
    israeliNumber?: string;
    barcode?: string;
    packageName?: string;
    expiryDate?: string;
    totalPrice: number;
    includeDevice: boolean;
  } | null>(null);
  
  // Bundle option - include device
  const [includeDevice, setIncludeDevice] = useState(false);
  
  // Customer search
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  
  // Recent activations
  const [recentActivations, setRecentActivations] = useState<RecentActivation[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  
  // New customer dialog
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);

  // Filter available SIMs (active and not rented)
  const availableSims = simCards.filter(s => s.is_active === true && !s.is_rented);

  // Sort SIMs by expiry (valid ones first)
  const sortedAvailableSims = useMemo(() => {
    return [...availableSims].sort((a, b) => {
      // First priority: check if SIM expires before rental end date
      const aExpiresBeforeEnd = a.expiry_date && endDate ? isBefore(parseISO(a.expiry_date), endDate) : false;
      const bExpiresBeforeEnd = b.expiry_date && endDate ? isBefore(parseISO(b.expiry_date), endDate) : false;
      
      if (aExpiresBeforeEnd && !bExpiresBeforeEnd) return 1; // a is problematic, push down
      if (!aExpiresBeforeEnd && bExpiresBeforeEnd) return -1; // b is problematic, push down
      
      // Second: sort by expiry date (latest first)
      if (a.expiry_date && b.expiry_date) {
        return new Date(b.expiry_date).getTime() - new Date(a.expiry_date).getTime();
      }
      return 0;
    });
  }, [availableSims, endDate]);

  // Check if SIM will expire during rental
  const getSimExpiryWarning = (sim: SimCard): { hasWarning: boolean; message: string } => {
    if (!sim.expiry_date || !endDate) return { hasWarning: false, message: '' };
    
    const expiryDate = parseISO(sim.expiry_date);
    const today = new Date();
    
    if (isBefore(expiryDate, today)) {
      return { hasWarning: true, message: '⛔ הסים פג תוקף!' };
    }
    
    if (isBefore(expiryDate, endDate)) {
      const daysUntilExpiry = differenceInDays(expiryDate, today);
      return { hasWarning: true, message: `⚠️ יפוג בעוד ${daysUntilExpiry} ימים` };
    }
    
    return { hasWarning: false, message: '' };
  };

  // Smart customer search
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return customers;
    const query = customerSearchQuery.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(query) || 
      c.phone.includes(query)
    );
  }, [customers, customerSearchQuery]);

  // Load recent activations
  useEffect(() => {
    const loadRecentActivations = async () => {
      setLoadingRecent(true);
      try {
        const { data, error } = await supabase
          .from('rentals')
          .select('id, customer_name, start_date, created_at')
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (error) throw error;
        
        // Get rental items for these rentals
        if (data && data.length > 0) {
          const rentalIds = data.map(r => r.id);
          const { data: items } = await supabase
            .from('rental_items')
            .select('rental_id, item_name')
            .in('rental_id', rentalIds)
            .eq('item_category', 'sim_european');
          
          const activations = data.map(r => ({
            id: r.id,
            customerName: r.customer_name,
            startDate: r.start_date,
            createdAt: r.created_at,
            simNumber: items?.find(i => i.rental_id === r.id)?.item_name || 'סים אירופאי',
          }));
          
          setRecentActivations(activations);
        }
      } catch (error) {
        console.error('Error loading recent activations:', error);
      } finally {
        setLoadingRecent(false);
      }
    };
    
    loadRecentActivations();
  }, []);

  // Check if SIM is in inventory
  const isSimInInventory = (simNumber: string | null): boolean => {
    if (!simNumber) return false;
    return inventory.some(item => item.simNumber === simNumber);
  };

  // Calculate pricing
  const priceBreakdown = useMemo(() => {
    const totalDays = differenceInDays(endDate, startDate) + 1;
    const businessDaysInfo = getExcludedDaysBreakdown(startDate, endDate);
    
    // European SIM price (based on total days)
    const simPrice = calculateEuropeanSimPrice(totalDays);
    
    // Device price (based on business days)
    const devicePrice = includeDevice ? businessDaysInfo.businessDays * EUROPEAN_BUNDLE_DEVICE_RATE : 0;
    
    const totalPrice = simPrice + devicePrice;
    
    return {
      totalDays,
      businessDays: businessDaysInfo.businessDays,
      saturdays: businessDaysInfo.saturdays,
      holidays: businessDaysInfo.holidays,
      simPrice,
      devicePrice,
      totalPrice,
    };
  }, [startDate, endDate, includeDevice]);

  // Get selected customer
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  // Handle note template selection
  const handleNoteTemplate = (template: string) => {
    setNotes(prev => prev ? `${prev}\n${template}` : template);
  };

  // Handle date preset
  const handleDatePreset = (days: number) => {
    setEndDate(addDays(startDate, days));
  };

  // Handle new customer creation
  const handleAddNewCustomer = async () => {
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
      toast({
        title: 'שגיאה',
        description: 'נא למלא שם וטלפון',
        variant: 'destructive',
      });
      return;
    }

    setIsAddingCustomer(true);
    try {
      await addCustomer({
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
      });
      
      toast({
        title: 'לקוח נוסף',
        description: `${newCustomerName} נוסף בהצלחה`,
      });
      
      // Find the newly added customer and select them
      setTimeout(() => {
        const newCust = customers.find(c => c.phone === newCustomerPhone.trim());
        if (newCust) {
          setSelectedCustomerId(newCust.id);
        }
      }, 500);
      
      setShowNewCustomerDialog(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
    } catch (error) {
      console.error('Error adding customer:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן להוסיף את הלקוח',
        variant: 'destructive',
      });
    } finally {
      setIsAddingCustomer(false);
    }
  };

  // Main activation + rental process
  const handleActivateAndRent = async () => {
    if (!selectedSim || !selectedCustomerId) {
      toast({
        title: 'שגיאה',
        description: 'נא לבחור סים ולקוח',
        variant: 'destructive',
      });
      return;
    }

    // Check SIM expiry warning
    const expiryWarning = getSimExpiryWarning(selectedSim);
    if (expiryWarning.message.includes('פג תוקף')) {
      toast({
        title: 'לא ניתן להשכיר',
        description: 'הסים פג תוקף, נא לבחור סים אחר',
        variant: 'destructive',
      });
      return;
    }

    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer) {
      toast({
        title: 'שגיאה',
        description: 'לקוח לא נמצא',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: Send activation request to Google Script
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_pending',
          sim: selectedSim.sim_number,
          customerName: customer.name,
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
        })
      });

      // Step 2: Add SIM to inventory if not already there
      let inventoryItemId: string | undefined;
      let barcode: string | undefined;
      
      if (!isSimInInventory(selectedSim.sim_number)) {
        await addInventoryItem({
          category: 'sim_european' as ItemCategory,
          name: `סים ${selectedSim.local_number || selectedSim.sim_number}`,
          localNumber: selectedSim.local_number || undefined,
          israeliNumber: selectedSim.israeli_number || undefined,
          expiryDate: selectedSim.expiry_date || undefined,
          simNumber: selectedSim.sim_number!,
          status: 'available',
          notes: selectedSim.package_name ? `חבילה: ${selectedSim.package_name}` : undefined,
        });
        
        // Wait for inventory to update
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Get inventory item (fresh lookup)
      const invItem = inventory.find(i => i.simNumber === selectedSim.sim_number);
      inventoryItemId = invItem?.id;
      barcode = invItem?.barcode;

      // Step 3: Build rental items
      const rentalItems = [
        {
          inventoryItemId: inventoryItemId || '',
          itemCategory: 'sim_european' as ItemCategory,
          itemName: `סים אירופאי - ${selectedSim.local_number || selectedSim.sim_number}`,
          hasIsraeliNumber: !!selectedSim.israeli_number,
          isGeneric: !inventoryItemId,
          pricePerDay: 0, // SIM has flat rate
        }
      ];

      // Add device if bundle option is selected
      if (includeDevice) {
        rentalItems.push({
          inventoryItemId: '',
          itemCategory: 'device_simple' as ItemCategory,
          itemName: 'מכשיר פשוט (באנדל אירופאי)',
          hasIsraeliNumber: false,
          isGeneric: true,
          pricePerDay: EUROPEAN_BUNDLE_DEVICE_RATE,
        });
      }

      // Step 4: Create rental
      await addRental({
        customerId: customer.id,
        customerName: customer.name,
        items: rentalItems,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        totalPrice: priceBreakdown.totalPrice,
        currency: 'ILS',
        status: 'active',
        notes: notes || undefined,
      });

      // Save result for success dialog
      setActivationResult({
        simNumber: selectedSim.sim_number || '',
        customerName: customer.name,
        startDate: format(startDate, 'dd/MM/yyyy'),
        endDate: format(endDate, 'dd/MM/yyyy'),
        localNumber: selectedSim.local_number || undefined,
        israeliNumber: selectedSim.israeli_number || undefined,
        barcode,
        packageName: selectedSim.package_name || undefined,
        expiryDate: selectedSim.expiry_date || undefined,
        totalPrice: priceBreakdown.totalPrice,
        includeDevice,
      });

      setShowSuccessDialog(true);

      // Reset form
      onSimChange(null);
      setSelectedCustomerId('');
      setNotes('');
      setStartDate(new Date());
      setEndDate(addDays(new Date(), 7));
      setIncludeDevice(false);

    } catch (error) {
      console.error('Error in activation process:', error);
      toast({
        title: 'שגיאה בתהליך ההפעלה',
        description: 'אירעה שגיאה. נסה שוב.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle print instructions from success dialog
  const handlePrintInstructions = async () => {
    if (!activationResult) return;
    
    try {
      await printCallingInstructions(
        activationResult.israeliNumber,
        activationResult.localNumber,
        activationResult.barcode,
        false,
        activationResult.packageName,
        activationResult.expiryDate
      );
      toast({
        title: 'הדפסה מתחילה',
        description: 'הוראות החיוג נשלחו להדפסה',
      });
    } catch (error) {
      toast({
        title: 'שגיאה בהדפסה',
        description: 'לא ניתן להדפיס',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <Card className="glass-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              הפעלת סים והשכרה
            </CardTitle>
            <CardDescription>
              בחר סים ולקוח כדי להפעיל את הסים וליצור השכרה באופן אוטומטי
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* SIM Selection */}
            <div className="space-y-2">
              <Label>בחר סים פנוי</Label>
              <Select
                value={selectedSim?.id || ''}
                onValueChange={(id) => {
                  const sim = simCards.find(s => s.id === id);
                  onSimChange(sim || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="-- בחר סים --" />
                </SelectTrigger>
                <SelectContent>
                  {sortedAvailableSims.map(sim => {
                    const warning = getSimExpiryWarning(sim);
                    const isExpired = warning.message.includes('פג תוקף');
                    
                    return (
                      <SelectItem 
                        key={sim.id} 
                        value={sim.id}
                        disabled={isExpired}
                        className={cn(warning.hasWarning && 'text-warning')}
                      >
                        <span className="flex items-center gap-2">
                          {sim.local_number || sim.sim_number} | {sim.package_name || 'ללא חבילה'} 
                          {warning.hasWarning && (
                            <span className="text-xs">{warning.message}</span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Selected SIM Info with Expiry Warning */}
            {selectedSim && (
              <div className={cn(
                "p-4 rounded-lg space-y-2",
                getSimExpiryWarning(selectedSim).hasWarning ? "bg-warning/10 border border-warning/30" : "bg-primary/10"
              )}>
                <div className="font-medium flex items-center gap-2">
                  סים נבחר:
                  {getSimExpiryWarning(selectedSim).hasWarning && (
                    <Badge variant="outline" className="text-warning border-warning">
                      <AlertTriangle className="h-3 w-3 ml-1" />
                      {getSimExpiryWarning(selectedSim).message}
                    </Badge>
                  )}
                </div>
                <div className="text-sm grid grid-cols-2 gap-2">
                  <span>ICCID: {selectedSim.sim_number}</span>
                  <span>מספר מקומי: {selectedSim.local_number || '-'}</span>
                  <span>מספר ישראלי: {selectedSim.israeli_number || '-'}</span>
                  <span>חבילה: {selectedSim.package_name || '-'}</span>
                  <span className={cn(
                    getSimExpiryWarning(selectedSim).hasWarning && "text-warning font-medium"
                  )}>
                    תוקף: {selectedSim.expiry_date ? format(parseISO(selectedSim.expiry_date), 'dd/MM/yyyy') : '-'}
                  </span>
                </div>
                {isSimInInventory(selectedSim.sim_number) ? (
                  <div className="flex items-center gap-1 text-success text-sm mt-2">
                    <Check className="h-4 w-4" />
                    הסים כבר במלאי
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-muted-foreground text-sm mt-2">
                    <AlertCircle className="h-4 w-4" />
                    הסים יתווסף למלאי אוטומטית
                  </div>
                )}
              </div>
            )}

            {/* Device Bundle Option */}
            <div className="flex items-center space-x-2 space-x-reverse p-4 rounded-lg bg-muted/50 border">
              <Checkbox
                id="include-device"
                checked={includeDevice}
                onCheckedChange={(checked) => setIncludeDevice(checked === true)}
              />
              <label
                htmlFor="include-device"
                className="flex-1 cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  הוסף מכשיר פשוט (באנדל אירופאי)
                </div>
                <p className="text-muted-foreground font-normal mt-1">
                  ₪{EUROPEAN_BUNDLE_DEVICE_RATE} ליום עסקים ({priceBreakdown.businessDays} ימי עסקים = ₪{priceBreakdown.devicePrice})
                </p>
              </label>
            </div>

            {/* Customer Selection with Smart Search */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>בחר לקוח</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewCustomerDialog(true)}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  לקוח חדש
                </Button>
              </div>
              
              {/* Smart Customer Search */}
              <Popover open={showCustomerSearch} onOpenChange={setShowCustomerSearch}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {selectedCustomer ? (
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {selectedCustomer.name} - {selectedCustomer.phone}
                      </span>
                    ) : (
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        חפש לקוח לפי שם או טלפון...
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="חפש לפי שם או טלפון..." 
                      value={customerSearchQuery}
                      onValueChange={setCustomerSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>לא נמצאו לקוחות</CommandEmpty>
                      <CommandGroup>
                        {filteredCustomers.slice(0, 10).map(customer => (
                          <CommandItem
                            key={customer.id}
                            value={customer.id}
                            onSelect={() => {
                              setSelectedCustomerId(customer.id);
                              setShowCustomerSearch(false);
                              setCustomerSearchQuery('');
                            }}
                          >
                            <User className="h-4 w-4 ml-2" />
                            <span className="font-medium">{customer.name}</span>
                            <span className="text-muted-foreground mr-2">{customer.phone}</span>
                            {selectedCustomerId === customer.id && (
                              <Check className="h-4 w-4 mr-auto" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Date Selection with Presets */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Label>תקופת השכרה:</Label>
                {DATE_PRESETS.map(preset => (
                  <Button
                    key={preset.days}
                    variant="outline"
                    size="sm"
                    onClick={() => handleDatePreset(preset.days)}
                    className={cn(
                      differenceInDays(endDate, startDate) + 1 === preset.days && "bg-primary/10 border-primary"
                    )}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>תאריך התחלה</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-right font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {startDate ? format(startDate, 'dd/MM/yyyy', { locale: he }) : 'בחר תאריך'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => date && setStartDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>תאריך סיום</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-right font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {endDate ? format(endDate, 'dd/MM/yyyy', { locale: he }) : 'בחר תאריך'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => date && setEndDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Price Summary */}
            <div className="p-4 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium">סיכום מחיר</span>
                <span className="text-sm text-muted-foreground">
                  {priceBreakdown.totalDays} ימים ({priceBreakdown.businessDays} ימי עסקים)
                </span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>סים אירופאי</span>
                  <span>₪{priceBreakdown.simPrice}</span>
                </div>
                
                {includeDevice && (
                  <div className="flex justify-between">
                    <span>מכשיר פשוט ({priceBreakdown.businessDays} × ₪{EUROPEAN_BUNDLE_DEVICE_RATE})</span>
                    <span>₪{priceBreakdown.devicePrice}</span>
                  </div>
                )}
                
                {(priceBreakdown.saturdays > 0 || priceBreakdown.holidays > 0) && (
                  <div className="flex justify-between text-muted-foreground text-xs">
                    <span>לא כולל: {priceBreakdown.saturdays} שבתות, {priceBreakdown.holidays} חגים</span>
                  </div>
                )}
                
                <div className="flex justify-between pt-2 border-t font-bold text-lg">
                  <span>סה"כ</span>
                  <span className="text-primary">₪{priceBreakdown.totalPrice}</span>
                </div>
              </div>
            </div>

            {/* Notes with Templates */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>הערות</Label>
                <div className="flex gap-1 flex-wrap">
                  {NOTE_TEMPLATES.map(template => (
                    <Button
                      key={template.label}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleNoteTemplate(template.value)}
                      className="text-xs h-7"
                    >
                      {template.label}
                    </Button>
                  ))}
                </div>
              </div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="הערות להשכרה..."
                rows={2}
              />
            </div>

            {/* Action Button */}
            <Button
              onClick={handleActivateAndRent}
              disabled={!selectedSim || !selectedCustomerId || isProcessing}
              className="w-full h-12 text-lg gap-2"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  מעבד...
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5" />
                  הפעל והשכר • ₪{priceBreakdown.totalPrice}
                </>
              )}
            </Button>

            <p className="text-sm text-muted-foreground text-center">
              לאחר הלחיצה, לחץ על הסימנייה (Bookmarklet) באתר CellStation להשלמת ההפעלה
            </p>
          </CardContent>
        </Card>

        {/* Recent Activations Sidebar */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              הפעלות אחרונות
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRecent ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : recentActivations.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">אין הפעלות אחרונות</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivations.map(activation => (
                  <div key={activation.id} className="p-3 rounded-lg bg-muted/50 text-sm">
                    <div className="font-medium">{activation.customerName}</div>
                    <div className="text-muted-foreground text-xs">
                      {activation.simNumber}
                    </div>
                    <div className="text-muted-foreground text-xs mt-1 flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      {format(parseISO(activation.startDate), 'dd/MM/yyyy')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-success">
              <Check className="h-6 w-6" />
              ההפעלה נשלחה בהצלחה!
            </DialogTitle>
          </DialogHeader>
          
          {activationResult && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                <div><strong>SIM:</strong> {activationResult.simNumber}</div>
                <div><strong>לקוח:</strong> {activationResult.customerName}</div>
                <div><strong>תאריכים:</strong> {activationResult.startDate} - {activationResult.endDate}</div>
                {activationResult.localNumber && (
                  <div><strong>מספר מקומי:</strong> {activationResult.localNumber}</div>
                )}
                {activationResult.israeliNumber && (
                  <div><strong>מספר ישראלי:</strong> {activationResult.israeliNumber}</div>
                )}
                {activationResult.includeDevice && (
                  <div className="flex items-center gap-1">
                    <Smartphone className="h-4 w-4" />
                    <strong>כולל מכשיר פשוט</strong>
                  </div>
                )}
                <div className="pt-2 border-t font-bold">
                  <strong>סה"כ:</strong> ₪{activationResult.totalPrice}
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg text-warning">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm">
                  עכשיו לחץ על Bookmarklet באתר CellStation כדי להשלים את ההפעלה
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="flex-row gap-2 sm:justify-start">
            <Button onClick={handlePrintInstructions} variant="outline" className="gap-2">
              <Printer className="h-4 w-4" />
              הדפס הוראות חיוג
            </Button>
            <Button onClick={() => setShowSuccessDialog(false)} className="gap-2">
              <ArrowRight className="h-4 w-4" />
              חזור לדאשבורד
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Customer Dialog */}
      <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
        <DialogContent className="text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle>הוספת לקוח חדש</DialogTitle>
            <DialogDescription>
              מלא את פרטי הלקוח החדש
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>שם הלקוח *</Label>
              <Input
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="שם מלא"
              />
            </div>
            <div className="space-y-2">
              <Label>טלפון *</Label>
              <Input
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="050-0000000"
                type="tel"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewCustomerDialog(false)}
            >
              ביטול
            </Button>
            <Button
              onClick={handleAddNewCustomer}
              disabled={isAddingCustomer || !newCustomerName.trim() || !newCustomerPhone.trim()}
            >
              {isAddingCustomer ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'הוסף לקוח'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
