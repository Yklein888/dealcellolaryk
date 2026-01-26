import { useState } from 'react';
import { useRental } from '@/hooks/useRental';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Edit2, 
  Trash2,
  Package,
  Upload
} from 'lucide-react';
import { 
  InventoryItem, 
  ItemCategory, 
  categoryLabels, 
  categoryIcons 
} from '@/types/rental';
import { useToast } from '@/hooks/use-toast';
import { ImportDialog } from '@/components/inventory/ImportDialog';

export default function Inventory() {
  const { inventory, addInventoryItem, updateInventoryItem, deleteInventoryItem } = useRental();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const [formData, setFormData] = useState({
    category: 'sim_european' as ItemCategory,
    name: '',
    localNumber: '',
    israeliNumber: '',
    expiryDate: '',
    status: 'available' as InventoryItem['status'],
    notes: '',
  });

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.localNumber?.includes(searchTerm) ||
      item.israeliNumber?.includes(searchTerm);
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const resetForm = () => {
    setFormData({
      category: 'sim_european',
      name: '',
      localNumber: '',
      israeliNumber: '',
      expiryDate: '',
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

  const getStatusVariant = (status: InventoryItem['status']) => {
    switch (status) {
      case 'available': return 'success';
      case 'rented': return 'info';
      case 'maintenance': return 'warning';
      default: return 'default';
    }
  };

  const statusLabels: Record<InventoryItem['status'], string> = {
    available: 'זמין',
    rented: 'מושכר',
    maintenance: 'בתחזוקה',
  };

  const isSim = (category: ItemCategory) => 
    category === 'sim_american' || category === 'sim_european';

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="ניהול מלאי" 
        description="הוספה, עריכה ומעקב אחר פריטים במלאי"
      >
        <div className="flex gap-2">
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

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="חיפוש לפי שם, מספר..."
            className="pr-10"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full md:w-48">
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
      </div>

      {/* Inventory Grid */}
      {filteredInventory.length === 0 ? (
        <div className="stat-card text-center py-8">
          <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-base font-medium text-foreground">אין פריטים במלאי</p>
          <p className="text-sm text-muted-foreground">הוסף פריטים חדשים כדי להתחיל</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredInventory.map((item, index) => (
            <div 
              key={item.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-all duration-200 animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-3 flex-1">
                <span className="text-xl">{categoryIcons[item.category]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground text-sm">{item.name}</p>
                    <span className="text-xs text-muted-foreground">({categoryLabels[item.category]})</span>
                  </div>
                  {isSim(item.category) && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {item.localNumber && <span>מקומי: {item.localNumber}</span>}
                      {item.israeliNumber && <span>ישראלי: {item.israeliNumber}</span>}
                      {item.expiryDate && <span>תוקף: {item.expiryDate}</span>}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <StatusBadge 
                  status={statusLabels[item.status]} 
                  variant={getStatusVariant(item.status)} 
                />
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleEdit(item)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
