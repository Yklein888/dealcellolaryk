import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { Zap, CalendarIcon, User, Check, Printer, ArrowRight, AlertCircle, Loader2, Plus } from 'lucide-react';
import { SimCard } from '@/hooks/useCellstationSync';
import { Customer, InventoryItem, ItemCategory } from '@/types/rental';
import { useToast } from '@/hooks/use-toast';
import { useSimActivation } from '@/hooks/useSimActivation';
import { printCallingInstructions } from '@/lib/callingInstructions';
import { format, addDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw5Zv5OWnH8UI0dCzfBR37maMDRf0NwIsX8PxREugD5lSSLKC2KYx9P72c0qQkb-TpA/exec";

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
  } | null>(null);
  
  // New customer dialog
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);

  // Filter available SIMs (active and not rented)
  const availableSims = simCards.filter(s => s.is_active === true && !s.is_rented);

  // Check if SIM is in inventory
  const isSimInInventory = (simNumber: string | null): boolean => {
    if (!simNumber) return false;
    return inventory.some(item => item.simNumber === simNumber);
  };

  // Get inventory item for SIM
  const getInventoryItem = (simNumber: string | null): InventoryItem | undefined => {
    if (!simNumber) return undefined;
    return inventory.find(item => item.simNumber === simNumber);
  };

  // Get selected customer
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

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

      // Step 3: Create rental
      await addRental({
        customerId: customer.id,
        customerName: customer.name,
        items: [{
          inventoryItemId: inventoryItemId || '',
          itemCategory: 'sim_european' as ItemCategory,
          itemName: `סים אירופאי - ${selectedSim.local_number || selectedSim.sim_number}`,
          hasIsraeliNumber: !!selectedSim.israeli_number,
          isGeneric: !inventoryItemId,
        }],
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        totalPrice: 0,
        currency: 'USD',
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
      });

      setShowSuccessDialog(true);

      // Reset form
      onSimChange(null);
      setSelectedCustomerId('');
      setNotes('');
      setStartDate(new Date());
      setEndDate(addDays(new Date(), 7));

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
      <Card className="glass-card max-w-2xl mx-auto">
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
                {availableSims.map(sim => (
                  <SelectItem key={sim.id} value={sim.id}>
                    {sim.local_number || sim.sim_number} | {sim.package_name || 'ללא חבילה'} | תוקף: {sim.expiry_date || '-'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected SIM Info */}
          {selectedSim && (
            <div className="bg-primary/10 p-4 rounded-lg space-y-2">
              <div className="font-medium">סים נבחר:</div>
              <div className="text-sm grid grid-cols-2 gap-2">
                <span>ICCID: {selectedSim.sim_number}</span>
                <span>מספר מקומי: {selectedSim.local_number || '-'}</span>
                <span>מספר ישראלי: {selectedSim.israeli_number || '-'}</span>
                <span>חבילה: {selectedSim.package_name || '-'}</span>
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

          {/* Customer Selection */}
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
            <Select
              value={selectedCustomerId}
              onValueChange={setSelectedCustomerId}
            >
              <SelectTrigger>
                <SelectValue placeholder="-- בחר לקוח --" />
              </SelectTrigger>
              <SelectContent>
                {customers.map(customer => (
                  <SelectItem key={customer.id} value={customer.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {customer.name} - {customer.phone}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Selection */}
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

          {/* Notes */}
          <div className="space-y-2">
            <Label>הערות (אופציונלי)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות להשכרה..."
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
                הפעל והשכר
              </>
            )}
          </Button>

          <p className="text-sm text-muted-foreground text-center">
            לאחר הלחיצה, לחץ על הסימנייה (Bookmarklet) באתר CellStation להשלמת ההפעלה
          </p>
        </CardContent>
      </Card>

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
