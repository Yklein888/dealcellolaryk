import { useState, useMemo, useRef, useEffect } from 'react';
import { useRental } from '@/hooks/useRental';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  User,
  Package,
  ShoppingCart,
  Wrench,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { categoryLabels, categoryIcons, repairStatusLabels, InventoryItem, Rental } from '@/types/rental';
import { QuickActionDialog } from '@/components/inventory/QuickActionDialog';

interface SearchResult {
  type: 'customer' | 'inventory' | 'rental' | 'repair';
  id: string;
  title: string;
  subtitle: string;
  status?: string;
  statusVariant?: 'success' | 'warning' | 'destructive' | 'info' | 'default';
  icon: React.ReactNode;
  link: string;
  actionData?: {
    inventoryItem?: InventoryItem;
    rental?: Rental;
  };
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const { customers, inventory, rentals, repairs } = useRental();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [quickActionDialogOpen, setQuickActionDialogOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const results = useMemo<SearchResult[]>(() => {
    if (!searchTerm.trim()) return [];
    
    const term = searchTerm.toLowerCase();
    const searchResults: SearchResult[] = [];

    // Status labels and variants for inventory
    const inventoryStatusLabels: Record<string, string> = { 
      available: 'זמין', 
      rented: 'מושכר', 
      maintenance: 'בתחזוקה' 
    };
    const inventoryStatusVariants: Record<string, 'success' | 'info' | 'warning'> = { 
      available: 'success', 
      rented: 'info', 
      maintenance: 'warning' 
    };

    // Search customers
    customers.forEach(customer => {
      if (
        customer.name.toLowerCase().includes(term) ||
        customer.phone.includes(term) ||
        customer.email?.toLowerCase().includes(term)
      ) {
        searchResults.push({
          type: 'customer',
          id: customer.id,
          title: customer.name,
          subtitle: customer.phone,
          icon: <User className="h-4 w-4" />,
          link: '/customers',
        });
      }
    });

    // Search inventory with status
    inventory.forEach(item => {
      if (
        item.name.toLowerCase().includes(term) ||
        item.localNumber?.includes(term) ||
        item.israeliNumber?.includes(term) ||
        item.simNumber?.toLowerCase().includes(term) ||
        item.barcode?.toLowerCase().includes(term) ||
        categoryLabels[item.category].includes(term)
      ) {
        searchResults.push({
          type: 'inventory',
          id: item.id,
          title: item.name,
          subtitle: `${categoryIcons[item.category]} ${categoryLabels[item.category]}`,
          status: inventoryStatusLabels[item.status],
          statusVariant: inventoryStatusVariants[item.status],
          icon: <Package className="h-4 w-4" />,
          link: '/inventory',
          actionData: { inventoryItem: item },
        });
      }
    });

    // Search rentals
    rentals.forEach(rental => {
      if (
        rental.customerName.toLowerCase().includes(term) ||
        rental.items.some(i => i.itemName.toLowerCase().includes(term))
      ) {
        searchResults.push({
          type: 'rental',
          id: rental.id,
          title: rental.customerName,
          subtitle: rental.items.map(i => i.itemName).join(', '),
          icon: <ShoppingCart className="h-4 w-4" />,
          link: '/rentals',
        });
      }
    });

    // Search repairs
    repairs.forEach(repair => {
      if (
        repair.customerName.toLowerCase().includes(term) ||
        repair.customerPhone.includes(term) ||
        repair.repairNumber.includes(term) ||
        repair.deviceType.toLowerCase().includes(term) ||
        repair.problemDescription.toLowerCase().includes(term)
      ) {
        searchResults.push({
          type: 'repair',
          id: repair.id,
          title: `${repair.repairNumber} - ${repair.customerName}`,
          subtitle: `${repair.deviceType} • ${repairStatusLabels[repair.status]}`,
          icon: <Wrench className="h-4 w-4" />,
          link: '/repairs',
        });
      }
    });

    return searchResults.slice(0, 10);
  }, [searchTerm, customers, inventory, rentals, repairs]);

  const handleSelect = (result: SearchResult) => {
    // For inventory items, open quick action dialog
    if (result.type === 'inventory' && result.actionData?.inventoryItem) {
      setSelectedItem(result.actionData.inventoryItem);
      setQuickActionDialogOpen(true);
    } else {
      navigate(result.link);
      onClose();
    }
  };

  const handleEditItem = (item: InventoryItem) => {
    navigate('/inventory', { state: { editItem: item } });
    onClose();
  };

  const handleAddToRental = (item: InventoryItem) => {
    navigate('/rentals', { state: { addItemToRental: item } });
    onClose();
  };

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'customer': return 'לקוח';
      case 'inventory': return 'מלאי';
      case 'rental': return 'השכרה';
      case 'repair': return 'תיקון';
    }
  };

  const getTypeColor = (type: SearchResult['type']) => {
    switch (type) {
      case 'customer': return 'bg-blue-500/20 text-blue-600';
      case 'inventory': return 'bg-green-500/20 text-green-600';
      case 'rental': return 'bg-purple-500/20 text-purple-600';
      case 'repair': return 'bg-orange-500/20 text-orange-600';
    }
  };

  const getStatusBadgeClass = (variant?: string) => {
    switch (variant) {
      case 'success': return 'bg-success/20 text-success border-success/30';
      case 'info': return 'bg-primary/20 text-primary border-primary/30';
      case 'warning': return 'bg-warning/20 text-warning border-warning/30';
      case 'destructive': return 'bg-destructive/20 text-destructive border-destructive/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>חיפוש חכם</DialogTitle>
          </DialogHeader>
          
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="חפש לקוחות, מוצרים, השכרות, תיקונים, ברקודים..."
                className="pr-10 text-lg h-12"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto p-2">
            {!searchTerm.trim() ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>התחל להקליד כדי לחפש...</p>
                <p className="text-sm mt-1">חפש בלקוחות, מלאי, השכרות, תיקונים וברקודים</p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>לא נמצאו תוצאות עבור "{searchTerm}"</p>
              </div>
            ) : (
              <div className="space-y-1">
                {results.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelect(result)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-right"
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${getTypeColor(result.type)}`}>
                      {result.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{result.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{result.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.status && (
                        <Badge className={`${getStatusBadgeClass(result.statusVariant)} border text-xs`}>
                          {result.status}
                        </Badge>
                      )}
                      <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                        {getTypeLabel(result.type)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t bg-muted/30 flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-2 py-0.5 rounded bg-muted text-xs">↑↓</kbd>
                לניווט
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-2 py-0.5 rounded bg-muted text-xs">Enter</kbd>
                לבחירה
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-2 py-0.5 rounded bg-muted text-xs">Esc</kbd>
              לסגירה
            </span>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Action Dialog for inventory items */}
      <QuickActionDialog
        isOpen={quickActionDialogOpen}
        onClose={() => {
          setQuickActionDialogOpen(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
        onEdit={handleEditItem}
        onAddToRental={handleAddToRental}
      />
    </>
  );
}
