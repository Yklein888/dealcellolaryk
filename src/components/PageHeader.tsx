import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8 pb-4 border-b border-border/50', className)}>
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-l from-primary to-foreground bg-clip-text text-transparent">{title}</h1>
        {description && (
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {children}
        </div>
      )}
    </div>
  );
}
