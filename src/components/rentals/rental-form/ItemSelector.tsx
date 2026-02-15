import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, Package, PackagePlus, Plus, Check, AlertTriangle, XCircle } from 'lucide-react';
import { ItemCategory, InventoryItem, categoryLabels, categoryIcons } from '@/types/rental';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, parseISO, isBefore } from 'date-fns';
import { SelectedItem, categoryColors, isSim } from './types';

type SimValidity = 'valid' | 'warning' | 'expired';

function checkSimValidity(item: InventoryItem, endDate: Date | undefined): SimValidity {
  if (!isSim(item.category)) return 'valid';
  if (!item.expiryDate) return 'valid';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = parseISO(item.expiryDate);
  if (isBefore(expiry, today)) return 'expired';
  if (!endDate) return 'valid';
  if (isBefore(expiry, endDate)) return 'warning';
  return 'valid';
}

interface ItemSelectorProps {
  availableItems: InventoryItem[];
  selectedItems: SelectedItem[];
  endDate: Date | undefined;
  onAddItem: (item: InventoryItem) => void;
  onAddGenericItem: (category: ItemCategory) => void;
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

export function ItemSelector({
  availableItems,
  selectedItems,
  endDate,
  onAddItem,
  onAddGenericItem,
  onAddInventoryItem,
}: ItemSelectorProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddData, setQuickAddData] = useState({
    category: 'sim_european' as ItemCategory,
    name: '',
    localNumber: '',
    israeliNumber: '',
    expiryDate: '',
    simNumber: '',
  });

