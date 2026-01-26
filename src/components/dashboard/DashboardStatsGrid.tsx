import { StatCard } from '@/components/StatCard';
import { 
  ShoppingCart, 
  AlertTriangle,
  Wrench,
  Clock,
  Package,
} from 'lucide-react';
import { DashboardStats } from '@/types/rental';
import { InventoryItem, categoryLabels } from '@/types/rental';

interface DashboardStatsGridProps {
  stats: DashboardStats;
  inventory: InventoryItem[];
}

export function DashboardStatsGrid({ stats, inventory }: DashboardStatsGridProps) {
  // Calculate available items by category
  const availableItems = inventory.filter(i => i.status === 'available');
  const availableByCategory = availableItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
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
      <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
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
