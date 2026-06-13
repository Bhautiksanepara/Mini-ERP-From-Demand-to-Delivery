import { Activity, Factory, FileClock, ShieldCheck, ShoppingCart, Truck, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiRequest } from '../services/apiClient';

export function DashboardPage({ user }) {
  const [health, setHealth] = useState('Checking');

  useEffect(() => {
    apiRequest('/health').then(() => setHealth('Connected')).catch(() => setHealth('Unavailable'));
  }, []);

  const cards = [
    ['Total Sales Orders', '18', 'Pending delivery: 8', ShoppingCart],
    ['Manufacturing Orders', '14', 'In progress: 1', Factory],
    ['Purchase Orders', '11', 'Partial receipts: 5', Truck],
    ['Delayed Orders', '7', 'Confirmed after schedule', Activity],
    ['Total Logs', '1265', 'Updated today', FileClock],
    ['Total Value', '600000', 'Stock valuation snapshot', ShieldCheck]
  ];

  return (
    <main className="grid gap-5 p-6 max-md:p-4">
      <section className="grid grid-cols-6 gap-3 max-xl:grid-cols-3 max-md:grid-cols-1">
        {cards.map(([label, value, hint, Icon]) => (
          <article key={label} className="grid min-h-32 gap-2 rounded-lg border border-enterprise-line bg-white p-4">
            <Icon className="text-enterprise-blue" size={21} />
            <span className="text-sm font-bold text-slate-500">{label}</span>
            <strong className="text-3xl font-extrabold text-slate-900">{value}</strong>
            <small className="text-xs font-semibold text-enterprise-muted">{hint}</small>
          </article>
        ))}
      </section>
      <section className="rounded-lg border border-enterprise-line bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold">Demand to Delivery Flow</h3>
            <p className="text-sm text-enterprise-muted">Inventory movement is the center of every transaction.</p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${health === 'Unavailable' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-enterprise-blueDark'}`}>{health}</span>
        </div>
        <div className="grid grid-cols-6 gap-2 max-xl:grid-cols-3 max-md:grid-cols-1">
          {['Product Creation', 'Sales Demand', 'Procurement', 'Manufacturing', 'Delivery', 'Stock Ledger'].map((step, index) => (
            <div key={step} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-enterprise-blue text-sm font-extrabold text-white">{index + 1}</span>
              <strong className="text-sm text-slate-800">{step}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        <InfoPanel title="My Work" icon={Wrench} rows={['Confirmed sales orders assigned to user', 'Manufacturing operations waiting for start', 'Purchase orders pending receipt']} />
        <InfoPanel title="Access Profile" icon={ShieldCheck} rows={(user.roles || []).map((role) => role.name || role.code).concat('Field-level permissions ready')} />
      </section>
    </main>
  );
}

function InfoPanel({ title, icon: Icon, rows }) {
  return (
    <section className="rounded-lg border border-enterprise-line bg-white p-5">
      <h3 className="mb-3 flex items-center gap-2 text-base font-extrabold"><Icon size={18} />{title}</h3>
      {rows.map((row) => <p key={row} className="border-t border-slate-100 py-2.5 text-sm font-medium text-slate-600">{row}</p>)}
    </section>
  );
}
