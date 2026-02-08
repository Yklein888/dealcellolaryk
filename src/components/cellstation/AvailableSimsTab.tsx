import { useState, useMemo } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Smartphone,
  Zap,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Calendar,
  Package,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { cn, normalizeForSearch } from '@/lib/utils';
import { SimCard } from '@/hooks/useCellstationSync';
import { Rental as SupabaseRental, InventoryItem } from '@/types/rental';

interface AvailableSimsTabProps {
  simCards: SimCard[];
  supabaseRentals: SupabaseRental[];
  supabaseInventory: InventoryItem[];
  isLoading: boolean;
  onActivate: (sim: SimCard) => void;
  onAddToInventory: (sim: SimCard) => Promise<void>;
}

export function AvailableSimsTab({
  simCards,
  supabaseRentals,
  supabaseInventory,
  isLoading,
  onActivate,
  onAddToInventory,
}: AvailableSimsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'expiry' | 'local_number'>('expiry');
  const [addingSimId, setAddingSimId] = useState<string | null>(null);

  // Get main system status for a SIM
  // IMPORTANT: After sync fix, sim_cards now correctly has:
  // - sim_cards.israeli_number = Israeli number (722587xxx)
  // - sim_cards.local_number = UK number (447429xxx)
  // In Supabase inventory:
  // - localNumber = UK number (447429xxx) - but stored with formats like 0722587xxx
  // - israeliNumber = Israeli number (722587xxx) - but stored with formats like 0722587xxx
  const getMainSystemStatus = (sim: SimCard): {
    status: 'not_found' | 'available' | 'rented' | 'overdue';
    isInInventory: boolean;
    rental?: SupabaseRental;
    customerName?: string;
    endDate?: string;
  } => {
    const simNorm = normalizeForSearch(sim.sim_number);
    const localNorm = normalizeForSearch(sim.local_number); // UK (447429xxx)
    const israeliNorm = normalizeForSearch(sim.israeli_number); // Israeli (722587xxx)
    
    // Try to find matching inventory item with normalized comparison
    const matchingItem = supabaseInventory.find(item => {
      const itemSimNorm = normalizeForSearch(item.simNumber);
      const itemLocalNorm = normalizeForSearch(item.localNumber);
      const itemIsraeliNorm = normalizeForSearch(item.israeliNumber);
      
      // Match by sim_number first (most reliable), then by phone numbers
      // Use includes for partial matching since formats vary
      if (simNorm && itemSimNorm && itemSimNorm === simNorm) return true;
      if (israeliNorm && itemIsraeliNorm && itemIsraeliNorm === israeliNorm) return true;
      if (localNorm && itemLocalNorm && itemLocalNorm === localNorm) return true;
      
      // Also check cross-matching (Israeli number in localNumber field due to old data)
      if (israeliNorm && itemLocalNorm && itemLocalNorm === israeliNorm) return true;
      
      return false;
    });

    if (!matchingItem) return { status: 'not_found', isInInventory: false };
    
    if (matchingItem.status === 'available') {
      return { status: 'available', isInInventory: true };
    }
    
    if (matchingItem.status === 'rented') {
      const activeRental = supabaseRentals.find(r => 
        r.status !== 'returned' &&
        r.items.some(item => item.inventoryItemId === matchingItem.id)
      );
      
      if (activeRental) {
        const isOverdue = activeRental.status === 'overdue' || 
          new Date(activeRental.endDate) < new Date();
        
        return {
          status: isOverdue ? 'overdue' : 'rented',
          isInInventory: true,
          rental: activeRental,
          customerName: activeRental.customerName,
          endDate: activeRental.endDate
        };
      }
    }
    
    return { status: 'available', isInInventory: true };
  };

  // Filter available SIMs (active, not rented in CellStation, valid expiry)
  const availableSims = useMemo(() => {
    const today = new Date();
    
    return simCards.filter(sim => {
      // Must be active in CellStation
      if (!sim.is_active) return false;
      
      // Must not be rented in CellStation
      if (sim.is_rented) return false;
      
      // Must have valid expiry (not expired)
      if (sim.expiry_date) {
        const expiryDate = parseISO(sim.expiry_date);
        if (expiryDate < today) return false;
      }
      
      // Check main system status - exclude if rented or overdue there
      const mainStatus = getMainSystemStatus(sim);
      if (mainStatus.status === 'rented' || mainStatus.status === 'overdue') {
        return false;
      }
      
      return true;
    });
  }, [simCards, supabaseInventory, supabaseRentals]);

  // Apply search and sort
  const filteredSims = useMemo(() => {
    let result = [...availableSims];
    
    if (searchTerm) {
      const searchNormalized = normalizeForSearch(searchTerm);
      result = result.filter(sim => {
        const localNorm = normalizeForSearch(sim.local_number);
        const israeliNorm = normalizeForSearch(sim.israeli_number);
        const simNorm = normalizeForSearch(sim.sim_number);
        
        return localNorm.includes(searchNormalized) ||
               israeliNorm.includes(searchNormalized) ||
               simNorm.includes(searchNormalized);
      });
    }
    
    result.sort((a, b) => {
      if (sortField === 'expiry') {
        if (!a.expiry_date) return 1;
        if (!b.expiry_date) return -1;
        return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
      } else {
        return (a.local_number || '').localeCompare(b.local_number || '');
      }
    });
    
    return result;
  }, [availableSims, searchTerm, sortField]);

  // Get expiry status
  const getExpiryStatus = (expiryDate: string | null): { color: string; text: string; daysLeft: number } => {
    if (!expiryDate) return { color: 'text-muted-foreground', text: 'לא ידוע', daysLeft: 999 };
    
    const today = new Date();
    const expiry = parseISO(expiryDate);
    const daysLeft = differenceInDays(expiry, today);
    
    if (daysLeft <= 7) {
      return { color: 'text-destructive', text: `${daysLeft} ימים`, daysLeft };
    } else if (daysLeft <= 30) {
      return { color: 'text-warning', text: `${daysLeft} ימים`, daysLeft };
    }
    return { color: 'text-success', text: `${daysLeft} ימים`, daysLeft };
  };

  const handleAddToInventory = async (sim: SimCard) => {
    setAddingSimId(sim.id);
    try {
      await onAddToInventory(sim);
    } finally {
      setAddingSimId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="🔍 חיפוש לפי מספר..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
        
        <Select value={sortField} onValueChange={(v) => setSortField(v as 'expiry' | 'local_number')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="מיון לפי" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="expiry">תוקף (הקרוב קודם)</SelectItem>
            <SelectItem value="local_number">מספר מקומי</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* SIM Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSims.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Smartphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>אין סימים זמינים להפעלה</p>
          <p className="text-sm mt-2">
            כל הסימים מושכרים, באיחור, או שפג תוקפם
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSims.map((sim) => {
            const mainStatus = getMainSystemStatus(sim);
            const expiryStatus = getExpiryStatus(sim.expiry_date);
            const isAdding = addingSimId === sim.id;
            
            return (
              <Card 
                key={sim.id} 
                className={cn(
                  "glass-card hover:shadow-lg transition-all duration-200",
                  expiryStatus.daysLeft <= 14 && "border-warning/50",
                  expiryStatus.daysLeft <= 7 && "border-destructive/50"
                )}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-success animate-pulse" />
                      <span className="font-mono font-bold">
                        {sim.local_number || sim.sim_number?.slice(-6) || 'N/A'}
                      </span>
                    </div>
                    {mainStatus.isInInventory && (
                      <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        במלאי
                      </Badge>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-24">🇮🇱 ישראלי:</span>
                      <span className="font-mono">{sim.israeli_number || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-24">📅 תוקף:</span>
                      <span className={cn("font-medium", expiryStatus.color)}>
                        {sim.expiry_date 
                          ? `${format(parseISO(sim.expiry_date), 'dd/MM/yyyy')} (${expiryStatus.text})`
                          : 'לא ידוע'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-24">📦 חבילה:</span>
                      <span>{sim.package_name || '-'}</span>
                    </div>
                  </div>

                  {/* Status badges */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                    <Badge className="bg-success/20 text-success border-success/30">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      זמין
                    </Badge>
                    {!mainStatus.isInInventory && (
                      <Badge variant="outline" className="text-muted-foreground">
                        לא במלאי
                      </Badge>
                    )}
                    {expiryStatus.daysLeft <= 14 && (
                      <Badge variant="outline" className={expiryStatus.color}>
                        <Clock className="h-3 w-3 mr-1" />
                        {expiryStatus.text}
                      </Badge>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      className="flex-1 gap-2"
                      onClick={() => onActivate(sim)}
                    >
                      <Zap className="h-4 w-4" />
                      הפעל והשכר
                    </Button>
                    {!mainStatus.isInInventory && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleAddToInventory(sim)}
                        disabled={isAdding}
                        title="הוסף למלאי"
                      >
                        {isAdding ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
