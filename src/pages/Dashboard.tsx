import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRental } from '@/hooks/useRental';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/PageHeader';
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
} from 'lucide-react';
import { format, parseISO, isBefore, differenceInDays } from 'date-fns';
import { he } from 'date-fns/locale';

// Dashboard components
import { DashboardStatsGrid } from '@/components/dashboard/DashboardStatsGrid';
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner';
import { QuickStatsRow } from '@/components/dashboard/QuickStatsRow';
import { InventoryChart } from '@/components/dashboard/InventoryChart';
import { RentalsActivityChart } from '@/components/dashboard/RentalsActivityChart';
import { UpcomingReturnsCard } from '@/components/dashboard/UpcomingReturnsCard';
import { RecentRepairsCard } from '@/components/dashboard/RecentRepairsCard';
import { OverdueAlert } from '@/components/dashboard/OverdueAlert';
import { RevenueChart } from '@/components/dashboard/RevenueChart';

export default function Dashboard() {
  const { stats, rentals, repairs, inventory, getUpcomingReturns, loading } = useRental();
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

  // ⚡ REAL-TIME SYNC - Dashboard updates instantly!
  useEffect(() => {
    console.log('🚀 Dashboard Real-Time Sync activated!');
    
    // Subscribe to rentals changes
    const rentalsChannel = supabase
      .channel('rentals_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rentals'
        },
        (payload) => {
          console.log('⚡ Rentals updated in real-time:', payload);
          // The useRental hook will automatically fetch updated data
          window.location.reload(); // Temporary - will be replaced with query invalidation
        }
      )
      .subscribe();

    // Subscribe to inventory changes
    const inventoryChannel = supabase
      .channel('inventory_dashboard_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory'
        },
        (payload) => {
          console.log('⚡ Inventory updated in real-time:', payload);
          window.location.reload(); // Temporary - will be replaced with query invalidation
        }
      )
      .subscribe();

    // Subscribe to repairs changes
    const repairsChannel = supabase
      .channel('repairs_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'repairs'
        },
        (payload) => {
          console.log('⚡ Repairs updated in real-time:', payload);
          window.location.reload(); // Temporary - will be replaced with query invalidation
        }
      )
      .subscribe();

    return () => {
      console.log('👋 Dashboard Real-Time Sync disconnected');
      rentalsChannel.unsubscribe();
      inventoryChannel.unsubscribe();
      repairsChannel.unsubscribe();
    };
  }, []);

  const upcomingReturns = useMemo(() => getUpcomingReturns(), [getUpcomingReturns, rentals]);

  const { activeRentals, overdueRentals, pendingRepairs, readyRepairs } = useMemo(() => {
    const today = new Date();
    const active = rentals.filter(r => r.status === 'active');
    return {
      activeRentals: active,
      overdueRentals: active.filter(r => isBefore(parseISO(r.endDate), today)),
      pendingRepairs: repairs.filter(r => r.status !== 'collected'),
      readyRepairs: repairs.filter(r => r.status === 'ready'),
    };
  }, [rentals, repairs]);

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

      <WelcomeBanner />
      <DashboardStatsGrid stats={stats} inventory={inventory} />
      <QuickStatsRow 
        rentals={rentals}
        repairs={repairs}
        readyRepairs={readyRepairs}
        isSupported={isSupported}
        isSubscribed={isSubscribed}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <InventoryChart inventory={inventory} />
        <RentalsActivityChart rentals={rentals} />
      </div>

      <div className="mb-8">
        <RevenueChart rentals={rentals} />
      </div>

      <div className="mb-8">
        <NotificationSettings />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingReturnsCard upcomingReturns={upcomingReturns} />
        <RecentRepairsCard pendingRepairs={pendingRepairs} />
        <OverdueAlert overdueRentals={overdueRentals} />
      </div>

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