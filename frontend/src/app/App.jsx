import React, { useState } from 'react';
import { BrandMark } from '../components/common/BrandMark';
import { AppLayout } from '../layouts/AppLayout';
import { moduleConfigs } from '../data/moduleConfigs';
import { useAuth } from '../hooks/useAuth';
import { AuthPage } from '../pages/AuthPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ModulePage } from '../pages/ModulePage';

export function App() {
  const { isBooting, signIn, signOut, signUp, user } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');

  if (isBooting) return <BootScreen />;
  if (!user) return <AuthPage onSignIn={signIn} onSignUp={signUp} />;

  return (
    <AppLayout activePage={activePage} onLogout={signOut} onNavigate={setActivePage} searchTerm={searchTerm} onSearch={setSearchTerm} user={user}>
      {activePage === 'dashboard' ? (
        <DashboardPage user={user} />
      ) : (
        <ModulePage config={moduleConfigs[activePage]} moduleKey={activePage} searchTerm={searchTerm} />
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
