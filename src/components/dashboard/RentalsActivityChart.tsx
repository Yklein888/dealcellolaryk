import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Rental } from '@/types/rental';
import { format, parseISO, subDays, startOfDay, isAfter, isBefore } from 'date-fns';
import { he } from 'date-fns/locale';
import { TrendingUp } from 'lucide-react';

interface RentalsActivityChartProps {
  rentals: Rental[];
}

export function RentalsActivityChart({ rentals }: RentalsActivityChartProps) {
  // Generate last 14 days data
  const today = startOfDay(new Date());
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(today, 13 - i);
    return {
      date: format(date, 'yyyy-MM-dd'),
      dayLabel: format(date, 'dd/MM', { locale: he }),
      shortLabel: format(date, 'E', { locale: he }),
    };
  });

  // Count active rentals per day
  const chartData = days.map(day => {
    const dayDate = parseISO(day.date);
    const activeCount = rentals.filter(r => {
      const startDate = parseISO(r.startDate);
      const endDate = parseISO(r.endDate);
      return (
        (isBefore(startDate, dayDate) || format(startDate, 'yyyy-MM-dd') === day.date) &&
        (isAfter(endDate, dayDate) || format(endDate, 'yyyy-MM-dd') === day.date) &&
        r.status !== 'returned'
      );
    }).length;

    return {
      ...day,
      active: activeCount,
    };
  });

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-strong rounded-xl p-3 shadow-lg">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-lg font-bold text-primary">{payload[0].value} השכרות פעילות</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="stat-card animate-slide-up" style={{ animationDelay: '350ms' }}>
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-accent" />
        פעילות השכרות (14 ימים אחרונים)
      </h3>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(173, 80%, 35%)" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="hsl(173, 80%, 35%)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="shortLabel" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 12 }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 12 }}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="active"
              stroke="hsl(173, 80%, 35%)"
              strokeWidth={3}
              fill="url(#colorActive)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
