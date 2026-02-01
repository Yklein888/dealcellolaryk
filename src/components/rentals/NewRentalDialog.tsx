import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRangePicker } from '@/components/DateRangePicker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  Search, 
  ShoppingCart,
  Calendar as CalendarIcon,
  User,
  Package,
  PackagePlus,
  Phone,
  Loader2,
  UserPlus,
  Printer,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { printCallingInstructions, downloadCallingInstructions } from '@/lib/callingInstructions';
import { 
  RentalItem, 
  ItemCategory,
  BundleType,
  categoryLabels, 
  categoryIcons,
  bundleLabels,
  Customer,
  InventoryItem,
} from '@/types/rental';
import { calculateRentalPrice } from '@/lib/pricing';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { DualCurrencyPrice } from '@/components/DualCurrencyPrice';
import { cn } from '@/lib/utils';
import { getFullHebrewDate } from '@/components/ui/hebrew-calendar';

// Category color mappings
const categoryColors: Record<ItemCategory, { bg: string; border: string; hover: string }> = {
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

interface SelectedItem {
  inventoryItemId: string;
  category: ItemCategory;
  name: string;
  hasIsraeliNumber: boolean;
  isGeneric?: boolean;
}

interface NewRentalDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  inventory: InventoryItem[];
  availableItems: InventoryItem[];
  preSelectedItem?: InventoryItem | null;
  onAddRental: (rental: {
    customerId: string;
    customerName: string;
    items: RentalItem[];
    startDate: string;
    endDate: string;
    totalPrice: number;
    currency: 'ILS' | 'USD';
    status: 'active';
    deposit?: number;
    notes?: string;
  }) => void;
  onAddCustomer: (customer: { name: string; phone: string; address?: string }) => Promise<void>;
  onAddInventoryItem: (item: {
    category: ItemCategory;
    name: string;
    localNumber?: string;
    israeliNumber?: string;
    expiryDate?: string;
    status: 'available';
  }) => void;
}

