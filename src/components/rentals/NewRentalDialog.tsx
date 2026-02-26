import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ExpiryWarningDialog } from '@/components/rentals/ExpiryWarningDialog';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { 
  RentalItem, ItemCategory, BundleType,
  categoryLabels, Customer, InventoryItem,
} from '@/types/rental';
import { calculateRentalPrice } from '@/lib/pricing';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isBefore } from 'date-fns';
import { SelectedItem, isSim } from './rental-form/types';
import { CustomerSelector } from './rental-form/CustomerSelector';
import { RentalDatePicker } from './rental-form/RentalDatePicker';
import { ItemSelector } from './rental-form/ItemSelector';
import { SelectedItemsSummary } from './rental-form/SelectedItemsSummary';
import { PricingBreakdown } from './rental-form/PricingBreakdown';

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
    pickupTime?: string;
  }) => Promise<void>;
  onAddCustomer: (customer: { name: string; phone: string; address?: string }) => Promise<void>;
  onAddInventoryItem: (item: {
    category: ItemCategory;
    name: string;
    localNumber?: string;
    israeliNumber?: string;
    expiryDate?: string;
    simNumber?: string;
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
  const [customerId, setCustomerId] = useState('');
  const [deposit, setDeposit] = useState('');
  const [notes, setNotes] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [autoActivateSim, setAutoActivateSim] = useState(true);

  // Expiry warning
  const [expiryWarningOpen, setExpiryWarningOpen] = useState(false);
  const [pendingExpiredItem, setPendingExpiredItem] = useState<InventoryItem | null>(null);

  const resetForm = () => {
    setCustomerId('');
    setDeposit('');
    setNotes('');
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedItems([]);
    setAutoActivateSim(true);
  };

  // Auto-add pre-selected item
  useEffect(() => {
    if (isOpen && preSelectedItem && preSelectedItem.status === 'available') {
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

  // SIM validity check
  const isSimValidForPeriod = (item: InventoryItem): 'valid' | 'warning' | 'expired' => {
    if (!isSim(item.category)) return 'valid';
    if (!item.expiryDate) return 'valid';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = parseISO(item.expiryDate);
    if (isBefore(expiryDate, today)) return 'expired';
    if (!endDate) return 'valid';
    if (isBefore(expiryDate, endDate)) return 'warning';
    return 'valid';
  };

  // Item handlers
  const handleAddItem = (item: InventoryItem) => {
    if (selectedItems.some(i => i.inventoryItemId === item.id)) {
      toast({ title: 'הפריט כבר נבחר', variant: 'destructive' });
      return;
    }
    const validity = isSimValidForPeriod(item);
    if (validity === 'expired') {
      setPendingExpiredItem(item);
      setExpiryWarningOpen(true);
      return;
    }
    if (validity === 'warning') {
      const expiryFormatted = item.expiryDate ? format(parseISO(item.expiryDate), 'dd/MM/yyyy') : '';
      const endFormatted = endDate ? format(endDate, 'dd/MM/yyyy') : '';
      toast({
        title: '⚠️ שים לב - הסים יפוג באמצע ההשכרה',
        description: `תוקף הסים: ${expiryFormatted}. סיום השכרה: ${endFormatted}`,
      });
    }
    setSelectedItems([...selectedItems, {
      inventoryItemId: item.id,
      category: item.category,
      name: item.name,
      hasIsraeliNumber: false,
    }]);
  };

  const handleAddGenericItem = (category: ItemCategory) => {
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

  const handleRemoveItem = (id: string) => setSelectedItems(selectedItems.filter(i => i.inventoryItemId !== id));
  const handleToggleIsraeli = (id: string) => setSelectedItems(selectedItems.map(i => i.inventoryItemId === id ? { ...i, hasIsraeliNumber: !i.hasIsraeliNumber } : i));
  const handleToggleDevice = (id: string) => setSelectedItems(selectedItems.map(i => i.inventoryItemId === id ? { ...i, includeEuropeanDevice: !i.includeEuropeanDevice } : i));

  // Price calculation
  const previewPrice = startDate && endDate && selectedItems.length > 0
    ? calculateRentalPrice(
        selectedItems.map(i => ({ category: i.category, hasIsraeliNumber: i.hasIsraeliNumber, includeEuropeanDevice: i.includeEuropeanDevice })),
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd')
      )
    : null;

  const hasEuropeanSim = selectedItems.some(item => item.category === 'sim_european' && !item.isGeneric);

  // Submit
  const handleSubmit = async () => {
    if (!customerId) {
      toast({ title: 'שגיאה', description: 'יש לבחור לקוח', variant: 'destructive' });
      return;
    }
    if (!startDate || !endDate) {
      toast({ title: 'שגיאה', description: 'יש לבחור תאריכי השכרה', variant: 'destructive' });
      return;
    }
    if (selectedItems.length === 0) {
      toast({ title: 'שגיאה', description: 'יש לבחור לפחות פריט אחד להשכרה', variant: 'destructive' });
      return;
    }

    const invalidItems = selectedItems.filter(item => item.isGeneric && item.category !== 'device_simple');
    if (invalidItems.length > 0) {
      const cats = [...new Set(invalidItems.map(i => categoryLabels[i.category]))];
      toast({ title: 'שגיאה', description: `${cats.join(', ')} חייבים להיבחר מהמלאי.`, variant: 'destructive' });
      return;
    }

    const customer = customers.find(c => c.id === customerId);
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

    const hasDeviceOrModem = selectedItems.some(item =>
      item.category === 'device_simple' || item.category === 'device_smartphone' || item.category === 'modem'
    );
    const pickupTime = hasDeviceOrModem ? format(new Date(), 'HH:mm:ss') : undefined;

    try {
      await onAddRental({
        customerId: customer.id,
        customerName: customer.name,
        items: rentalItems,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        totalPrice: pricing.total,
        currency: pricing.currency,
        status: 'active',
        deposit: deposit ? parseFloat(deposit) : undefined,
        notes: notes || undefined,
        pickupTime,
      });

      // Auto-activate European SIMs
      if (autoActivateSim) {
        const europeanSimItems = selectedItems.filter(item => item.category === 'sim_european' && !item.isGeneric);
        for (const simItem of europeanSimItems) {
          const inventoryItem = inventory.find(i => i.id === simItem.inventoryItemId);
          if (inventoryItem?.simNumber) {
            try {
              await fetch('/api/sim-activation-request', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  sim_number: inventoryItem.simNumber,
                  customer_id: customer.id,
                  customer_name: customer.name,
                  start_date: format(startDate, 'yyyy-MM-dd'),
                  end_date: format(endDate, 'yyyy-MM-dd'),
                }),
              });
            } catch (err) {
              console.error('Error auto-activating SIM:', err);
            }
          }
        }
        if (europeanSimItems.length > 0) {
          toast({
            title: 'בקשת הפעלה נשלחה',
            description: `${europeanSimItems.length} סימים נשלחו להפעלה. לחץ על ה-Bookmarklet להשלמת ההפעלה.`,
          });
        }
      }

      toast({ title: 'השכרה נוצרה', description: `השכרה חדשה נוצרה עבור ${customer.name}` });
      onOpenChange(false);
      setTimeout(resetForm, 100);
    } catch (error: any) {
      toast({
        title: 'שגיאה ביצירת השכרה',
        description: error.message || 'אחד הפריטים כבר לא זמין. נסה לרענן ולבחור שוב.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { onOpenChange(open); if (!open) resetForm(); }}>
        <DialogContent size="full" className="h-[100dvh] sm:h-[95vh] max-h-none sm:max-h-[900px] flex flex-col">
          <DialogHeader className="flex-shrink-0 px-4 sm:px-8 py-4 sm:py-6 border-b bg-muted/30">
            <DialogTitle className="text-xl sm:text-2xl font-bold">יצירת השכרה חדשה</DialogTitle>
            <DialogDescription className="text-sm">מלא את הפרטים ליצירת השכרה חדשה</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 pb-20 sm:pb-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10">
              {/* Left Column */}
              <div className="space-y-6">
                <CustomerSelector
                  customers={customers}
                  selectedCustomerId={customerId}
                  onSelectCustomer={setCustomerId}
                  onAddCustomer={onAddCustomer}
                />

                <RentalDatePicker
                  startDate={startDate}
                  endDate={endDate}
                  onSelectDates={(s, e) => { setStartDate(s); setEndDate(e); }}
                />

                <SelectedItemsSummary
                  selectedItems={selectedItems}
                  inventory={inventory}
                  endDate={endDate}
                  onRemoveItem={handleRemoveItem}
                  onToggleIsraeliNumber={handleToggleIsraeli}
                  onToggleEuropeanDevice={handleToggleDevice}
                />

                <PricingBreakdown
                  previewPrice={previewPrice}
                  deposit={deposit}
                  notes={notes}
                  autoActivateSim={autoActivateSim}
                  hasEuropeanSim={hasEuropeanSim}
                  onDepositChange={setDeposit}
                  onNotesChange={setNotes}
                  onAutoActivateChange={setAutoActivateSim}
                />

                {/* Submit Button - Desktop */}
                <Button onClick={handleSubmit} className="hidden sm:flex w-full h-12 text-lg" size="lg">
                  <Plus className="h-5 w-5" />
                  צור השכרה
                </Button>
              </div>

              {/* Right Column */}
              <ItemSelector
                availableItems={availableItems}
                selectedItems={selectedItems}
                endDate={endDate}
                onAddItem={handleAddItem}
                onAddGenericItem={handleAddGenericItem}
                onAddInventoryItem={onAddInventoryItem}
              />
            </div>
          </div>

          {/* Mobile Submit */}
          <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t shadow-lg safe-area-inset-bottom">
            <Button onClick={handleSubmit} className="w-full h-12 text-base font-semibold" size="lg">
              <Plus className="h-5 w-5" />
              צור השכרה
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expiry Warning Dialog */}
      <ExpiryWarningDialog
        isOpen={expiryWarningOpen}
        onOpenChange={setExpiryWarningOpen}
        item={pendingExpiredItem}
        onConfirm={() => {
          if (pendingExpiredItem) {
            setSelectedItems([...selectedItems, {
              inventoryItemId: pendingExpiredItem.id,
              category: pendingExpiredItem.category,
              name: pendingExpiredItem.name,
              hasIsraeliNumber: false,
            }]);
            toast({ title: '⚠️ סים פג תוקף נוסף', description: 'זכור להאריך את תוקף הסים לפני ההפעלה' });
          }
          setPendingExpiredItem(null);
          setExpiryWarningOpen(false);
        }}
      />
    </>
  );
}
