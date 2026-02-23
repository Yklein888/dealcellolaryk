import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { subMonths, format, startOfMonth, parseISO, isSameMonth } from 'date-fns';
import { he } from 'date-fns/locale';
import { Rental } from '@/types/rental';
import { DollarSign } from 'lucide-react';

interface RevenueChartProps {
  rentals: Rental[];
}

const USD_TO_ILS = 3.7;

const GRADIENT_COLORS = [
  'hsl(var(--primary) / 0.5)',
  'hsl(var(--primary) / 0.6)',
  'hsl(var(--primary) / 0.7)',
  'hsl(var(--primary) / 0.8)',
  'hsl(var(--primary) / 0.9)',
  'hsl(var(--primary))',
];

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { count: number } }>;
  label?: string;
}) => {
  if (active && payload && payload.length) {
    const revenue = payload[0].value;
    const count = payload[0].payload.count;
    return (
      <div className="glass-strong rounded-xl p-3 shadow-lg border border-primary/20">
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p className="text-lg font-bold text-primary">
          ₪{revenue.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
        </p>
        <p className="text-xs text-muted-foreground">{count} השכרות</p>
      </div>
    );
  }
  return null;
};

export function RevenueChart({ rentals }: RevenueChartProps) {
  const chartData = useMemo(() => {
    const today = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = startOfMonth(subMonths(today, 5 - i));
      return {
        label: format(date, 'MMM yy', { locale: he }),
        date,
        revenue: 0,
        count: 0,
      };
    });

    rentals.forEach((rental) => {
      try {
        const rentalDate = parseISO(rental.startDate);
        const month = months.find((m) => isSameMonth(rentalDate, m.date));
        if (month) {
          const amount =
            rental.currency === 'USD'
              ? rental.totalPrice * USD_TO_ILS
              : rental.totalPrice;
          month.revenue += amount;
          month.count += 1;
        }
      } catch {
        // skip invalid dates
      }
    });

    return months;
  }, [rentals]);

  const maxRevenue = Math.max(...chartData.map((d) => d.revenue), 1);
  const totalRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0);
  const totalRentals = chartData.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/10">
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          הכנסות — 6 חודשים אחרונים
        </h3>
        <div className="text-left sm:text-right">
          <p className="text-xl font-extrabold bg-gradient-to-l from-primary to-accent bg-clip-text text-transparent">
            ₪{totalRevenue.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-muted-foreground">{totalRentals} השכרות</p>
        </div>
      </div>

      {totalRevenue === 0 ? (
        <div className="h-[220px] flex items-center justify-center">
          <p className="text-muted-foreground text-sm">אין נתוני הכנסות עדיין</p>
        </div>
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
              barCategoryGap="30%"
            >
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₪${v >= 1000 ? Math.round(v / 1000) + 'K' : v}`}
                width={48}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--primary) / 0.05)' }} />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.revenue === maxRevenue
                        ? 'hsl(var(--primary))'
                        : GRADIENT_COLORS[index]
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