export function NewRentalDialog({
  isOpen,
  onOpenChange,
  customers,
  inventory,
  availableItems,
  preSelectedItem,
  onAddRental,
  onAddCustomer,
  onAddInventoryItem,
}: NewRentalDialogProps) {
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    customerId: '',
    deposit: '',
    notes: '',
  });

  // Date state - separate start and end dates for dual calendar
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Selected items state
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

  // Search/filter state
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [itemCategoryFilter, setItemCategoryFilter] = useState<string>('all');

  // Quick add dialogs
  const [isQuickAddCustomerOpen, setIsQuickAddCustomerOpen] = useState(false);
  const [isQuickAddInventoryOpen, setIsQuickAddInventoryOpen] = useState(false);

  // Quick add form data
  const [quickCustomerData, setQuickCustomerData] = useState({
    name: '',
    phone: '',
    address: '',
  });

  const [quickAddData, setQuickAddData] = useState({
    category: 'sim_european' as ItemCategory,
    name: '',
    localNumber: '',
    israeliNumber: '',
    expiryDate: '',
  });

  const [downloadingInstructions, setDownloadingInstructions] = useState<string | null>(null);

  // Reset form
  const resetForm = () => {
    setFormData({ customerId: '', deposit: '', notes: '' });
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedItems([]);
    setCustomerSearchTerm('');
    setItemSearchTerm('');
    setItemCategoryFilter('all');
  };

  // Auto-add pre-selected item when dialog opens
  useEffect(() => {
    if (isOpen && preSelectedItem && preSelectedItem.status === 'available') {
      // Check if item is not already selected
      if (!selectedItems.some(i => i.inventoryItemId === preSelectedItem.id)) {
        setSelectedItems([{
          inventoryItemId: preSelectedItem.id,
          category: preSelectedItem.category,
          name: preSelectedItem.name,
          hasIsraeliNumber: false,
        }]);
      }
    }
  }, [isOpen, preSelectedItem]);

  // Filter customers
  const filteredCustomers = customers.filter(customer => {
    const searchLower = customerSearchTerm.toLowerCase();
    return customer.name.toLowerCase().includes(searchLower) ||
           customer.phone.includes(customerSearchTerm);
  });

  // Filter available items
  const filteredAvailableItems = availableItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
      categoryLabels[item.category].includes(itemSearchTerm);
    const matchesCategory = itemCategoryFilter === 'all' || item.category === itemCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Group items by category for visual grid
  const itemsByCategory = Object.entries(categoryLabels).reduce((acc, [category]) => {
    acc[category as ItemCategory] = filteredAvailableItems.filter(i => i.category === category);
    return acc;
  }, {} as Record<ItemCategory, InventoryItem[]>);

  // Helper functions
  const isSim = (category: ItemCategory) => 
    category === 'sim_american' || category === 'sim_european';

  const handleAddItem = (item: InventoryItem) => {
    if (selectedItems.some(i => i.inventoryItemId === item.id)) {
      toast({
        title: 'הפריט כבר נבחר',
        variant: 'destructive',
      });
      return;
    }

    setSelectedItems([...selectedItems, {
      inventoryItemId: item.id,
      category: item.category,
      name: item.name,
      hasIsraeliNumber: false,
    }]);
  };

  const handleRemoveItem = (inventoryItemId: string) => {
    setSelectedItems(selectedItems.filter(i => i.inventoryItemId !== inventoryItemId));
  };

  const handleToggleIsraeliNumber = (inventoryItemId: string) => {
    setSelectedItems(selectedItems.map(i => 
      i.inventoryItemId === inventoryItemId 
        ? { ...i, hasIsraeliNumber: !i.hasIsraeliNumber }
        : i
    ));
  };

  // Add bundle - only for device_simple which doesn't require inventory
  // Note: Bundles with SIMs are no longer supported since SIMs must be from inventory
  const handleAddBundle = (bundleType: BundleType) => {
    toast({
      title: 'באנדלים לא זמינים',
      description: 'יש לבחור סים מהמלאי ולהוסיף מכשיר פשוט בנפרד',
      variant: 'destructive',
    });
  };

  // Add generic item - only allowed for device_simple
  const handleAddGenericItem = (category: ItemCategory) => {
    // Only device_simple can be added without inventory
    if (category !== 'device_simple') {
      toast({
        title: 'נדרש לבחור מהמלאי',
        description: `${categoryLabels[category]} חייב להיבחר מהמלאי. רק מכשיר פשוט ניתן להוסיף ללא מלאי.`,
        variant: 'destructive',
      });
      return;
    }
    
    const genericId = `generic-${Date.now()}`;
    setSelectedItems([...selectedItems, {
      inventoryItemId: genericId,
      category,
      name: `${categoryLabels[category]} (כללי)`,
      hasIsraeliNumber: false,
      isGeneric: true,
    }]);
  };

  // Quick add customer
  const handleQuickAddCustomer = async () => {
    if (!quickCustomerData.name || !quickCustomerData.phone) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין שם וטלפון',
        variant: 'destructive',
      });
      return;
    }

    try {
      await onAddCustomer({
        name: quickCustomerData.name,
        phone: quickCustomerData.phone,
        address: quickCustomerData.address || undefined,
      });
      
      toast({
        title: 'לקוח נוסף',
        description: `${quickCustomerData.name} נוסף בהצלחה`,
      });
      
      setQuickCustomerData({ name: '', phone: '', address: '' });
      setIsQuickAddCustomerOpen(false);
    } catch (error) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן להוסיף לקוח',
        variant: 'destructive',
      });
    }
  };

  // Quick add inventory
  const handleQuickAddInventory = () => {
    if (!quickAddData.name) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין שם לפריט',
        variant: 'destructive',
      });
      return;
    }
    onAddInventoryItem({
      category: quickAddData.category,
      name: quickAddData.name,
      localNumber: quickAddData.localNumber || undefined,
      israeliNumber: quickAddData.israeliNumber || undefined,
      expiryDate: quickAddData.expiryDate || undefined,
      status: 'available',
    });
    toast({
      title: 'פריט נוסף למלאי',
      description: `${quickAddData.name} נוסף למלאי`,
    });
    setQuickAddData({ category: 'sim_european', name: '', localNumber: '', israeliNumber: '', expiryDate: '' });
    setIsQuickAddInventoryOpen(false);
  };

  // Print calling instructions
  const handlePrintInstructions = async (itemId: string, israeliNumber?: string, localNumber?: string, barcode?: string) => {
    if (!israeliNumber && !localNumber) {
      toast({
        title: 'אין מספרים',
        description: 'לסים זה אין מספר ישראלי או מקומי מוגדר',
        variant: 'destructive',
      });
      return;
    }

    setDownloadingInstructions(itemId);

    try {
      await printCallingInstructions(israeliNumber, localNumber, barcode);
      toast({
        title: 'פותח חלון הדפסה',
        description: 'בחר מדפסת והדפס את ההוראות',
      });
    } catch (error) {
      console.error('Error printing instructions:', error);
      toast({
        title: 'שגיאה בהדפסה',
        description: 'מנסה להוריד כקובץ במקום...',
        variant: 'destructive',
      });
      // Fallback to download
      try {
        await downloadCallingInstructions(israeliNumber, localNumber, barcode);
        toast({
          title: 'הקובץ הורד',
          description: 'פתח את הקובץ והדפס אותו ידנית',
        });
      } catch (downloadError) {
        toast({
          title: 'שגיאה',
          description: 'לא ניתן ליצור את קובץ ההוראות',
          variant: 'destructive',
        });
      }
    } finally {
      setDownloadingInstructions(null);
    }
  };

  // Calculate preview price
  const calculatePreviewPrice = () => {
    if (!startDate || !endDate || selectedItems.length === 0) {
      return null;
    }

    return calculateRentalPrice(
      selectedItems.map(i => ({ 
        category: i.category, 
        hasIsraeliNumber: i.hasIsraeliNumber 
      })),
      format(startDate, 'yyyy-MM-dd'),
      format(endDate, 'yyyy-MM-dd')
    );
  };

  const previewPrice = calculatePreviewPrice();
  const rentalDays = startDate && endDate 
    ? differenceInDays(endDate, startDate) + 1 
    : 0;

  // Submit
  const handleSubmit = () => {
    if (!formData.customerId) {
      toast({
        title: 'שגיאה',
        description: 'יש לבחור לקוח',
        variant: 'destructive',
      });
      return;
    }

    if (!startDate || !endDate) {
      toast({
        title: 'שגיאה',
        description: 'יש לבחור תאריכי השכרה',
        variant: 'destructive',
      });
      return;
    }

    if (selectedItems.length === 0) {
      toast({
        title: 'שגיאה',
        description: 'יש לבחור לפחות פריט אחד להשכרה',
        variant: 'destructive',
      });
      return;
    }

    // Validate that all non-device_simple items are from inventory (not generic)
    const invalidItems = selectedItems.filter(item => 
      item.isGeneric && item.category !== 'device_simple'
    );
    
    if (invalidItems.length > 0) {
      const invalidCategories = [...new Set(invalidItems.map(i => categoryLabels[i.category]))];
      toast({
        title: 'שגיאה',
        description: `${invalidCategories.join(', ')} חייבים להיבחר מהמלאי. רק מכשיר פשוט ניתן להוסיף ללא מלאי.`,
        variant: 'destructive',
      });
      return;
    }

    const customer = customers.find(c => c.id === formData.customerId);
    if (!customer) return;

    const pricing = calculateRentalPrice(
      selectedItems.map(i => ({ category: i.category, hasIsraeliNumber: i.hasIsraeliNumber })),
      format(startDate, 'yyyy-MM-dd'),
      format(endDate, 'yyyy-MM-dd')
    );

    const rentalItems: RentalItem[] = selectedItems.map(item => ({
      inventoryItemId: item.inventoryItemId,
      itemCategory: item.category,
      itemName: item.name,
      hasIsraeliNumber: item.hasIsraeliNumber,
      isGeneric: item.isGeneric,
    }));

    onAddRental({
      customerId: customer.id,
      customerName: customer.name,
      items: rentalItems,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      totalPrice: pricing.total,
      currency: pricing.currency,
      status: 'active',
      deposit: formData.deposit ? parseFloat(formData.deposit) : undefined,
      notes: formData.notes,
    });

    toast({
      title: 'השכרה נוצרה',
      description: `השכרה חדשה נוצרה עבור ${customer.name}`,
    });

    onOpenChange(false);
    setTimeout(() => {
      resetForm();
    }, 100);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) resetForm();
      }}>
        <DialogContent size="full" className="h-[100dvh] sm:h-[95vh] max-h-none sm:max-h-[900px] flex flex-col">
          <DialogHeader className="flex-shrink-0 px-4 sm:px-8 py-4 sm:py-6 border-b bg-muted/30">
            <DialogTitle className="text-xl sm:text-2xl font-bold">יצירת השכרה חדשה</DialogTitle>
            <DialogDescription className="text-sm">מלא את הפרטים ליצירת השכרה חדשה</DialogDescription>
          </DialogHeader>
          
          {/* Two-column layout - scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 pb-20 sm:pb-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10">
            {/* Left Column - Customer & Dates */}
            <div className="space-y-6">
              {/* Customer Selection */}
              <div className="space-y-3 p-4 sm:p-5 rounded-xl sm:rounded-2xl border bg-card shadow-sm">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm sm:text-base font-semibold">
                    <User className="h-5 w-5 text-primary" />
                    בחר לקוח
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsQuickAddCustomerOpen(true)}
                    className="h-8 text-xs gap-1"
                  >
                    <UserPlus className="h-4 w-4" />
                    הוסף לקוח
                  </Button>
                </div>
                
                {/* Customer Search */}
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={customerSearchTerm}
                    onChange={(e) => setCustomerSearchTerm(e.target.value)}
                    placeholder="חפש לפי שם או טלפון..."
                    className="pr-10"
                  />
                </div>

                {/* Customer List */}
                <div className="max-h-48 sm:max-h-60 overflow-y-auto border rounded-lg bg-background">
                  {filteredCustomers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 text-sm">
                      {customers.length === 0 ? 'אין לקוחות במערכת' : 'לא נמצאו לקוחות'}
                    </p>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, customerId: customer.id })}
                        className={cn(
                          "w-full flex items-center justify-between p-3 hover:bg-muted/50 text-right transition-all border-b last:border-b-0",
                          formData.customerId === customer.id && "bg-primary/10 border-primary/30"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{customer.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </p>
                          </div>
                        </div>
                        {formData.customerId === customer.id && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Date Selection with Dual Hebrew Calendar */}
              <div className="space-y-3 p-4 sm:p-5 rounded-xl sm:rounded-2xl border bg-card shadow-sm">
                <Label className="flex items-center gap-2 text-sm sm:text-base font-semibold">
                  <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  תאריכי השכרה
                </Label>
                
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-right h-12 text-base",
                    !startDate && "text-muted-foreground"
                  )}
                  onClick={() => setIsDatePickerOpen(true)}
                >
                  <CalendarIcon className="ml-2 h-5 w-5" />
                  {startDate ? (
                    endDate ? (
                      <>
                        {format(startDate, "dd/MM/yyyy", { locale: he })} - {format(endDate, "dd/MM/yyyy", { locale: he })}
                        <span className="mr-auto text-primary font-medium">
                          ({rentalDays} ימים)
                        </span>
                      </>
                    ) : (
                      format(startDate, "dd/MM/yyyy", { locale: he })
                    )
                  ) : (
                    <span>בחר טווח תאריכים</span>
                  )}
                </Button>

                {/* Hebrew date display */}
                {startDate && endDate && (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 space-y-1">
                    <p className="text-xs text-muted-foreground text-center">
                      {getFullHebrewDate(startDate)} - {getFullHebrewDate(endDate)}
                    </p>
                    <p className="text-sm text-center">
                      <span className="text-muted-foreground">משך השכרה: </span>
                      <span className="font-bold text-primary text-lg">{rentalDays}</span>
                      <span className="text-muted-foreground"> ימים</span>
                    </p>
                  </div>
                )}

                <DateRangePicker
                  isOpen={isDatePickerOpen}
                  onOpenChange={setIsDatePickerOpen}
                  startDate={startDate}
                  endDate={endDate}
                  onSelect={(start, end) => {
                    setStartDate(start);
                    setEndDate(end);
                  }}
                />
              </div>

              {/* Selected Items Summary */}
              {selectedItems.length > 0 && (
                <div className="space-y-3 p-4 sm:p-5 rounded-xl sm:rounded-2xl border bg-card shadow-sm">
                  <Label className="flex items-center gap-2 text-sm sm:text-base font-semibold">
                    <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    פריטים נבחרים ({selectedItems.length})
                  </Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedItems.map((item) => {
                      const isEuropeanSimFromInventory = item.category === 'sim_european' && !item.isGeneric;
                      const inventoryItem = isEuropeanSimFromInventory 
                        ? inventory.find(i => i.id === item.inventoryItemId)
                        : null;

                      return (
                        <div 
                          key={item.inventoryItemId}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-lg border",
                            categoryColors[item.category].bg,
                            categoryColors[item.category].border
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{categoryIcons[item.category]}</span>
                            <span className="text-sm font-medium">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {item.category === 'sim_american' && (
                              <div className="flex items-center gap-1 mr-2">
                                <Checkbox
                                  checked={item.hasIsraeliNumber}
                                  onCheckedChange={() => handleToggleIsraeliNumber(item.inventoryItemId)}
                                />
                                <Label className="text-xs">ישראלי (+$10)</Label>
                              </div>
                            )}
                            {isEuropeanSimFromInventory && inventoryItem && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={downloadingInstructions === item.inventoryItemId}
                                onClick={() => handlePrintInstructions(
                                  item.inventoryItemId,
                                  inventoryItem.israeliNumber || undefined,
                                  inventoryItem.localNumber || undefined,
                                  inventoryItem.barcode || undefined
                                )}
                                className="h-7 w-7 p-0"
                              >
                                {downloadingInstructions === item.inventoryItemId ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Printer className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleRemoveItem(item.inventoryItemId)}
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Price Preview */}
              {previewPrice && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30">
                  <p className="text-sm text-muted-foreground mb-2">פירוט מחיר:</p>
                  {previewPrice.breakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.item}</span>
                      <DualCurrencyPrice 
                        amount={item.price} 
                        currency={item.currency === '$' ? 'USD' : 'ILS'} 
                        showTooltip={false}
                      />
                    </div>
                  ))}
                  <div className="border-t border-primary/30 mt-2 pt-2 flex justify-between font-bold text-lg">
                    <span>סה"כ</span>
                    <span className="text-primary">
                      <DualCurrencyPrice amount={previewPrice.total} currency={previewPrice.currency} />
                    </span>
                  </div>
                </div>
              )}

              {/* Deposit & Notes */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">פיקדון</Label>
                  <Input
                    type="number"
                    value={formData.deposit}
                    onChange={(e) => setFormData({ ...formData, deposit: e.target.value })}
                    placeholder="₪0"
                    className="h-10 sm:h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">הערות</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="הערות..."
                    className="h-10 sm:h-11"
                  />
                </div>
              </div>

              {/* Submit Button - Hidden on mobile (shows in fixed bottom) */}
              <Button 
                onClick={handleSubmit} 
                className="hidden sm:flex w-full h-12 text-lg"
                size="lg"
              >
                <Plus className="h-5 w-5" />
                צור השכרה
              </Button>
            </div>

            {/* Right Column - Item Selection */}
            <div className="space-y-4">
              {/* Quick Add Simple Device */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm sm:text-base font-semibold">
                  📱 הוסף מכשיר פשוט
                </Label>
                <div className="p-3 sm:p-4 rounded-xl border-2 border-dashed border-green-400/40 bg-gradient-to-br from-green-100/50 to-green-50/30 dark:from-green-950/30 dark:to-green-900/20">
                  <button
                    type="button"
                    onClick={() => handleAddGenericItem('device_simple')}
                    className="w-full flex items-center justify-center gap-3 p-3 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 transition-all"
                  >
                    <span className="text-2xl">📱</span>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">מכשיר פשוט (כללי)</p>
                      <p className="text-xs text-muted-foreground">לא נדרש לבחור מהמלאי</p>
                    </div>
                    <Plus className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </button>
                </div>
              </div>

              {/* Info about inventory requirement */}
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                  <span>⚠️</span>
                  <span>סימים, סמארטפונים, מודמים ונטסטיקים חייבים להיבחר מהמלאי. רק מכשיר פשוט ניתן להוסיף ללא מלאי.</span>
                </p>
              </div>

              {/* Inventory Items Visual Grid */}
              <div className="space-y-3 p-4 sm:p-5 rounded-xl sm:rounded-2xl border bg-card shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label className="flex items-center gap-2 text-sm sm:text-base font-semibold">
                    <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    בחר מהמלאי
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsQuickAddInventoryOpen(true)}
                    className="gap-1"
                  >
                    <PackagePlus className="h-4 w-4" />
                    הוסף למלאי
                  </Button>
                </div>

                {/* Category Filter */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={itemCategoryFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setItemCategoryFilter('all')}
                    className="h-8"
                  >
                    הכל
                  </Button>
                  {Object.entries(categoryLabels).map(([key, label]) => (
                    <Button
                      key={key}
                      variant={itemCategoryFilter === key ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setItemCategoryFilter(key)}
                      className="h-8 gap-1"
                    >
                      <span>{categoryIcons[key as ItemCategory]}</span>
                      <span className="hidden sm:inline">{label}</span>
                    </Button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={itemSearchTerm}
                    onChange={(e) => setItemSearchTerm(e.target.value)}
                    placeholder="חפש פריט..."
                    className="pr-10"
                  />
                </div>

                {/* Visual Grid by Category */}
                <div className="max-h-[300px] sm:max-h-[500px] overflow-y-auto space-y-4">
                  {filteredAvailableItems.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="h-16 w-16 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground">
                        {availableItems.length === 0 ? 'אין פריטים זמינים במלאי' : 'לא נמצאו פריטים'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      {filteredAvailableItems.map((item) => {
                        const isSelected = selectedItems.some(i => i.inventoryItemId === item.id);
                        const colors = categoryColors[item.category];
                        
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleAddItem(item)}
                            disabled={isSelected}
                            className={cn(
                              "relative flex flex-col items-center gap-1 sm:gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all text-center",
                              colors.bg,
                              isSelected 
                                ? "border-green-500 ring-2 ring-green-500/30 cursor-default" 
                                : cn(colors.border, colors.hover, "cursor-pointer hover:scale-[1.02]")
                            )}
                          >
                            {isSelected && (
                              <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-green-500 flex items-center justify-center">
                                <Check className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                              </div>
                            )}
                            <span className="text-2xl sm:text-3xl">{categoryIcons[item.category]}</span>
                            <div>
                              <p className="font-medium text-xs sm:text-sm text-foreground line-clamp-1">{item.name}</p>
                              <p className="text-[10px] sm:text-xs text-muted-foreground">{categoryLabels[item.category]}</p>
                            </div>
                            {(item.israeliNumber || item.localNumber) && (
                              <div className="text-xs space-y-0.5">
                                {item.israeliNumber && (
                                  <p className="text-primary">🇮🇱 {item.israeliNumber}</p>
                                )}
                                {item.localNumber && (
                                  <p className="text-muted-foreground">📞 {item.localNumber}</p>
                                )}
                              </div>
                            )}
                            {!isSelected && (
                              <div className="absolute bottom-2 left-2">
                                <Plus className="h-5 w-5 text-primary/50" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          </div>
          
          {/* Fixed bottom submit button for mobile */}
          <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t shadow-lg safe-area-inset-bottom">
            <Button 
              onClick={handleSubmit} 
              className="w-full h-12 text-base font-semibold"
              size="lg"
            >
              <Plus className="h-5 w-5" />
              צור השכרה
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Add Customer Dialog */}
      <Dialog open={isQuickAddCustomerOpen} onOpenChange={setIsQuickAddCustomerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>הוספת לקוח חדש</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>שם *</Label>
              <Input
                value={quickCustomerData.name}
                onChange={(e) => setQuickCustomerData({ ...quickCustomerData, name: e.target.value })}
                placeholder="שם הלקוח"
              />
            </div>
            <div className="space-y-2">
              <Label>טלפון *</Label>
              <Input
                value={quickCustomerData.phone}
                onChange={(e) => setQuickCustomerData({ ...quickCustomerData, phone: e.target.value })}
                placeholder="050-0000000"
              />
            </div>
            <div className="space-y-2">
              <Label>כתובת</Label>
              <Input
                value={quickCustomerData.address}
                onChange={(e) => setQuickCustomerData({ ...quickCustomerData, address: e.target.value })}
                placeholder="כתובת (אופציונלי)"
              />
            </div>
            <Button onClick={handleQuickAddCustomer} className="w-full">
              הוסף לקוח
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Add Inventory Dialog */}
      <Dialog open={isQuickAddInventoryOpen} onOpenChange={setIsQuickAddInventoryOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>הוספה מהירה למלאי</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>קטגוריה</Label>
              <Select 
                value={quickAddData.category} 
                onValueChange={(value: ItemCategory) => setQuickAddData({ ...quickAddData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {categoryIcons[key as ItemCategory]} {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>שם הפריט</Label>
              <Input
                value={quickAddData.name}
                onChange={(e) => setQuickAddData({ ...quickAddData, name: e.target.value })}
                placeholder="לדוגמה: סים אירופאי #002"
              />
            </div>

            {isSim(quickAddData.category) && (
              <>
                <div className="space-y-2">
                  <Label>מספר מקומי</Label>
                  <Input
                    value={quickAddData.localNumber}
                    onChange={(e) => setQuickAddData({ ...quickAddData, localNumber: e.target.value })}
                    placeholder="+44-7700-900123"
                  />
                </div>

                <div className="space-y-2">
                  <Label>מספר ישראלי</Label>
                  <Input
                    value={quickAddData.israeliNumber}
                    onChange={(e) => setQuickAddData({ ...quickAddData, israeliNumber: e.target.value })}
                    placeholder="050-0001111"
                  />
                </div>

                <div className="space-y-2">
                  <Label>תוקף</Label>
                  <Input
                    type="date"
                    value={quickAddData.expiryDate}
                    onChange={(e) => setQuickAddData({ ...quickAddData, expiryDate: e.target.value })}
                  />
                </div>
              </>
            )}

            <Button onClick={handleQuickAddInventory} className="w-full">
              הוסף למלאי
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
