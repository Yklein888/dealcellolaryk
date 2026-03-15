import { memo, useMemo } from 'react';
import { ShoppingCart, AlertTriangle, Wrench, Clock, Package, CalendarClock } from 'lucide-react';
import { DashboardStats } from '@/types/rental';
import { InventoryItem } from '@/types/rental';
import { isItemTrulyAvailable } from '@/hooks/rental/useRentalStats';
import { Link } from 'react-router-dom';

interface DashboardStatsGridProps {
  stats: DashboardStats;
  inventory: InventoryItem[];
}

interface StatTileProps {
  to: string;
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: 'blue' | 'red' | 'green' | 'amber' | 'violet' | 'slate';
  sub?: string;
  size?: 'lg' | 'sm';
}

const colorMap = {
  blue:   { bg: '#EFF6FF', iconBg: '#3B82F6', text: '#1D4ED8', sub: '#60A5FA', border: '#BFDBFE' },
  red:    { bg: '#FFF1F2', iconBg: '#EF4444', text: '#B91C1C', sub: '#FCA5A5', border: '#FECACA' },
  green:  { bg: '#F0FDF4', iconBg: '#22C55E', text: '#15803D', sub: '#4ADE80', border: '#BBF7D0' },
  amber:  { bg: '#FFFBEB', iconBg: '#F59E0B', text: '#92400E', sub: '#FCD34D', border: '#FDE68A' },
  violet: { bg: '#F0FDFA', iconBg: '#06B6D4', text: '#5B21B6', sub: '#A78BFA', border: '#DDD6FE' },
  slate:  { bg: '#F8FAFC', iconBg: '#64748B', text: '#1E293B', sub: '#94A3B8', border: '#E2E8F0' },
};

function StatTile({ to, label, value, icon: Icon, color, sub, size = 'sm' }: StatTileProps) {
  const c = colorMap[color];
  const isLg = size === 'lg';

  return (
    <Link to={to} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <div
        style={{
          background: c.bg,
          border: `1px solid ${c.border}`,
          borderRadius: 16,
          padding: isLg ? 28 : 20,
          cursor: 'pointer',
          transition: 'box-shadow 0.2s, transform 0.2s',
          height: '100%',
          boxSizing: 'border-box',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${c.iconBg}30`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = '';
          (e.currentTarget as HTMLDivElement).style.boxShadow = '';
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', margin: '0 0 10px 0', letterSpacing: '0.01em' }}>
              {label}
            </p>
            <p style={{
              fontSize: isLg ? 52 : 32,
              fontWeight: 800,
              color: c.text,
              lineHeight: 1,
              margin: '0 0 8px 0',
              fontFamily: "'Inter', sans-serif",
            }}>
              {value}
            </p>
            {sub && (
              <p style={{ fontSize: 12, color: c.sub, margin: 0 }}>{sub}</p>
            )}
          </div>
          <div style={{
            background: c.iconBg,
            borderRadius: isLg ? 12 : 10,
            padding: isLg ? 12 : 10,
            flexShrink: 0,
            boxShadow: `0 4px 12px ${c.iconBg}40`,
          }}>
            <Icon style={{ width: isLg ? 24 : 20, height: isLg ? 24 : 20, color: 'white' }} />
          </div>
        </div>
      </div>
    </Link>
  );
}

export const DashboardStatsGrid = memo(function DashboardStatsGrid({ stats, inventory }: DashboardStatsGridProps) {
  const availableCount = useMemo(() => inventory.filter(isItemTrulyAvailable).length, [inventory]);

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Hero: 2 large cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16, marginBottom: 16 }}>
        <StatTile
          to="/rentals?status=active"
          label="השכרות פעילות"
          value={stats.activeRentals}
          icon={ShoppingCart}
          color="blue"
          sub='סה"כ השכרות פעילות'
          size="lg"
        />
        <StatTile
          to="/rentals?status=overdue"
          label="באיחור"
          value={stats.overdueReturns}
          icon={AlertTriangle}
          color={stats.overdueReturns > 0 ? 'red' : 'green'}
          sub={stats.overdueReturns > 0 ? 'דורשות טיפול מיידי' : 'הכל בסדר'}
          size="lg"
        />
      </div>

      {/* Secondary: 4 small cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }} className="sm-grid-4">
        <StatTile to="/rentals?status=ending_today" label="מסתיימות היום"   value={stats.endingToday}       icon={CalendarClock} color="amber" />
        <StatTile to="/repairs?status=in_lab"       label="תיקונים בתהליך"  value={stats.repairsInProgress} icon={Wrench}        color="violet" />
        <StatTile to="/rentals?status=upcoming"     label="החזרות קרובות"   value={stats.upcomingReturns}   icon={Clock}         color="blue" />
        <StatTile to="/inventory?status=available"  label="פריטים זמינים"   value={availableCount}          icon={Package}       color="green" />
      </div>
    </div>
  );
});
