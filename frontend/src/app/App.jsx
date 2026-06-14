import React, { useState } from 'react';
import { BrandMark } from '../components/common/BrandMark';
import { AppLayout } from '../layouts/AppLayout';
import { moduleConfigs } from '../data/moduleConfigs';
import { useAuth } from '../hooks/useAuth';
import { AuthPage } from '../pages/AuthPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ModulePage } from '../pages/ModulePage';
import { ProfilePage } from '../pages/ProfilePage';

export function App() {
  const { isBooting, signIn, signOut, signUp, updateUser, user } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [pageFilters, setPageFilters] = useState(null);

  const navigate = (page, filters = null) => {
    setActivePage(page);
    setPageFilters(filters);
  };

  if (isBooting) return <BootScreen />;
  if (!user) return <AuthPage onSignIn={signIn} onSignUp={signUp} />;

  return (
    <AppLayout activePage={activePage} onLogout={signOut} onNavigate={navigate} user={user}>
      {activePage === 'dashboard' ? (
        <DashboardPage onNavigate={navigate} user={user} />
      ) : activePage === 'profile' ? (
        <ProfilePage user={user} onUserUpdate={updateUser} />
      ) : (
        <ModulePage config={moduleConfigs[activePage]} moduleKey={activePage} initialFilters={pageFilters} user={user} />
      )}
    </AppLayout>
  );
}

function BootScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-enterprise-shell text-slate-600">
      <div className="grid justify-items-center gap-3">
        <BrandMark />
        <span className="text-sm font-bold">Loading Mini ERP</span>
      </div>
    </main>
  );
}
