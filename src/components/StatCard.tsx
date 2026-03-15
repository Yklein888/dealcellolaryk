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

const variantBorderStyles: Record<string, string> = {
  default:     '',
  primary:     'border-primary/20',
  warning:     'border-warning/20',
  success:     'border-success/20',
  destructive: 'border-destructive/20',
};

const iconContainerStyles: Record<string, string> = {
  default:     'bg-muted text-muted-foreground',
  primary:     'bg-primary/10 text-primary',
  warning:     'bg-warning/10 text-warning',
  success:     'bg-success/10 text-success',
  destructive: 'bg-destructive/10 text-destructive',
};

const valueColorStyles: Record<string, string> = {
  default:     'text-foreground',
  primary:     'value-glow-primary',
  warning:     'value-glow-warning',
  success:     'value-glow-success',
  destructive: 'value-glow-destructive',
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
    if (onClick) {
      onClick();
    } else if (href) {
      navigate(href);
    }
  };

  return (
    <div
      className={cn(
        'stat-card animate-fade-in group',
        variantBorderStyles[variant],
        isClickable && 'cursor-pointer active:scale-[0.98]'
      )}
      onClick={isClickable ? handleClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') handleClick();
            }
          : undefined
      }
    >
      {/* Bottom accent bar — scales in on hover */}
      <div className="stat-bar" aria-hidden="true" />

      <div className="flex items-center justify-between gap-3 relative z-10">
        {/* Left side: icon */}
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl flex-shrink-0 transition-transform duration-200 group-hover:scale-105',
            iconContainerStyles[variant]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        {/* Right side: text */}
        <div className="flex-1 min-w-0 text-right">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate leading-snug">
            {title}
          </p>
          <p
            className={cn(
              'mt-0.5 text-2xl sm:text-3xl font-bold leading-tight tracking-tight transition-colors duration-200',
              valueColorStyles[variant]
            )}
          >
            {value}
          </p>
          {trend && (
            <div
              className={cn(
                'inline-flex items-center gap-1 mt-1 text-xs font-semibold',
                trend.isPositive ? 'text-success' : 'text-destructive'
              )}
            >
              {trend.isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>
                {trend.isPositive ? '+' : ''}
                {trend.value}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
