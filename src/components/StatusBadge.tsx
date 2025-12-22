import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
}

const variantStyles = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-success/20 text-success border-success/30',
  warning: 'bg-warning/20 text-warning border-warning/30',
  destructive: 'bg-destructive/20 text-destructive border-destructive/30',
  info: 'bg-primary/20 text-primary border-primary/30',
};

export function StatusBadge({ status, variant = 'default' }: StatusBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border',
      variantStyles[variant]
    )}>
      {status}
    </span>
  );
}
