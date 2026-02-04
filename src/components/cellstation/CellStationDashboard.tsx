import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw,
  Package,
  Smartphone,
  Zap,
  Users,
  CloudDownload,
  Search,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeftRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// Cell Station Dashboard v4.0
// סנכרון + הפעלות + החלפות סים
// ============================================

const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzKhHEQeldMrsNjL8RZMigkPvIKJDRSWD0WoDYpyGPAmGxBYFxDi_9EiUldFjnZ6TIE/exec';

// === Types ===
interface Rental {
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

interface InventoryItem {
  id: string;
  sim: string;
  local_number: string;
  israel_number: string;
  plan: string;
  expiry: string;
  status: 'active' | 'inactive';
}

interface Customer {
  name: string;
  phone: string;
  rentals_count: number;
  last_rental: string;
}

interface Stats {
  total_inventory: number;
  active_inventory: number;
  inactive_inventory: number;
  available_for_rent: number;
  total_rentals: number;
  ending_today: number;
  ending_tomorrow: number;
  ended: number;
}

interface PendingAction {
  action: string;
  sim?: string;
  customer_name?: string;
  old_sim?: string;
  new_sim?: string;
}

// === Stat Card Component ===
function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  variant = 'default',
  highlight = false 
}: { 
  title: string; 
  value: number; 
  icon: React.ElementType;
  variant?: 'default' | 'warning' | 'success' | 'destructive' | 'primary';
  highlight?: boolean;
}) {
  const variantStyles = {
    default: 'border-border/50',
    warning: 'border-warning/50 bg-warning/5',
    success: 'border-success/50 bg-success/5',
    destructive: 'border-destructive/50 bg-destructive/5',
    primary: 'border-primary/50 bg-primary/5',
  };

  const iconStyles = {
    default: 'text-muted-foreground',
    warning: 'text-warning',
    success: 'text-success',
    destructive: 'text-destructive',
    primary: 'text-primary',
  };

  return (
    <Card className={cn(
      'glass-card transition-all duration-200',
      variantStyles[variant],
      highlight && 'ring-2 ring-warning animate-pulse'
    )}>
      <CardContent className="p-4 text-center">
        <Icon className={cn('h-6 w-6 mx-auto mb-2', iconStyles[variant])} />
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{title}</div>
      </CardContent>
    </Card>
  );
}

