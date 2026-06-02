import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Skeleton } from './Skeleton';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface TableColumn<T = any> {
  key:        string;
  header:     string;
  cell?:      (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface TablePagination {
  page:         number;
  pageSize:     number;
  total:        number;
  onPageChange: (p: number) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface TableProps<T extends Record<string, any>> {
  columns:      TableColumn<T>[];
  data:         T[];
  keyExtractor: (row: T) => string;
  isLoading?:   boolean;
  emptyMessage?: string;
  pagination?:  TablePagination;
  onRowClick?:  (row: T) => void;
  className?:   string;
  skeletonRows?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function Table<T extends Record<string, any>>({
  columns, data, keyExtractor,
  isLoading, emptyMessage = 'Sin datos',
  pagination, onRowClick, className, skeletonRows = 6,
}: TableProps<T>) {
  const from  = pagination ? pagination.page * pagination.pageSize + 1 : null;
  const to    = pagination ? Math.min((pagination.page + 1) * pagination.pageSize, pagination.total) : null;
  const pages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 0;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500',
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <Skeleton className="h-4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-14 text-center text-sm text-slate-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-slate-50'
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn('px-4 py-3 text-sm text-slate-700', col.className)}
                    >
                      {col.cell
                        ? col.cell(row, index)
                        : (row[col.key] as React.ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {pagination && pagination.total > pagination.pageSize && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            {from}–{to} de {pagination.total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 0}
              className="rounded-lg p-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[4rem] text-center tabular-nums">
              {pagination.page + 1} / {pages}
            </span>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pages - 1}
              className="rounded-lg p-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
