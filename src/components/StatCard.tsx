import { LucideIcon } from 'lucide-react';
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

const variantStyles = {
  default:     'border-white/30',
  primary:     'border-primary/30',
  warning:     'border-warning/30',
  success:     'border-success/30',
  destructive: 'border-destructive/30',
};

const iconVariantStyles = {
  default:     'bg-muted/50 text-muted-foreground',
  primary:     'bg-gradient-to-br from-primary/30 to-accent/20 text-primary',
  warning:     'bg-gradient-to-br from-warning/30 to-orange-400/20 text-warning',
  success:     'bg-gradient-to-br from-success/30 to-green-400/20 text-success',
  destructive: 'bg-gradient-to-br from-destructive/30 to-red-400/20 text-destructive',
};

// Value number glow + colour per variant
const valueVariantStyles = {
  default:     'text-foreground',
  primary:     'gradient-text value-glow-primary',
  warning:     'text-warning value-glow-warning',
  success:     'text-success value-glow-success',
  destructive: 'text-destructive value-glow-destructive',
};

export function StatCard({ title, value, icon: Icon, trend, variant = 'default', href, onClick }: StatCardProps) {
  const navigate = useNavigate();
  const isClickable = !!href || !!onClick;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (href) {
      navigate(href);
    }
  };

  return (
    <div
      className={cn(
        'stat-card animate-fade-in card-glow group',
        variantStyles[variant],
        isClickable && 'cursor-pointer active:scale-[0.98]'
      )}
      onClick={isClickable ? handleClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); } : undefined}
    >
      {/* Shimmer sweep — animated by CSS on :hover */}
      <div className="stat-shimmer" aria-hidden="true" />

      {/* Bottom accent bar — scales in on hover */}
      <div className="stat-bar" aria-hidden="true" />

      <div className="flex items-start justify-between gap-2 relative z-10">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
          <p className={cn(
            'mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold transition-all duration-300',
            valueVariantStyles[variant]
          )}>
            {value}
          </p>
          {trend && (
            <p className={cn(
              'mt-1 text-xs sm:text-sm font-medium',
              trend.isPositive ? 'text-success' : 'text-destructive'
            )}>
              {trend.isPositive ? '+' : ''}{trend.value}%
            </p>
          )}
        </div>
        <div className={cn(
          'flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl transition-transform duration-300 group-hover:scale-110 shrink-0',
          iconVariantStyles[variant]
        )}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
      </div>
    </div>
  );
}
