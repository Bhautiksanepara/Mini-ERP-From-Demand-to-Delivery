export function FormField({ label, value, onChange, type = 'text', children, error }) {
  return (
    <label className="grid gap-1.5 text-sm font-bold text-slate-700">
      <span>{label}</span>
      {children || (
        <input
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-enterprise-blue focus:ring-2 focus:ring-blue-100"
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {error && <span className="text-rose-600 text-xs font-medium">{error}</span>}
    </label>
  );
}
