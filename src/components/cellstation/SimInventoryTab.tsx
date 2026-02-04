import { useState, useMemo } from 'react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Smartphone, Plus, Check, RefreshCw, Zap, Printer } from 'lucide-react';
import { SimCard } from '@/hooks/useCellstationSync';
import { InventoryItem, ItemCategory } from '@/types/rental';
import { useToast } from '@/hooks/use-toast';
import { printCallingInstructions } from '@/lib/callingInstructions';

type FilterStatus = 'all' | 'active' | 'inactive' | 'available';
type SortField = 'expiry_date' | 'local_number' | 'status';

interface SimInventoryTabProps {
  simCards: SimCard[];
  isLoading: boolean;
  inventory: InventoryItem[];
  onActivate: (sim: SimCard) => void;
  onAddToInventory: (item: Omit<InventoryItem, 'id'>) => Promise<void>;
}

export function SimInventoryTab({ 
  simCards, 
  isLoading, 
  inventory, 
  onActivate,
  onAddToInventory 
}: SimInventoryTabProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortField, setSortField] = useState<SortField>('expiry_date');
  const [addingSimId, setAddingSimId] = useState<string | null>(null);
  const [printingSimId, setPrintingSimId] = useState<string | null>(null);

  const isSimInInventory = (simNumber: string | null): boolean => {
    if (!simNumber) return false;
    return inventory.some(item => item.simNumber === simNumber);
  };

  const filteredAndSortedSims = useMemo(() => {
    let result = [...simCards];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(sim =>
        sim.local_number?.toLowerCase().includes(query) ||
        sim.israeli_number?.toLowerCase().includes(query) ||
        sim.sim_number?.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (filterStatus !== 'all') {
      if (filterStatus === 'active') {
        result = result.filter(sim => sim.is_active === true);
      } else if (filterStatus === 'inactive') {
        result = result.filter(sim => sim.is_active === false);
      } else if (filterStatus === 'available') {
        result = result.filter(sim => sim.is_active && !sim.is_rented && !isSimInInventory(sim.sim_number));
      }
    }

    // Sort
    result.sort((a, b) => {
      if (sortField === 'expiry_date') {
        if (!a.expiry_date) return 1;
        if (!b.expiry_date) return -1;
        return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
      } else if (sortField === 'local_number') {
        return (a.local_number || '').localeCompare(b.local_number || '');
      } else if (sortField === 'status') {
        return (a.status || '').localeCompare(b.status || '');
      }
      return 0;
    });

    return result;
  }, [simCards, searchQuery, filterStatus, sortField, inventory]);

  const getExpiryInfo = (expiryDate: string | null, isActive?: boolean): { color: string; badge?: string } => {
    if (isActive === false) return { color: 'text-destructive bg-destructive/10', badge: '⛔ לא פעיל' };
    if (!expiryDate) return { color: '' };
    
    const today = new Date();
    const expiry = parseISO(expiryDate);
    const daysUntilExpiry = differenceInDays(expiry, today);
    
    if (daysUntilExpiry < 0) return { color: 'text-destructive bg-destructive/10', badge: '⛔ פג תוקף' };
    if (daysUntilExpiry <= 7) return { color: 'text-destructive bg-destructive/10', badge: `⚠️ ${daysUntilExpiry} ימים` };
    if (daysUntilExpiry <= 30) return { color: 'text-warning bg-warning/10', badge: `⏰ ${daysUntilExpiry} ימים` };
    return { color: '' };
  };

  const handleAddToInventory = async (sim: SimCard) => {
    if (!sim.sim_number) {
      toast({
        title: 'שגיאה',
        description: 'לסים זה אין מספר ICCID',
        variant: 'destructive',
      });
      return;
    }

    setAddingSimId(sim.id);
    try {
      await onAddToInventory({
        category: 'sim_european' as ItemCategory,
        name: `סים ${sim.local_number || sim.sim_number}`,
        localNumber: sim.local_number || undefined,
        israeliNumber: sim.israeli_number || undefined,
        expiryDate: sim.expiry_date || undefined,
        simNumber: sim.sim_number,
        status: 'available',
        notes: sim.package_name ? `חבילה: ${sim.package_name}` : undefined,
      });

      toast({
        title: 'נוסף למלאי',
        description: `הסים ${sim.local_number || sim.sim_number} נוסף בהצלחה`,
      });
    } catch (error) {
      console.error('Error adding SIM to inventory:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן להוסיף את הסים למלאי',
        variant: 'destructive',
      });
    } finally {
      setAddingSimId(null);
    }
  };

  const handlePrintInstructions = async (sim: SimCard) => {
    setPrintingSimId(sim.id);
    try {
      const inventoryItem = inventory.find(i => i.simNumber === sim.sim_number);
      await printCallingInstructions(
        sim.israeli_number || undefined,
        sim.local_number || undefined,
        inventoryItem?.barcode,
        false,
        sim.package_name || undefined,
        sim.expiry_date || undefined
      );
      toast({
        title: 'הדפסה מתחילה',
        description: 'הוראות החיוג נשלחו להדפסה',
      });
    } catch (error) {
      console.error('Error printing instructions:', error);
      toast({
        title: 'שגיאה בהדפסה',
        description: 'לא ניתן להדפיס את ההוראות',
        variant: 'destructive',
      });
    } finally {
      setPrintingSimId(null);
    }
  };

  return (
    <Card className="glass-card">
      <CardContent className="pt-6">
        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center mb-6">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="חיפוש לפי מספר טלפון, ICCID או מספר מקומי..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>
          
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="סינון לפי סטטוס" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסימים</SelectItem>
              <SelectItem value="active">פעילים</SelectItem>
              <SelectItem value="inactive">לא פעילים</SelectItem>
              <SelectItem value="available">זמינים להפעלה</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="מיון לפי" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expiry_date">תוקף</SelectItem>
              <SelectItem value="local_number">מספר מקומי</SelectItem>
              <SelectItem value="status">סטטוס</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredAndSortedSims.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Smartphone className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">אין סימים להצגה</h3>
            <p className="text-muted-foreground mt-1">
              {simCards.length === 0 
                ? 'סנכרן נתונים מ-CellStation כדי להתחיל'
                : 'לא נמצאו סימים התואמים לחיפוש'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">מספר ישראלי</TableHead>
                  <TableHead className="text-right">מספר מקומי</TableHead>
                  <TableHead className="text-right">ICCID</TableHead>
                  <TableHead className="text-right">תוקף</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-right">חבילה</TableHead>
                  <TableHead className="text-right w-[280px]">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedSims.map((sim) => {
                  const isInInventory = isSimInInventory(sim.sim_number);
                  const isAdding = addingSimId === sim.id;
                  const isPrinting = printingSimId === sim.id;
                  const expiryInfo = getExpiryInfo(sim.expiry_date, sim.is_active);
                  
                  return (
                    <TableRow key={sim.id} className={expiryInfo.color}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {sim.israeli_number || '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {sim.local_number || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{sim.sim_number || '-'}</TableCell>
                      <TableCell>
                        {sim.expiry_date 
                          ? format(parseISO(sim.expiry_date), 'dd/MM/yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge 
                          status={sim.is_active ? 'פעיל' : 'לא פעיל'}
                          variant={sim.is_active ? 'success' : 'destructive'}
                        />
                      </TableCell>
                      <TableCell>{sim.package_name || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {/* Activate button - goes to activation tab */}
                          {sim.is_active && !sim.is_rented && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => onActivate(sim)}
                              className="gap-1"
                            >
                              <Zap className="h-3 w-3" />
                              הפעל והשכר
                            </Button>
                          )}

                          {/* Add to inventory button */}
                          {!isInInventory && sim.is_active ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAddToInventory(sim)}
                              disabled={isAdding}
                              className="gap-1"
                            >
                              {isAdding ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Plus className="h-3 w-3" />
                              )}
                              למלאי
                            </Button>
                          ) : isInInventory ? (
                            <span className="inline-flex items-center gap-1 text-success text-sm px-2">
                              <Check className="h-4 w-4" />
                              במלאי
                            </span>
                          ) : null}

                          {/* Print instructions - only if in inventory */}
                          {isInInventory && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePrintInstructions(sim)}
                              disabled={isPrinting}
                              className="gap-1"
                            >
                              {isPrinting ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Printer className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                        </div>
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
