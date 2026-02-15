import { memo, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { InventoryItem, categoryLabels, ItemCategory } from '@/types/rental';
import { Package } from 'lucide-react';
import { isItemTrulyAvailable } from '@/hooks/rental/useRentalStats';

interface InventoryChartProps {
  inventory: InventoryItem[];
}

const COLORS = [
  'hsl(173, 80%, 35%)',
  'hsl(199, 89%, 48%)',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
  'hsl(280, 60%, 50%)',
  'hsl(340, 70%, 50%)',
];

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-strong rounded-xl p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground">{payload[0].name}</p>
        <p className="text-lg font-bold text-primary">{payload[0].value} פריטים</p>
      </div>
    );
  }
  return null;
};

export const InventoryChart = memo(function InventoryChart({ inventory }: InventoryChartProps) {
  const categoryData = useMemo(() => {
    const availableItems = inventory.filter(isItemTrulyAvailable);
    return availableItems.reduce((acc, item) => {
      const category = item.category as ItemCategory;
      const existing = acc.find(d => d.category === category);
      if (existing) {
        existing.value += 1;
      } else {
        acc.push({
          category,
          name: categoryLabels[category] || category,
          value: 1,
        });
      }
      return acc;
    }, [] as { category: ItemCategory; name: string; value: number }[]);
  }, [inventory]);

  if (categoryData.length === 0) {
    return (
      <div className="stat-card h-[300px] flex items-center justify-center">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">אין פריטים זמינים במלאי</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" />
        פריטים זמינים לפי קטגוריה
      </h3>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
            >
              {categoryData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index % COLORS.length]}
                  className="transition-all duration-300 hover:opacity-80"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
              iconType="circle"
              layout="horizontal"
              verticalAlign="bottom"
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});