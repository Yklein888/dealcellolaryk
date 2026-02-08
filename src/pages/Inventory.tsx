import { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useRental } from '@/hooks/useRental';
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
  RefreshCw
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
import { useCellstationSync, SimCard } from '@/hooks/useCellstationSync';
import { supabase } from '@/integrations/supabase/client';

export default function Inventory() {
  const { inventory, addInventoryItem, updateInventoryItem, deleteInventoryItem, refreshData } = useRental();
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
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncPreview, setSyncPreview] = useState<{ 
    toAdd: SimCard[]; 
    toUpdate: Array<{ sim: SimCard; inventoryItem: InventoryItem; changes: string[] }>; 
    existing: number 
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

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

  // Format phone number with leading zero
  const formatPhoneWithLeadingZero = (phone: string | null | undefined): string | undefined => {
    if (!phone) return undefined;
    let cleaned = String(phone).replace(/[-\s]/g, '');
    // Add leading zero if missing for Israeli numbers (722, 752, 77, etc.)
    if (/^7\d{8,9}$/.test(cleaned)) {
      cleaned = '0' + cleaned;
    }
    return cleaned;
  };

  // Determine SIM type based on package name
  const getSimTypeName = (packageName: string | null | undefined): string => {
    if (!packageName) return 'סים';
    const lower = packageName.toLowerCase();
    if (lower.includes('גלישה') || lower.includes('גיגה') || lower.includes('data') || lower.includes('gb')) {
      return 'סים גלישה';
    }
    if (lower.includes('דיבור') || lower.includes('שיחות') || lower.includes('calls') || lower.includes('voice')) {
      return 'סים שיחות';
    }
    return 'סים';
  };

  // Load sync preview from CellStation
  const loadSyncPreview = async () => {
    setIsLoadingPreview(true);
    try {
      // First sync with CellStation to get latest data
      const { error: syncError } = await supabase.functions.invoke('cellstation-sync');
      if (syncError) throw syncError;

      // Fetch ALL sim_cards (including inactive)
      const { data: simCards, error } = await supabase
        .from('sim_cards')
        .select('*')
        .order('is_active', { ascending: false })
        .order('expiry_date', { ascending: true });

      if (error) throw error;

      // Build inventory lookup by ICCID (sim_number)
      const inventoryByIccid = new Map<string, InventoryItem>();
      inventory
        .filter(item => item.simNumber)
        .forEach(item => {
          inventoryByIccid.set(item.simNumber!.toLowerCase(), item);
        });

      // Separate SIMs into toAdd (new) and toUpdate (existing with changes)
      const toAdd: typeof simCards = [];
      const toUpdate: Array<{
        sim: typeof simCards[0];
        inventoryItem: InventoryItem;
        changes: string[];
      }> = [];

      for (const sim of simCards || []) {
        if (!sim.sim_number) continue;
        
        const existingItem = inventoryByIccid.get(sim.sim_number.toLowerCase());
        
        if (!existingItem) {
          // New SIM - add to inventory
          toAdd.push(sim);
        } else {
          // Existing SIM - check if needs update
          const changes: string[] = [];
          
          const newIsraeli = formatPhoneWithLeadingZero(sim.israeli_number);
          const newLocal = formatPhoneWithLeadingZero(sim.local_number);
          const newExpiry = sim.expiry_date || undefined;
          
          // Check name change (based on package type) - name is just the type, no phone number
          const expectedName = getSimTypeName(sim.package_name);
          if (existingItem.name !== expectedName) {
            changes.push(`שם: ${existingItem.name} → ${expectedName}`);
          }
          
          if (newIsraeli && newIsraeli !== existingItem.israeliNumber) {
            changes.push(`מספר ישראלי: ${existingItem.israeliNumber || '-'} → ${newIsraeli}`);
          }
          if (newLocal && newLocal !== existingItem.localNumber) {
            changes.push(`מספר מקומי: ${existingItem.localNumber || '-'} → ${newLocal}`);
          }
          if (newExpiry && newExpiry !== existingItem.expiryDate) {
            changes.push(`תוקף: ${existingItem.expiryDate || '-'} → ${newExpiry}`);
          }
          
          if (changes.length > 0) {
            toUpdate.push({ sim, inventoryItem: existingItem, changes });
          }
        }
      }

      const existing = (simCards || []).length - toAdd.length - toUpdate.length;

      setSyncPreview({ toAdd, toUpdate, existing });
    } catch (error: any) {
      console.error('Error loading sync preview:', error);
      toast({
        title: 'שגיאה בטעינת נתונים',
        description: error.message || 'לא ניתן היה לטעון את נתוני הסימים',
        variant: 'destructive',
      });
      setIsSyncDialogOpen(false);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Execute sync - add new SIMs and update existing ones
  const executeSync = async () => {
    if (!syncPreview) return;
    
    const hasWork = (syncPreview.toAdd?.length || 0) + (syncPreview.toUpdate?.length || 0) > 0;
    if (!hasWork) return;

    setIsSyncing(true);
    let added = 0;
    let updated = 0;
    let errors = 0;

    try {
      // Add new SIMs
      for (const sim of syncPreview.toAdd || []) {
        try {
          const simType = getSimTypeName(sim.package_name);
          await addInventoryItem({
            category: 'sim_european' as ItemCategory,
            name: simType,
            localNumber: formatPhoneWithLeadingZero(sim.local_number),
            israeliNumber: formatPhoneWithLeadingZero(sim.israeli_number),
            expiryDate: sim.expiry_date || undefined,
            simNumber: sim.sim_number || undefined,
            status: 'available',
            notes: sim.package_name ? `חבילה: ${sim.package_name}` : undefined,
          });
          added++;
        } catch (e) {
          console.error('Error adding SIM:', e);
          errors++;
        }
      }

      // Update existing SIMs
      for (const { sim, inventoryItem } of syncPreview.toUpdate || []) {
        try {
          const simType = getSimTypeName(sim.package_name);
          const { error: updateError } = await supabase
            .from('inventory')
            .update({
              israeli_number: formatPhoneWithLeadingZero(sim.israeli_number),
              local_number: formatPhoneWithLeadingZero(sim.local_number),
              expiry_date: sim.expiry_date || null,
              name: simType,
              updated_at: new Date().toISOString(),
            })
            .eq('id', inventoryItem.id);
          
          if (updateError) throw updateError;
          updated++;
        } catch (e) {
          console.error('Error updating SIM:', e);
          errors++;
        }
      }

      toast({
        title: 'סנכרון הושלם',
        description: `נוספו ${added}, עודכנו ${updated}${errors > 0 ? `, ${errors} שגיאות` : ''}`,
      });

      // Refresh data
      await refreshData();
      setIsSyncDialogOpen(false);
      setSyncPreview(null);
    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: 'שגיאה בסנכרון',
        description: error.message || 'לא ניתן היה להשלים את הסנכרון',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenSyncDialog = () => {
    setIsSyncDialogOpen(true);
    setSyncPreview(null);
    loadSyncPreview();
  };

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="ניהול מלאי" 
        description="הוספה, עריכה ומעקב אחר פריטים במלאי"
      >
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="lg" onClick={handleOpenSyncDialog}>
            <RefreshCw className="h-5 w-5" />
            סנכרון מלאי
          </Button>
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

      {/* Sync Dialog */}
      <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>סנכרון מלאי מ-CellStation</DialogTitle>
            <DialogDescription>
              סנכרון סימים פעילים מאתר הספק והוספתם למלאי
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isLoadingPreview ? (
              <div className="flex flex-col items-center justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-muted-foreground">טוען נתונים מ-CellStation...</p>
              </div>
            ) : syncPreview ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-muted-foreground">סימים ללא שינויים:</span>
                  <span className="font-semibold">{syncPreview.existing}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-success/10 border border-success/20 rounded-lg">
                  <span className="text-success">סימים חדשים להוספה:</span>
                  <span className="font-semibold text-success">{syncPreview.toAdd.length}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-warning/10 border border-warning/20 rounded-lg">
                  <span className="text-warning">סימים קיימים לעדכון:</span>
                  <span className="font-semibold text-warning">{syncPreview.toUpdate?.length || 0}</span>
                </div>

                {/* New SIMs to add */}
                {syncPreview.toAdd.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-success">חדשים להוספה:</h4>
                    <div className="max-h-40 overflow-y-auto border rounded-lg">
                      <div className="divide-y">
                        {syncPreview.toAdd.slice(0, 10).map((sim) => (
                          <div key={sim.id} className="p-2 text-sm flex justify-between items-center gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${sim.is_active ? 'bg-success' : 'bg-destructive'}`} />
                              <span className="font-mono text-xs">{sim.sim_number?.slice(-8) || '-'}</span>
                            </div>
                            <div className="text-right">
                              <div>0{sim.israeli_number?.replace(/^0/, '') || sim.local_number?.replace(/^0/, '') || '-'}</div>
                            </div>
                          </div>
                        ))}
                        {syncPreview.toAdd.length > 10 && (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            ועוד {syncPreview.toAdd.length - 10} סימים...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Existing SIMs to update */}
                {(syncPreview.toUpdate?.length || 0) > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-warning">סימים לעדכון:</h4>
                    <div className="max-h-40 overflow-y-auto border rounded-lg">
                      <div className="divide-y">
                        {syncPreview.toUpdate?.slice(0, 10).map(({ sim, changes }) => (
                          <div key={sim.id} className="p-2 text-sm">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-mono text-xs">{sim.sim_number?.slice(-8) || '-'}</span>
                              <span className="text-muted-foreground">
                                0{sim.israeli_number?.replace(/^0/, '') || '-'}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {changes.join(' | ')}
                            </div>
                          </div>
                        ))}
                        {(syncPreview.toUpdate?.length || 0) > 10 && (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            ועוד {(syncPreview.toUpdate?.length || 0) - 10} סימים...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {syncPreview.toAdd.length === 0 && (syncPreview.toUpdate?.length || 0) === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>כל הסימים מעודכנים</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsSyncDialogOpen(false)}
              disabled={isSyncing}
            >
              ביטול
            </Button>
            <Button
              onClick={executeSync}
              disabled={isSyncing || isLoadingPreview || (syncPreview?.toAdd.length === 0 && (syncPreview?.toUpdate?.length || 0) === 0)}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin ml-2" />
                  מסנכרן...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 ml-2" />
                  סנכרן {(syncPreview?.toAdd.length || 0) + (syncPreview?.toUpdate?.length || 0)} סימים
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        <div className="stat-card text-center py-6 sm:py-8">
          <Package className="h-8 w-8 sm:h-10 sm:w-10 mx-auto text-muted-foreground mb-2 sm:mb-3" />
          <p className="text-sm sm:text-base font-medium text-foreground">אין פריטים במלאי</p>
          <p className="text-xs sm:text-sm text-muted-foreground">הוסף פריטים חדשים כדי להתחיל</p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {categoryOrder
            .filter(cat => inventoryByCategory[cat]?.length > 0)
            .map((category, index) => (
              <div 
                key={category}
                className="animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
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
