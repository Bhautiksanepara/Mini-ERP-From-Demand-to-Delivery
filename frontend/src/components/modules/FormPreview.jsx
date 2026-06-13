import { Button } from '../common/Button';

export function FormPreview({ config }) {
  return (
    <section className="rounded-lg border border-enterprise-line bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-slate-900">{config.title.replace(/s$/, '')} Form View</h3>
          <p className="text-sm text-enterprise-muted">Fields follow the Excalidraw breakdown and lifecycle actions.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="subtle">Back</Button>
          <Button variant="ghost">Confirm</Button>
          <Button variant="subtle">Cancel</Button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 max-xl:grid-cols-3 max-md:grid-cols-1">
        {config.formFields.map((field) => (
          <label key={field} className="grid gap-1.5">
            <span className="text-xs font-extrabold text-slate-500">{field}</span>
            <div className="min-h-10 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
              {field.includes('Quantity') || field.includes('Price') ? '0.00' : 'Select or enter value'}
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
