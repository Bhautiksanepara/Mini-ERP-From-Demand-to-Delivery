export function KanbanBoard({ config, rows }) {
  return (
    <section className="grid grid-cols-5 gap-3 overflow-x-auto">
      {config.statusLabels.slice(0, 5).map((status) => (
        <div key={status} className="grid min-h-72 min-w-48 content-start gap-3 rounded-lg border border-enterprise-line bg-white p-3">
          <h3 className="text-sm font-extrabold text-slate-600">{status}</h3>
          {rows.slice(0, 2).map((row, index) => (
            <article key={`${status}-${row.reference || index}`} className="grid gap-1 rounded-md border border-slate-200 bg-slate-50 p-3">
              <strong className="text-sm text-slate-900">{row.reference || row.name || row.record_type}</strong>
              <span className="text-sm text-slate-600">{row.customer_name || row.vendor_name || row.finished_product_name || row.product_name || row.module_code || 'Operational record'}</span>
              <small className="text-xs font-bold text-enterprise-muted">{row.status || row.action || 'Open'}</small>
            </article>
          ))}
        </div>
      ))}
    </section>
  );
}
