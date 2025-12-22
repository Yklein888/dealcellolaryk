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
  Package
} from 'lucide-react';
import { 
  InventoryItem, 
  ItemCategory, 
  categoryLabels, 
  categoryIcons 
} from '@/types/rental';
import { useToast } from '@/hooks/use-toast';

export default function Inventory() {
  const { inventory, addInventoryItem, updateInventoryItem, deleteInventoryItem } = useRental();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
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
      </PageHeader>

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
        <div className="stat-card text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground">אין פריטים במלאי</p>
          <p className="text-muted-foreground">הוסף פריטים חדשים כדי להתחיל</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInventory.map((item) => (
            <div 
              key={item.id}
              className="stat-card hover:border-primary/30 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{categoryIcons[item.category]}</span>
                  <div>
                    <p className="font-semibold text-foreground">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{categoryLabels[item.category]}</p>
                  </div>
                </div>
                <StatusBadge 
                  status={statusLabels[item.status]} 
                  variant={getStatusVariant(item.status)} 
                />
              </div>

              {isSim(item.category) && (
                <div className="space-y-1 mb-4 text-sm">
                  {item.localNumber && (
                    <p className="text-muted-foreground">
                      מספר מקומי: <span className="text-foreground">{item.localNumber}</span>
                    </p>
                  )}
                  {item.israeliNumber && (
                    <p className="text-muted-foreground">
                      מספר ישראלי: <span className="text-foreground">{item.israeliNumber}</span>
                    </p>
                  )}
                  {item.expiryDate && (
                    <p className="text-muted-foreground">
                      תוקף: <span className="text-foreground">{item.expiryDate}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t border-border">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleEdit(item)}
                >
                  <Edit2 className="h-4 w-4" />
                  עריכה
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  מחיקה
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
