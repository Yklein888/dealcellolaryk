import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCellStation } from '@/hooks/useCellStation';
import { useToast } from '@/hooks/use-toast';
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
import { QuickActivateDialog } from '@/components/cellstation/QuickActivateDialog';
import { SimActionDialog, SimActionType } from '@/components/cellstation/SimActionDialog';
import { QuickRentalDialog } from '@/components/cellstation/QuickRentalDialog';
import { RefreshCw, Search, Clock, Zap, AlertTriangle, Phone, ArrowLeftRight, CheckCircle2, Activity, TrendingDown, BarChart3 } from 'lucide-react';
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
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
      status === 'syncing' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800' :
      status === 'error'   ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800' :
      status === 'success' ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800' :
      'bg-muted border-border text-muted-foreground'
    }`}>
      <span>{emoji}</span>
      <span>{text}</span>
      {simCountDelta !== null && simCountDelta !== 0 && status === 'success' && (
        <span className={`font-bold ${simCountDelta > 0 ? 'text-green-600' : 'text-orange-600'}`}>
          ({simCountDelta > 0 ? '+' : ''}{simCountDelta})
        </span>
      )}
    </div>
  );
}

function StatusBadge({ status, detail, isOverdue }: { status: string | null; detail: string | null; isOverdue?: boolean }) {
  if (detail === 'expired') {
    return <Badge className="bg-red-500/20 text-red-700 border-red-300">פג תוקף</Badge>;
  }
  if (status === 'rented') {
    if (isOverdue) return <Badge className="bg-orange-500/20 text-orange-700 border-orange-300">⏰ באיחור</Badge>;
    return <Badge className="bg-blue-500/20 text-blue-700 border-blue-300">מושכר</Badge>;
  }
  if (status === 'available') {
    if (detail === 'expiring') return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-300">קרוב לפקיעה</Badge>;
    return <Badge className="bg-green-500/20 text-green-700 border-green-300">זמין</Badge>;
  }
  return <Badge variant="outline">{detail || status || 'לא ידוע'}</Badge>;
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
  [iccid: string]: { status: string; id: string; rentalId?: string };
}

interface SimTableProps {
  sims: SimRow[];
  showCustomer?: boolean;
  showSwap?: boolean;
  inventoryMap?: InventoryMap;
  onSwapClick?: (sim: SimRow) => void;
  onActivateAndSwapClick?: (sim: SimRow) => void;
  onActivateClick?: (sim: SimRow) => void;
  onRentalClick?: (sim: SimRow) => void;
  needsSwapIccids?: Set<string>;
  overdueIccids?: Set<string>;
  showActionButton?: boolean;
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

// Mobile card view for a single SIM
function SimCard({ sim, showCustomer, showSwap, showActionButton, needsSwapIccids, overdueIccids, onSwapClick, onActivateAndSwapClick, onActivateClick, onRentalClick }: SimTableProps & { sim: SimRow }) {
  const needsSwap = needsSwapIccids?.has(sim.iccid || '');
  const isOverdue = overdueIccids?.has(sim.iccid || '');
  const isRentedClickable = sim.status === 'rented' && !!onRentalClick;
  return (
    <div
      className={`rounded-xl border bg-card p-4 shadow-sm space-y-2 transition-all duration-150
        ${needsSwap ? 'border-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/10' : ''}
        ${isRentedClickable ? 'cursor-pointer hover:shadow-md hover:border-blue-300 active:scale-[0.99]' : ''}`}
      onClick={() => { if (isRentedClickable) onRentalClick!(sim); }}
    >
      {/* Row 1: Status + ICCID */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <StatusBadge status={sim.status} detail={sim.status_detail} isOverdue={isOverdue} />
          {needsSwap && <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />}
        </div>
        <span className="font-mono text-xs text-muted-foreground">{shortIccid(sim.iccid)}</span>
      </div>
      {/* Row 2: Phone numbers */}
      <div className="flex gap-3 text-sm">
        {sim.uk_number && <span dir="ltr" className="font-semibold">{sim.uk_number}</span>}
        {sim.il_number && <span dir="ltr" className="text-muted-foreground">{sim.il_number}</span>}
        {!sim.uk_number && !sim.il_number && <span className="text-muted-foreground">—</span>}
      </div>
      {/* Row 3: Customer + period (if rented) */}
      {showCustomer && sim.customer_name && (
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{sim.customer_name}</span>
          {sim.start_date && <span className="mr-2 text-xs">{formatDate(sim.start_date)} – {formatDate(sim.end_date)}</span>}
        </div>
      )}
      {/* Row 4: Expiry + plan + actions */}
      <div className="flex items-center justify-between pt-1" onClick={e => e.stopPropagation()}>
        <div className="flex gap-2 text-xs text-muted-foreground">
          {sim.expiry_date && <span>תוקף: {formatDate(sim.expiry_date)}</span>}
          {sim.plan && <span>· {sim.plan}</span>}
        </div>
        <div className="flex gap-1">
          {showActionButton && sim.status === 'available' && onActivateClick && !needsSwap && (
            <Button size="sm" onClick={() => onActivateClick(sim)} className="gap-1 text-xs h-7 bg-green-600 hover:bg-green-700">
              <Zap className="h-3 w-3" /> הפעל
            </Button>
          )}
          {needsSwap && onActivateAndSwapClick && (
            <Button size="sm" variant="destructive" onClick={() => onActivateAndSwapClick(sim)} className="gap-1 text-xs h-7">
              <ArrowLeftRight className="h-3 w-3" /> החלף
            </Button>
          )}
          {!needsSwap && isOverdue && onActivateAndSwapClick && (
            <Button size="sm" variant="outline" onClick={() => onActivateAndSwapClick(sim)} className="gap-1 text-xs h-7 border-orange-400 text-orange-700 hover:bg-orange-50">
              <ArrowLeftRight className="h-3 w-3" /> הפעלה והחלפה
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SimTable({ sims, showCustomer, showSwap, inventoryMap, onSwapClick, onActivateAndSwapClick, onActivateClick, onRentalClick, needsSwapIccids, overdueIccids, showActionButton }: SimTableProps) {
  if (sims.length === 0) {
    return <p className="text-center text-muted-foreground py-8">אין סימים להצגה</p>;
  }
  return (
    <>
      {/* Mobile: Cards */}
      <div className="lg:hidden space-y-2.5">
        {sims.map(sim => (
          <SimCard key={sim.id} sim={sim} sims={sims} showCustomer={showCustomer} showSwap={showSwap} showActionButton={showActionButton}
            needsSwapIccids={needsSwapIccids} overdueIccids={overdueIccids}
            onSwapClick={onSwapClick} onActivateAndSwapClick={onActivateAndSwapClick}
            onActivateClick={onActivateClick} onRentalClick={onRentalClick} />
        ))}
      </div>
      {/* Desktop: Table */}
      <div className="hidden lg:block overflow-x-auto rounded-xl border border-border/50">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="border-b border-border/50 hover:bg-transparent">
              <TableHead className="font-semibold text-foreground">SIM</TableHead>
              <TableHead className="font-semibold text-foreground">UK Number</TableHead>
              <TableHead className="font-semibold text-foreground">IL Number</TableHead>
              <TableHead className="font-semibold text-foreground">ICCID</TableHead>
              <TableHead className="font-semibold text-foreground">סטטוס</TableHead>
              <TableHead className="font-semibold text-foreground">תוקף</TableHead>
              <TableHead className="font-semibold text-foreground">חבילה</TableHead>
              {showCustomer && <TableHead className="font-semibold text-foreground">לקוח</TableHead>}
              {showCustomer && <TableHead className="font-semibold text-foreground">תקופה</TableHead>}
              {(showSwap || needsSwapIccids || showActionButton) && <TableHead className="font-semibold text-foreground">פעולה</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sims.map((sim, idx) => {
              const needsSwap = needsSwapIccids?.has(sim.iccid || '');
              const isOverdue = overdueIccids?.has(sim.iccid || '');
              return (
                <TableRow
                  key={sim.id}
                  className={`transition-colors duration-100
                    ${idx % 2 === 1 ? 'bg-muted/20' : ''}
                    ${needsSwap ? 'bg-yellow-50 dark:bg-yellow-950/10' : ''}
                    ${(sim.status === 'rented' && onRentalClick) ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20' : 'hover:bg-muted/40'}`}
                  onClick={() => { if (sim.status === 'rented' && onRentalClick) onRentalClick(sim); }}
                >
                  <TableCell className="font-mono text-xs">{sim.sim_number || '-'}</TableCell>
                  <TableCell dir="ltr" className="font-medium">{sim.uk_number || '-'}</TableCell>
                  <TableCell dir="ltr">{sim.il_number || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{shortIccid(sim.iccid)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <StatusBadge status={sim.status} detail={sim.status_detail} isOverdue={isOverdue} />
                      {needsSwap && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(sim.expiry_date)}</TableCell>
                  <TableCell>{sim.plan || '-'}</TableCell>
                  {showCustomer && <TableCell className="font-medium">{sim.customer_name || '-'}</TableCell>}
                  {showCustomer && (
                    <TableCell className="text-xs text-muted-foreground">
                      {sim.start_date ? `${formatDate(sim.start_date)} - ${formatDate(sim.end_date)}` : '-'}
                    </TableCell>
                  )}
                  {(showSwap || needsSwapIccids || showActionButton) && (
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 flex-wrap">
                        {showActionButton && sim.status === 'available' && onActivateClick && !needsSwap && (
                          <Button size="sm" variant="default" onClick={() => onActivateClick(sim)} className="gap-1 text-xs bg-green-600 hover:bg-green-700">
                            <Zap className="h-3 w-3" /> הפעל
                          </Button>
                        )}
                        {needsSwap && onActivateAndSwapClick && (
                          <Button size="sm" variant="destructive" onClick={() => onActivateAndSwapClick(sim)} className="gap-1 text-xs">
                            <ArrowLeftRight className="h-3 w-3" /> החלף
                          </Button>
                        )}
                        {!needsSwap && isOverdue && onActivateAndSwapClick && (
                          <Button size="sm" variant="outline" onClick={() => onActivateAndSwapClick(sim)} className="gap-1 text-xs border-orange-400 text-orange-700 hover:bg-orange-50">
                            <ArrowLeftRight className="h-3 w-3" /> הפעלה והחלפה
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
    </>
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    simCards, isLoading, isSyncing,
    syncSims, activateSim, activateSimWithStatus, swapSim, activateAndSwap,
    stats, fetchSims, isActivating,
  } = useCellStation();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('available');
  const [swapDialogSim, setSwapDialogSim] = useState<SimRow | null>(null);
  const [quickActivateSim, setQuickActivateSim] = useState<SimRow | null>(null);
  const [activateSwapSim, setActivateSwapSim] = useState<SimRow | null>(null);
  const [swapRentalId, setSwapRentalId] = useState<string>('');
  const [simActionDialogSim, setSimActionDialogSim] = useState<SimRow | null>(null);
  const [quickRentalDialogSim, setQuickRentalDialogSim] = useState<SimRow | null>(null);

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

  // Keep ref in sync with latest runAutoSync (avoids interval reset on state changes)
  const autoSyncFnRef = useRef(runAutoSync);
  useEffect(() => { autoSyncFnRef.current = runAutoSync; }, [runAutoSync]);

  // Auto-sync interval - stable, never resets due to isSyncing state flips
  useEffect(() => {
    syncIntervalRef.current = setInterval(() => {
      autoSyncFnRef.current();
    }, SYNC_INTERVAL_MS);

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, []);

  // Real-time for cellstation_sims handled via fetchSims() polling

  // Refresh "time ago" every 30s
  useEffect(() => {
    const ticker = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(ticker);
  }, []);

  // Inventory map for cross-referencing
  const [inventoryMap, setInventoryMap] = useState<InventoryMap>({});
  const [needsSwapIccids, setNeedsSwapIccids] = useState<Set<string>>(new Set());
  const [overdueIccids, setOverdueIccids] = useState<Set<string>>(new Set());
  const [overdueSwapItems, setOverdueSwapItems] = useState<OverdueSwapItem[]>([]);
  const [overdueNotReturned, setOverdueNotReturned] = useState<OverdueNotReturnedItem[]>([]);

  // ⚡ Cross-reference + Real-time sync (merged so loadCrossReference is in scope for subscription)
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

      // Add rentalId to map by joining rented inventory items → rental_items → active rentals
      const rentedInvIds = Object.values(map).filter(v => v.status === 'rented').map(v => v.id);
      if (rentedInvIds.length > 0) {
        const { data: riData } = await supabase
          .from('rental_items')
          .select('inventory_item_id, rental_id')
          .in('inventory_item_id', rentedInvIds);
        if (riData && riData.length > 0) {
          const rentalIds = [...new Set((riData as any[]).map((r: any) => r.rental_id).filter(Boolean))];
          const { data: activeRentals } = await supabase
            .from('rentals')
            .select('id')
            .in('id', rentalIds)
            .in('status', ['active', 'overdue']);
          const activeSet = new Set((activeRentals || []).map((r: any) => r.id));
          const invToRental: Record<string, string> = {};
          for (const ri of riData as any[]) {
            if (ri.inventory_item_id && ri.rental_id && activeSet.has(ri.rental_id)) {
              invToRental[ri.inventory_item_id] = ri.rental_id;
            }
          }
          for (const iccid of Object.keys(map)) {
            const rId = invToRental[map[iccid].id];
            if (rId) map[iccid] = { ...map[iccid], rentalId: rId };
          }
        }
      }
      setInventoryMap(map);

      // 2. Compute needs_swap: available in cellstation + has ACTIVE rental in our system
      // map[iccid].rentalId is only set (above) for items with an active/overdue rental
      const swapNeeded = new Set<string>();
      for (const sim of simCards) {
        if (sim.status === 'available' && sim.iccid && map[sim.iccid]?.rentalId) {
          swapNeeded.add(sim.iccid);
        }
      }
      setNeedsSwapIccids(swapNeeded);

      // 2b. overdueIccids = מושכר בCS + מושכר אצלנו + עבר תאריך סיום
      // נחשב אחרי שנטען overdue rentals למטה

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
        // overdueIccids = סימים שהלקוח לא החזיר (מושכר בCS + אצלנו + באיחור)
        const overdueSet = new Set<string>(notReturnedItems.map(i => {
          const sim = simCards.find(s => (s.uk_number || s.il_number || s.sim_number) === i.simNumber);
          return sim?.iccid || '';
        }).filter(Boolean));
        setOverdueIccids(overdueSet);
      } else {
        setOverdueSwapItems([]);
        setOverdueNotReturned([]);
        setOverdueIccids(new Set());
      }
    }

    if (simCards.length > 0) {
      loadCrossReference();
    }

    // ⚡ Real-time inventory subscription — calls loadCrossReference() on changes
    console.log('🚀 Real-Time Inventory Sync activated!');
    const inventorySubscription = supabase
      .channel('inventory_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory' },
        (payload) => {
          console.log('⚡ Inventory updated in real-time:', payload);
          if (simCards.length > 0) {
            setTimeout(() => { loadCrossReference(); }, 500);
          }
        }
      )
      .subscribe();

    return () => {
      inventorySubscription.unsubscribe();
    };
  }, [simCards]);

  // Quick activate a SIM directly from the table row
  const handleQuickActivate = useCallback(async (sim: SimRow, params: {
    start_rental: string;
    end_rental: string;
    price: string;
    days: string;
    note: string;
  }) => {
    if (!sim.iccid) return { success: false, error: 'אין ICCID' };
    // activateSimWithStatus מפעיל + מעדכן cellstation_sims (דרך Supabase הנכון)
    return await activateSimWithStatus({ iccid: sim.iccid, ...params });
  }, [activateSimWithStatus]);

  // Navigate to rental for a rented SIM
  const handleSimAction = useCallback((action: SimActionType) => {
    const sim = simActionDialogSim;
    setSimActionDialogSim(null);
    if (!sim) return;
    if (action === 'quick_activate') setQuickActivateSim(sim);
    if (action === 'quick_rental') setQuickRentalDialogSim(sim);
    if (action === 'activate_and_swap') setActivateSwapSim(sim);
  }, [simActionDialogSim]);

  const openRentalForSim = useCallback((sim: SimRow) => {
    const iccid = sim.iccid;
    if (!iccid || !inventoryMap[iccid]) return;
    const rentalId = inventoryMap[iccid].rentalId;
    if (rentalId) {
      navigate(`/rentals?highlight=${rentalId}`);
    }
  }, [inventoryMap, navigate]);

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
    try {
      const result = await swapSim(params);

      // After edge function succeeds, update local DB
      const oldIccid = swapDialogSim?.iccid;
      const newIccid = params.swap_iccid;

      // 1. Update old inventory item to available
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
        const { data: created, error: createError } = await supabase.from('inventory').insert({
          name: `סים גלישה`,
          category: 'sim_european',
          sim_number: newIccid,
          local_number: newSimData?.uk_number || params.swap_msisdn || null,
          israeli_number: newSimData?.il_number || null,
          expiry_date: newSimData?.expiry_date || null,
          status: 'rented',
        }).select('id').single();
        if (!created || createError) {
          toast({ title: 'שגיאה ביצירת מלאי', description: createError?.message || 'לא ניתן ליצור פריט מלאי חדש', variant: 'destructive' });
          return result;
        }
        newInventoryId = created.id;
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
      toast({ title: '✅ החלפה הושלמה!', description: `הסים הוחלף בהצלחה ל-${params.swap_msisdn}` });
      return result;
    } catch (e: any) {
      toast({ title: '❌ החלפה נכשלה', description: e.message, variant: 'destructive' });
      throw e;
    }
  }, [swapSim, swapDialogSim, simCards, fetchSims, toast]);

  const filtered = useMemo(() => {
    if (!search.trim()) return simCards;
    const q = search.toLowerCase();
    return simCards.filter(s =>
      [s.sim_number, s.uk_number, s.il_number, s.iccid, s.customer_name, s.plan]
        .some(v => v?.toLowerCase().includes(q))
    );
  }, [simCards, search]);

  const available = useMemo(() => filtered.filter(s => s.status === 'available' && s.status_detail !== 'expired' && !needsSwapIccids.has(s.iccid || '')), [filtered, needsSwapIccids]);
  const expired = useMemo(() => filtered.filter(s => s.status === 'available' && s.status_detail === 'expired'), [filtered]);
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
          <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-l from-primary to-foreground bg-clip-text text-transparent">📶 ניהול סימים</h1>
          <p className="text-sm text-muted-foreground mt-0.5">כרטיסי SIM מ-CellStation</p>
        </div>
        <div className="flex items-center gap-2">
          <SyncStatusIndicator status={syncStatus} lastSyncTime={lastSyncTime} simCountDelta={simCountDelta} />
          <Button onClick={runAutoSync} disabled={isSyncing} size="sm" className="gap-2 bg-gradient-to-r from-primary to-accent text-white hover:opacity-90 shadow-sm">
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            רענן
          </Button>
        </div>
      </div>

      {/* Stats - כרטיסי gradient עם אייקונים */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => setActiveTab('available')}
          className={`rounded-2xl p-4 text-right shadow-md hover:shadow-xl hover:scale-[1.03] transition-all duration-200 bg-gradient-to-br from-emerald-400 to-green-600 text-white ring-2 ${activeTab === 'available' ? 'ring-emerald-300 ring-offset-2' : 'ring-transparent'}`}
        >
          <div className="flex items-start justify-between mb-1">
            <CheckCircle2 className="h-7 w-7 opacity-75" />
            <div className="text-4xl font-extrabold">{stats.available}</div>
          </div>
          <div className="text-sm font-semibold opacity-90">זמינים</div>
        </button>
        <button
          onClick={() => setActiveTab('rented')}
          className={`rounded-2xl p-4 text-right shadow-md hover:shadow-xl hover:scale-[1.03] transition-all duration-200 bg-gradient-to-br from-blue-400 to-blue-600 text-white ring-2 ${activeTab === 'rented' ? 'ring-blue-300 ring-offset-2' : 'ring-transparent'}`}
        >
          <div className="flex items-start justify-between mb-1">
            <Activity className="h-7 w-7 opacity-75" />
            <div className="text-4xl font-extrabold">{stats.rented}</div>
          </div>
          <div className="text-sm font-semibold opacity-90">מושכרים</div>
        </button>
        <button
          onClick={() => setActiveTab('expired')}
          className={`rounded-2xl p-4 text-right shadow-md hover:shadow-xl hover:scale-[1.03] transition-all duration-200 bg-gradient-to-br from-rose-400 to-red-600 text-white ring-2 ${activeTab === 'expired' ? 'ring-rose-300 ring-offset-2' : 'ring-transparent'}`}
        >
          <div className="flex items-start justify-between mb-1">
            <TrendingDown className="h-7 w-7 opacity-75" />
            <div className="text-4xl font-extrabold">{stats.expired}</div>
          </div>
          <div className="text-sm font-semibold opacity-90">פגי תוקף</div>
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`rounded-2xl p-4 text-right shadow-md hover:shadow-xl hover:scale-[1.03] transition-all duration-200 bg-gradient-to-br from-slate-500 to-slate-700 text-white ring-2 ${activeTab === 'all' ? 'ring-slate-400 ring-offset-2' : 'ring-transparent'}`}
        >
          <div className="flex items-start justify-between mb-1">
            <BarChart3 className="h-7 w-7 opacity-75" />
            <div className="text-4xl font-extrabold">{stats.total}</div>
          </div>
          <div className="text-sm font-semibold opacity-90">סה״כ</div>
        </button>
      </div>

      {/* התראות */}


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
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="חיפוש לפי מספר, לקוח, ICCID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10 h-12 text-base border-border/70 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary rounded-xl shadow-sm"
        />
      </div>

      {/* לשוניות */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="w-full grid grid-cols-5 h-12 rounded-xl bg-muted/60 p-1 gap-0.5">
          <TabsTrigger value="all" className="text-xs rounded-lg font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-background">כל ({filtered.length})</TabsTrigger>
          <TabsTrigger value="available" className="text-xs rounded-lg font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-green-700 dark:data-[state=active]:bg-background">זמינים ({available.length})</TabsTrigger>
          <TabsTrigger value="rented" className="text-xs rounded-lg font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700 dark:data-[state=active]:bg-background">מושכרים ({rented.length})</TabsTrigger>
          <TabsTrigger value="expired" className="text-xs rounded-lg font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-red-700 dark:data-[state=active]:bg-background">פגי תוקף ({expired.length})</TabsTrigger>
          <TabsTrigger value="activate" className="text-xs rounded-lg font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-background">הפעלה</TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="space-y-2 mt-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : (
          <>
            <TabsContent value="all" className="mt-3">
              <SimTable sims={filtered} showActionButton inventoryMap={inventoryMap} needsSwapIccids={needsSwapIccids} onActivateAndSwapClick={sim => setActivateSwapSim(sim)} onActivateClick={sim => setSimActionDialogSim(sim)} onRentalClick={sim => openRentalForSim(sim)} overdueIccids={overdueIccids} />
            </TabsContent>
            <TabsContent value="available" className="mt-3">
              <SimTable sims={available} showActionButton onActivateClick={sim => setSimActionDialogSim(sim)} onActivateAndSwapClick={sim => setActivateSwapSim(sim)} needsSwapIccids={needsSwapIccids} />
            </TabsContent>
            <TabsContent value="rented" className="mt-3">
              <SimTable sims={rented} showCustomer onRentalClick={sim => openRentalForSim(sim)} needsSwapIccids={needsSwapIccids} overdueIccids={overdueIccids} onActivateAndSwapClick={sim => setActivateSwapSim(sim)} />
            </TabsContent>
            <TabsContent value="expired" className="mt-3">
              <SimTable sims={expired} showActionButton onActivateClick={sim => setSimActionDialogSim(sim)} onActivateAndSwapClick={sim => setActivateSwapSim(sim)} needsSwapIccids={needsSwapIccids} />
            </TabsContent>
            <TabsContent value="activate" className="mt-3">
              <ActivationTab availableSims={simCards} onActivate={activateSim} onActivateAndSwap={activateAndSwap} isActivating={isActivating} />
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* SimAction Dialog */}
      {simActionDialogSim && (
        <SimActionDialog
          sim={simActionDialogSim}
          isOpen={!!simActionDialogSim}
          onClose={() => setSimActionDialogSim(null)}
          onAction={handleSimAction}
        />
      )}

      {/* Quick Rental Dialog */}
      {quickRentalDialogSim && (
        <QuickRentalDialog
          sim={quickRentalDialogSim}
          isOpen={!!quickRentalDialogSim}
          onClose={() => setQuickRentalDialogSim(null)}
          onActivate={handleQuickActivate}
          onSuccess={() => { setQuickRentalDialogSim(null); fetchSims(); }}
        />
      )}

      {/* Quick Activate Dialog */}
      {quickActivateSim && (
        <QuickActivateDialog
          sim={quickActivateSim}
          isOpen={!!quickActivateSim}
          onClose={() => setQuickActivateSim(null)}
          onActivate={handleQuickActivate}
          isActivating={isActivating}
        />
      )}

      {/* Dialogs */}
      {swapDialogSim && (
        <SwapSimDialog
          open={!!swapDialogSim}
          onOpenChange={(open) => { if (!open) setSwapDialogSim(null); }}
          currentSim={swapDialogSim}
          availableSims={simCards.filter(s => s.status === 'available' && s.iccid)}
          onSwap={handleSwapWithUpdates}
          isSwapping={false}
        />
      )}
      {activateSwapSim && (
        <ActivateAndSwapDialog
          open={!!activateSwapSim}
          onOpenChange={(open) => { if (!open) setActivateSwapSim(null); }}
          oldSim={activateSwapSim}
          availableSims={simCards.filter(s => s.status === 'available' && s.iccid)}
          onActivateAndSwap={activateAndSwap}
        />
      )}
    </div>
  );
}