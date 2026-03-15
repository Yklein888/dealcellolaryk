import { memo } from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
}

const variantStyles: Record<string, string> = {
  default:     'bg-gray-100 text-gray-600 dark:bg-white/8 dark:text-gray-400',
  success:     'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  warning:     'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  destructive: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
  info:        'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20',
};

const dotColors: Record<string, string> = {
  default:     'bg-gray-400',
  success:     'bg-emerald-500',
  warning:     'bg-amber-500',
  destructive: 'bg-red-500',
  info:        'bg-indigo-500',
};

export const StatusBadge = memo(function StatusBadge({ status, variant = 'default' }: StatusBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
      variantStyles[variant],
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', dotColors[variant])} />
      {status}
    </span>
  );
});
