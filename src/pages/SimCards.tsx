import { useState, useMemo } from 'react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { RefreshCw, Search, Smartphone, CheckCircle, XCircle, CloudDownload, Plus, Check, Package } from 'lucide-react';
import { useCellstationSync } from '@/hooks/useCellstationSync';
import { useRental } from '@/hooks/useRental';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type FilterStatus = 'all' | 'available' | 'rented' | 'active' | 'inactive';
type SortField = 'expiry_date' | 'local_number' | 'status';

export default function SimCards() {
  const { simCards, isLoading, isRefreshing, isSyncing, syncSims, refreshData } = useCellstationSync();
  const { inventory, addInventoryItem } = useRental();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortField, setSortField] = useState<SortField>('expiry_date');
  const [addingSimId, setAddingSimId] = useState<string | null>(null);

  // Check if a SIM is already in inventory (by sim_number/ICCID)
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
      if (filterStatus === 'available') {
        result = result.filter(sim => !sim.is_rented);
      } else if (filterStatus === 'rented') {
        result = result.filter(sim => sim.is_rented);
      } else if (filterStatus === 'active') {
        result = result.filter(sim => sim.is_active === true);
      } else if (filterStatus === 'inactive') {
        result = result.filter(sim => sim.is_active === false);
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
  }, [simCards, searchQuery, filterStatus, sortField]);

  const stats = useMemo(() => {
    const total = simCards.length;
    const active = simCards.filter(s => s.is_active === true).length;
    // Available for inventory = active SIMs not yet in main inventory
    const availableForInventory = simCards.filter(s => 
      s.is_active === true && !isSimInInventory(s.sim_number)
    ).length;

    return { total, active, availableForInventory };
  }, [simCards, inventory]);

  const getExpiryColor = (expiryDate: string | null, isActive?: boolean): string => {
    // If explicitly marked as inactive, show red
    if (isActive === false) return 'text-destructive bg-destructive/10';
    
    if (!expiryDate) return '';
    
    const today = new Date();
    const expiry = parseISO(expiryDate);
    const daysUntilExpiry = differenceInDays(expiry, today);
    
    if (daysUntilExpiry < 0) return 'text-destructive bg-destructive/10';
    if (daysUntilExpiry <= 7) return 'text-destructive bg-destructive/10';
    if (daysUntilExpiry <= 30) return 'text-warning bg-warning/10';
    return '';
  };

  const handleAddToInventory = async (sim: typeof simCards[0]) => {
    if (!sim.sim_number) {
      toast({
        title: 'שגיאה',
        description: 'לסים זה אין מספר ICCID ולכן לא ניתן להוסיפו למלאי',
        variant: 'destructive',
      });
      return;
    }

    setAddingSimId(sim.id);
    try {
      // Determine category based on number pattern
      // Israeli numbers (44...) should be categorized as sim_european based on user's instruction
      const category = sim.israeli_number?.startsWith('44') ? 'sim_european' : 'sim_american';
      
      await addInventoryItem({
        category: category as any,
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
        description: `הסים ${sim.local_number || sim.sim_number} נוסף בהצלחה למלאי`,
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

  const lastSyncTime = simCards.length > 0 && simCards[0].last_synced
    ? format(new Date(simCards[0].last_synced), 'dd/MM/yyyy HH:mm', { locale: he })
    : 'לא סונכרן';

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="סימים מ-CellStation"
        description={`סנכרון אחרון: ${lastSyncTime} • הנתונים מתעדכנים אוטומטית`}
      >
        <div className="flex gap-2">
          <Button 
            onClick={syncSims}
            disabled={isLoading || isSyncing}
            className="gap-2"
          >
            <CloudDownload className={cn("h-4 w-4", isSyncing && "animate-bounce")} />
            {isSyncing ? 'מסנכרן...' : 'סנכרן סימים'}
          </Button>
          <Button 
            onClick={refreshData}
            disabled={isLoading || isRefreshing}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", (isLoading || isRefreshing) && "animate-spin")} />
            {isRefreshing ? 'מרענן...' : 'רענן נתונים'}
          </Button>
        </div>
      </PageHeader>

      {/* Stats Cards - Updated to show Total, Active, Available for Inventory */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה"כ במערכת</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">סימים מ-CellStation</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סימים פעילים</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.active}</div>
            <p className="text-xs text-muted-foreground">סטטוס פעיל</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">זמינים להוספה למלאי</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.availableForInventory}</div>
            <p className="text-xs text-muted-foreground">פעילים ולא במלאי</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
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
                <SelectItem value="available">פנויים</SelectItem>
                <SelectItem value="rented">בהשכרה</SelectItem>
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
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="glass-card">
        <CardContent className="p-0">
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
                  ? 'הנתונים מתעדכנים אוטומטית מ-CellStation'
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
                    <TableHead className="text-right w-[120px]">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedSims.map((sim) => {
                    const isInInventory = isSimInInventory(sim.sim_number);
                    const isAdding = addingSimId === sim.id;
                    
                    return (
                      <TableRow key={sim.id} className={getExpiryColor(sim.expiry_date, sim.is_active)}>
                        {/* Swapped: 44... numbers are now Israel Number */}
                        <TableCell className="font-medium whitespace-nowrap">
                          {sim.israeli_number || '-'}
                        </TableCell>
                        {/* Swapped: 7225... numbers are now Local Number */}
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
                          {isInInventory ? (
                            <span className="inline-flex items-center gap-1 text-success text-sm">
                              <Check className="h-4 w-4" />
                              במלאי
                            </span>
                          ) : sim.is_active ? (
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
                              הוסף למלאי
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">לא פעיל</span>
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
    </div>
  );
}
