import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useCellStation } from '@/hooks/useCellStation';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivationTab } from '@/components/cellstation/ActivationTab';
import { SwapSimDialog } from '@/components/cellstation/SwapSimDialog';
import { ActivateAndSwapDialog } from '@/components/cellstation/ActivateAndSwapDialog';
import { RefreshCw, Search, Clock, Zap, AlertTriangle, Phone } from 'lucide-react';
import { differenceInDays, formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';

const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const LAST_SYNC_KEY = 'dealcell_cellstation_last_sync';
const LAST_SIM_COUNT_KEY = 'dealcell_cellstation_sim_count';

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

function SyncStatusIndicator({ status, lastSyncTime, simCountDelta }: {
  status: SyncStatus;
  lastSyncTime: Date | null;
  simCountDelta: number | null;
}) {
  const getDisplay = () => {
    if (status === 'syncing') {
      return { emoji: '🔄', text: 'מסנכרן...', className: 'text-blue-600 dark:text-blue-400' };
    }
    if (status === 'error') {
      return { emoji: '❌', text: 'סנכרון נכשל', className: 'text-destructive' };
    }
    if (lastSyncTime) {
      const timeAgo = formatDistanceToNow(lastSyncTime, { locale: he, addSuffix: true });
      return { emoji: '✅', text: `עודכן ${timeAgo}`, className: 'text-green-600 dark:text-green-400' };
    }
    return { emoji: '⏳', text: 'טרם סונכרן', className: 'text-muted-foreground' };
  };

  const { emoji, text, className } = getDisplay();

  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm font-medium ${className}`}>
        {emoji} {text}
      </span>
      {simCountDelta !== null && simCountDelta !== 0 && status === 'success' && (
        <span className={`text-xs font-medium ${simCountDelta > 0 ? 'text-green-600' : 'text-orange-600'}`}>
          ({simCountDelta > 0 ? '+' : ''}{simCountDelta} סימים)
        </span>
      )}
    </div>
  );
}

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
  onRentalClick?: (sim: SimRow) => void;
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

function SimTable({ sims, showCustomer, showSwap, showSystemStatus, inventoryMap, onSwapClick, onActivateAndSwapClick, onRentalClick, needsSwapIccids }: SimTableProps) {
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
  const [activeTab, setActiveTab] = useState<string>('all');
  const [swapDialogSim, setSwapDialogSim] = useState<SimRow | null>(null);
  const [activateSwapSim, setActivateSwapSim] = useState<SimRow | null>(null);
  const [swapRentalId, setSwapRentalId] = useState<string>('');

  // Auto-sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    const stored = localStorage.getItem(LAST_SYNC_KEY);
    return stored ? new Date(stored) : null;
  });
  const [simCountDelta, setSimCountDelta] = useState<number | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setTick] = useState(0); // Force re-render for "time ago"

  // Auto-sync function
  const runAutoSync = useCallback(async () => {
    if (isSyncing) return;
    setSyncStatus('syncing');
    setSimCountDelta(null);
    const prevCount = parseInt(localStorage.getItem(LAST_SIM_COUNT_KEY) || '0', 10);
    
    try {
      await syncSims();
      const now = new Date();
      setLastSyncTime(now);
      localStorage.setItem(LAST_SYNC_KEY, now.toISOString());
      setSyncStatus('success');
    } catch {
      setSyncStatus('error');
    }
  }, [syncSims, isSyncing]);

  // Update sim count delta after simCards changes
  useEffect(() => {
    if (simCards.length > 0 && syncStatus === 'success') {
      const prevCount = parseInt(localStorage.getItem(LAST_SIM_COUNT_KEY) || '0', 10);
      if (prevCount > 0) {
        setSimCountDelta(simCards.length - prevCount);
      }
      localStorage.setItem(LAST_SIM_COUNT_KEY, String(simCards.length));
    }
  }, [simCards.length, syncStatus]);

  // Auto-sync interval
  useEffect(() => {
    syncIntervalRef.current = setInterval(() => {
      runAutoSync();
    }, SYNC_INTERVAL_MS);

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [runAutoSync]);

  // ⚡ REAL-TIME SYNC - Updates appear instantly across all devices!
  useEffect(() => {
    console.log('🚀 Real-Time Sync activated - changes sync in real-time!');
    
    // Subscribe to cellstation_sims changes
    const subscription = supabase
      .channel('cellstation_sims_realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'cellstation_sims'
        },
        (payload) => {
          console.log('⚡ Real-time update received:', payload);
          // Refresh SIMs data immediately
          fetchSims();
        }
      )
      .subscribe();

    return () => {
      console.log('👋 Real-Time Sync disconnected');
      subscription.unsubscribe();
    };
  }, [fetchSims]);

  // Refresh "time ago" every 30s
  useEffect(() => {
    const ticker = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(ticker);
  }, []);

  // ⚡ REAL-TIME SYNC for Inventory - instant updates!
  useEffect(() => {
    console.log('🚀 Real-Time Inventory Sync activated!');
    
    // Subscribe to inventory changes
    const inventorySubscription = supabase
      .channel('inventory_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory'
        },
        (payload) => {
          console.log('⚡ Inventory updated in real-time:', payload);
          // Trigger cross-reference reload
          if (simCards.length > 0) {
            setTimeout(async () => {
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
              
              const swapNeeded = new Set<string>();
              for (const sim of simCards) {
                if (sim.status === 'available' && sim.iccid && rentedIccids.has(sim.iccid)) {
                  swapNeeded.add(sim.iccid);
                }
              }
              setNeedsSwapIccids(swapNeeded);
            }, 500);
          }
        }
      )
      .subscribe();

    return () => {
      inventorySubscription.unsubscribe();
    };
  }, [simCards]);

  // Inventory map for cross-referencing
  const [inventoryMap, setInventoryMap] = useState<InventoryMap>({});
  const [needsSwapIccids, setNeedsSwapIccids] = useState<Set<string>>(new Set());
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

  // Navigate to rental for a rented SIM
  const openRentalForSim = useCallback((sim: SimRow) => {
    const iccid = sim.iccid;
    if (!iccid || !inventoryMap[iccid]) return;
    const rentalId = inventoryMap[iccid].rentalId;
    if (rentalId) {
      window.location.href = `/rentals?highlight=${rentalId}`;
    }
  }, [inventoryMap]);

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
  const expiringSoon = useMemo(() => simCards.filter(s => {
    if (!s.expiry_date) return false;
    const days = differenceInDays(new Date(s.expiry_date), new Date());
    return days >= 0 && days <= 7;
  }), [simCards]);

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">📶 ניהול סימים</h1>
          <p className="text-sm text-muted-foreground">כרטיסי SIM מ-CellStation</p>
        </div>
        <div className="flex items-center gap-2">
          <SyncStatusIndicator status={syncStatus} lastSyncTime={lastSyncTime} simCountDelta={simCountDelta} />
          <Button onClick={runAutoSync} disabled={isSyncing} variant="outline" size="sm" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            רענן
          </Button>
        </div>
      </div>

      {/* Stats - כרטיסים גדולים וקליקביליים */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => setActiveTab('available')}
          className={`rounded-xl p-4 text-right border-2 transition-all ${activeTab === 'available' ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-transparent bg-green-100/60 dark:bg-green-950/20 hover:border-green-300'}`}
        >
          <div className="text-3xl font-bold text-green-700 dark:text-green-400">{stats.available}</div>
          <div className="text-sm font-medium text-green-800 dark:text-green-300">✅ זמינים</div>
        </button>
        <button
          onClick={() => setActiveTab('rented')}
          className={`rounded-xl p-4 text-right border-2 transition-all ${activeTab === 'rented' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-transparent bg-blue-100/60 dark:bg-blue-950/20 hover:border-blue-300'}`}
        >
          <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">{stats.rented}</div>
          <div className="text-sm font-medium text-blue-800 dark:text-blue-300">📤 מושכרים</div>
        </button>
        <button
          onClick={() => setActiveTab('expired')}
          className={`rounded-xl p-4 text-right border-2 transition-all ${activeTab === 'expired' ? 'border-red-500 bg-red-50 dark:bg-red-950/30' : 'border-transparent bg-red-100/60 dark:bg-red-950/20 hover:border-red-300'}`}
        >
          <div className="text-3xl font-bold text-red-700 dark:text-red-400">{stats.expired}</div>
          <div className="text-sm font-medium text-red-800 dark:text-red-300">❌ פגי תוקף</div>
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`rounded-xl p-4 text-right border-2 transition-all ${activeTab === 'all' ? 'border-gray-500 bg-gray-100 dark:bg-gray-800' : 'border-transparent bg-gray-100/60 dark:bg-gray-800/40 hover:border-gray-300'}`}
        >
          <div className="text-3xl font-bold text-gray-700 dark:text-gray-300">{stats.total}</div>
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">📊 סה״כ</div>
        </button>
      </div>

      {/* התראות */}
      {overdueSwapItems.length > 0 && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="font-bold text-red-700 text-sm">⚠️ סימים שדורשים החלפה ({overdueSwapItems.length})</span>
            </div>
            <div className="space-y-1">
              {overdueSwapItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/70 dark:bg-black/20">
                  <Button size="sm" variant="destructive" className="gap-1 h-7 text-xs"
                    onClick={() => { const sim = simCards.find(s => s.iccid === item.iccid); if (sim) setActivateSwapSim(sim); }}>
                    <Zap className="h-3 w-3" /> החלף עכשיו
                  </Button>
                  <div className="text-right text-sm">
                    <span className="font-semibold">{item.customerName}</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="font-mono text-xs">{item.simNumber}</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="text-red-600 font-bold">{item.daysOverdue} ימים</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {overdueNotReturned.length > 0 && (
        <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <span className="font-bold text-orange-700 text-sm">⏰ לקוחות לא החזירו ({overdueNotReturned.length})</span>
            </div>
            <div className="space-y-1">
              {overdueNotReturned.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/70 dark:bg-black/20">
                  {item.phone ? (
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" asChild>
                      <a href={`tel:${item.phone}`}><Phone className="h-3 w-3" /> התקשר</a>
                    </Button>
                  ) : <div />}
                  <div className="text-right text-sm">
                    <span className="font-semibold">{item.customerName}</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="font-mono text-xs">{item.simNumber}</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="text-orange-600 font-bold">{item.daysOverdue} ימים באיחור</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {expiringSoon.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="font-bold text-yellow-700 text-sm">⚡ פג תוקף בעוד 7 ימים ({expiringSoon.length})</span>
            </div>
            <div className="space-y-1">
              {expiringSoon.map((sim, i) => {
                const daysLeft = differenceInDays(new Date(sim.expiry_date!), new Date());
                return (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/70 dark:bg-black/20">
                    <span className={`font-bold text-sm ${daysLeft === 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                      {daysLeft === 0 ? 'פג היום!' : `${daysLeft} ימים`}
                    </span>
                    <div className="text-right text-sm">
                      {sim.customer_name && <span className="font-semibold">{sim.customer_name} · </span>}
                      <span dir="ltr" className="font-mono text-xs">{sim.il_number || sim.uk_number}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* חיפוש */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="חיפוש לפי מספר, לקוח, ICCID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10 h-11 text-base"
        />
      </div>

      {/* לשוניות */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="w-full grid grid-cols-5 h-11">
          <TabsTrigger value="all" className="text-xs">כל ({filtered.length})</TabsTrigger>
          <TabsTrigger value="available" className="text-xs">זמינים ({available.length})</TabsTrigger>
          <TabsTrigger value="rented" className="text-xs">מושכרים ({rented.length})</TabsTrigger>
          <TabsTrigger value="expired" className="text-xs">פגי תוקף ({expired.length})</TabsTrigger>
          <TabsTrigger value="activate" className="text-xs">הפעלה</TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="space-y-2 mt-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : (
          <>
            <TabsContent value="all" className="mt-3">
              <SimTable sims={filtered} showSystemStatus inventoryMap={inventoryMap} needsSwapIccids={needsSwapIccids} onActivateAndSwapClick={sim => setActivateSwapSim(sim)} onRentalClick={sim => openRentalForSim(sim)} />
            </TabsContent>
            <TabsContent value="available" className="mt-3">
              <SimTable sims={available} />
            </TabsContent>
            <TabsContent value="rented" className="mt-3">
              <SimTable sims={rented} showCustomer showSwap onSwapClick={sim => openSwapForSim(sim)} onRentalClick={sim => openRentalForSim(sim)} needsSwapIccids={needsSwapIccids} onActivateAndSwapClick={sim => setActivateSwapSim(sim)} />
            </TabsContent>
            <TabsContent value="expired" className="mt-3">
              <SimTable sims={expired} />
            </TabsContent>
            <TabsContent value="activate" className="mt-3">
              <ActivationTab availableSims={simCards} onActivate={activateSim} onActivateAndSwap={activateAndSwap} isActivating={isActivating} />
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Dialogs */}
      {swapDialogSim && (
        <SwapSimDialog
          sim={swapDialogSim}
          availableSims={simCards.filter(s => s.status === 'available' && s.iccid)}
          isOpen={!!swapDialogSim}
          onClose={() => setSwapDialogSim(null)}
          onSwap={handleSwap}
          isSwapping={isSwapping}
        />
      )}
      {activateSwapSim && (
        <ActivateAndSwapDialog
          currentSim={activateSwapSim}
          availableSims={simCards.filter(s => s.status === 'available' && s.iccid)}
          isOpen={!!activateSwapSim}
          onClose={() => setActivateSwapSim(null)}
          onActivateAndSwap={handleActivateAndSwap}
          isActivating={isActivating}
        />
      )}
    </div>
  );
}