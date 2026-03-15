import { memo, useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
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

  const handleSort = (columnKey: keyof T) => {
    const column = columns.find(c => c.key === columnKey);
    if (!column?.sortable) return;

    let newDirection: SortDirection = 'asc';
    if (sortKey === columnKey) {
      if (sortDirection === 'asc') newDirection = 'desc';
      else if (sortDirection === 'desc') newDirection = null;
    }

    setSortKey(newDirection ? columnKey : null);
    setSortDirection(newDirection);
    if (onSort) onSort(columnKey, newDirection);
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return data;
    return [...data].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1;
      if (typeof aValue === 'number' && typeof bValue === 'number')
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      if (aValue instanceof Date && bValue instanceof Date)
        return sortDirection === 'asc' ? aValue.getTime() - bValue.getTime() : bValue.getTime() - aValue.getTime();
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      return sortDirection === 'asc' ? aStr.localeCompare(bStr, 'he') : bStr.localeCompare(aStr, 'he');
    });
  }, [data, sortKey, sortDirection]);

  if (sortedData.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-3">
          <ChevronsUpDown className="h-5 w-5 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{noDataMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
            {columns.map(column => (
              <th
                key={String(column.key)}
                onClick={() => handleSort(column.key)}
                className={cn(
                  'text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 whitespace-nowrap',
                  column.sortable ? 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none' : '',
                  column.className,
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
                <div className="flex items-center gap-1.5">
                  <span>{column.label}</span>
                  {column.sortable && (
                    <span className="flex-shrink-0">
                      {sortKey !== column.key ? (
                        <ChevronsUpDown className="h-3 w-3 text-gray-300" />
                      ) : sortDirection === 'asc' ? (
                        <ArrowUp className="h-3 w-3 text-teal-500" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-teal-500" />
                      )}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-white/5">
          {sortedData.map((row) => (
            <tr
              key={keyExtractor(row)}
              className={cn(
                'hover:bg-gray-50 dark:hover:bg-white/3 transition-colors duration-100',
                rowClassName,
              )}
            >
              {columns.map(column => (
                <td
                  key={String(column.key)}
                  className={cn('px-4 py-3.5 text-sm text-gray-700 dark:text-gray-300', column.className)}
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
}) as <T>(props: SortableTableProps<T>) => React.ReactElement;

(SortableTable as any).displayName = 'SortableTable';
