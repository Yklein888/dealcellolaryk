import { memo } from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'warning' | 'success' | 'destructive';
  href?: string;
  onClick?: () => void;
}

const iconBg: Record<string, string> = {
  default:     'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  primary:     'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
  warning:     'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  success:     'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  destructive: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
};

const valueColor: Record<string, string> = {
  default:     'text-foreground',
  primary:     'text-blue-600 dark:text-blue-400',
  warning:     'text-amber-600 dark:text-amber-400',
  success:     'text-emerald-600 dark:text-emerald-400',
  destructive: 'text-red-600 dark:text-red-400',
};

const accentBorderColor: Record<string, string> = {
  default:     '#94A3B8',
  primary:     '#3B82F6',
  warning:     '#F59E0B',
  success:     '#22C55E',
  destructive: '#EF4444',
};

export const StatCard = memo(function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  variant = 'default',
  href,
  onClick,
}: StatCardProps) {
  const navigate = useNavigate();
  const isClickable = !!href || !!onClick;

  const handleClick = () => {
    if (onClick) onClick();
    else if (href) navigate(href);
  };

  return (
    <div
      className={cn(
        'stat-card animate-fade-in group',
        isClickable && 'cursor-pointer'
      )}
      style={{ borderLeftColor: accentBorderColor[variant] }}
      onClick={isClickable ? handleClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3 relative z-10">
        {/* Icon — small colored square */}
        <div
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0',
            iconBg[variant]
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 text-right">
          <p className="text-xs font-medium text-muted-foreground truncate leading-snug mb-1">
            {title}
          </p>
          <p
            className={cn(
              'text-2xl sm:text-3xl font-bold leading-tight tracking-tight',
              valueColor[variant]
            )}
          >
            {value}
          </p>
          {trend && (
            <div
              className={cn(
                'inline-flex items-center gap-1 mt-1.5 text-xs font-semibold',
                trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              )}
            >
              {trend.isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{trend.isPositive ? '+' : ''}{trend.value}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
