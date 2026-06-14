import { Factory, ShoppingCart, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiRequest } from '../services/apiClient';

export function DashboardPage({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest('/dashboard/stats')
      .then((res) => {
        if (res.success && res.data) {
          setStats(res.data);
        }
      })
      .catch((err) => console.error('Error loading dashboard stats:', err))
      .finally(() => setLoading(false));
  }, []);

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
        { key: 'Late', label: 'Late' }
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
        { key: 'Late', label: 'Late' }
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
        { key: 'Late', label: 'Late' }
      ]
    }
  ];

  return (
    <main className="grid gap-6 p-6 max-md:p-4 bg-enterprise-shell">
      {sections.map((section) => {
        const Icon = section.icon;
        const moduleStats = stats?.[section.moduleKey];

        return (
          <section key={section.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-5 flex items-center gap-2 text-lg font-extrabold text-slate-800 border-b border-slate-100 pb-3">
              <Icon size={20} className="text-enterprise-blue" />
              {section.title}
            </h3>

            <div className="grid gap-5">
              {/* All Row */}
              <div className="flex items-center gap-4 max-md:flex-col max-md:items-start">
                <span className="text-sm font-extrabold text-slate-400 w-10 uppercase tracking-wide max-md:w-auto select-none">All</span>
                <div className="flex flex-wrap gap-3">
                  {section.statuses.map((status) => {
                    const count = loading ? '...' : (moduleStats?.all?.[status.key] ?? 0);
                    return (
                      <button
                        key={`all-${status.key}`}
                        onClick={() => onNavigate(section.moduleKey, { status: status.key, mine: false })}
                        className="flex flex-col items-center justify-center border border-slate-200 hover:border-enterprise-blue hover:bg-slate-50 transition rounded-xl px-4 py-2 bg-white min-w-[100px] shadow-sm active:scale-95 duration-100"
                        title={`View all ${section.title} with status ${status.label}`}
                      >
                        <span className="text-xl font-extrabold text-slate-800">{count}</span>
                        <span className="text-xs font-semibold text-slate-500">{status.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* My Row */}
              <div className="flex items-center gap-4 max-md:flex-col max-md:items-start border-t border-slate-50 pt-4">
                <span className="text-sm font-extrabold text-slate-400 w-10 uppercase tracking-wide max-md:w-auto select-none">My</span>
                <div className="flex flex-wrap gap-3">
                  {section.statuses.map((status) => {
                    const count = loading ? '...' : (moduleStats?.my?.[status.key] ?? 0);
                    return (
                      <button
                        key={`my-${status.key}`}
                        onClick={() => onNavigate(section.moduleKey, { status: status.key, mine: true })}
                        className="flex flex-col items-center justify-center border border-slate-200 hover:border-enterprise-blue hover:bg-slate-50 transition rounded-xl px-4 py-2 bg-white min-w-[100px] shadow-sm active:scale-95 duration-100"
                        title={`View my ${section.title} with status ${status.label}`}
                      >
                        <span className="text-xl font-extrabold text-slate-800">{count}</span>
                        <span className="text-xs font-semibold text-slate-500">{status.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </main>
  );
}
