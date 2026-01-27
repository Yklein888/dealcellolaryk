import { StatCard } from '@/components/StatCard';
import { 
  ShoppingCart, 
  AlertTriangle,
  Wrench,
  Clock,
  Package,
} from 'lucide-react';
import { DashboardStats } from '@/types/rental';
import { InventoryItem } from '@/types/rental';
import { parseISO, isAfter } from 'date-fns';

interface DashboardStatsGridProps {
  stats: DashboardStats;
  inventory: InventoryItem[];
}

// Helper function to check if item is truly available (status + valid expiry for SIMs)
const isItemTrulyAvailable = (item: InventoryItem): boolean => {
  if (item.status !== 'available') return false;
  
  // For SIMs, check expiry date
  const isSim = item.category === 'sim_american' || item.category === 'sim_european';
  if (isSim && item.expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = parseISO(item.expiryDate);
    return isAfter(expiryDate, today) || expiryDate.getTime() === today.getTime();
  }
  
  return true;
};

export function DashboardStatsGrid({ stats, inventory }: DashboardStatsGridProps) {
  // Calculate truly available items (status + valid expiry for SIMs)
  const availableItems = inventory.filter(isItemTrulyAvailable);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
      <div className="animate-slide-up" style={{ animationDelay: '0ms' }}>
        <StatCard
          title="השכרות פעילות"
          value={stats.activeRentals}
          icon={ShoppingCart}
          variant="primary"
        />
      </div>
      <div className="animate-slide-up" style={{ animationDelay: '50ms' }}>
        <StatCard
          title="באיחור"
          value={stats.overdueReturns}
          icon={AlertTriangle}
          variant="destructive"
        />
      </div>
      <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
        <StatCard
          title="תיקונים בתהליך"
          value={stats.repairsInProgress}
          icon={Wrench}
          variant="warning"
        />
      </div>
      <div className="animate-slide-up" style={{ animationDelay: '150ms' }}>
        <StatCard
          title="החזרות קרובות"
          value={stats.upcomingReturns}
          icon={Clock}
          variant="primary"
        />
      </div>
      <div className="animate-slide-up col-span-2 sm:col-span-1" style={{ animationDelay: '200ms' }}>
        <StatCard
          title="פריטים זמינים"
          value={availableItems.length}
          icon={Package}
          variant="success"
        />
      </div>
    </div>
  );
}
