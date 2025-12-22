import { useState } from 'react';
import { useRental } from '@/hooks/useRental';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
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
  RotateCcw,
  Calendar,
  User,
  Package
} from 'lucide-react';
import { 
  Rental, 
  RentalItem, 
  ItemCategory,
  categoryLabels, 
  categoryIcons,
  rentalStatusLabels 
} from '@/types/rental';
import { calculateRentalPrice, formatPrice } from '@/lib/pricing';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

export default function Rentals() {
  const { 
    rentals, 
    customers, 
    inventory, 
    addRental, 
    returnRental,
    getAvailableItems 
  } = useRental();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    customerId: '',
    startDate: '',
    endDate: '',
    deposit: '',
    notes: '',
  });

  const [selectedItems, setSelectedItems] = useState<Array<{
    inventoryItemId: string;
    category: ItemCategory;
    name: string;
    hasIsraeliNumber: boolean;
  }>>([]);

  const filteredRentals = rentals.filter(rental => {
    const matchesSearch = 
      rental.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rental.items.some(i => i.itemName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || rental.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const availableItems = getAvailableItems();

  const resetForm = () => {
    setFormData({
      customerId: '',
      startDate: '',
      endDate: '',
      deposit: '',
      notes: '',
    });
    setSelectedItems([]);
  };

  const handleAddItem = (inventoryItemId: string) => {
    const item = inventory.find(i => i.id === inventoryItemId);
    if (!item) return;

    if (selectedItems.some(i => i.inventoryItemId === inventoryItemId)) {
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

  const calculatePreviewPrice = () => {
    if (!formData.startDate || !formData.endDate || selectedItems.length === 0) {
      return null;
    }

    return calculateRentalPrice(
      selectedItems.map(i => ({ 
        category: i.category, 
        hasIsraeliNumber: i.hasIsraeliNumber 
      })),
      formData.startDate,
      formData.endDate
    );
  };

  const previewPrice = calculatePreviewPrice();

  const handleSubmit = () => {
    if (!formData.customerId) {
      toast({
        title: 'שגיאה',
        description: 'יש לבחור לקוח',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.startDate || !formData.endDate) {
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

    const customer = customers.find(c => c.id === formData.customerId);
    if (!customer) return;

    const pricing = calculateRentalPrice(
      selectedItems.map(i => ({ category: i.category, hasIsraeliNumber: i.hasIsraeliNumber })),
      formData.startDate,
      formData.endDate
    );

    const rentalItems: RentalItem[] = selectedItems.map(item => ({
      inventoryItemId: item.inventoryItemId,
      itemCategory: item.category,
      itemName: item.name,
      hasIsraeliNumber: item.hasIsraeliNumber,
    }));

    addRental({
      customerId: customer.id,
      customerName: customer.name,
      items: rentalItems,
      startDate: formData.startDate,
      endDate: formData.endDate,
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

    resetForm();
    setIsAddDialogOpen(false);
  };

  const handleReturn = (rentalId: string) => {
    returnRental(rentalId);
    toast({
      title: 'השכרה הוחזרה',
      description: 'הפריטים הוחזרו למלאי',
    });
  };

  const getStatusVariant = (status: Rental['status']) => {
    switch (status) {
      case 'active': return 'info';
      case 'overdue': return 'destructive';
      case 'returned': return 'success';
      default: return 'default';
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="ניהול השכרות" 
        description="יצירה וניהול השכרות קיימות"
      >
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button variant="glow" size="lg">
              <Plus className="h-5 w-5" />
              השכרה חדשה
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>יצירת השכרה חדשה</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 mt-4">
              {/* Customer Selection */}
              <div className="space-y-2">
                <Label>בחר לקוח *</Label>
                <Select 
                  value={formData.customerId} 
                  onValueChange={(value) => setFormData({ ...formData, customerId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר לקוח מהרשימה" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} - {customer.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>תאריך התחלה *</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>תאריך סיום *</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>

              {/* Item Selection */}
              <div className="space-y-2">
                <Label>בחר פריטים להשכרה *</Label>
                <Select onValueChange={handleAddItem}>
                  <SelectTrigger>
                    <SelectValue placeholder="הוסף פריט" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {categoryIcons[item.category]} {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Selected Items */}
              {selectedItems.length > 0 && (
                <div className="space-y-2">
                  <Label>פריטים נבחרים</Label>
                  <div className="space-y-2">
                    {selectedItems.map((item) => (
                      <div 
                        key={item.inventoryItemId}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{categoryIcons[item.category]}</span>
                          <div>
                            <p className="font-medium text-foreground">{item.name}</p>
                            <p className="text-sm text-muted-foreground">{categoryLabels[item.category]}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {item.category === 'sim_american' && (
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={item.hasIsraeliNumber}
                                onCheckedChange={() => handleToggleIsraeliNumber(item.inventoryItemId)}
                              />
                              <Label className="text-sm">מספר ישראלי (+$10)</Label>
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRemoveItem(item.inventoryItemId)}
                          >
                            הסר
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Price Preview */}
              {previewPrice && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm text-muted-foreground mb-2">פירוט מחיר:</p>
                  {previewPrice.breakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.item}</span>
                      <span>{item.currency}{item.price}</span>
                    </div>
                  ))}
                  <div className="border-t border-primary/20 mt-2 pt-2 flex justify-between font-bold">
                    <span>סה"כ</span>
                    <span className="text-primary">{formatPrice(previewPrice.total, previewPrice.currency)}</span>
                  </div>
                </div>
              )}

              {/* Deposit */}
              <div className="space-y-2">
                <Label>פיקדון</Label>
                <Input
                  type="number"
                  value={formData.deposit}
                  onChange={(e) => setFormData({ ...formData, deposit: e.target.value })}
                  placeholder="סכום הפיקדון"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>הערות</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="הערות נוספות..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleSubmit} className="flex-1">
                  צור השכרה
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    resetForm();
                    setIsAddDialogOpen(false);
                  }}
                >
                  ביטול
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="חיפוש לפי שם לקוח או פריט..."
            className="pr-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="כל הסטטוסים" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="active">פעיל</SelectItem>
            <SelectItem value="overdue">באיחור</SelectItem>
            <SelectItem value="returned">הוחזר</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Rentals List */}
      {filteredRentals.length === 0 ? (
        <div className="stat-card text-center py-12">
          <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground">אין השכרות</p>
          <p className="text-muted-foreground">צור השכרה חדשה כדי להתחיל</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRentals.map((rental) => (
            <div 
              key={rental.id}
              className="stat-card hover:border-primary/30 transition-all duration-200"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-lg">{rental.customerName}</p>
                      <StatusBadge 
                        status={rentalStatusLabels[rental.status]} 
                        variant={getStatusVariant(rental.status)} 
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {rental.items.map((item, idx) => (
                      <span 
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-sm"
                      >
                        {categoryIcons[item.itemCategory]} {item.itemName}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(parseISO(rental.startDate), 'dd/MM/yyyy', { locale: he })} - {format(parseISO(rental.endDate), 'dd/MM/yyyy', { locale: he })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      {rental.items.length} פריטים
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-left">
                    <p className="text-2xl font-bold text-primary">
                      {formatPrice(rental.totalPrice, rental.currency)}
                    </p>
                    {rental.deposit && (
                      <p className="text-sm text-muted-foreground">פיקדון: ₪{rental.deposit}</p>
                    )}
                  </div>

                  {rental.status === 'active' && (
                    <Button 
                      variant="outline"
                      onClick={() => handleReturn(rental.id)}
                    >
                      <RotateCcw className="h-4 w-4" />
                      החזר
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
