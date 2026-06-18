import { AlertTriangle, Factory, RefreshCw, ShoppingCart, Truck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../services/apiClient';
import { cn } from '../utils/formatters';

const DEFAULT_STATUS_STYLE = { border: 'border-slate-200', bg: 'bg-white', label: 'text-slate-500', value: 'text-slate-800' };

const STATUS_STYLES = {
  Draft: { border: 'border-slate-200', bg: 'bg-slate-50', label: 'text-slate-500', value: 'text-slate-700' },
  Confirmed: { border: 'border-blue-200', bg: 'bg-blue-50', label: 'text-blue-600', value: 'text-blue-700' },
  'In Progress': { border: 'border-amber-200', bg: 'bg-amber-50', label: 'text-amber-600', value: 'text-amber-700' },
  'Partially Delivered': { border: 'border-amber-200', bg: 'bg-amber-50', label: 'text-amber-600', value: 'text-amber-700' },
  'Partially Received': { border: 'border-amber-200', bg: 'bg-amber-50', label: 'text-amber-600', value: 'text-amber-700' },
  'To Close': { border: 'border-purple-200', bg: 'bg-purple-50', label: 'text-purple-600', value: 'text-purple-700' },
  'Fully Delivered': { border: 'border-emerald-200', bg: 'bg-emerald-50', label: 'text-emerald-600', value: 'text-emerald-700' },
  'Fully Received': { border: 'border-emerald-200', bg: 'bg-emerald-50', label: 'text-emerald-600', value: 'text-emerald-700' },
  Done: { border: 'border-emerald-200', bg: 'bg-emerald-50', label: 'text-emerald-600', value: 'text-emerald-700' },
  Late: { border: 'border-red-200', bg: 'bg-red-50', label: 'text-red-500', value: 'text-red-600' },
  Cancelled: { border: 'border-rose-200', bg: 'bg-rose-50', label: 'text-rose-500', value: 'text-rose-600' }
};

function sumExcluding(counts, exclude = ['Late', 'Cancelled']) {
  if (!counts) return 0;
  const excluded = Array.isArray(exclude) ? exclude : [exclude];
  return Object.entries(counts).reduce((sum, [key, value]) => (excluded.includes(key) ? sum : sum + Number(value || 0)), 0);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function StatusRow({ label, statuses, counts, loading, onSelect, title }) {
  return (
    <div className="flex items-start gap-3 md:gap-4">
      <span className="mt-3 w-8 shrink-0 text-xs font-extrabold uppercase tracking-wide text-slate-400 md:w-12">{label}</span>
      <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:gap-3 md:overflow-visible md:pb-0">
        {statuses.map((status) => {
          const count = Number(counts?.[status.key] ?? 0);
          const style = count > 0 ? (STATUS_STYLES[status.key] || DEFAULT_STATUS_STYLE) : DEFAULT_STATUS_STYLE;

          return (
            <button
              key={`${label}-${status.key}`}
              onClick={() => onSelect(status)}
              className={cn(
                'flex min-w-[88px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-3 py-2 shadow-sm transition hover:shadow-md hover:ring-2 hover:ring-enterprise-blue/20 active:scale-95 md:min-w-[104px] md:px-4 md:py-2.5',
                style.border,
                style.bg
              )}
              title={`View ${title} — ${status.label}`}
            >
              {loading ? (
                <span className="block h-5 w-7 animate-pulse rounded bg-slate-200 md:h-6 md:w-8" />
              ) : (
                <span className={cn('text-lg font-extrabold md:text-xl', style.value)}>{count}</span>
              )}
              <span className={cn('text-xs font-semibold leading-tight', style.label)}>{status.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DashboardPage({ onNavigate, user }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = useCallback(() => {
    setLoading(true);
    apiRequest('/dashboard/stats')
      .then((res) => {
        if (res.success && res.data) {
          setStats(res.data);
          setError('');
        }
      })
      .catch((err) => {
        console.error('Error loading dashboard stats:', err);
        setError('Unable to load dashboard stats.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const sections = [
    {
      title: 'Sales Orders',
      icon: ShoppingCart,
      moduleKey: 'sales',
      statuses: [
        { key: 'Draft', label: 'Draft' },
        { key: 'Confirmed', label: 'Confirmed' },
        { key: 'Partially Delivered', label: 'Partially Delivered' },
        { key: 'Fully Delivered', label: 'Delivered' },
        { key: 'Late', label: 'Late' },
        { key: 'Cancelled', label: 'Cancelled' }
      ]
    },
    {
      title: 'Purchase Orders',
      icon: Truck,
      moduleKey: 'purchase',
      statuses: [
        { key: 'Draft', label: 'Draft' },
        { key: 'Confirmed', label: 'Confirmed' },
        { key: 'Partially Received', label: 'Partially Received' },
        { key: 'Fully Received', label: 'Received' },
        { key: 'Late', label: 'Late' },
        { key: 'Cancelled', label: 'Cancelled' }
      ]
    },
    {
      title: 'Manufacturing Orders',
      icon: Factory,
      moduleKey: 'manufacturing',
      statuses: [
        { key: 'Draft', label: 'Draft' },
        { key: 'Confirmed', label: 'Confirmed' },
        { key: 'In Progress', label: 'In-Progress' },
        { key: 'To Close', label: 'To Close' },
        { key: 'Done', label: 'Done' },
        { key: 'Late', label: 'Late' },
        { key: 'Cancelled', label: 'Cancelled' }
      ]
    }
  ];

  const overdueTotal = (stats?.sales?.all?.Late || 0) + (stats?.purchase?.all?.Late || 0) + (stats?.manufacturing?.all?.Late || 0);

  const summaryCards = [
    { key: 'sales', label: 'Sales Orders', icon: ShoppingCart, total: sumExcluding(stats?.sales?.all) },
    { key: 'purchase', label: 'Purchase Orders', icon: Truck, total: sumExcluding(stats?.purchase?.all) },
    { key: 'manufacturing', label: 'Manufacturing Orders', icon: Factory, total: sumExcluding(stats?.manufacturing?.all) },
    { key: 'overdue', label: 'Overdue Items', icon: AlertTriangle, total: overdueTotal, alert: true }
  ];

  return (
    <main className="grid gap-6 p-6 max-md:p-4 bg-enterprise-shell">
      <div className="flex items-center justify-between gap-4 max-md:flex-col max-md:items-start">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">
            {getGreeting()}, {user?.full_name || user?.login_id}
          </h1>
          <p className="text-sm font-semibold text-slate-400">Here&apos;s what&apos;s happening across your operations today.</p>
        </div>
        <button
          onClick={loadStats}
          disabled={loading}
          className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          const isAlert = card.alert && card.total > 0;
          return (
            <div
              key={card.key}
              className={cn('rounded-xl border bg-white p-5 shadow-sm', isAlert ? 'border-red-200' : 'border-slate-200')}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wide text-slate-400">{card.label}</span>
                <span className={cn('grid h-9 w-9 place-items-center rounded-lg', isAlert ? 'bg-red-50 text-red-600' : 'bg-enterprise-blue/10 text-enterprise-blue')}>
                  <Icon size={18} />
                </span>
              </div>
              {loading ? (
                <span className="mt-3 block h-8 w-16 animate-pulse rounded bg-slate-200" />
              ) : (
                <p className={cn('mt-3 text-3xl font-extrabold', isAlert ? 'text-red-600' : 'text-slate-800')}>{card.total}</p>
              )}
            </div>
          );
        })}
      </div>

      {sections.map((section) => {
        const Icon = section.icon;
        const moduleStats = stats?.[section.moduleKey];

        return (
          <section key={section.title} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-enterprise-blue/10 text-enterprise-blue">
                  <Icon size={20} />
                </span>
                <h3 className="text-lg font-extrabold text-slate-800">{section.title}</h3>
              </div>
              <button onClick={() => onNavigate(section.moduleKey)} className="text-sm font-bold text-enterprise-blue hover:underline">
                View all
              </button>
            </div>

            <div className="grid gap-4 p-5">
              <StatusRow
                label="All"
                title={section.title}
                statuses={section.statuses}
                counts={moduleStats?.all}
                loading={loading}
                onSelect={(status) => onNavigate(section.moduleKey, { status: status.key, mine: false })}
              />
              <div className="border-t border-slate-50 pt-4">
                <StatusRow
                  label="My"
                  title={section.title}
                  statuses={section.statuses}
                  counts={moduleStats?.my}
                  loading={loading}
                  onSelect={(status) => onNavigate(section.moduleKey, { status: status.key, mine: true })}
                />
              </div>
            </div>
          </section>
        );
      })}
    </main>
  );
}
