import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import { useRental } from '@/hooks/useRental';

import { PageHeader } from '@/components/PageHeader';
import { SortableTable, Column } from '@/components/SortableTable';
import { EmptyState, LoadingState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { GlobalSearch } from '@/components/GlobalSearch';
import { QuickActions } from '@/components/QuickActions';
import { PriceCalculator } from '@/components/PriceCalculator';
import { NotificationSettings } from '@/components/NotificationSettings';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/hooks/use-toast';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { QuickActionDialog } from '@/components/inventory/QuickActionDialog';
import { InventoryItem } from '@/types/rental';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import {
  Search,
  Plus,
  Calculator,
  ScanLine,
  Globe,
  ArrowRight,
} from 'lucide-react';
import { format, parseISO, isBefore, differenceInDays } from 'date-fns';
import { he } from 'date-fns/locale';

// Dashboard components
import { DashboardStatsGrid } from '@/components/dashboard/DashboardStatsGrid';
import { QuickStatsRow } from '@/components/dashboard/QuickStatsRow';

// Lazy load heavy chart components
const InventoryChart = lazy(() => import('@/components/dashboard/InventoryChart').then(m => ({ default: m.InventoryChart })));
const RentalsActivityChart = lazy(() => import('@/components/dashboard/RentalsActivityChart').then(m => ({ default: m.RentalsActivityChart })));
const RevenueChart = lazy(() => import('@/components/dashboard/RevenueChart').then(m => ({ default: m.RevenueChart })));
const UpcomingReturnsCard = lazy(() => import('@/components/dashboard/UpcomingReturnsCard').then(m => ({ default: m.UpcomingReturnsCard })));
const RecentRepairsCard = lazy(() => import('@/components/dashboard/RecentRepairsCard').then(m => ({ default: m.RecentRepairsCard })));
const OverdueAlert = lazy(() => import('@/components/dashboard/OverdueAlert').then(m => ({ default: m.OverdueAlert })));

// Fallback component for chart loading
const ChartSkeleton = () => (
  <div className="rounded-2xl p-6 bg-muted/30 animate-pulse min-h-80">
    <div className="h-4 bg-muted rounded w-1/3 mb-4"></div>
    <div className="space-y-3">
      <div className="h-64 bg-muted rounded"></div>
    </div>
  </div>
);

export default function Dashboard() {
  const { stats, rentals, repairs, inventory, getUpcomingReturns, loading, usSims, usSimsLoading } = useRental();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [isQuickActionDialogOpen, setIsQuickActionDialogOpen] = useState(false);
  const [scannedSearchTerm, setScannedSearchTerm] = useState<string>('');
  const { isSubscribed, notifyRentalDue, isSupported } = usePushNotifications();
  const { toast } = useToast();

  // Handle barcode scan result
  const handleBarcodeScan = useCallback((barcode: string) => {
    const item = inventory.find(i => i.barcode === barcode);
    if (item) {
      setSelectedInventoryItem(item);
      setIsQuickActionDialogOpen(true);
    } else {
      setScannedSearchTerm(barcode);
      setIsSearchOpen(true);
    }
  }, [inventory]);

  // Check for rentals due soon and send notifications
  useEffect(() => {
    if (!isSubscribed) return;

    const checkDueRentals = () => {
      const today = new Date();
      rentals
        .filter(r => r.status === 'active')
        .forEach(rental => {
          const endDate = parseISO(rental.endDate);
          const daysUntilDue = differenceInDays(endDate, today);
          if (daysUntilDue <= 1 && daysUntilDue >= 0) {
            notifyRentalDue(rental.customerName, format(endDate, 'dd/MM/yyyy', { locale: he }));
          }
        });
    };

    checkDueRentals();
    const interval = setInterval(checkDueRentals, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isSubscribed, rentals, notifyRentalDue]);


  const upcomingReturns = useMemo(() => getUpcomingReturns(), [getUpcomingReturns, rentals]);

  const { activeRentals, overdueRentals, pendingRepairs, readyRepairs, simsStats, rentalsWithUSSims } = useMemo(() => {
    const today = new Date();
    const active = rentals.filter(r => r.status === 'active');

    // US SIMs stats
    const pendingSims = usSims.filter(s => s.status === 'pending').length;
    const activatingSims = usSims.filter(s => s.status === 'activating').length;
    const activeSims = usSims.filter(s => s.status === 'active').length;

    // Rentals with US SIMs
    const rentalsWithUS = active.filter(r =>
      r.items.some(item => item.itemCategory === 'sim_american')
    );

    return {
      activeRentals: active,
      overdueRentals: active.filter(r => isBefore(parseISO(r.endDate), today)),
      pendingRepairs: repairs.filter(r => r.status !== 'collected'),
      readyRepairs: repairs.filter(r => r.status === 'ready'),
      simsStats: { pending: pendingSims, activating: activatingSims, active: activeSims },
      rentalsWithUSSims: rentalsWithUS,
    };
  }, [rentals, repairs, usSims]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div>
      <PageHeader 
        title="דאשבורד" 
        description="סקירה כללית של המערכת"
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setIsSearchOpen(true)} className="gap-2">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">חיפוש</span>
            <kbd className="hidden sm:inline px-2 py-0.5 text-xs rounded bg-muted">⌘K</kbd>
          </Button>
          <Button variant="outline" onClick={() => setIsScannerOpen(true)} className="gap-2">
            <ScanLine className="h-4 w-4" />
            <span className="hidden sm:inline">סרוק</span>
          </Button>
          <Button variant="outline" onClick={() => setIsCalculatorOpen(true)} className="gap-2">
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline">מחשבון</span>
          </Button>
          <Button variant="glow" onClick={() => setIsQuickActionsOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">פעולה מהירה</span>
          </Button>
        </div>
      </PageHeader>

      <DashboardStatsGrid stats={stats} inventory={inventory} />
      <QuickStatsRow
        rentals={rentals}
        repairs={repairs}
        readyRepairs={readyRepairs}
        isSupported={isSupported}
        isSubscribed={isSubscribed}
      />

      <Suspense fallback={<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><ChartSkeleton /><ChartSkeleton /></div>}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <InventoryChart inventory={inventory} />
          <RentalsActivityChart rentals={rentals} />
        </div>
      </Suspense>

      <Suspense fallback={<div className="mb-8"><ChartSkeleton /></div>}>
        <div className="mb-8">
          <RevenueChart rentals={rentals} />
        </div>
      </Suspense>

      {/* US SIMs Activations Section */}
      <div className="mb-8">
        <div className="stat-card">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-lg">
                  <Globe className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">הפעלות סימים</h2>
                  <p className="text-xs text-muted-foreground">סימים לארה״ב</p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="/sims" className="gap-2">
                  <span>נהל</span>
                  <ArrowRight className="h-3 w-3" />
                </a>
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-warning">{simsStats.pending}</p>
                <p className="text-xs text-muted-foreground mt-1">ממתינים</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-500">{simsStats.activating}</p>
                <p className="text-xs text-muted-foreground mt-1">בהפעלה</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-success">{simsStats.active}</p>
                <p className="text-xs text-muted-foreground mt-1">פעילים</p>
              </div>
            </div>
          </div>
          <div className="stat-shimmer" />
          <div className="stat-bar" />
        </div>
      </div>

      {/* Rentals with US SIMs Section */}
      <div className="mb-8">
        <div className="stat-card">
          <div className="relative z-10">
            <h2 className="text-lg font-bold text-foreground mb-4">השכרות עם סימים לארה״ב</h2>

            {rentalsWithUSSims.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">אין השכרות פעילות עם סימים לארה״ב כרגע</p>
            ) : (
              <SortableTable<typeof rentalsWithUSSims[0]>
                columns={useMemo(() => [
                  {
                    key: 'customerName',
                    label: 'לקוח',
                    sortable: true,
                  },
                  {
                    key: 'endDate',
                    label: 'עד תאריך',
                    sortable: true,
                    render: (value) => format(parseISO(value as string), 'dd/MM/yyyy', { locale: he }),
                  },
                  {
                    key: 'totalPrice',
                    label: 'מחיר',
                    sortable: true,
                    render: (value, row: any) => `${row.currency === 'USD' ? '$' : '₪'}${(value as number).toFixed(0)}`,
                  },
                ] as Column<typeof rentalsWithUSSims[0]>[], [])}
                data={rentalsWithUSSims.slice(0, 5)}
                keyExtractor={(rental) => rental.id}
                defaultSort="endDate"
                defaultSortDirection="asc"
                noDataMessage="אין השכרות עם סימים לארה״ב"
              />
            )}
          </div>
          <div className="stat-shimmer" />
          <div className="stat-bar" />
        </div>
      </div>

      <div className="mb-8">
        <NotificationSettings />
      </div>

      <Suspense fallback={<div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><ChartSkeleton /><ChartSkeleton /><ChartSkeleton /></div>}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UpcomingReturnsCard upcomingReturns={upcomingReturns} />
          <RecentRepairsCard pendingRepairs={pendingRepairs} />
          <OverdueAlert overdueRentals={overdueRentals} />
        </div>
      </Suspense>

      {/* Modals */}
      <GlobalSearch 
        isOpen={isSearchOpen} 
        onClose={() => { setIsSearchOpen(false); setScannedSearchTerm(''); }}
        initialSearchTerm={scannedSearchTerm}
      />
      <QuickActions isOpen={isQuickActionsOpen} onClose={() => setIsQuickActionsOpen(false)} />
      <PriceCalculator isOpen={isCalculatorOpen} onClose={() => setIsCalculatorOpen(false)} />
      <BarcodeScanner 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        onScan={handleBarcodeScan}
      />
      {selectedInventoryItem && (
        <QuickActionDialog
          isOpen={isQuickActionDialogOpen}
          onClose={() => { setIsQuickActionDialogOpen(false); setSelectedInventoryItem(null); }}
          item={selectedInventoryItem}
        />
      )}
    </div>
  );
}