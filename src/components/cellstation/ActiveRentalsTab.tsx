import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  AlertTriangle,
  CheckCircle,
  ArrowLeftRight,
  Loader2,
  Info,
  ChevronUp,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { cn, normalizeForSearch } from '@/lib/utils';
import { Rental as SupabaseRental, InventoryItem } from '@/types/rental';

interface CellStationRental {
  rental_id: string;
  id: string;
  sim: string;
  local_number: string;
  israel_number: string;
  plan: string;
  start_date: string;
  end_date: string;
  days: string;
  customer_name: string;
  customer_phone: string;
  status: string;
}

interface ActiveRentalsTabProps {
  rentals: CellStationRental[];
  supabaseRentals: SupabaseRental[];
  supabaseInventory: InventoryItem[];
  isLoading: boolean;
  onReplaceSim: (rental: CellStationRental) => void;
}

// Format phone number - add leading 0 if missing
const formatPhone = (phone: string | number | null | undefined): string => {
  if (phone === null || phone === undefined || phone === '') return '';
  const str = String(phone);
  const cleaned = str.replace(/\D/g, '');
  if (cleaned.length === 9 && !cleaned.startsWith('0')) {
    return '0' + cleaned;
  }
  return cleaned.startsWith('0') ? cleaned : '0' + cleaned;
};

// Format local number - add leading 0 if missing (for 07xxx numbers)
const formatLocalNumber = (num: string | number | null | undefined): string => {
  if (num === null || num === undefined || num === '') return '';
  const str = String(num);
  const cleaned = str.replace(/\D/g, '');
  if (cleaned.startsWith('7') && cleaned.length === 9) {
    return '0' + cleaned;
  }
  if (cleaned.startsWith('07')) {
    return cleaned;
  }
  return '0' + cleaned;
};

