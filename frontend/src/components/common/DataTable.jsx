import { formatCell, labelize } from '../../utils/formatters';

export function DataTable({ columns, loading = false, rows }) {
  return (
    <section className="overflow-auto rounded-lg border border-enterprise-line bg-white">
      <table className="w-full min-w-[840px] border-collapse">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wide text-slate-500">
                {labelize(column)}
              </th>
            ))}
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
              <tr key={row.id || row.reference || index} className="hover:bg-blue-50/40">
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
    </section>
  );
}
