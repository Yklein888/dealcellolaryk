import { memo, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  breadcrumbs?: BreadcrumbItem[];
}

export const PageHeader = memo(function PageHeader({
  title,
  description,
  children,
  className,
  breadcrumbs,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6',
        className
      )}
    >
      <div className="min-w-0">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 mb-1.5" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, index) => (
              <span key={index} className="flex items-center gap-1">
                {index > 0 && (
                  <ChevronLeft className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                )}
                {crumb.href ? (
                  <Link
                    to={crumb.href}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors duration-150"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground/50">
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        )}

        {/* Title */}
        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-tight">
          {title}
        </h1>

        {/* Description */}
        {description && (
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* Actions */}
      {children && (
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap flex-shrink-0">
          {children}
        </div>
      )}
    </div>
  );
});
