import { memo, useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc' | null;

export interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  className?: string;
}

interface SortableTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  defaultSort?: keyof T;
  defaultSortDirection?: SortDirection;
  onSort?: (key: keyof T, direction: SortDirection) => void;
  className?: string;
  rowClassName?: string;
  noDataMessage?: string;
}

/**
 * Reusable Sortable Table Component
 * Supports:
 * - Click column headers to sort
 * - Visual indicators (arrows) for sort direction
 * - Custom render functions per column
 * - Keyboard accessibility
 */
export const SortableTable = memo(function SortableTable<T>({
  columns,
  data,
  keyExtractor,
  defaultSort,
  defaultSortDirection = 'asc',
  onSort,
  className,
  rowClassName,
  noDataMessage = 'אין נתונים להצגה',
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(defaultSort || null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSort ? defaultSortDirection : null);

  // Handle column header click
  const handleSort = (columnKey: keyof T) => {
    const column = columns.find(c => c.key === columnKey);
    if (!column?.sortable) return;

    let newDirection: SortDirection = 'asc';

    // Cycle through: asc → desc → no sort
    if (sortKey === columnKey) {
      if (sortDirection === 'asc') {
        newDirection = 'desc';
      } else if (sortDirection === 'desc') {
        newDirection = null;
      }
    }

    setSortKey(newDirection ? columnKey : null);
    setSortDirection(newDirection);

    if (onSort) {
      onSort(columnKey, newDirection);
    }
  };

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1;

      // Handle numbers
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle dates
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortDirection === 'asc' ? aValue.getTime() - bValue.getTime() : bValue.getTime() - aValue.getTime();
      }

      // Handle strings
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      return sortDirection === 'asc' ? aStr.localeCompare(bStr, 'he') : bStr.localeCompare(aStr, 'he');
    });
  }, [data, sortKey, sortDirection]);

  // Render sort indicator icon
  const SortIcon = ({ columnKey }: { columnKey: keyof T }) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground/50" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-4 w-4 text-primary" />
    ) : (
      <ArrowDown className="h-4 w-4 text-primary" />
    );
  };

  if (sortedData.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        {noDataMessage}
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50 hover:bg-muted/50 transition-colors">
            {columns.map(column => (
              <th
                key={String(column.key)}
                onClick={() => handleSort(column.key)}
                className={cn(
                  'text-right px-4 py-3 font-semibold text-muted-foreground',
                  column.sortable ? 'cursor-pointer hover:text-foreground hover:bg-muted/30' : '',
                  column.className
                )}
                role={column.sortable ? 'button' : undefined}
                tabIndex={column.sortable ? 0 : undefined}
                onKeyDown={(e) => {
                  if (column.sortable && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handleSort(column.key);
                  }
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>{column.label}</span>
                  {column.sortable && <SortIcon columnKey={column.key} />}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, index) => (
            <tr
              key={keyExtractor(row)}
              className={cn(
                'border-b border-border/20 hover:bg-muted/20 transition-colors',
                rowClassName
              )}
            >
              {columns.map(column => (
                <td
                  key={String(column.key)}
                  className={cn('px-4 py-3', column.className)}
                >
                  {column.render
                    ? column.render(row[column.key], row)
                    : String(row[column.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

SortableTable.displayName = 'SortableTable';
