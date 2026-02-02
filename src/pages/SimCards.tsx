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
import { RefreshCw, Search, Smartphone, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useCellstationSync } from '@/hooks/useCellstationSync';
import { cn } from '@/lib/utils';

type FilterStatus = 'all' | 'available' | 'rented' | 'expiring';
type SortField = 'expiry_date' | 'local_number' | 'status';

export default function SimCards() {
  const { simCards, isLoading, isRefreshing, refreshData } = useCellstationSync();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortField, setSortField] = useState<SortField>('expiry_date');

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
      } else if (filterStatus === 'expiring') {
        const today = new Date();
        result = result.filter(sim => {
          if (!sim.expiry_date) return false;
          const daysUntilExpiry = differenceInDays(parseISO(sim.expiry_date), today);
          return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
        });
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
    const today = new Date();
    const total = simCards.length;
    const available = simCards.filter(s => !s.is_rented).length;
    const rented = simCards.filter(s => s.is_rented).length;
    const expiring = simCards.filter(s => {
      if (!s.expiry_date) return false;
      const daysUntilExpiry = differenceInDays(parseISO(s.expiry_date), today);
      return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
    }).length;

    return { total, available, rented, expiring };
  }, [simCards]);

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

  const lastSyncTime = simCards.length > 0 && simCards[0].last_synced
    ? format(new Date(simCards[0].last_synced), 'dd/MM/yyyy HH:mm', { locale: he })
    : 'לא סונכרן';

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="סימים מ-CellStation"
        description={`סנכרון אחרון: ${lastSyncTime} • הנתונים מתעדכנים אוטומטית`}
      >
        <Button 
          onClick={refreshData}
          disabled={isLoading || isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", (isLoading || isRefreshing) && "animate-spin")} />
          {isRefreshing ? 'מרענן...' : 'רענן נתונים'}
        </Button>
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה"כ סימים</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">פנויים</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.available}</div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">בהשכרה</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rented}</div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">פגי תוקף בקרוב</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.expiring}</div>
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
                placeholder="חיפוש לפי מספר טלפון או סים..."
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
                <SelectItem value="available">פנויים</SelectItem>
                <SelectItem value="rented">בהשכרה</SelectItem>
                <SelectItem value="expiring">פגי תוקף בקרוב</SelectItem>
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
                    <TableHead className="text-right">מספר קצר</TableHead>
                    <TableHead className="text-right">מספר מקומי</TableHead>
                    <TableHead className="text-right">מספר ישראלי</TableHead>
                    <TableHead className="text-right">ICCID</TableHead>
                    <TableHead className="text-right">תוקף</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">חבילה</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedSims.map((sim) => (
                    <TableRow key={sim.id} className={getExpiryColor(sim.expiry_date, sim.is_active)}>
                      <TableCell className="font-medium">{sim.short_number || '-'}</TableCell>
                      <TableCell>{sim.local_number || '-'}</TableCell>
                      <TableCell>{sim.israeli_number || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{sim.sim_number || '-'}</TableCell>
                      <TableCell>
                        {sim.expiry_date 
                          ? format(parseISO(sim.expiry_date), 'dd/MM/yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge 
                          status={sim.is_active ? 'פעיל' : 'פג תוקף'}
                          variant={sim.is_active ? 'success' : 'destructive'}
                        />
                      </TableCell>
                      <TableCell>{sim.package_name || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
