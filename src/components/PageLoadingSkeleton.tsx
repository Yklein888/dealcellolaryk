import { Skeleton } from '@/components/ui/skeleton';

interface PageLoadingSkeletonProps {
  columns?: number;
  rows?: number;
  showFilterBar?: boolean;
  showStats?: boolean;
}

export function PageLoadingSkeleton({
  columns = 3,
  rows = 6,
  showFilterBar = true,
  showStats = false,
}: PageLoadingSkeletonProps) {
  return (
    <div className="animate-in fade-in duration-300">
      {/* PageHeader skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <Skeleton className="h-8 w-40 mb-2 rounded-lg" />
          <Skeleton className="h-4 w-56 rounded-lg" />
        </div>
        <Skeleton className="h-11 w-36 rounded-xl" />
      </div>

      {/* Optional stats row */}
      {showStats && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Filter bar */}
      {showFilterBar && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Skeleton className="h-12 flex-1 rounded-xl" />
          <Skeleton className="h-12 w-36 rounded-xl" />
          <Skeleton className="h-12 w-36 rounded-xl sm:block hidden" />
        </div>
      )}

      {/* Cards grid */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 ${
          columns === 2 ? 'lg:grid-cols-2' :
          columns === 3 ? 'lg:grid-cols-3' :
          columns === 4 ? 'lg:grid-cols-4' :
          'lg:grid-cols-3'
        } gap-4`}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
