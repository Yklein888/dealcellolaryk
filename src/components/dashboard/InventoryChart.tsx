import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { InventoryItem, categoryLabels, ItemCategory } from '@/types/rental';
import { Package } from 'lucide-react';
import { parseISO, isAfter } from 'date-fns';

interface InventoryChartProps {
  inventory: InventoryItem[];
}

const COLORS = [
  'hsl(173, 80%, 35%)', // primary - teal
  'hsl(199, 89%, 48%)', // accent - blue
  'hsl(142, 76%, 36%)', // success - green
  'hsl(38, 92%, 50%)',  // warning - orange
  'hsl(280, 60%, 50%)', // purple
  'hsl(340, 70%, 50%)', // pink
];

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

export function InventoryChart({ inventory }: InventoryChartProps) {
  // Filter only truly available items (status + valid expiry for SIMs)
  const availableItems = inventory.filter(isItemTrulyAvailable);
  
  // Group by category
  const categoryData = availableItems.reduce((acc, item) => {
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

  // Custom tooltip
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
    <div className="stat-card animate-slide-up" style={{ animationDelay: '300ms' }}>
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
}
