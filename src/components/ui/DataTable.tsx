import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { EmptyState } from './EmptyState';
import { TableSkeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  accessor?: (row: T) => string | number;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'right' | 'center';
  exportOnly?: boolean;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  dense?: boolean;
  stickyHeader?: boolean;
  maxHeight?: number;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  emptyTitle = 'No records match the current filters',
  emptyDescription = 'Adjust the filters, widen the date range, or clear the search to see records.',
  pageSize = 15,
  onRowClick,
  selectable,
  selected = [],
  onSelectedChange,
  initialSort,
  dense,
  stickyHeader = true,
  maxHeight,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(1);

  const visibleColumns = columns.filter((c) => !c.exportOnly);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.accessor) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = column.accessor!(a);
      const bv = column.accessor!(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: string) => {
    setSort((cur) =>
      cur?.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' },
    );
    setPage(1);
  };

  const allSelected = pageRows.length > 0 && pageRows.every((r) => selected.includes(rowKey(r)));

  if (loading) return <TableSkeleton cols={visibleColumns.length} />;
  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <div className="flex flex-col">
      <div
        className="overflow-auto scroll-thin"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className="w-full border-collapse">
          <thead className={cn(stickyHeader && 'sticky top-0 z-10')}>
            <tr className="bg-paper/95 backdrop-blur">
              {selectable && (
                <th className="th-cell w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all rows on this page"
                    checked={allSelected}
                    onChange={(e) => {
                      const ids = pageRows.map(rowKey);
                      onSelectedChange?.(
                        e.target.checked
                          ? [...new Set([...selected, ...ids])]
                          : selected.filter((id) => !ids.includes(id)),
                      );
                    }}
                  />
                </th>
              )}
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className={cn('th-cell border-b border-line', col.align === 'right' && 'text-right', col.align === 'center' && 'text-center')}
                  style={col.width ? { width: col.width } : undefined}
                  aria-sort={sort?.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  {col.sortable !== false && col.accessor ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-ink"
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.header}
                      <span aria-hidden className="text-[9px]">
                        {sort?.key === col.key ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const id = rowKey(row);
              return (
                <tr
                  key={id}
                  className={cn(
                    'border-b border-line/40 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-teal/5',
                    selected.includes(id) && 'bg-teal/10',
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selectable && (
                    <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${id}`}
                        checked={selected.includes(id)}
                        onChange={(e) =>
                          onSelectedChange?.(
                            e.target.checked
                              ? [...selected, id]
                              : selected.filter((s) => s !== id),
                          )
                        }
                      />
                    </td>
                  )}
                  {visibleColumns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'table-cell',
                        dense && 'py-1',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                      )}
                    >
                      {col.render ? col.render(row) : String(col.accessor?.(row) ?? '')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sorted.length > pageSize && (
        <div className="flex items-center justify-between border-t border-line/60 px-3 py-2 text-2xs text-muted">
          <span className="metric">
            {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)} of{' '}
            {sorted.length.toLocaleString('en-IN')}
          </span>
          <div className="flex items-center gap-1">
            <button className="btn-secondary px-2 py-1" disabled={safePage === 1} onClick={() => setPage(1)}>
              «
            </button>
            <button
              className="btn-secondary px-2 py-1"
              disabled={safePage === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </button>
            <span className="metric px-2">
              {safePage} / {totalPages}
            </span>
            <button
              className="btn-secondary px-2 py-1"
              disabled={safePage === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
            <button
              className="btn-secondary px-2 py-1"
              disabled={safePage === totalPages}
              onClick={() => setPage(totalPages)}
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
