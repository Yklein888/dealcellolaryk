import { ChevronDown, ChevronUp, Edit2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { InventoryItem, ItemCategory, categoryLabels, categoryIcons } from '@/types/rental';
import { parseISO, isAfter } from 'date-fns';

interface InventoryCategorySectionProps {
  category: ItemCategory;
  items: InventoryItem[];
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
}

const statusLabels: Record<InventoryItem['status'], string> = {
  available: 'זמין',
  rented: 'מושכר',
  maintenance: 'בתחזוקה',
};

const getStatusVariant = (status: InventoryItem['status']) => {
  switch (status) {
    case 'available': return 'success';
    case 'rented': return 'info';
    case 'maintenance': return 'warning';
    default: return 'default';
  }
};

const isSim = (category: ItemCategory) => 
  category === 'sim_american' || category === 'sim_european';

// Check if SIM is expired
const isExpired = (item: InventoryItem): boolean => {
  if (!isSim(item.category) || !item.expiryDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = parseISO(item.expiryDate);
  return !isAfter(expiryDate, today) && expiryDate.getTime() !== today.getTime();
};

export function InventoryCategorySection({ 
  category, 
  items, 
  onEdit, 
  onDelete 
}: InventoryCategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const availableCount = items.filter(i => {
    if (i.status !== 'available') return false;
    if (isSim(i.category) && i.expiryDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiryDate = parseISO(i.expiryDate);
      return isAfter(expiryDate, today) || expiryDate.getTime() === today.getTime();
    }
    return true;
  }).length;

  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
      {/* Category Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-4 py-4 hover:bg-muted/50 transition-colors ${isExpanded ? 'bg-gradient-to-l from-primary/5 to-accent/5' : ''}`}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 text-xl shrink-0">{categoryIcons[category]}</span>
          <div className="text-right">
            <h3 className="text-lg font-semibold text-foreground">
              {categoryLabels[category]}
            </h3>
            <p className="text-sm text-muted-foreground">
              {availableCount} זמינים מתוך {items.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-extrabold bg-gradient-to-l from-primary to-accent bg-clip-text text-transparent">{items.length}</span>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Items List */}
      {isExpanded && items.length > 0 && (
        <div className="border-t border-border">
          {items.map((item, index) => {
            const expired = isExpired(item);
            return (
              <div 
                key={item.id}
                className={`flex items-center gap-3 px-4 py-3 border-b border-border/60 last:border-b-0 hover:bg-primary/5 transition-colors ${expired ? 'bg-destructive/5' : ''}`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground text-sm">{item.name}</p>
                      {expired && (
                        <span className="text-xs text-destructive font-medium">(פג תוקף)</span>
                      )}
                    </div>
                    {isSim(item.category) && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                        {item.localNumber && <span>מקומי: {item.localNumber}</span>}
                        {item.israeliNumber && <span>ישראלי: {item.israeliNumber}</span>}
                        {item.expiryDate && (
                          <span className={expired ? 'text-destructive' : ''}>
                            תוקף: {item.expiryDate}
                          </span>
                        )}
                        {item.simNumber && <span>סים: {item.simNumber}</span>}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {expired ? (
                    <StatusBadge status="פג תוקף" variant="destructive" />
                  ) : (
                    <StatusBadge 
                      status={statusLabels[item.status]} 
                      variant={getStatusVariant(item.status)} 
                    />
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(item)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => onDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {isExpanded && items.length === 0 && (
        <div className="p-6 text-center text-muted-foreground border-t border-border">
          אין פריטים בקטגוריה זו
        </div>
      )}
    </div>
  );
}
