import { useState, useMemo, useEffect, useCallback } from 'react';
import { useCellStation } from '@/hooks/useCellStation';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/StatCard';
import { ActivationTab } from '@/components/cellstation/ActivationTab';
import { SwapSimDialog } from '@/components/cellstation/SwapSimDialog';
import { ActivateAndSwapDialog } from '@/components/cellstation/ActivateAndSwapDialog';
import { RefreshCw, Search, Signal, CheckCircle, XCircle, Clock, ArrowLeftRight, Zap, AlertTriangle, Phone } from 'lucide-react';
import { differenceInDays } from 'date-fns';

function StatusBadge({ status, detail }: { status: string | null; detail: string | null }) {
  if (status === 'rented') {
    return <Badge className="bg-blue-500/20 text-blue-700 border-blue-300">מושכר</Badge>;
  }
  switch (detail) {
    case 'valid':
      return <Badge className="bg-green-500/20 text-green-700 border-green-300">תקין</Badge>;
    case 'expiring':
      return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-300">קרוב לפקיעה</Badge>;
    case 'expired':
      return <Badge className="bg-red-500/20 text-red-700 border-red-300">פג תוקף</Badge>;
    default:
      return <Badge variant="outline">{detail || 'לא ידוע'}</Badge>;
  }
}

function formatDate(d: string | null) {
  if (!d) return '-';
  try {
    const date = new Date(d);
    return date.toLocaleDateString('he-IL');
  } catch { return d; }
}

function shortIccid(iccid: string | null) {
  if (!iccid) return '-';
  return '...' + iccid.slice(-6);
}

interface SimRow {
  id: string;
  sim_number: string | null;
  uk_number: string | null;
  il_number: string | null;
  iccid: string | null;
  status: string | null;
  status_detail: string | null;
  expiry_date: string | null;
  plan: string | null;
  start_date: string | null;
  end_date: string | null;
  customer_name: string | null;
}

// Cross-reference status type
type SystemStatus = 'match' | 'needs_swap' | 'not_in_inventory' | 'both_rented';

interface InventoryMap {
  [iccid: string]: { status: string; id: string };
}

interface SimTableProps {
  sims: SimRow[];
  showCustomer?: boolean;
  showSwap?: boolean;
  showSystemStatus?: boolean;
  inventoryMap?: InventoryMap;
  onSwapClick?: (sim: SimRow) => void;
  onActivateAndSwapClick?: (sim: SimRow) => void;
  needsSwapIccids?: Set<string>;
}

function getSystemStatus(sim: SimRow, inventoryMap: InventoryMap): SystemStatus {
  if (!sim.iccid || !inventoryMap[sim.iccid]) return 'not_in_inventory';
  const inv = inventoryMap[sim.iccid];
  if (sim.status === 'available' && inv.status === 'rented') return 'needs_swap';
  if (sim.status === 'rented' && inv.status === 'rented') return 'both_rented';
  return 'match';
}

function SystemStatusBadge({ status }: { status: SystemStatus }) {
  switch (status) {
    case 'match':
      return <span className="text-xs whitespace-nowrap">✅ תואם</span>;
    case 'needs_swap':
      return <span className="text-xs text-orange-600 font-medium whitespace-nowrap">⚠️ צריך החלפה</span>;
    case 'not_in_inventory':
      return <span className="text-xs text-muted-foreground whitespace-nowrap">❌ לא במלאי</span>;
    case 'both_rented':
      return <span className="text-xs whitespace-nowrap">🔄 מושכר</span>;
  }
}

