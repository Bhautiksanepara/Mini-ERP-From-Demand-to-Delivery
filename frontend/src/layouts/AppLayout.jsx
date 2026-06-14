import { LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen, UserRound } from 'lucide-react';
import { useState } from 'react';
import { BrandMark } from '../components/common/BrandMark';
import { moduleConfigs } from '../data/moduleConfigs';
import { cn } from '../utils/formatters';

export function AppLayout({ activePage, children, onNavigate, onLogout, user }) {
  const [collapsed, setCollapsed] = useState(false);
  const pageTitle = activePage === 'dashboard' ? 'System Administrator Dashboard' : moduleConfigs[activePage].title;
  const navigate = (page) => {
    onNavigate(page);
  };

  return (
    <div className={cn('grid min-h-screen bg-enterprise-shell transition-[grid-template-columns]', collapsed ? 'grid-cols-[82px_1fr]' : 'grid-cols-[268px_1fr]', 'max-md:grid-cols-1')}>
      <aside className="sticky top-0 h-screen overflow-hidden bg-enterprise-sidebar px-3 py-4 text-slate-200 max-md:relative max-md:h-auto">
        <div className="flex min-h-12 items-center gap-3 border-b border-white/10 px-1 pb-4">
          <BrandMark size="sm" />
          {!collapsed && (
            <div>
              <strong className="block text-lg text-white">Mini ERP</strong>
              <span className="text-xs text-slate-400">Operations Cockpit</span>
            </div>
          )}
        </div>
        <nav className="mt-4 grid gap-1 max-md:grid-cols-2">
          <NavButton active={activePage === 'dashboard'} collapsed={collapsed} icon={LayoutDashboard} label="Dashboard" onClick={() => navigate('dashboard')} />
          {Object.entries(moduleConfigs).map(([key, config]) => {
            const isAdmin = user?.roles?.some(r => r === 'admin' || r.code === 'admin' || (typeof r === 'string' && r === 'admin'));
            
            const moduleMapping = {
              sales: 'sales',
              purchase: 'purchase',
              manufacturing: 'manufacturing',
              boms: 'bom',
              products: 'product',
              inventory: 'inventory',
              audit: 'audit_logs',
              users: 'user_management'
            };

            const targetCode = moduleMapping[key];
            const hasViewPermission = isAdmin || user?.permissions?.module_permissions?.some(
              (p) => p.module_code === targetCode && p.action_code === 'view' && p.permission !== 'denied'
            );

            if (!hasViewPermission) return null;

            return (
              <NavButton key={key} active={activePage === key} collapsed={collapsed} icon={config.icon} label={config.title} onClick={() => navigate(key)} />
            );
          })}
        </nav>
      </aside>

      <section className="min-w-0">
        <header className="sticky top-0 z-10 flex min-h-[72px] items-center gap-4 border-b border-slate-200 bg-white/95 px-6 backdrop-blur max-md:flex-wrap max-md:px-4">
          <button className="grid h-10 w-10 place-items-center rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200" onClick={() => setCollapsed((value) => !value)} title={collapsed ? 'Open Master Menu' : 'Close Master Menu'}>
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-enterprise-muted">App Dashboard</span>
            <h2 className="m-0 text-xl font-extrabold text-slate-900">{pageTitle}</h2>
          </div>
          <div className="ml-auto flex items-center gap-2 max-md:ml-0 max-md:w-full">
            <div className="flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-slate-700">
              <UserRound size={17} className="text-slate-500" />
              <span className="font-bold text-sm">{user.full_name || user.login_id}</span>
            </div>
            <button className="grid h-10 w-10 place-items-center rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200" onClick={onLogout} title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        {children}
      </section>
    </div>
  );
}

function NavButton({ active, collapsed, icon: Icon, label, onClick }) {
  return (
    <button
      className={cn(
        'flex min-h-10 items-center gap-3 rounded-md px-3 text-left text-sm font-bold text-slate-300 transition hover:bg-enterprise-blue hover:text-white',
        active && 'bg-enterprise-blue text-white'
      )}
      onClick={onClick}
    >
      <Icon size={18} />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}
