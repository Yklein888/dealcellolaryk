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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search,
  Package,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { cn, normalizeForSearch } from '@/lib/utils';
import { SimCard } from '@/hooks/useCellstationSync';
import { Rental as SupabaseRental, InventoryItem } from '@/types/rental';

interface AllSimsTabProps {
  simCards: SimCard[];
  supabaseRentals: SupabaseRental[];
  supabaseInventory: InventoryItem[];
  isLoading: boolean;
}

// Format local number - add leading 0 if missing (for 07xxx numbers)
const formatLocalNumber = (num: string | number | null | undefined): string => {
  if (num === null || num === undefined || num === '') return '-';
  const str = String(num);
  const cleaned = str.replace(/\D/g, '');
  if (cleaned.startsWith('7') && cleaned.length === 9) {
    return '0' + cleaned;
  }
  if (cleaned.startsWith('07')) {
    return cleaned;
  }
  return cleaned.startsWith('0') ? cleaned : '0' + cleaned;
};

type StatusFilter = 'all' | 'available' | 'rented' | 'overdue' | 'expired' | 'unsynced';

export function AllSimsTab({
  simCards,
  supabaseRentals,
  supabaseInventory,
  isLoading,
}: AllSimsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Get comprehensive status for a SIM
  const getSimStatus = (sim: SimCard): {
    status: 'available' | 'rented' | 'overdue' | 'expired' | 'unsynced' | 'not_in_inventory';
    isInInventory: boolean;
    rental?: SupabaseRental;
    customerName?: string;
    endDate?: string;
    inventoryItem?: InventoryItem;
  } => {
    const today = new Date();
    
    // Check if expired
    if (!sim.is_active) {
      return { status: 'expired', isInInventory: false };
    }
    
    if (sim.expiry_date) {
      const expiryDate = parseISO(sim.expiry_date);
      if (expiryDate < today) {
        return { status: 'expired', isInInventory: false };
      }
    }

    // Find matching inventory item
    const simNorm = normalizeForSearch(sim.sim_number);
    const localNorm = normalizeForSearch(sim.local_number);
    const israeliNorm = normalizeForSearch(sim.israeli_number);
    
    const matchingItem = supabaseInventory.find(item => {
      const itemSimNorm = normalizeForSearch(item.simNumber);
      const itemLocalNorm = normalizeForSearch(item.localNumber);
      const itemIsraeliNorm = normalizeForSearch(item.israeliNumber);
      
      return (simNorm && itemSimNorm === simNorm) ||
             (localNorm && itemLocalNorm === localNorm) ||
             (israeliNorm && itemIsraeliNorm === israeliNorm);
    });

    if (!matchingItem) {
      // Not in main inventory
      if (sim.is_rented) {
        return { status: 'unsynced', isInInventory: false };
      }
      return { status: 'not_in_inventory', isInInventory: false };
    }

    // Find active rental
    const activeRental = supabaseRentals.find(r =>
      r.status !== 'returned' &&
      r.items.some(item => item.inventoryItemId === matchingItem.id)
    );

    if (activeRental) {
      const isOverdue = activeRental.status === 'overdue' || 
        new Date(activeRental.endDate) < today;
      
      return {
        status: isOverdue ? 'overdue' : 'rented',
        isInInventory: true,
        rental: activeRental,
        customerName: activeRental.customerName,
        endDate: activeRental.endDate,
        inventoryItem: matchingItem,
      };
    }

    // Check for mismatch: CellStation says rented but inventory is available
    if (sim.is_rented && matchingItem.status === 'available') {
      return { status: 'unsynced', isInInventory: true, inventoryItem: matchingItem };
    }

    return { status: 'available', isInInventory: true, inventoryItem: matchingItem };
  };

  // Apply filters
  const filteredSims = useMemo(() => {
    let result = [...simCards];
    
    // Search filter
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
    
    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(sim => {
        const status = getSimStatus(sim);
        if (statusFilter === 'unsynced') {
          return status.status === 'unsynced' || status.status === 'not_in_inventory';
        }
        return status.status === statusFilter;
      });
    }
    
    // Sort by status priority, then by local number
    result.sort((a, b) => {
      const statusA = getSimStatus(a);
      const statusB = getSimStatus(b);
      
      const priority: Record<string, number> = {
        'overdue': 0,
        'unsynced': 1,
        'not_in_inventory': 2,
        'rented': 3,
        'available': 4,
        'expired': 5,
      };
      
      const priorityA = priority[statusA.status] ?? 99;
      const priorityB = priority[statusB.status] ?? 99;
      
      if (priorityA !== priorityB) return priorityA - priorityB;
      return (a.local_number || '').localeCompare(b.local_number || '');
    });
    
    return result;
  }, [simCards, searchTerm, statusFilter, supabaseInventory, supabaseRentals]);

  // Get status badge
  const getStatusBadge = (status: ReturnType<typeof getSimStatus>) => {
    switch (status.status) {
      case 'available':
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            זמין
          </Badge>
        );
      case 'rented':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="default" className="gap-1 cursor-help">
                  <Package className="h-3 w-3" />
                  מושכר
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm">
                  <div>לקוח: {status.customerName}</div>
                  <div>עד: {status.endDate ? format(parseISO(status.endDate), 'dd/MM/yyyy') : '-'}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case 'overdue':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            באיחור!
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <XCircle className="h-3 w-3" />
            לא בתוקף
          </Badge>
        );
      case 'unsynced':
        return (
          <Badge variant="warning" className="gap-1">
            <RefreshCw className="h-3 w-3" />
            לא מסונכרן
          </Badge>
        );
      case 'not_in_inventory':
        return (
          <Badge variant="outline" className="gap-1">
            לא במלאי
          </Badge>
        );
    }
  };

  // Count stats
  const stats = useMemo(() => {
    const counts = {
      available: 0,
      rented: 0,
      overdue: 0,
      expired: 0,
      unsynced: 0,
    };
    
    simCards.forEach(sim => {
      const status = getSimStatus(sim);
      if (status.status === 'not_in_inventory') {
        counts.unsynced++;
      } else if (counts[status.status as keyof typeof counts] !== undefined) {
        counts[status.status as keyof typeof counts]++;
      }
    });
    
    return counts;
  }, [simCards, supabaseInventory, supabaseRentals]);

  return (
    <Card className="glass-card">
      <CardContent className="pt-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="🔍 חיפוש לפי מספר..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="סינון לפי סטטוס" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">הכל ({simCards.length})</SelectItem>
              <SelectItem value="available">זמין ({stats.available})</SelectItem>
              <SelectItem value="rented">מושכר ({stats.rented})</SelectItem>
              <SelectItem value="overdue">באיחור ({stats.overdue})</SelectItem>
              <SelectItem value="expired">לא בתוקף ({stats.expired})</SelectItem>
              <SelectItem value="unsynced">לא מסונכרן ({stats.unsynced})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="outline" className="gap-1">
            סה"כ: {simCards.length}
          </Badge>
          {stats.overdue > 0 && (
            <Badge variant="destructive" className="gap-1">
              באיחור: {stats.overdue}
            </Badge>
          )}
          {stats.unsynced > 0 && (
            <Badge variant="warning" className="gap-1">
              לא מסונכרן: {stats.unsynced}
            </Badge>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSims.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>אין סימים להצגה</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="w-full text-right" dir="rtl">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">מספר מקומי</TableHead>
                  <TableHead className="text-right">מספר ישראלי</TableHead>
                  <TableHead className="text-right">ICCID</TableHead>
                  <TableHead className="text-right">חבילה</TableHead>
                  <TableHead className="text-right">תוקף</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-right">במלאי</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSims.map((sim) => {
                  const status = getSimStatus(sim);
                  const isProblematic = status.status === 'overdue' || status.status === 'unsynced';
                  
                  return (
                    <TableRow 
                      key={sim.id}
                      className={cn(
                        "hover:bg-muted/30",
                        isProblematic && "bg-destructive/5 border-r-2 border-r-destructive"
                      )}
                    >
                      <TableCell className="font-mono">
                        {formatLocalNumber(sim.local_number)}
                      </TableCell>
                      <TableCell className="font-mono">
                        {sim.israeli_number || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {sim.sim_number?.slice(-8) || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {sim.package_name || '-'}
                      </TableCell>
                      <TableCell>
                        {sim.expiry_date ? (
                          <span className={cn(
                            "text-sm",
                            differenceInDays(parseISO(sim.expiry_date), new Date()) <= 7 && "text-destructive",
                            differenceInDays(parseISO(sim.expiry_date), new Date()) <= 30 && differenceInDays(parseISO(sim.expiry_date), new Date()) > 7 && "text-warning"
                          )}>
                            {format(parseISO(sim.expiry_date), 'dd/MM/yyyy')}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(status)}
                      </TableCell>
                      <TableCell>
                        {status.isInInventory ? (
                          <CheckCircle className="h-4 w-4 text-success" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
