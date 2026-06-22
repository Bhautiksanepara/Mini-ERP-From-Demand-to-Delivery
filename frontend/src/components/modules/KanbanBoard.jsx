import { GripVertical } from 'lucide-react';
import { useState } from 'react';
import { Skeleton } from '../common/Skeleton';

function rowMatchesStatus(row, status, config) {
  if (config.dataKey === 'boms') {
    if (status === 'All') return true;
    if (status === 'Components') return Number(row.component_count || 0) > 0 && Number(row.operation_count || 0) === 0;
    if (status === 'Operations') return Number(row.operation_count || 0) > 0;
    return false;
  }
  if (config.statusFilters?.[status]) {
    const filter = config.statusFilters[status];
    if (filter.status && row.status !== filter.status) return false;
    if (filter.action && row.action !== filter.action) return false;
    if (filter.movement_direction && row.movement_direction !== filter.movement_direction) return false;
    if (filter.movement_type && row.movement_type !== filter.movement_type) return false;
    if (filter.late) {
      return row.status === 'Confirmed' && row.scheduled_date && new Date(row.scheduled_date) < new Date();
    }
    return true;
  }
  if (config.dataKey === 'users') {
    const roles = row.role_codes ? (typeof row.role_codes === 'string' ? row.role_codes.split(',') : row.role_codes) : (row.roles ? row.roles.map(r => typeof r === 'object' ? r.code : r) : []);
    if (status === 'All Users') return true;
    if (status === 'System Users') return !roles.includes('admin');
    if (status === 'Administrators') return roles.includes('admin');
    return false;
  }
  if (status === 'All' || status === 'All Modules' || status === 'All Users') return true;
  if (row.status === status) return true;
  if (row.action === status) return true;
  return false;
}

function KanbanSkeletonCard() {
  return (
    <div className="grid gap-2 rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-3 w-3 shrink-0" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
      <Skeleton className="ml-5 h-3 w-1/2" />
      <Skeleton className="ml-5 h-3 w-1/3" />
    </div>
  );
}