// Format ISO date to DD/MM/YYYY
const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export function ActiveRentalsTab({
  rentals,
  supabaseRentals,
  supabaseInventory,
  isLoading,
  onReplaceSim,
}: ActiveRentalsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRentalIds, setExpandedRentalIds] = useState<Set<string>>(new Set());

  const toggleRentalExpanded = (rentalId: string) => {
    setExpandedRentalIds(prev => {
      const next = new Set(prev);
      if (next.has(rentalId)) {
        next.delete(rentalId);
      } else {
        next.add(rentalId);
      }
      return next;
    });
  };

  // Get main system rental info for a SIM
  // IMPORTANT: CellStation field mapping is SWAPPED:
  // - CellStation local_number = Israeli number (722587xxx)
  // - CellStation israel_number = UK/local number (447429xxx)
  // While in Supabase inventory:
  // - localNumber = UK number (447429xxx)
  // - israeliNumber = Israeli number (722587xxx)
  const getMainSystemInfo = (
    csLocalNumber: string | null, // CellStation's local_number = Israeli number
    csIsraelNumber: string | null, // CellStation's israel_number = UK number
    simNumber: string | null
  ): {
    status: 'not_found' | 'available' | 'rented' | 'overdue' | 'returned';
    rental?: SupabaseRental;
    customerName?: string;
    endDate?: string;
  } => {
    if (!csLocalNumber && !csIsraelNumber && !simNumber) return { status: 'not_found' };
    
    // Normalize all search values
    const israeliNumNorm = normalizeForSearch(csLocalNumber); // Israeli (722587xxx)
    const localNumNorm = normalizeForSearch(csIsraelNumber); // UK (447429xxx)
    const simNorm = normalizeForSearch(simNumber);
    
    // Find matching inventory item with correct field mapping
    const matchingItem = supabaseInventory.find(item => {
      const itemLocalNorm = normalizeForSearch(item.localNumber); // UK in inventory
      const itemIsraeliNorm = normalizeForSearch(item.israeliNumber); // Israeli in inventory
      const itemSimNorm = normalizeForSearch(item.simNumber);
      
      // Match: CS israeli (local_number) → inventory israeliNumber
      // Match: CS UK (israel_number) → inventory localNumber
      // Match: sim_number → simNumber
      return (simNorm && itemSimNorm === simNorm) ||
             (israeliNumNorm && itemIsraeliNorm === israeliNumNorm) ||
             (localNumNorm && itemLocalNorm === localNumNorm);
    });

    if (!matchingItem) return { status: 'not_found' };
    
    if (matchingItem.status === 'available') return { status: 'returned' };
    
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
          rental: activeRental,
          customerName: activeRental.customerName,
          endDate: activeRental.endDate
        };
      }
    }
    
    return { status: 'available' };
  };

  // Filter rentals with smart search
  const filteredRentals = useMemo(() => {
    if (!searchTerm) return rentals;
    
    const searchNormalized = normalizeForSearch(searchTerm);
    const searchLower = searchTerm.toLowerCase();
    
    return rentals.filter(r => {
      const localNormalized = normalizeForSearch(r.local_number);
      const phoneNormalized = normalizeForSearch(r.customer_phone);
      const simNormalized = normalizeForSearch(r.sim);
      
      return (
        r.customer_name?.toLowerCase().includes(searchLower) ||
        localNormalized.includes(searchNormalized) ||
        phoneNormalized.includes(searchNormalized) ||
        simNormalized.includes(searchNormalized)
      );
    });
  }, [rentals, searchTerm]);

  // Get status variant
  const getStatusVariant = (status: string): 'default' | 'destructive' | 'warning' | 'success' => {
    if (status === 'הסתיים' || status === 'ended') return 'destructive';
    if (status === 'מסתיים היום!' || status.includes('היום')) return 'warning';
    if (status === 'מסתיים מחר' || status.includes('מחר')) return 'warning';
    return 'success';
  };

  return (
    <Card className="glass-card">
      <CardContent className="pt-6">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="🔍 חיפוש לפי שם לקוח, טלפון או מספר..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredRentals.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>אין השכרות פעילות להצגה</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="w-full text-right" dir="rtl">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right w-8"></TableHead>
                  <TableHead className="text-right">לקוח</TableHead>
                  <TableHead className="text-right">טלפון</TableHead>
                  <TableHead className="text-right">מספר מקומי</TableHead>
                  <TableHead className="text-right">סיום</TableHead>
                  <TableHead className="text-right">סטטוס CellStation</TableHead>
                  <TableHead className="text-right">סטטוס מערכת</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRentals.map((rental, idx) => {
                  const rentalId = rental.rental_id || `${idx}`;
                  const isExpanded = expandedRentalIds.has(rentalId);
                  // Pass all three identifiers for proper matching:
                  // rental.local_number = Israeli (722587xxx)
                  // rental.israel_number = UK (447429xxx)
                  // rental.sim = ICCID
                  const mainSystemInfo = getMainSystemInfo(
                    rental.local_number,
                    rental.israel_number,
                    rental.sim
                  );
                  const needsReplacement = mainSystemInfo.status === 'overdue';
                  
                  return (
                    <>
                      <TableRow 
                        key={idx} 
                        className={cn(
                          "hover:bg-muted/30",
                          needsReplacement && "bg-destructive/5 border-r-2 border-r-destructive"
                        )}
                      >
                        <TableCell className="p-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => toggleRentalExpanded(rentalId)}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <Info className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{rental.customer_name}</TableCell>
                        <TableCell>{formatPhone(rental.customer_phone)}</TableCell>
                        <TableCell className="font-mono text-sm">{formatLocalNumber(rental.local_number)}</TableCell>
                        <TableCell>{formatDate(rental.end_date)}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(rental.status)}>
                            {rental.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {mainSystemInfo.status === 'not_found' && (
                            <Badge variant="outline" className="text-muted-foreground">
                              לא במערכת
                            </Badge>
                          )}
                          {mainSystemInfo.status === 'returned' && (
                            <Badge className="bg-success/20 text-success border-success/30 gap-1">
                              <CheckCircle className="h-3 w-3" />
                              הוחזר
                            </Badge>
                          )}
                          {mainSystemInfo.status === 'available' && (
                            <Badge className="bg-success/20 text-success border-success/30 gap-1">
                              <CheckCircle className="h-3 w-3" />
                              זמין
                            </Badge>
                          )}
                          {mainSystemInfo.status === 'rented' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge className="bg-primary/20 text-primary border-primary/30 gap-1 cursor-help">
                                    📱 מושכר
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-sm">
                                    <div>לקוח: {mainSystemInfo.customerName}</div>
                                    <div>עד: {mainSystemInfo.endDate ? formatDate(mainSystemInfo.endDate) : '-'}</div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {mainSystemInfo.status === 'overdue' && (
                            <div className="flex flex-col gap-1">
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                באיחור!
                              </Badge>
                              <span className="text-xs text-destructive">
                                ⚠️ לא הוחזר - נדרשת החלפה
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {needsReplacement && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => onReplaceSim(rental)}
                                className="gap-1"
                              >
                                <ArrowLeftRight className="h-3 w-3" />
                                החלף סים
                              </Button>
                            )}
                            {mainSystemInfo.rental && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="gap-1"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>צפה בהשכרה במערכת הראשית</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Expanded details row */}
                      {isExpanded && (
                        <TableRow className="bg-muted/20">
                          <TableCell colSpan={8} className="p-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground block">📅 תאריך התחלה</span>
                                <span>{formatDate(rental.start_date)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">📱 ICCID</span>
                                <span className="font-mono text-xs">{rental.sim}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">🇮🇱 מספר ישראלי</span>
                                <span className="font-mono">{rental.israel_number || 'אין'}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">📦 חבילה</span>
                                <span>{rental.plan}</span>
                              </div>
                            </div>
                            
                            {mainSystemInfo.status === 'overdue' && mainSystemInfo.rental && (
                              <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                                <div className="flex items-center gap-2 mb-2">
                                  <AlertTriangle className="h-4 w-4 text-destructive" />
                                  <span className="font-medium text-destructive">
                                    ⚠️ הסים לא הוחזר במערכת הראשית!
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  הלקוח {mainSystemInfo.customerName} לא החזיר את הסים בתאריך {formatDate(mainSystemInfo.endDate || '')}.
                                  <br />
                                  <strong>יש לבצע החלפת סים כדי להמשיך להשכיר את הקו הזה.</strong>
                                </p>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
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
