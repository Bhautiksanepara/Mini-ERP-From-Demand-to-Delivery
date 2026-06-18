import { LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Percent, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { BrandMark } from '../components/common/BrandMark';
import { moduleConfigs } from '../data/moduleConfigs';
import { cn } from '../utils/formatters';

export function AppLayout({ activePage, children, onNavigate, onLogout, user }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const pageTitle = activePage === 'dashboard'
    ? 'Dashboard'
    : activePage === 'profile'
      ? 'My Profile'
      : activePage === 'discount-rules'
        ? 'Discount Rules'
        : moduleConfigs[activePage].title;

  const navigate = (page) => {
    onNavigate(page);
    setMobileOpen(false);
  };

  const isAdmin = user?.roles?.some(r => r === 'admin' || r.code === 'admin' || (typeof r === 'string' && r === 'admin'));

  const moduleMapping = {
    sales: 'sales', purchase: 'purchase', manufacturing: 'manufacturing',
    boms: 'bom', products: 'product', inventory: 'inventory',
    audit: 'audit_logs', users: 'user_management'
  };

  return (
    <div className={cn(
      'grid min-h-screen bg-enterprise-shell transition-[grid-template-columns] duration-200',
      collapsed ? 'grid-cols-[82px_1fr]' : 'grid-cols-[268px_1fr]',
      'max-md:grid-cols-1'
    )}>

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'sticky top-0 h-screen overflow-y-auto overflow-x-hidden bg-enterprise-sidebar px-3 py-4 text-slate-200',
        'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-72 max-md:transition-transform max-md:duration-300',
        mobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
      )}>
        <div className="flex min-h-12 items-center gap-3 border-b border-white/10 px-1 pb-4">
          <BrandMark size="sm" />
          {!collapsed && (
            <>
              <div>
                <strong className="block text-lg text-white">Mini ERP</strong>
                <span className="text-xs text-slate-400">Operations Cockpit</span>
              </div>
              <button
                className="ml-auto grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:text-white md:hidden"
                onClick={() => setMobileOpen(false)}
              >
                <X size={18} />
              </button>
            </>
          )}
        </div>
        <nav className="mt-4 grid gap-1">
          <NavButton active={activePage === 'dashboard'} collapsed={collapsed} icon={LayoutDashboard} label="Dashboard" onClick={() => navigate('dashboard')} />
          {isAdmin && (
            <NavButton active={activePage === 'discount-rules'} collapsed={collapsed} icon={Percent} label="Discount Rules" onClick={() => navigate('discount-rules')} />
          )}
          {Object.entries(moduleConfigs).map(([key, config]) => {
            const targetCode = moduleMapping[key];
            const hasViewPermission = isAdmin || user?.permissions?.module_permissions?.some(
              (p) => p.module_code === targetCode && p.action_code === 'view' && p.permission !== 'denied'
            );
            if (!hasViewPermission) return null;
            return (
              <NavButton key={key} active={activePage === key} collapsed={collapsed} icon={config.icon} label={config.title} onClick={() => navigate(key)} />
            );
          })}
          <NavButton active={activePage === 'profile'} collapsed={collapsed} icon={UserRound} label="My Profile" onClick={() => navigate('profile')} />
        </nav>
      </aside>

      {/* Main content */}
      <section className="min-w-0">
        <header className="sticky top-0 z-10 flex min-h-[64px] items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
          {/* Mobile hamburger */}
          <button
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={19} />
          </button>
          {/* Desktop sidebar toggle */}
          <button
            className="hidden h-10 w-10 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 md:grid"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? 'Expand menu' : 'Collapse menu'}
          >
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>

          <div className="min-w-0 flex-1">
            <span className="hidden text-xs font-bold uppercase tracking-wide text-enterprise-muted sm:block">Mini ERP</span>
            <h2 className="truncate text-base font-extrabold text-slate-900 md:text-xl">{pageTitle}</h2>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              onClick={() => navigate('profile')}
              className="flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-slate-700 transition hover:border-enterprise-blue hover:bg-slate-50"
            >
              <UserRound size={17} className="text-slate-500" />
              <span className="hidden text-sm font-bold sm:inline">{user.full_name || user.login_id}</span>
            </button>
            <button
              className="grid h-10 w-10 place-items-center rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
              onClick={onLogout}
              title="Logout"
            >
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
      <Icon size={18} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}
