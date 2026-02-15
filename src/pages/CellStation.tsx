import { useState, useMemo, useEffect } from 'react';
import { useCellStation } from '@/hooks/useCellStation';
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
import { RefreshCw, Search, Signal, CheckCircle, XCircle, Clock, ArrowLeftRight, Zap, AlertTriangle } from 'lucide-react';

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

interface SimTableProps {
  sims: SimRow[];
  showCustomer?: boolean;
  showSwap?: boolean;
  onSwapClick?: (sim: SimRow) => void;
  onActivateAndSwapClick?: (sim: SimRow) => void;
  needsSwapIccids?: Set<string>;
}

function SimTable({ sims, showCustomer, showSwap, onSwapClick, onActivateAndSwapClick, needsSwapIccids }: SimTableProps) {
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

export default function CellStation() {
  const {
    simCards, isLoading, isSyncing, isSwapping,
    syncSims, activateSim, swapSim, activateAndSwap,
    stats,
  } = useCellStation();

  const [search, setSearch] = useState('');
  const [swapDialogSim, setSwapDialogSim] = useState<SimRow | null>(null);
  const [activateSwapSim, setActivateSwapSim] = useState<SimRow | null>(null);

  // Get ICCIDs that need swap: SIM is "available" in cellstation_sims BUT "rented" in inventory
  const [needsSwapIccids, setNeedsSwapIccids] = useState<Set<string>>(new Set());

  useEffect(() => {
    import('@/integrations/supabase/client').then(({ supabase }) => {
      // Get inventory items that are currently rented and have a sim_number
      supabase
        .from('inventory' as any)
        .select('sim_number')
        .eq('status', 'rented')
        .not('sim_number', 'is', null)
        .then(({ data }) => {
          if (data) {
            // Set of ICCIDs that are rented in our inventory
            const rentedIccids = new Set((data as any[]).map(d => d.sim_number).filter(Boolean));
            // Cross-reference: SIM is "available" in cellstation_sims but "rented" in inventory
            const swapNeeded = new Set<string>();
            for (const sim of simCards) {
              if (sim.status === 'available' && sim.iccid && rentedIccids.has(sim.iccid)) {
                swapNeeded.add(sim.iccid);
              }
            }
            setNeedsSwapIccids(swapNeeded);
          }
        });
    });
  }, [simCards]);

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
                  onSwapClick={sim => setSwapDialogSim(sim)}
                  needsSwapIccids={needsSwapIccids}
                  onActivateAndSwapClick={sim => setActivateSwapSim(sim)}
                />
              </TabsContent>
              <TabsContent value="activate" className="m-0">
                <ActivationTab
                  availableSims={simCards}
                  onActivate={activateSim}
                  isActivating={false}
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
          onSwap={swapSim}
          isSwapping={isSwapping}
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
