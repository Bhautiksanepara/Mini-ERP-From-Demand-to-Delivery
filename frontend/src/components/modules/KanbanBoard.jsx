import { useState } from 'react';

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
  if (status === 'All' || status === 'All Modules' || status === 'All Users') {
    return true;
  }
  if (row.status === status) return true;
  if (row.action === status) return true;
  return false;
}

export function KanbanBoard({ config, rows, onCardClick, onCardDrop }) {
  const [activeColumn, setActiveColumn] = useState(null);

  const handleDragStart = (event, row) => {
    event.dataTransfer.setData('application/json', JSON.stringify(row));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event, status) => {
    event.preventDefault();
    setActiveColumn(status);
  };

  const handleDragLeave = () => {
    setActiveColumn(null);
  };

  const handleDrop = (event, status) => {
    event.preventDefault();
    setActiveColumn(null);
    try {
      const dataStr = event.dataTransfer.getData('application/json');
      if (dataStr) {
        const row = JSON.parse(dataStr);
        if (onCardDrop) {
          onCardDrop(row, status);
        }
      }
    } catch (error) {
      console.error('Failed to parse dropped card data', error);
    }
  };

  const kanbanColumns = config.statusLabels.filter(
    (label) => !['All', 'All Modules', 'All Users'].includes(label)
  ).slice(0, 5);

  return (
    <section className="grid gap-3 overflow-x-auto" style={{ gridTemplateColumns: `repeat(${kanbanColumns.length}, minmax(240px, 1fr))` }}>
      {kanbanColumns.map((status) => {
        const filteredRows = rows.filter((row) => rowMatchesStatus(row, status, config));
        const isHovered = activeColumn === status;

        return (
          <div 
            key={status} 
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
            className={`grid min-h-72 min-w-48 content-start gap-3 rounded-lg border p-3 transition-colors ${
              isHovered 
                ? 'border-enterprise-blue bg-blue-50/30' 
                : 'border-enterprise-line bg-white'
            }`}
          >
            <h3 className="text-sm font-extrabold text-slate-600">{status} ({filteredRows.length})</h3>
            {filteredRows.map((row, index) => (
              <article 
                key={`${status}-${row.reference || row.id || index}`} 
                draggable={true}
                onDragStart={(e) => handleDragStart(e, row)}
                className={`grid gap-1 rounded-md border border-slate-200 bg-slate-50 p-3 transition-shadow cursor-grab active:cursor-grabbing hover:border-enterprise-blue hover:shadow-sm`}
                onClick={() => onCardClick && onCardClick(row)}
              >
                <strong className="text-sm text-slate-900">{row.reference || row.name || row.record_type || `#${row.id}`}</strong>
                <span className="text-sm text-slate-600">{row.customer_name || row.vendor_name || row.finished_product_name || row.product_name || row.module_code || row.full_name || 'Operational record'}</span>
                <small className="text-xs font-bold text-enterprise-muted">{row.status || row.action || 'Open'}</small>
              </article>
            ))}
          </div>
        );
      })}
    </section>
  );
}
