import { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useRental } from '@/hooks/useRental';
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
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
  Package,
  Upload,
  Printer as PrinterIcon,
} from 'lucide-react';
import { BarcodeDisplay } from '@/components/BarcodeDisplay';
import { 
  InventoryItem, 
  ItemCategory, 
  categoryLabels, 
  categoryIcons 
} from '@/types/rental';
import { useToast } from '@/hooks/use-toast';
import { ImportDialog } from '@/components/inventory/ImportDialog';
import { InventoryCategorySection } from '@/components/inventory/InventoryCategorySection';
import { BarcodePrintDialog } from '@/components/inventory/BarcodePrintDialog';
import { supabase } from '@/integrations/supabase/client';

export default function Inventory() {
  const { inventory, addInventoryItem, updateInventoryItem, deleteInventoryItem, refreshData, loading } = useRental();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Read URL params on mount
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setFilterStatus(statusParam);
      // Clear the URL param after applying
      setSearchParams({}, { replace: true });
    }
  }, []);

  // Handle direct navigation from global search
  useEffect(() => {
    if (location.state?.editItem) {
      const item = location.state.editItem as InventoryItem;
      handleEdit(item);
      // Clear the state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const [formData, setFormData] = useState({
    category: 'sim_european' as ItemCategory,
    name: '',
    localNumber: '',
    israeliNumber: '',
    expiryDate: '',
    simNumber: '',
    status: 'available' as InventoryItem['status'],
    notes: '',
  });

  // Filter inventory
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.localNumber?.includes(searchTerm) ||
      item.israeliNumber?.includes(searchTerm) ||
      item.simNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Group filtered inventory by category
  const inventoryByCategory = filteredInventory.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<ItemCategory, InventoryItem[]>);

  // Get categories in order
  const categoryOrder: ItemCategory[] = [
    'sim_european',
    'sim_american', 
    'device_simple',
    'device_smartphone',
    'modem',
    'netstick'
  ];

  const resetForm = () => {
    setFormData({
      category: 'sim_european',
      name: '',
      localNumber: '',
      israeliNumber: '',
      expiryDate: '',
      simNumber: '',
      status: 'available',
      notes: '',
    });
    setEditingItem(null);
  };

  const handleSubmit = () => {
    if (!formData.name) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין שם לפריט',
        variant: 'destructive',
      });
      return;
    }

    // Validate SIM number for SIM categories
    if (isSim(formData.category) && !formData.simNumber) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין מספר סים (ICCID) לפריט מסוג סים',
        variant: 'destructive',
      });
      return;
    }

    if (editingItem) {
      updateInventoryItem(editingItem.id, formData);
      toast({
        title: 'הפריט עודכן',
        description: 'פרטי הפריט עודכנו בהצלחה',
      });
    } else {
      addInventoryItem(formData);
      toast({
        title: 'פריט נוסף',
        description: 'הפריט נוסף למלאי בהצלחה',
      });
    }

    resetForm();
    setIsAddDialogOpen(false);
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      category: item.category,
      name: item.name,
      localNumber: item.localNumber || '',
      israeliNumber: item.israeliNumber || '',
      expiryDate: item.expiryDate || '',
      simNumber: item.simNumber || '',
      status: item.status,
      notes: item.notes || '',
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteInventoryItem(id);
    toast({
      title: 'פריט נמחק',
      description: 'הפריט הוסר מהמלאי',
    });
  };

  const isSim = (category: ItemCategory) => 
    category === 'sim_american' || category === 'sim_european';


  if (loading) return <PageLoadingSkeleton columns={1} rows={4} showStats={false} />;

  return (
    <div>
      <PageHeader 
        title="ניהול מלאי" 
        description="הוספה, עריכה ומעקב אחר פריטים במלאי"
      >
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="lg" onClick={() => setIsPrintDialogOpen(true)}>
            <PrinterIcon className="h-5 w-5" />
            הדפס ברקודים
          </Button>
          <Button variant="outline" size="lg" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="h-5 w-5" />
            ייבוא מקובץ
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button variant="glow" size="lg">
                <Plus className="h-5 w-5" />
                הוסף פריט
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'עריכת פריט' : 'הוספת פריט חדש'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>קטגוריה</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value: ItemCategory) => setFormData({ ...formData, category: value })}
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
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="לדוגמה: סים אירופאי #001"
                />
              </div>

              {isSim(formData.category) && (
                <>
                  <div className="space-y-2">
                    <Label>מספר מקומי</Label>
                    <Input
                      value={formData.localNumber}
                      onChange={(e) => setFormData({ ...formData, localNumber: e.target.value })}
                      placeholder="+44-7700-900123"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>מספר ישראלי</Label>
                    <Input
                      value={formData.israeliNumber}
                      onChange={(e) => setFormData({ ...formData, israeliNumber: e.target.value })}
                      placeholder="050-0001111"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>תוקף</Label>
                    <Input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      מספר סים (ICCID) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={formData.simNumber}
                      onChange={(e) => setFormData({ ...formData, simNumber: e.target.value })}
                      placeholder="89972..."
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>סטטוס</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value: InventoryItem['status']) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">זמין</SelectItem>
                    <SelectItem value="rented">מושכר</SelectItem>
                    <SelectItem value="maintenance">בתחזוקה</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>הערות</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="הערות נוספות..."
                />
              </div>

              {/* Barcode preview and print - only for existing items with barcode */}
              {editingItem && editingItem.barcode && (
                <div className="space-y-3 pt-4 border-t">
                  <Label className="flex items-center gap-2">
                    <PrinterIcon className="h-4 w-4" />
                    ברקוד
                  </Label>
                  <div className="flex flex-col items-center gap-3 p-4 bg-muted/50 rounded-lg">
                    <BarcodeDisplay code={editingItem.barcode} height={50} width={1.5} />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const printWindow = window.open('', '_blank');
                        if (!printWindow) return;
                        
                        printWindow.document.write(`
                          <!DOCTYPE html>
                          <html dir="rtl">
                          <head>
                            <title>הדפסת ברקוד</title>
                            <style>
                              * { margin: 0; padding: 0; box-sizing: border-box; }
                              body { 
                                font-family: Arial, sans-serif; 
                                display: flex; 
                                flex-direction: column; 
                                align-items: center; 
                                justify-content: center; 
                                min-height: 100vh;
                                padding: 20px;
                              }
                              .container { text-align: center; }
                              h2 { font-size: 14pt; margin-bottom: 5px; }
                              p { font-size: 10pt; color: #666; margin-bottom: 10px; }
                              svg { max-width: 200px; }
                            </style>
                          </head>
                          <body>
                            <div class="container">
                              <h2>${editingItem.name}</h2>
                              <p>${categoryLabels[editingItem.category]}</p>
                              <svg id="barcode"></svg>
                            </div>
                            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js"></script>
                            <script>
                              JsBarcode("#barcode", "${editingItem.barcode}", {
                                format: "CODE128",
                                width: 2,
                                height: 60,
                                displayValue: true,
                                fontSize: 12,
                                margin: 5
                              });
                              window.onload = function() {
                                setTimeout(() => {
                                  window.print();
                                  window.close();
                                }, 300);
                              };
                            </script>
                          </body>
                          </html>
                        `);
                        printWindow.document.close();
                      }}
                    >
                      <PrinterIcon className="h-4 w-4 ml-2" />
                      הדפס ברקוד
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button onClick={handleSubmit} className="flex-1">
                  {editingItem ? 'עדכן' : 'הוסף'}
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
        </div>
      </PageHeader>

      <ImportDialog 
        isOpen={isImportDialogOpen} 
        onClose={() => setIsImportDialogOpen(false)} 
      />

      <BarcodePrintDialog
        isOpen={isPrintDialogOpen}
        onClose={() => setIsPrintDialogOpen(false)}
        items={inventory}
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="חיפוש לפי שם, מספר טלפון, מספר סים..."
            className="pr-10"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="כל הקטגוריות" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הקטגוריות</SelectItem>
              {Object.entries(categoryLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {categoryIcons[key as ItemCategory]} {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="כל הסטטוסים" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              <SelectItem value="available">זמין</SelectItem>
              <SelectItem value="rented">מושכר</SelectItem>
              <SelectItem value="maintenance">בתחזוקה</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Inventory by Category */}
      {filteredInventory.length === 0 ? (
        inventory.length === 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card text-center py-16 px-6 shadow-sm">
            <div className="flex h-20 w-20 mx-auto mb-5 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-accent/10">
              <Package className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">המלאי ריק</h3>
            <p className="text-muted-foreground mb-6 max-w-xs mx-auto">הוסף פריטים למלאי כדי להתחיל להשכיר ולנהל את הציוד שלך</p>
            <Button variant="glow" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              הוסף פריט ראשון
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/50 bg-card text-center py-12 px-6 shadow-sm">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-lg font-medium text-foreground">לא נמצאו פריטים</p>
            <p className="text-sm text-muted-foreground">נסה לשנות את מילות החיפוש</p>
          </div>
        )
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {categoryOrder
            .filter(cat => inventoryByCategory[cat]?.length > 0)
            .map((category, index) => (
              <div key={category}>
                <InventoryCategorySection
                  category={category}
                  items={inventoryByCategory[category]}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