// === Main Component ===
export function CellStationDashboard() {
  const { toast } = useToast();

  // State
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [availableSims, setAvailableSims] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('rentals');
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // Activate form state
  const [selectedSim, setSelectedSim] = useState<InventoryItem | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [price, setPrice] = useState('');

  // Replace form state
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [newSim, setNewSim] = useState('');

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(WEBAPP_URL);
      const data = await res.json();

      if (data.success !== false) {
        setRentals(data.rentals || []);
        setInventory(data.inventory || []);
        setAvailableSims(data.available_sims || []);
        setStats(data.stats || null);
        setPendingAction(data.pending || null);
      } else {
        setError(data.error || 'שגיאה בטעינת נתונים');
      }
    } catch (err) {
      setError('שגיאה בחיבור - לחץ על הסימנייה ב-Cell Station לסנכרון ראשוני');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch(WEBAPP_URL + '?action=customers');
      const data = await res.json();
      if (data.customers) setCustomers(data.customers);
    } catch (e) {}
  };

  useEffect(() => {
    fetchData();
    fetchCustomers();
  }, []);

  // Filter rentals
  const filteredRentals = useMemo(() => rentals.filter(r =>
    !searchTerm ||
    r.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.local_number?.includes(searchTerm) ||
    r.sim?.includes(searchTerm)
  ), [rentals, searchTerm]);

  // Filter inventory
  const filteredInventory = useMemo(() => inventory.filter(s =>
    !searchTerm ||
    s.local_number?.includes(searchTerm) ||
    s.sim?.includes(searchTerm) ||
    s.id?.includes(searchTerm)
  ), [inventory, searchTerm]);

  // Get status variant
  const getStatusVariant = (status: string): 'default' | 'destructive' | 'warning' | 'success' => {
    if (status === 'הסתיים' || status === 'ended') return 'destructive';
    if (status === 'מסתיים היום!' || status.includes('היום')) return 'warning';
    if (status === 'מסתיים מחר' || status.includes('מחר')) return 'warning';
    return 'success';
  };

  // Send activate request
  const handleActivate = async () => {
    if (!selectedSim || !customerName || !startDate || !endDate) {
      toast({
        title: 'שגיאה',
        description: 'נא למלא את כל השדות',
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await fetch(WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'activate',
          sim: selectedSim.sim,
          customer_name: customerName,
          customer_phone: customerPhone,
          start_date: startDate,
          end_date: endDate,
          price: price,
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast({
          title: '✅ הפעלה נשמרה!',
          description: `SIM: ${selectedSim.local_number} | לקוח: ${customerName}`,
        });

        // Reset form
        setSelectedSim(null);
        setCustomerName('');
        setCustomerPhone('');
        setStartDate('');
        setEndDate('');
        setPrice('');
        fetchData();
      } else {
        toast({
          title: 'שגיאה',
          description: data.error || 'לא ידוע',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'שגיאה בשליחה',
        variant: 'destructive',
      });
    }
  };

  // Send replace request
  const handleReplace = async () => {
    if (!selectedRental || !newSim) {
      toast({
        title: 'שגיאה',
        description: 'נא לבחור השכרה ולהזין מספר סים חדש',
        variant: 'destructive',
      });
      return;
    }

    if (newSim.length < 19 || newSim.length > 20) {
      toast({
        title: 'שגיאה',
        description: 'מספר סים חייב להיות 19-20 ספרות',
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await fetch(WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'replace_sim',
          old_sim: selectedRental.sim,
          new_sim: newSim,
          rental_id: selectedRental.rental_id,
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast({
          title: '✅ החלפה נשמרה!',
          description: `סים ישן: ${selectedRental.local_number} → סים חדש: ${newSim.slice(-6)}`,
        });

        // Reset form
        setSelectedRental(null);
        setNewSim('');
        fetchData();
      } else {
        toast({
          title: 'שגיאה',
          description: data.error || 'לא ידוע',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'שגיאה בשליחה',
        variant: 'destructive',
      });
    }
  };

  // Cancel pending
  const handleCancelPending = async () => {
    try {
      await fetch(WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel_pending' }),
      });
      setPendingAction(null);
      fetchData();
      toast({
        title: 'בוטל',
        description: 'הפעולה הממתינה בוטלה',
      });
    } catch (e) {}
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Smartphone className="h-8 w-8 text-primary" />
            Cell Station
          </h1>
          <p className="text-muted-foreground">
            ניהול סימים והשכרות
          </p>
        </div>
        <Button
          onClick={fetchData}
          disabled={loading}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {loading ? 'טוען...' : 'רענן'}
        </Button>
      </div>

      {/* Pending Action Alert */}
      {pendingAction && (
        <Card className="border-warning bg-warning/10">
          <CardContent className="p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-warning" />
              <div>
                <span className="font-bold text-warning">פעולה ממתינה: </span>
                {pendingAction.action === 'activate' && (
                  <span>הפעלת השכרה - {pendingAction.customer_name} - SIM: {pendingAction.sim?.slice(-6)}</span>
                )}
                {pendingAction.action === 'replace_sim' && (
                  <span>החלפת סים - מ-{pendingAction.old_sim?.slice(-6)} ל-{pendingAction.new_sim?.slice(-6)}</span>
                )}
                <span className="text-sm text-muted-foreground block">לך ל-Cell Station ולחץ על הסימנייה</span>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={handleCancelPending}>
              ביטול
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard title="השכרות" value={stats.total_rentals} icon={Package} variant="primary" />
          <StatCard title="היום!" value={stats.ending_today} icon={AlertTriangle} variant="warning" highlight={stats.ending_today > 0} />
          <StatCard title="מחר" value={stats.ending_tomorrow} icon={Calendar} variant="warning" />
          <StatCard title="הסתיימו" value={stats.ended} icon={XCircle} variant="destructive" />
          <StatCard title="מלאי" value={stats.total_inventory} icon={Smartphone} />
          <StatCard title="פעילים" value={stats.active_inventory} icon={CheckCircle} variant="success" />
          <StatCard title="פנויים" value={stats.available_for_rent} icon={Zap} variant="success" />
          <StatCard title="לא פעילים" value={stats.inactive_inventory} icon={XCircle} />
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-4">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="rentals" className="gap-2">
            <Package className="h-4 w-4" />
            השכרות ({rentals.length})
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2">
            <Smartphone className="h-4 w-4" />
            מלאי ({inventory.length})
          </TabsTrigger>
          <TabsTrigger value="activate" className="gap-2">
            <Zap className="h-4 w-4" />
            הפעלה חדשה
          </TabsTrigger>
          <TabsTrigger value="replace" className="gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            החלפת סים
          </TabsTrigger>
        </TabsList>

        {/* Rentals Tab */}
        <TabsContent value="rentals">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="relative mb-4">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="🔍 חיפוש לפי שם לקוח או מספר..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRentals.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  אין השכרות להצגה
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">לקוח</TableHead>
                        <TableHead className="text-right">טלפון</TableHead>
                        <TableHead className="text-right">מספר מקומי</TableHead>
                        <TableHead className="text-right">תוכנית</TableHead>
                        <TableHead className="text-right">התחלה</TableHead>
                        <TableHead className="text-right">סיום</TableHead>
                        <TableHead className="text-right">ימים</TableHead>
                        <TableHead className="text-right">סטטוס</TableHead>
                        <TableHead className="text-right">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRentals.map((rental, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{rental.customer_name}</TableCell>
                          <TableCell>{rental.customer_phone}</TableCell>
                          <TableCell className="font-mono text-sm">{rental.local_number}</TableCell>
                          <TableCell>{rental.plan}</TableCell>
                          <TableCell>{rental.start_date}</TableCell>
                          <TableCell>{rental.end_date}</TableCell>
                          <TableCell className="text-center">{rental.days}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(rental.status)}>
                              {rental.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedRental(rental);
                                setActiveTab('replace');
                              }}
                              className="gap-1"
                            >
                              <ArrowLeftRight className="h-3 w-3" />
                              החלפה
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="relative mb-4">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="🔍 חיפוש לפי מספר..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">ID</TableHead>
                        <TableHead className="text-right">מספר מקומי</TableHead>
                        <TableHead className="text-right">מספר ישראלי</TableHead>
                        <TableHead className="text-right">תוכנית</TableHead>
                        <TableHead className="text-right">תוקף</TableHead>
                        <TableHead className="text-right">סטטוס</TableHead>
                        <TableHead className="text-right">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInventory.map((item, idx) => (
                        <TableRow
                          key={idx}
                          className={cn(
                            item.status === 'active' ? 'bg-success/5' : 'bg-destructive/5'
                          )}
                        >
                          <TableCell>{item.id}</TableCell>
                          <TableCell className="font-mono">{item.local_number}</TableCell>
                          <TableCell className="font-mono">{item.israel_number}</TableCell>
                          <TableCell>{item.plan}</TableCell>
                          <TableCell>{item.expiry}</TableCell>
                          <TableCell>
                            <Badge variant={item.status === 'active' ? 'success' : 'destructive'}>
                              {item.status === 'active' ? '🟢 פעיל' : '🔴 לא פעיל'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.status === 'active' && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => {
                                  setSelectedSim(item);
                                  setActiveTab('activate');
                                }}
                                className="gap-1"
                              >
                                <Zap className="h-3 w-3" />
                                הפעל
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activate Tab */}
        <TabsContent value="activate">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                הפעלת השכרה חדשה
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {/* SIM Selection */}
                <div className="space-y-4">
                  <div>
                    <label className="block font-medium mb-2">בחר סים פנוי:</label>
                    <Select
                      value={selectedSim?.sim || ''}
                      onValueChange={(value) => {
                        const sim = availableSims.find((s) => s.sim === value);
                        setSelectedSim(sim || null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="-- בחר סים --" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSims.map((sim, idx) => (
                          <SelectItem key={idx} value={sim.sim}>
                            {sim.local_number} - {sim.plan} (תוקף: {sim.expiry})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedSim && (
                    <Card className="bg-success/10 border-success/30">
                      <CardContent className="p-4 text-sm space-y-1">
                        <div><strong>ID:</strong> {selectedSim.id}</div>
                        <div><strong>SIM:</strong> {selectedSim.sim}</div>
                        <div><strong>מספר ישראלי:</strong> {selectedSim.israel_number}</div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Customer Details */}
                <div className="space-y-4">
                  <div>
                    <label className="block font-medium mb-1">שם לקוח:</label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="שם הלקוח"
                      list="customers-list"
                    />
                    <datalist id="customers-list">
                      {customers.map((c, i) => (
                        <option key={i} value={c.name}>
                          {c.phone}
                        </option>
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block font-medium mb-1">טלפון לקוח:</label>
                    <Input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="05X-XXXXXXX"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-medium mb-1">תאריך התחלה:</label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">תאריך סיום:</label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium mb-1">מחיר (אופציונלי):</label>
                    <Input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  <Button
                    onClick={handleActivate}
                    disabled={!selectedSim || !customerName || !startDate || !endDate}
                    className="w-full gap-2"
                    size="lg"
                  >
                    <Zap className="h-4 w-4" />
                    שלח להפעלה
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Replace Tab */}
        <TabsContent value="replace">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-primary" />
                החלפת סים בהשכרה קיימת
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Rental Selection */}
                <div className="space-y-4">
                  <div>
                    <label className="block font-medium mb-2">בחר השכרה:</label>
                    <Select
                      value={selectedRental?.sim || ''}
                      onValueChange={(value) => {
                        const rental = rentals.find((r) => r.sim === value);
                        setSelectedRental(rental || null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="-- בחר השכרה --" />
                      </SelectTrigger>
                      <SelectContent>
                        {rentals.map((r, idx) => (
                          <SelectItem key={idx} value={r.sim}>
                            {r.customer_name} - {r.local_number} (עד {r.end_date})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedRental && (
                    <Card className="bg-primary/10 border-primary/30">
                      <CardContent className="p-4 text-sm space-y-1">
                        <div><strong>לקוח:</strong> {selectedRental.customer_name}</div>
                        <div><strong>SIM נוכחי:</strong> {selectedRental.sim}</div>
                        <div><strong>מספר מקומי:</strong> {selectedRental.local_number}</div>
                        <div><strong>תאריכים:</strong> {selectedRental.start_date} - {selectedRental.end_date}</div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* New SIM Input */}
                <div className="space-y-4">
                  <div>
                    <label className="block font-medium mb-1">מספר סים חדש (ICCID):</label>
                    <Input
                      value={newSim}
                      onChange={(e) => setNewSim(e.target.value.replace(/\D/g, ''))}
                      className="font-mono"
                      placeholder="19-20 ספרות"
                      maxLength={20}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      {newSim.length}/20 ספרות
                      {newSim.length >= 19 && newSim.length <= 20 && ' ✅'}
                    </p>
                  </div>

                  <Card className="bg-warning/10 border-warning/30">
                    <CardContent className="p-4">
                      <p className="font-medium text-warning flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        שים לב!
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        החלפת סים היא פעולה בלתי הפיכה. הסים הישן יימחק לצמיתות.
                      </p>
                    </CardContent>
                  </Card>

                  <Button
                    onClick={handleReplace}
                    disabled={!selectedRental || newSim.length < 19}
                    className="w-full gap-2"
                    size="lg"
                    variant="secondary"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    שלח להחלפה
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CellStationDashboard;
