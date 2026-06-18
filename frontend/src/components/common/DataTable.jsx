import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCell, labelize } from '../../utils/formatters';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export function DataTable({
  columns,
  sortableColumns,
  loading = false,
  rows,
  onRowClick,
  sortBy,
  sortDir = 'desc',
  onSortChange,
  pagination,
  onPageChange,
  onPageSizeChange,
}) {
  const sortableSet = sortableColumns ? new Set(sortableColumns) : null;

  const handleHeaderClick = (column) => {
    if (!onSortChange) return;
    if (sortableSet && !sortableSet.has(column)) return;

    if (sortBy === column) {
      onSortChange(column, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(column, 'asc');
    }
  };

  const total = pagination?.total ?? 0;
  const limit = pagination?.limit ?? rows.length;
  const page = pagination?.page ?? 1;
  const totalPages = pagination?.total_pages ?? 1;
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = total === 0 ? 0 : Math.min(page * limit, total);

  return (
    <section className="overflow-auto rounded-lg border border-enterprise-line bg-white">
      <table className="w-full min-w-[600px] border-collapse sm:min-w-[840px]">
        <thead>
          <tr>
            {columns.map((column) => {
              const sortable = Boolean(onSortChange) && (!sortableSet || sortableSet.has(column));
              const isActive = sortable && sortBy === column;
              return (
                <th
                  key={column}
                  className={`border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wide text-slate-500 ${sortable ? 'cursor-pointer select-none hover:text-slate-700' : ''}`}
                  onClick={() => handleHeaderClick(column)}
                >
                  <span className="inline-flex items-center gap-1">
                    {labelize(column)}
                    {sortable && (
                      isActive ? (
                        sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} className="opacity-30" />
                      )
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-sm font-bold text-enterprise-muted">
                Loading records from API...
              </td>
            </tr>
          ) : rows.length ? (
            rows.map((row, index) => (
              <tr
                key={row.id || row.reference || index}
                className={`hover:bg-blue-50/40 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick && onRowClick(row)}
              >
                {columns.map((column) => (
                  <td key={column} className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-800">
                    {formatCell(row[column])}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-sm font-bold text-enterprise-muted">
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {pagination && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 sm:px-4 sm:py-3 sm:gap-3">
          <span className="text-xs sm:text-sm">
            {total === 0 ? 'No records' : `${start}–${end} of ${total}`}
          </span>
          <div className="flex items-center gap-2 sm:gap-3">
            {onPageSizeChange && (
              <label className="flex items-center gap-1.5 sm:gap-2">
                <span className="hidden sm:inline">Rows per page</span>
                <select
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm font-bold text-slate-700"
                  value={limit}
                  onChange={(event) => onPageSizeChange(Number(event.target.value))}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-50"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs sm:text-sm">{page}/{totalPages}</span>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-50"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
