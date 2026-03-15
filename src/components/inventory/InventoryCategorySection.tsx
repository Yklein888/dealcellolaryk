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
    <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #F3F4F6', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      {/* Category Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: isExpanded ? '#F0FDFA' : '#FFFFFF',
          border: 'none',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
      >
        <div className="flex items-center gap-3">
          <span style={{ display: 'flex', width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: '#F0FDFA', fontSize: 20, flexShrink: 0 }}>{categoryIcons[category]}</span>
          <div className="text-right">
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>
              {categoryLabels[category]}
            </h3>
            <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
              {availableCount} זמינים מתוך {items.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 24, fontWeight: 800, color: '#0D9488' }}>{items.length}</span>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Items List */}
      {isExpanded && items.length > 0 && (
        <div style={{ borderTop: '1px solid #F3F4F6' }}>
          {items.map((item) => {
            const expired = isExpired(item);
            return (
              <div
                key={item.id}
                style={{ background: expired ? '#FFF1F2' : 'transparent' }}
                className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-teal-50/40 transition-colors`}
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
                    className="h-9 w-9 hover:bg-primary/10 hover:text-primary"
                    onClick={() => onEdit(item)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