export function KanbanBoard({ config, rows, onCardClick, onCardDrop, loading = false }) {
  const [draggingRow, setDraggingRow] = useState(null);
  const [activeColumn, setActiveColumn] = useState(null);
  const [dropFlash, setDropFlash] = useState(null); // { status, type: 'success' | 'error' }

  const handleDragStart = (event, row) => {
    event.dataTransfer.setData('application/json', JSON.stringify(row));
    event.dataTransfer.effectAllowed = 'move';
    // Delay so browser captures drag ghost before card dims
    setTimeout(() => setDraggingRow(row), 0);
  };

  const handleDragEnd = () => {
    setDraggingRow(null);
    setActiveColumn(null);
  };

  const handleDragOver = (event, status) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (activeColumn !== status) setActiveColumn(status);
  };

  const handleDragLeave = (event) => {
    // Only clear when truly leaving the column, not entering a child element
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setActiveColumn(null);
    }
  };

  const handleDrop = async (event, status) => {
    event.preventDefault();
    setActiveColumn(null);
    setDraggingRow(null);
    try {
      const dataStr = event.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const row = JSON.parse(dataStr);
      if (onCardDrop) {
        const result = await Promise.resolve(onCardDrop(row, status));
        // Only show success when backend explicitly confirmed the change (returns true)
        if (result === true) {
          setDropFlash({ status, type: 'success', message: null });
          setTimeout(() => setDropFlash(null), 1200);
        }
      }
    } catch (error) {
      console.error('Drop failed', error);
      setDropFlash({ status, type: 'error', message: error.message || 'Move failed' });
      setTimeout(() => setDropFlash(null), 3000);
    }
  };

  const kanbanColumns = config.statusLabels.filter(
    (label) => !['All', 'All Modules', 'All Users'].includes(label)
  ).slice(0, 5);

  return (
    <section className="overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${kanbanColumns.length}, minmax(220px, 1fr))`,
          minWidth: `${kanbanColumns.length * 236}px`,
        }}
      >
        {kanbanColumns.map((status) => {
          const filteredRows = rows.filter((row) => rowMatchesStatus(row, status, config));
          const isActive = activeColumn === status;
          const flash = dropFlash?.status === status ? dropFlash.type : null;

          let columnBorder = 'border-slate-200 bg-white';
          if (flash === 'success') columnBorder = 'border-emerald-400 bg-emerald-50/60';
          else if (flash === 'error') columnBorder = 'border-red-400 bg-red-50/60';
          else if (isActive) columnBorder = 'border-enterprise-blue bg-blue-50/40 border-dashed';

          return (
            <div
              key={status}
              onDragOver={(e) => handleDragOver(e, status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, status)}
              className={`grid min-h-72 content-start gap-2 rounded-xl border-2 p-3 transition-all duration-150 ${columnBorder}`}
            >
              {/* Column header */}
              <div className="mb-1 flex items-center justify-between">
                <h3 className={`text-sm font-extrabold transition-colors ${isActive ? 'text-enterprise-blue' : 'text-slate-600'}`}>
                  {status}
                </h3>
                <span className={`grid h-5 min-w-[22px] place-items-center rounded-full px-1.5 text-xs font-extrabold transition-colors ${
                  isActive ? 'bg-enterprise-blue text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {filteredRows.length}
                </span>
              </div>

              {/* Skeleton cards while loading */}
              {loading && Array.from({ length: 3 }).map((_, i) => (
                <KanbanSkeletonCard key={i} />
              ))}

              {/* Cards */}
              {!loading && filteredRows.map((row, index) => {
                const isDragging = draggingRow && (draggingRow.id === row.id);
                return (
                  <article
                    key={`${status}-${row.reference || row.id || index}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, row)}
                    onDragEnd={handleDragEnd}
                    onClick={() => !draggingRow && onCardClick?.(row)}
                    className={`grid gap-1.5 rounded-lg border p-3 transition-all duration-150 select-none ${
                      isDragging
                        ? 'cursor-grabbing border-enterprise-blue bg-blue-50 opacity-40 shadow-xl ring-2 ring-enterprise-blue/40 scale-95'
                        : 'cursor-grab border-slate-200 bg-white shadow-sm hover:border-enterprise-blue hover:shadow-md active:cursor-grabbing active:scale-95'
                    }`}
                  >
                    <div className="flex items-start gap-1.5">
                      <GripVertical size={14} className="mt-0.5 shrink-0 text-slate-300" />
                      <strong className="text-sm text-slate-900 leading-snug">
                        {row.reference || row.name || row.record_type || `#${row.id}`}
                      </strong>
                    </div>
                    <span className="pl-5 text-sm text-slate-500">
                      {row.customer_name || row.vendor_name || row.finished_product_name || row.product_name || row.module_code || row.full_name || 'Operational record'}
                    </span>
                    <small className="pl-5 text-xs font-bold text-enterprise-muted">
                      {row.status || row.action || 'Open'}
                    </small>
                  </article>
                );
              })}

              {/* Drop zone ghost — appears at bottom of target column */}
              {!loading && isActive && draggingRow && (
                <div className="flex animate-pulse items-center justify-center gap-2 rounded-lg border-2 border-dashed border-enterprise-blue bg-blue-50 py-4 text-sm font-bold text-enterprise-blue">
                  ↓ Drop here
                </div>
              )}

              {/* Empty column placeholder */}
              {!loading && filteredRows.length === 0 && !isActive && (
                <p className="py-8 text-center text-xs font-semibold text-slate-300">No items</p>
              )}

              {/* Success / error flash */}
              {flash === 'success' && (
                <div className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-2 text-sm font-bold text-emerald-700">
                  ✓ Moved successfully
                </div>
              )}
              {flash === 'error' && (
                <div className="flex flex-col gap-0.5 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm font-bold text-red-600">
                  <span>✗ Move failed</span>
                  {dropFlash?.message && (
                    <span className="text-xs font-medium text-red-500">{dropFlash.message}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
