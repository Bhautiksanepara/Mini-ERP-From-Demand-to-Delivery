import { cn } from '../../utils/formatters';

export function StatusStrip({ activeStatus, counts, onChange }) {
  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
      {counts.map((item) => (
        <button
          key={item.label}
          className={cn(
            'grid min-h-16 gap-1 rounded-lg border border-enterprise-line bg-white px-3 py-2 text-left transition',
            activeStatus === item.label && 'border-enterprise-blue text-enterprise-blueDark shadow-[0_0_0_3px_rgb(15_108_189_/_12%)]'
          )}
          onClick={() => onChange(item.label)}
        >
          <strong className="text-xl">{item.count}</strong>
          <span className="text-xs font-extrabold text-slate-500">{item.label}</span>
        </button>
      ))}
    </section>
  );
}