function SimTable({ sims, showCustomer, showSwap, showSystemStatus, inventoryMap, onSwapClick, onActivateAndSwapClick, needsSwapIccids }: SimTableProps) {
  if (sims.length === 0) {
    return <p className="text-center text-muted-foreground py-8">אין סימים להצגה</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SIM</TableHead>
            <TableHead>UK Number</TableHead>
            <TableHead>IL Number</TableHead>
            <TableHead>ICCID</TableHead>
            <TableHead>סטטוס</TableHead>
            {showSystemStatus && <TableHead>מצב במערכת</TableHead>}
            <TableHead>תוקף</TableHead>
            <TableHead>חבילה</TableHead>
            {showCustomer && <TableHead>לקוח</TableHead>}
            {showCustomer && <TableHead>תקופה</TableHead>}
            {(showSwap || needsSwapIccids) && <TableHead>פעולות</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sims.map((sim) => {
            const needsSwap = needsSwapIccids?.has(sim.iccid || '');
            const sysStatus = showSystemStatus && inventoryMap ? getSystemStatus(sim, inventoryMap) : null;
            return (
              <TableRow key={sim.id} className={needsSwap ? 'bg-yellow-50 dark:bg-yellow-950/10' : ''}>
                <TableCell className="font-mono text-xs">{sim.sim_number || '-'}</TableCell>
                <TableCell dir="ltr">{sim.uk_number || '-'}</TableCell>
                <TableCell dir="ltr">{sim.il_number || '-'}</TableCell>
                <TableCell className="font-mono text-xs">{shortIccid(sim.iccid)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <StatusBadge status={sim.status} detail={sim.status_detail} />
                    {needsSwap && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                  </div>
                </TableCell>
                {showSystemStatus && (
                  <TableCell>
                    {sysStatus && <SystemStatusBadge status={sysStatus} />}
                  </TableCell>
                )}
                <TableCell>{formatDate(sim.expiry_date)}</TableCell>
                <TableCell>{sim.plan || '-'}</TableCell>
                {showCustomer && <TableCell>{sim.customer_name || '-'}</TableCell>}
                {showCustomer && (
                  <TableCell className="text-xs">
                    {sim.start_date ? `${formatDate(sim.start_date)} - ${formatDate(sim.end_date)}` : '-'}
                  </TableCell>
                )}
                {(showSwap || needsSwapIccids) && (
                  <TableCell>
                    <div className="flex gap-1">
                      {showSwap && onSwapClick && (
                        <Button size="sm" variant="outline" onClick={() => onSwapClick(sim)} className="gap-1 text-xs">
                          <ArrowLeftRight className="h-3 w-3" /> החלף
                        </Button>
                      )}
                      {needsSwap && onActivateAndSwapClick && (
                        <Button size="sm" variant="default" onClick={() => onActivateAndSwapClick(sim)} className="gap-1 text-xs">
                          <Zap className="h-3 w-3" /> הפעל+החלף
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// Overdue warning types
interface OverdueSwapItem {
  customerName: string;
  simNumber: string;
  iccid: string;
  daysOverdue: number;
  rentalId: string;
}

interface OverdueNotReturnedItem {
  customerName: string;
  simNumber: string;
  daysOverdue: number;
  phone: string;
}

export default function CellStation() {
  const {
    simCards, isLoading, isSyncing, isSwapping,
    syncSims, activateSim, swapSim, activateAndSwap,
    stats, fetchSims, isActivating,
  } = useCellStation();

  const [search, setSearch] = useState('');
  const [swapDialogSim, setSwapDialogSim] = useState<SimRow | null>(null);
  const [activateSwapSim, setActivateSwapSim] = useState<SimRow | null>(null);
  const [swapRentalId, setSwapRentalId] = useState<string>('');

  // Inventory map for cross-referencing
  const [inventoryMap, setInventoryMap] = useState<InventoryMap>({});
  // Needs swap ICCIDs
  const [needsSwapIccids, setNeedsSwapIccids] = useState<Set<string>>(new Set());
  // Overdue warnings
  const [overdueSwapItems, setOverdueSwapItems] = useState<OverdueSwapItem[]>([]);
  const [overdueNotReturned, setOverdueNotReturned] = useState<OverdueNotReturnedItem[]>([]);

  useEffect(() => {
    async function loadCrossReference() {
      // 1. Load all inventory items with sim_number
      const { data: invData } = await supabase
        .from('inventory' as any)
        .select('id, sim_number, status')
        .not('sim_number', 'is', null);

      const map: InventoryMap = {};
      const rentedIccids = new Set<string>();
      if (invData) {
        for (const item of invData as any[]) {
          if (item.sim_number) {
            map[item.sim_number] = { status: item.status, id: item.id };
            if (item.status === 'rented') {
              rentedIccids.add(item.sim_number);
            }
          }
        }
      }
      setInventoryMap(map);

      // 2. Compute needs_swap: available in cellstation but rented in inventory
      const swapNeeded = new Set<string>();
      for (const sim of simCards) {
        if (sim.status === 'available' && sim.iccid && rentedIccids.has(sim.iccid)) {
          swapNeeded.add(sim.iccid);
        }
      }
      setNeedsSwapIccids(swapNeeded);

      // 3. Load overdue rentals and cross-reference
      const today = new Date().toISOString().split('T')[0];
      const { data: overdueRentals } = await supabase
        .from('rentals')
        .select('id, customer_name, end_date, customer_id')
        .eq('status', 'active')
        .lt('end_date', today);

      if (overdueRentals && overdueRentals.length > 0) {
        // Get rental items for overdue rentals
        const rentalIds = overdueRentals.map(r => r.id);
        const { data: rentalItems } = await supabase
          .from('rental_items')
          .select('rental_id, inventory_item_id')
          .in('rental_id', rentalIds);

        // Get inventory items for those rental items
        const invItemIds = (rentalItems || []).map(ri => ri.inventory_item_id).filter(Boolean);
        const { data: invItems } = await supabase
          .from('inventory' as any)
          .select('id, sim_number')
          .in('id', invItemIds.length > 0 ? invItemIds : ['none']);

        // Get customer phones
        const customerIds = overdueRentals.map(r => r.customer_id).filter(Boolean);
        const { data: customersData } = await supabase
          .from('customers')
          .select('id, phone')
          .in('id', customerIds.length > 0 ? customerIds : ['none']);

        const customerPhoneMap: Record<string, string> = {};
        (customersData || []).forEach(c => { customerPhoneMap[c.id] = c.phone; });

        const invSimMap: Record<string, string> = {};
        ((invItems as any[]) || []).forEach(i => { invSimMap[i.id] = i.sim_number; });

        const swapItems: OverdueSwapItem[] = [];
        const notReturnedItems: OverdueNotReturnedItem[] = [];

        for (const rental of overdueRentals) {
          const items = (rentalItems || []).filter(ri => ri.rental_id === rental.id);
          const daysOverdue = differenceInDays(new Date(), new Date(rental.end_date));

          for (const item of items) {
            if (!item.inventory_item_id) continue;
            const simNumber = invSimMap[item.inventory_item_id];
            if (!simNumber) continue;

            // Find matching cellstation SIM
            const csSim = simCards.find(s => s.iccid === simNumber);
            if (!csSim) continue;

            if (csSim.status === 'available') {
              // CellStation released it but still rented in our system
              swapItems.push({
                customerName: rental.customer_name,
                simNumber: csSim.uk_number || csSim.il_number || simNumber,
                iccid: simNumber,
                daysOverdue,
                rentalId: rental.id,
              });
            } else if (csSim.status === 'rented') {
              // Customer still has it
              notReturnedItems.push({
                customerName: rental.customer_name,
                simNumber: csSim.uk_number || csSim.il_number || simNumber,
                daysOverdue,
                phone: customerPhoneMap[rental.customer_id || ''] || '',
              });
            }
          }
        }

        setOverdueSwapItems(swapItems);
        setOverdueNotReturned(notReturnedItems);
      } else {
        setOverdueSwapItems([]);
        setOverdueNotReturned([]);
      }
    }

    if (simCards.length > 0) {
      loadCrossReference();
    }
  }, [simCards]);

  // Find rental ID for a rented SIM
  const openSwapForSim = useCallback(async (sim: SimRow) => {
    setSwapDialogSim(sim);
    // Find the rental linked to this SIM via inventory
    const { data: invItem } = await supabase
      .from('inventory')
      .select('id')
      .eq('sim_number', sim.iccid || '')
      .single();
    if (invItem) {
      const { data: rentalItem } = await supabase
        .from('rental_items')
        .select('rental_id')
        .eq('inventory_item_id', invItem.id)
        .limit(1)
        .maybeSingle();
      // Only use rental_id from active/overdue rentals
      if (rentalItem?.rental_id) {
        const { data: rental } = await supabase
          .from('rentals')
          .select('id')
          .eq('id', rentalItem.rental_id)
          .in('status', ['active', 'overdue'])
          .maybeSingle();
        setSwapRentalId(rental?.id || '');
      }
    }
  }, []);

  // Enhanced swap handler with DB updates
  const handleSwapWithUpdates = useCallback(async (params: {
    rental_id: string;
    current_sim: string;
    current_iccid: string;
    swap_msisdn: string;
    swap_iccid: string;
  }) => {
    const result = await swapSim(params);

    // After edge function succeeds, update local DB
    const oldIccid = swapDialogSim?.iccid;
    const newIccid = params.swap_iccid;

    // 1. Update old SIM to available in cellstation_sims
    if (oldIccid) {
      await supabase.from('cellstation_sims')
        .update({ status: 'available', status_detail: 'valid', customer_name: null })
        .eq('iccid', oldIccid);
    }

    // 2. Update new SIM to rented in cellstation_sims
    if (newIccid) {
      await supabase.from('cellstation_sims')
        .update({ status: 'rented', status_detail: 'active', customer_name: swapDialogSim?.customer_name })
        .eq('iccid', newIccid);
    }

    // 3. Update old inventory item to available
    if (oldIccid) {
      await supabase.from('inventory')
        .update({ status: 'available', needs_swap: false })
        .eq('sim_number', oldIccid);
    }

    // 4. Ensure new inventory item exists and mark as rented
    const { data: newInvItem } = await supabase
      .from('inventory')
      .select('id')
      .eq('sim_number', newIccid)
      .maybeSingle();

    let newInventoryId: string;
    if (!newInvItem) {
      const newSimData = simCards.find(s => s.iccid === newIccid);
      const { data: created } = await supabase.from('inventory').insert({
        name: `סים גלישה`,
        category: 'sim_european',
        sim_number: newIccid,
        local_number: newSimData?.uk_number || params.swap_msisdn || null,
        israeli_number: newSimData?.il_number || null,
        expiry_date: newSimData?.expiry_date || null,
        status: 'rented',
      }).select('id').single();
      newInventoryId = created!.id;
    } else {
      newInventoryId = newInvItem.id;
      await supabase.from('inventory')
        .update({ status: 'rented' })
        .eq('id', newInventoryId);
    }

    // 5. Update rental_items to point to new inventory item
    if (params.rental_id && oldIccid) {
      const { data: oldInv } = await supabase
        .from('inventory')
        .select('id')
        .eq('sim_number', oldIccid)
        .maybeSingle();
      if (oldInv) {
        await supabase.from('rental_items')
          .update({ inventory_item_id: newInventoryId })
          .eq('rental_id', params.rental_id)
          .eq('inventory_item_id', oldInv.id);
      }
    }

    // Refresh data
    await fetchSims();
    return result;
  }, [swapSim, swapDialogSim, simCards, fetchSims]);

  const filtered = useMemo(() => {
    if (!search.trim()) return simCards;
    const q = search.toLowerCase();
    return simCards.filter(s =>
      [s.sim_number, s.uk_number, s.il_number, s.iccid, s.customer_name, s.plan]
        .some(v => v?.toLowerCase().includes(q))
    );
  }, [simCards, search]);

  const available = useMemo(() => filtered.filter(s => s.status === 'available' && s.status_detail === 'valid'), [filtered]);
  const expired = useMemo(() => filtered.filter(s => s.status_detail === 'expired'), [filtered]);
  const rented = useMemo(() => filtered.filter(s => s.status === 'rented'), [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader title="ניהול סימים" description="סנכרון וניהול כרטיסי SIM מ-CellStation" />
        <Button onClick={syncSims} disabled={isSyncing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'מסנכרן...' : 'סנכרון'}
        </Button>
      </div>

      {/* Overdue Warning Cards */}
      {overdueSwapItems.length > 0 && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h3 className="font-bold text-red-700 dark:text-red-400">
                ⚠️ סימים שדורשים החלפה ({overdueSwapItems.length} סימים)
              </h3>
            </div>
            <div className="space-y-2">
              {overdueSwapItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-md bg-white/60 dark:bg-black/20">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1"
                    onClick={() => {
                      const sim = simCards.find(s => s.iccid === item.iccid);
                      if (sim) setActivateSwapSim(sim);
                    }}
                  >
                    <Zap className="h-3 w-3" /> החלף עכשיו
                  </Button>
                  <div className="text-right text-sm">
                    <span className="font-medium">{item.customerName}</span>
                    <span className="mx-2 text-muted-foreground">|</span>
                    <span className="font-mono text-xs">{item.simNumber}</span>
                    <span className="mx-2 text-muted-foreground">|</span>
                    <span className="text-red-600 font-medium">{item.daysOverdue} ימים באיחור</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {overdueNotReturned.length > 0 && (
        <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-5 w-5 text-orange-600" />
              <h3 className="font-bold text-orange-700 dark:text-orange-400">
                ⏰ סימים באיחור - הלקוח טרם החזיר ({overdueNotReturned.length} סימים)
              </h3>
            </div>
            <div className="space-y-2">
              {overdueNotReturned.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-md bg-white/60 dark:bg-black/20">
                  {item.phone && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      asChild
                    >
                      <a href={`tel:${item.phone}`}>
                        <Phone className="h-3 w-3" /> התקשר ללקוח
                      </a>
                    </Button>
                  )}
                  <div className="text-right text-sm">
                    <span className="font-medium">{item.customerName}</span>
                    <span className="mx-2 text-muted-foreground">|</span>
                    <span className="font-mono text-xs">{item.simNumber}</span>
                    <span className="mx-2 text-muted-foreground">|</span>
                    <span className="text-orange-600 font-medium">{item.daysOverdue} ימים באיחור</span>
                    {item.phone && (
                      <>
                        <span className="mx-2 text-muted-foreground">|</span>
                        <span dir="ltr" className="text-xs">{item.phone}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="סה״כ" value={stats.total} icon={Signal} />
        <StatCard title="זמינים" value={stats.available} icon={CheckCircle} />
        <StatCard title="מושכרים" value={stats.rented} icon={Clock} />
        <StatCard title="פגי תוקף" value={stats.expired} icon={XCircle} />
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="חיפוש לפי מספר, ICCID, לקוח..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Tabs defaultValue="all" dir="rtl">
              <div className="border-b px-4 pt-4 overflow-x-auto">
                <TabsList>
                  <TabsTrigger value="all">כל הסימים ({filtered.length})</TabsTrigger>
                  <TabsTrigger value="available">זמינים ({available.length})</TabsTrigger>
                  <TabsTrigger value="expired">פגי תוקף ({expired.length})</TabsTrigger>
                  <TabsTrigger value="rented">מושכרים ({rented.length})</TabsTrigger>
                  <TabsTrigger value="activate">הפעלה</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="all" className="m-0">
                <SimTable
                  sims={filtered}
                  showSystemStatus
                  inventoryMap={inventoryMap}
                  needsSwapIccids={needsSwapIccids}
                  onActivateAndSwapClick={sim => setActivateSwapSim(sim)}
                />
              </TabsContent>
              <TabsContent value="available" className="m-0">
                <SimTable sims={available} />
              </TabsContent>
              <TabsContent value="expired" className="m-0">
                <SimTable sims={expired} />
              </TabsContent>
              <TabsContent value="rented" className="m-0">
                <SimTable
                   sims={rented}
                   showCustomer
                   showSwap
                   onSwapClick={sim => openSwapForSim(sim)}
                   needsSwapIccids={needsSwapIccids}
                   onActivateAndSwapClick={sim => setActivateSwapSim(sim)}
                 />
              </TabsContent>
              <TabsContent value="activate" className="m-0">
                <ActivationTab
                  availableSims={simCards}
                  onActivate={activateSim}
                  onActivateAndSwap={activateAndSwap}
                  isActivating={isActivating}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Swap Dialog */}
      {swapDialogSim && (
        <SwapSimDialog
          open={!!swapDialogSim}
          onOpenChange={open => !open && setSwapDialogSim(null)}
          currentSim={swapDialogSim}
          availableSims={simCards}
          onSwap={handleSwapWithUpdates}
          isSwapping={isSwapping}
          rentalId={swapRentalId}
        />
      )}

      {/* Activate + Swap Dialog */}
      {activateSwapSim && (
        <ActivateAndSwapDialog
          open={!!activateSwapSim}
          onOpenChange={open => !open && setActivateSwapSim(null)}
          oldSim={activateSwapSim}
          availableSims={simCards}
          onActivateAndSwap={activateAndSwap}
          rentalId=""
        />
      )}
    </div>
  );
}
