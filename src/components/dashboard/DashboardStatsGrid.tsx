import { memo, useMemo } from 'react';
import { StatCard } from '@/components/StatCard';
import { 
  ShoppingCart, 
  AlertTriangle,
  Wrench,
  Clock,
  Package,
  CalendarClock,
} from 'lucide-react';
import { DashboardStats } from '@/types/rental';
import { InventoryItem } from '@/types/rental';
import { isItemTrulyAvailable } from '@/hooks/rental/useRentalStats';

interface DashboardStatsGridProps {
  stats: DashboardStats;
  inventory: InventoryItem[];
}

export const DashboardStatsGrid = memo(function DashboardStatsGrid({ stats, inventory }: DashboardStatsGridProps) {
  const availableCount = useMemo(() => inventory.filter(isItemTrulyAvailable).length, [inventory]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
      <div>
        <StatCard
          title="השכרות פעילות"
          value={stats.activeRentals}
          icon={ShoppingCart}
          variant="primary"
          href="/rentals?status=active"
        />
      </div>
      <div>
        <StatCard
          title="באיחור"
          value={stats.overdueReturns}
          icon={AlertTriangle}
          variant="destructive"
          href="/rentals?status=overdue"
        />
      </div>
      <div>
        <StatCard
          title="מסתיימות היום"
          value={stats.endingToday}
          icon={CalendarClock}
          variant="warning"
          href="/rentals?status=ending_today"
        />
      </div>
      <div>
        <StatCard
          title="תיקונים בתהליך"
          value={stats.repairsInProgress}
          icon={Wrench}
          variant="warning"
          href="/repairs?status=in_lab"
        />
      </div>
      <div>
        <StatCard
          title="החזרות קרובות"
          value={stats.upcomingReturns}
          icon={Clock}
          variant="primary"
          href="/rentals?status=upcoming"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <StatCard
          title="פריטים זמינים"
          value={availableCount}
          icon={Package}
          variant="success"
          href="/inventory?status=available"
        />
      </div>
    </div>
  );
});