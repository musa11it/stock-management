import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface Column<T> {
  header: string;
  accessor: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({ columns, data, rowKey, onRowClick }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map((col, i) => (
              <th key={i} className={cn('px-5 py-3 font-medium text-slate-500', col.headerClassName)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row) => (
            <tr
              key={rowKey(row)}
              className={cn('transition-colors', onRowClick && 'cursor-pointer hover:bg-slate-50')}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col, i) => (
                <td key={i} className={cn('px-5 py-3 text-slate-700', col.className)}>
                  {col.accessor(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
