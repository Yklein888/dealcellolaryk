import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'warning' | 'success' | 'destructive';
}

const variantStyles = {
  default: 'border-white/30',
  primary: 'border-primary/30',
  warning: 'border-warning/30',
  success: 'border-success/30',
  destructive: 'border-destructive/30',
};

const iconVariantStyles = {
  default: 'bg-muted/50 text-muted-foreground',
  primary: 'bg-gradient-to-br from-primary/30 to-accent/20 text-primary',
  warning: 'bg-gradient-to-br from-warning/30 to-orange-400/20 text-warning',
  success: 'bg-gradient-to-br from-success/30 to-green-400/20 text-success',
  destructive: 'bg-gradient-to-br from-destructive/30 to-red-400/20 text-destructive',
};

export function StatCard({ title, value, icon: Icon, trend, variant = 'default' }: StatCardProps) {
  return (
    <div className={cn(
      'stat-card animate-fade-in card-glow group',
      variantStyles[variant]
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
          {trend && (
            <p className={cn(
              'mt-1 text-sm font-medium',
              trend.isPositive ? 'text-success' : 'text-destructive'
            )}>
              {trend.isPositive ? '+' : ''}{trend.value}%
            </p>
          )}
        </div>
        <div className={cn(
          'flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110',
          iconVariantStyles[variant]
        )}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