  const filtered = availableItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      categoryLabels[item.category].includes(searchTerm);
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aStatus = checkSimValidity(a, endDate);
    const bStatus = checkSimValidity(b, endDate);
    const order = { valid: 0, warning: 1, expired: 2 };
    return order[aStatus] - order[bStatus];
  });

  const handleQuickAdd = () => {
    if (!quickAddData.name) {
      toast({ title: 'שגיאה', description: 'יש להזין שם לפריט', variant: 'destructive' });
      return;
    }
    if (isSim(quickAddData.category) && !quickAddData.simNumber) {
      toast({ title: 'שגיאה', description: 'יש להזין מספר סים (ICCID) לפריט מסוג סים', variant: 'destructive' });
      return;
    }
    onAddInventoryItem({
      category: quickAddData.category,
      name: quickAddData.name,
      localNumber: quickAddData.localNumber || undefined,
      israeliNumber: quickAddData.israeliNumber || undefined,
      expiryDate: quickAddData.expiryDate || undefined,
      simNumber: quickAddData.simNumber || undefined,
      status: 'available',
    });
    toast({ title: 'פריט נוסף למלאי', description: `${quickAddData.name} נוסף למלאי` });
    setQuickAddData({ category: 'sim_european', name: '', localNumber: '', israeliNumber: '', expiryDate: '', simNumber: '' });
    setIsQuickAddOpen(false);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Quick Add Simple Device */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm sm:text-base font-semibold">
            📱 הוסף מכשיר פשוט
          </Label>
          <div className="p-3 sm:p-4 rounded-xl border-2 border-dashed border-green-400/40 bg-gradient-to-br from-green-100/50 to-green-50/30 dark:from-green-950/30 dark:to-green-900/20">
            <button
              type="button"
              onClick={() => onAddGenericItem('device_simple')}
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

        {/* Info */}
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
            <span>⚠️</span>
            <span>סימים, סמארטפונים, מודמים ונטסטיקים חייבים להיבחר מהמלאי. רק מכשיר פשוט ניתן להוסיף ללא מלאי.</span>
          </p>
        </div>

        {/* Inventory Items Grid */}
        <div className="space-y-3 p-4 sm:p-5 rounded-xl sm:rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label className="flex items-center gap-2 text-sm sm:text-base font-semibold">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              בחר מהמלאי
            </Label>
            <Button variant="outline" size="sm" onClick={() => setIsQuickAddOpen(true)} className="gap-1">
              <PackagePlus className="h-4 w-4" />
              הוסף למלאי
            </Button>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            <Button variant={categoryFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setCategoryFilter('all')} className="h-8">
              הכל
            </Button>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <Button
                key={key}
                variant={categoryFilter === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoryFilter(key)}
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
            <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="חפש פריט..." className="pr-10" />
          </div>

          {/* Grid */}
          <div className="max-h-[300px] sm:max-h-[500px] overflow-y-auto space-y-4">
            {sorted.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">
                  {availableItems.length === 0 ? 'אין פריטים זמינים במלאי' : 'לא נמצאו פריטים'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {sorted.map((item) => {
                  const isSelected = selectedItems.some(i => i.inventoryItemId === item.id);
                  const colors = categoryColors[item.category];
                  const validity = checkSimValidity(item, endDate);
                  const isExpired = validity === 'expired';

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onAddItem(item)}
                      disabled={isSelected}
                      className={cn(
                        "relative flex flex-col items-center gap-1 sm:gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all text-center",
                        colors.bg,
                        isExpired
                          ? "opacity-75 border-amber-400/50 cursor-pointer hover:border-amber-500"
                          : isSelected
                            ? "border-green-500 ring-2 ring-green-500/30 cursor-default"
                            : validity === 'warning'
                              ? cn(colors.border, "ring-2 ring-amber-400/50 hover:border-amber-400", "cursor-pointer hover:scale-[1.02]")
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
                      {isSim(item.category) && item.simNumber && (
                        <p className="text-[10px] text-muted-foreground/70 font-mono truncate max-w-full">
                          📱 {item.simNumber}
                        </p>
                      )}
                      {isSim(item.category) && item.expiryDate && (
                        <div className={cn(
                          "text-[10px] flex items-center gap-1",
                          validity === 'warning' && "text-amber-600 dark:text-amber-400",
                          validity === 'expired' && "text-destructive"
                        )}>
                          {validity === 'warning' && <AlertTriangle className="h-3 w-3" />}
                          {validity === 'expired' && <XCircle className="h-3 w-3" />}
                          <span>תוקף: {format(parseISO(item.expiryDate), 'dd/MM/yy')}</span>
                          {validity === 'warning' && <span className="font-medium">(פג באמצע!)</span>}
                          {validity === 'expired' && <span className="font-medium">(פג תוקף)</span>}
                        </div>
                      )}
                      {(item.israeliNumber || item.localNumber) && (
                        <div className="text-xs space-y-0.5">
                          {item.israeliNumber && <p className="text-primary">🇮🇱 {item.israeliNumber}</p>}
                          {item.localNumber && <p className="text-muted-foreground">📞 {item.localNumber}</p>}
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

      {/* Quick Add Inventory Dialog */}
      <Dialog open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>הוספה מהירה למלאי</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>קטגוריה</Label>
              <Select value={quickAddData.category} onValueChange={(v: ItemCategory) => setQuickAddData({ ...quickAddData, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{categoryIcons[key as ItemCategory]} {label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>שם הפריט</Label>
              <Input value={quickAddData.name} onChange={(e) => setQuickAddData({ ...quickAddData, name: e.target.value })} placeholder="לדוגמה: סים אירופאי #002" />
            </div>
            {isSim(quickAddData.category) && (
              <>
                <div className="space-y-2">
                  <Label>מספר סים (ICCID) <span className="text-destructive">*</span></Label>
                  <Input value={quickAddData.simNumber} onChange={(e) => setQuickAddData({ ...quickAddData, simNumber: e.target.value })} placeholder="89972..." />
                </div>
                <div className="space-y-2">
                  <Label>מספר מקומי</Label>
                  <Input value={quickAddData.localNumber} onChange={(e) => setQuickAddData({ ...quickAddData, localNumber: e.target.value })} placeholder={quickAddData.category === 'sim_american' ? "+1-555-123-4567" : "+44-7700-900123"} />
                </div>
                <div className="space-y-2">
                  <Label>מספר ישראלי</Label>
                  <Input value={quickAddData.israeliNumber} onChange={(e) => setQuickAddData({ ...quickAddData, israeliNumber: e.target.value })} placeholder="050-0001111" />
                </div>
                <div className="space-y-2">
                  <Label>תוקף</Label>
                  <Input type="date" value={quickAddData.expiryDate} onChange={(e) => setQuickAddData({ ...quickAddData, expiryDate: e.target.value })} />
                </div>
              </>
            )}
            <Button onClick={handleQuickAdd} className="w-full">הוסף למלאי</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
