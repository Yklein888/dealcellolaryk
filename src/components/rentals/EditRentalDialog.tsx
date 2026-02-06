import { useState, useEffect, useMemo } from 'react';
import { useRental } from '@/hooks/useRental';
import { 
  Rental, 
  RentalItem, 
  InventoryItem, 
  ItemCategory, 
  categoryLabels, 
  categoryIcons 
} from '@/types/rental';
import { calculateRentalPrice } from '@/lib/pricing';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DualCurrencyPrice } from '@/components/DualCurrencyPrice';
import { 
  X, 
  Plus, 
  Package, 
  Loader2, 
  AlertTriangle,
  Calculator 
} from 'lucide-react';
import { parseISO, isBefore } from 'date-fns';

interface EditRentalDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  rental: Rental | null;
}

interface EditableItem extends RentalItem {
  id: string; // Unique key for React
}

export function EditRentalDialog({ 
  isOpen, 
  onOpenChange, 
  rental 
}: EditRentalDialogProps) {
  const { inventory, updateRentalItems, getAvailableItems } = useRental();
  const { toast } = useToast();
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deposit, setDeposit] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Rental['status']>('active');
  const [overdueDailyRate, setOverdueDailyRate] = useState('');
  const [overdueGraceDays, setOverdueGraceDays] = useState('0');
  const [autoChargeEnabled, setAutoChargeEnabled] = useState(false);
  
  // Editable items state
  const [editItems, setEditItems] = useState<EditableItem[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | ''>('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form when rental changes
  useEffect(() => {
    if (rental) {
      setStartDate(rental.startDate);
      setEndDate(rental.endDate);
      setDeposit(rental.deposit?.toString() || '');
      setNotes(rental.notes || '');
      setStatus(rental.status);
      setOverdueDailyRate(rental.overdueDailyRate?.toString() || '');
      setOverdueGraceDays((rental.overdueGraceDays ?? 0).toString());
      setAutoChargeEnabled(rental.autoChargeEnabled ?? false);
      
      // Initialize items with unique IDs
      setEditItems(rental.items.map((item, idx) => ({
        ...item,
        id: `${item.inventoryItemId || 'generic'}-${idx}`,
      })));
      setIsAddingItem(false);
      setSelectedCategory('');
    }
  }, [rental]);

  // Get available items for adding (excluding ones already in this rental)
  const availableItemsForCategory = useMemo(() => {
    if (!selectedCategory) return [];
    
    const alreadyInRental = new Set(
      editItems
        .filter(i => !i.isGeneric && i.inventoryItemId)
        .map(i => i.inventoryItemId)
    );
    
    return getAvailableItems(selectedCategory as ItemCategory)
      .filter(item => !alreadyInRental.has(item.id));
  }, [selectedCategory, editItems, getAvailableItems]);

  // Calculate price dynamically based on items and dates
  const calculatedPrice = useMemo(() => {
    if (!startDate || !endDate || editItems.length === 0) return null;
    
    try {
      const itemsForCalc = editItems.map(item => ({
        category: item.itemCategory,
        hasIsraeliNumber: item.hasIsraeliNumber || false,
      }));
      
      const result = calculateRentalPrice(itemsForCalc, startDate, endDate);
      
      // Format breakdown to strings
      const formattedBreakdown = result.breakdown?.map(b => 
        `${b.item}: ${b.currency}${b.price.toFixed(2)}${b.details ? ` (${b.details})` : ''}`
      ) || [];
      
      return {
        total: result.total,
        currency: result.currency as 'ILS' | 'USD',
        breakdown: formattedBreakdown,
      };
    } catch {
      return null;
    }
  }, [editItems, startDate, endDate]);

  const handleRemoveItem = (itemId: string) => {
    // Prevent removing last item
    if (editItems.length <= 1) {
      toast({
        title: 'לא ניתן להסיר',
        description: 'חייב להישאר לפחות פריט אחד בהשכרה',
        variant: 'destructive',
      });
      return;
    }
    
    setEditItems(prev => prev.filter(i => i.id !== itemId));
  };

  const handleAddInventoryItem = (item: InventoryItem) => {
    const newItem: EditableItem = {
      id: `new-${item.id}-${Date.now()}`,
      inventoryItemId: item.id,
      itemCategory: item.category,
      itemName: item.name,
      hasIsraeliNumber: !!item.israeliNumber,
      isGeneric: false,
    };
    
    setEditItems(prev => [...prev, newItem]);
    setIsAddingItem(false);
    setSelectedCategory('');
  };

  const handleAddGenericDevice = () => {
    const newItem: EditableItem = {
      id: `generic-${Date.now()}`,
      inventoryItemId: '',
      itemCategory: 'device_simple',
      itemName: 'מכשיר פשוט',
      isGeneric: true,
    };
    
    setEditItems(prev => [...prev, newItem]);
    setIsAddingItem(false);
  };

  const handleSave = async () => {
    if (!rental) return;
    
    if (editItems.length === 0) {
      toast({
        title: 'שגיאה',
        description: 'חייב להיות לפחות פריט אחד בהשכרה',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Prepare items for update
      const itemsToUpdate = editItems.map(item => ({
        inventoryItemId: item.inventoryItemId,
        itemCategory: item.itemCategory,
        itemName: item.itemName,
        pricePerDay: item.pricePerDay,
        hasIsraeliNumber: item.hasIsraeliNumber,
        isGeneric: item.isGeneric,
      }));
      
      const newTotalPrice = calculatedPrice?.total || rental.totalPrice;
      
      await updateRentalItems(rental.id, itemsToUpdate, newTotalPrice);
      
      toast({
        title: 'ההשכרה עודכנה',
        description: 'הפריטים והמחיר עודכנו בהצלחה',
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating rental items:', error);
      toast({
        title: 'שגיאה',
        description: error instanceof Error ? error.message : 'לא ניתן לעדכן את ההשכרה',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Check if item has expiry warning
  const getItemExpiryWarning = (item: EditableItem) => {
    if (!item.inventoryItemId || item.isGeneric) return null;
    
    const invItem = inventory.find(i => i.id === item.inventoryItemId);
    if (!invItem?.expiryDate || !endDate) return null;
    
    const expiryDate = parseISO(invItem.expiryDate);
    const rentalEndDate = parseISO(endDate);
    
    if (isBefore(expiryDate, rentalEndDate)) {
      return `פג תוקף לפני סיום ההשכרה (${invItem.expiryDate})`;
    }
    return null;
  };

  if (!rental) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>עריכת השכרה</DialogTitle>
          <DialogDescription>
            עריכת השכרה של {rental.customerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>תאריך התחלה</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <Label>תאריך סיום</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                פריטים בהשכרה ({editItems.length})
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddingItem(true)}
                disabled={isAddingItem}
              >
                <Plus className="h-4 w-4 ml-1" />
                הוסף פריט
              </Button>
            </div>
            
            {/* Current Items */}
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {editItems.map((item) => {
                const expiryWarning = getItemExpiryWarning(item);
                return (
                  <div 
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      expiryWarning 
                        ? 'border-warning bg-warning/10' 
                        : 'border-border bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{categoryIcons[item.itemCategory]}</span>
                      <div>
                        <p className="font-medium text-sm">{item.itemName}</p>
                        <p className="text-xs text-muted-foreground">
                          {categoryLabels[item.itemCategory]}
                          {item.isGeneric && ' (ללא מעקב מלאי)'}
                        </p>
                        {expiryWarning && (
                          <p className="text-xs text-warning flex items-center gap-1 mt-1">
                            <AlertTriangle className="h-3 w-3" />
                            {expiryWarning}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={editItems.length <= 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Add Item Panel */}
            {isAddingItem && (
              <div className="p-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>בחר קטגוריה</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsAddingItem(false);
                      setSelectedCategory('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(categoryLabels) as ItemCategory[]).map((cat) => (
                    <button
                      key={cat}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        selectedCategory === cat
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      <span className="text-xl block">{categoryIcons[cat]}</span>
                      <span className="text-xs">{categoryLabels[cat]}</span>
                    </button>
                  ))}
                </div>

                {selectedCategory && (
                  <div className="space-y-2">
                    {selectedCategory === 'device_simple' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={handleAddGenericDevice}
                      >
                        הוסף מכשיר פשוט (ללא מעקב מלאי)
                      </Button>
                    )}
                    
                    {availableItemsForCategory.length > 0 ? (
                      <div className="max-h-[150px] overflow-y-auto space-y-1">
                        {availableItemsForCategory.map((item) => (
                          <button
                            key={item.id}
                            className="w-full p-2 rounded-lg border border-border hover:border-primary/50 text-right transition-all flex items-center gap-3"
                            onClick={() => handleAddInventoryItem(item)}
                          >
                            <span>{categoryIcons[item.category]}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{item.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.israeliNumber && `🇮🇱 ${item.israeliNumber}`}
                                {item.localNumber && ` | 📞 ${item.localNumber}`}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-3">
                        אין פריטים זמינים בקטגוריה זו
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dynamic Price Calculation */}
          {calculatedPrice && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="h-4 w-4 text-primary" />
                <Label className="text-primary font-medium">מחיר מחושב</Label>
              </div>
              <div className="text-2xl font-bold text-primary">
                <DualCurrencyPrice amount={calculatedPrice.total} currency="ILS" />
              </div>
              {calculatedPrice.breakdown && calculatedPrice.breakdown.length > 0 && (
                <div className="mt-2 space-y-1">
                  {calculatedPrice.breakdown.map((line, idx) => (
                    <p key={idx} className="text-xs text-muted-foreground">{line}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Status */}
          <div className="space-y-2">
            <Label>סטטוס</Label>
            <Select value={status} onValueChange={(val: Rental['status']) => setStatus(val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">פעיל</SelectItem>
                <SelectItem value="overdue">באיחור</SelectItem>
                <SelectItem value="returned">הוחזר</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Deposit & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>פיקדון</Label>
              <Input
                type="number"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                placeholder="סכום הפיקדון"
              />
            </div>
            <div className="space-y-2">
              <Label>הערות</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="הערות נוספות"
              />
            </div>
          </div>

          {/* Overdue Charging Section */}
          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-3">חיוב אוטומטי על איחור</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>סכום ליום איחור (₪)</Label>
                <Input
                  type="number"
                  value={overdueDailyRate}
                  onChange={(e) => setOverdueDailyRate(e.target.value)}
                  placeholder="למשל: 50"
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label>ימי חסד</Label>
                <Input
                  type="number"
                  value={overdueGraceDays}
                  onChange={(e) => setOverdueGraceDays(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="min-h-[44px]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <Checkbox
                id="autoChargeEnabled"
                checked={autoChargeEnabled}
                onCheckedChange={(checked) => setAutoChargeEnabled(checked === true)}
              />
              <Label htmlFor="autoChargeEnabled" className="text-sm cursor-pointer">
                חייב אוטומטית (רק ללקוחות עם כרטיס שמור)
              </Label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button 
              onClick={handleSave} 
              className="flex-1"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  שומר...
                </>
              ) : (
                'שמור שינויים'
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              ביטול
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
