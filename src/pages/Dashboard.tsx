import { useState, useEffect } from 'react';
import { useRental } from '@/hooks/useRental';
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
import { 
  Search,
  Plus,
  Calculator,
  Activity,
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
  const handleBarcodeScan = (barcode: string) => {
    // First, try to find an exact barcode match
    const item = inventory.find(i => i.barcode === barcode);
    if (item) {
      setSelectedInventoryItem(item);
      setIsQuickActionDialogOpen(true);
    } else {
      // If no exact barcode match, open global search with the scanned value
      setScannedSearchTerm(barcode);
      setIsSearchOpen(true);
    }
  };

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
          
          // Notify if due today or tomorrow
          if (daysUntilDue <= 1 && daysUntilDue >= 0) {
            notifyRentalDue(rental.customerName, format(endDate, 'dd/MM/yyyy', { locale: he }));
          }
        });
    };

    // Check on mount and every hour
    checkDueRentals();
    const interval = setInterval(checkDueRentals, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isSubscribed, rentals, notifyRentalDue]);

  const upcomingReturns = getUpcomingReturns();
  const today = new Date();

  const activeRentals = rentals.filter(r => r.status === 'active');
  const overdueRentals = activeRentals.filter(r => isBefore(parseISO(r.endDate), today));
  const pendingRepairs = repairs.filter(r => r.status !== 'collected');
  const readyRepairs = repairs.filter(r => r.status === 'ready');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="relative">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-accent animate-pulse" />
            <Activity className="h-8 w-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white" />
          </div>
          <p className="mt-4 text-muted-foreground font-medium">טוען נתונים...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader 
        title="דאשבורד" 
        description="סקירה כללית של המערכת"
      >
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={() => setIsSearchOpen(true)}
            className="gap-2"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">חיפוש</span>
            <kbd className="hidden sm:inline px-2 py-0.5 text-xs rounded bg-muted">⌘K</kbd>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setIsScannerOpen(true)}
            className="gap-2"
          >
            <ScanLine className="h-4 w-4" />
            <span className="hidden sm:inline">סרוק</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setIsCalculatorOpen(true)}
            className="gap-2"
          >
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline">מחשבון</span>
          </Button>
          <Button 
            variant="glow" 
            onClick={() => setIsQuickActionsOpen(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">פעולה מהירה</span>
          </Button>
        </div>
      </PageHeader>

      {/* Welcome Banner */}
      <WelcomeBanner overdueRentals={overdueRentals} readyRepairs={readyRepairs} />

      {/* Stats Grid */}
      <DashboardStatsGrid stats={stats} inventory={inventory} />

      {/* Quick Stats Row */}
      <QuickStatsRow 
        rentals={rentals}
        repairs={repairs}
        readyRepairs={readyRepairs}
        isSupported={isSupported}
        isSubscribed={isSubscribed}
      />

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <InventoryChart inventory={inventory} />
        <RentalsActivityChart rentals={rentals} />
      </div>

      {/* Notification Settings */}
      <div className="mb-8">
        <NotificationSettings />
      </div>

      {/* Lists Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingReturnsCard upcomingReturns={upcomingReturns} />
        <RecentRepairsCard pendingRepairs={pendingRepairs} />
        <OverdueAlert overdueRentals={overdueRentals} />
      </div>

      {/* Modals */}
      <GlobalSearch 
        isOpen={isSearchOpen} 
        onClose={() => {
          setIsSearchOpen(false);
          setScannedSearchTerm('');
        }}
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
          onClose={() => {
            setIsQuickActionDialogOpen(false);
            setSelectedInventoryItem(null);
          }}
          item={selectedInventoryItem}
        />
      )}
    </div>
  );
}
