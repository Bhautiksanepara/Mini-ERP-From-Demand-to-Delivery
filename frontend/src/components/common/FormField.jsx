export function FormField({
  label,
  value,
  onChange,
  type = "text",
  children,
  error,
  disabled = false,
}) {
  const hasError = Boolean(error);

  return (
    <label className="grid gap-1.5 text-sm font-bold text-slate-700">
      <span>{label}</span>
      {children || (
        <input
          className={`h-10 rounded-md border px-3 text-sm font-medium outline-none transition ${
            disabled
              ? "border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
              : hasError
                ? "border-rose-400 bg-rose-50 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 text-slate-800"
                : "border-slate-300 focus:border-enterprise-blue focus:ring-2 focus:ring-blue-100 text-slate-800"
          }`}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
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
