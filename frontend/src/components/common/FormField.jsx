export function FormField({
  label,
  value,
  onChange,
  type = "text",
  children,
  error,
}) {
  const hasError = Boolean(error);

  return (
    <label className="grid gap-1.5 text-sm font-bold text-slate-700">
      <span>{label}</span>
      {children || (
        <input
          className={`h-10 rounded-md border bg-white px-3 text-sm font-medium text-slate-800 outline-none transition ${
            hasError
              ? "border-rose-400 bg-rose-50 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
              : "border-slate-300 focus:border-enterprise-blue focus:ring-2 focus:ring-blue-100"
          }`}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={hasError}
          aria-describedby={
            hasError
              ? `${label.toLowerCase().replace(/\s+/g, "-")}-error`
              : undefined
          }
        />
      )}
      {error && (
        <span
          id={`${label.toLowerCase().replace(/\s+/g, "-")}-error`}
          className="text-xs font-medium text-rose-600"
        >
          {error}
        </span>
      )}
    </label>
  );
}
