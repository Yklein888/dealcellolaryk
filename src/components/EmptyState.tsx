import { memo, ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  iconColor?: 'primary' | 'warning' | 'success' | 'destructive' | 'muted';
}

const iconColorMap = {
  primary: 'text-primary',
  warning: 'text-warning',
  success: 'text-success',
  destructive: 'text-destructive',
  muted: 'text-muted-foreground/50',
};

/**
 * Empty State Component
 * Shows when no data is available with optional CTA button
 */
export const EmptyState = memo(function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  iconColor = 'muted',
}: EmptyStateProps) {
  return (
    <div className={cn('text-center py-12 px-6', className)}>
      <div className="flex h-16 w-16 mx-auto mb-4 items-center justify-center rounded-2xl bg-muted/20">
        <Icon className={cn('h-8 w-8', iconColorMap[iconColor])} />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">{description}</p>
      )}
      {action && (
        <Button variant="glow" onClick={action.onClick} className="gap-2">
          {action.label}
        </Button>
      )}
    </div>
  );
});

EmptyState.displayName = 'EmptyState';

/**
 * Error State Component
 * Shows when something went wrong
 */
interface ErrorStateProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const ErrorState = memo(function ErrorState({
  title,
  description,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn('rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center', className)}>
      <div className="flex h-12 w-12 mx-auto mb-3 items-center justify-center rounded-xl bg-destructive/10">
        <span className="text-2xl">⚠️</span>
      </div>
      <h3 className="font-bold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
      )}
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
});

ErrorState.displayName = 'ErrorState';

/**
 * Loading State Component
 * Shows while data is being fetched
 */
interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState = memo(function LoadingState({
  message = 'טוען נתונים...',
  className,
}: LoadingStateProps) {
  return (
    <div className={cn('text-center py-12', className)}>
      <div className="flex justify-center mb-4">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
});

LoadingState.displayName = 'LoadingState';
