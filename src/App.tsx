import React, { useState } from 'react';
import { HomeMenu } from './components/HomeMenu';
import { CountingModule } from './components/CountingModule';
import { LocatorModule } from './components/LocatorModule';
import { PendenciesModule } from './components/PendenciesModule';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminManagementPanel } from './components/AdminManagementPanel';

import { UpdateWheelsModule } from './components/UpdateWheelsModule';
import { HistoryModule } from './components/HistoryModule';
import { getPhotoOverrides } from './lib/supabase';
import { setPhotoOverrides } from './utils/photoUtils';

type AppMode = 'menu' | 'counting' | 'locator' | 'pendencies' | 'update-wheels' | 'admin-login' | 'admin-dashboard' | 'admin-management' | 'admin-panel' | 'admin-history';

export default function App() {
  const [mode, setMode] = useState<AppMode>('menu');

  // Detect administrative route e carregar overrides globais
  React.useEffect(() => {
    if (window.location.pathname === '/admin') {
      setMode('admin-login');
    }

    // Carregar overrides de fotos do Supabase assim que o app inicia
    getPhotoOverrides().then(overrides => {
      if (overrides && overrides.length > 0) {
        setPhotoOverrides(overrides);
      }
    });
  }, []);

  // Reset scroll on view change
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [mode]);

  const handleSelectMode = (newMode: AppMode) => {
    setMode(newMode);
  };

  const handleBackToMenu = () => {
    setMode('menu');
  };

  if (mode === 'menu') {
    return <HomeMenu onSelectMode={handleSelectMode} />;
  }

  if (mode === 'locator') {
    return <LocatorModule onBackToMenu={handleBackToMenu} />;
  }

  if (mode === 'pendencies') {
    return <PendenciesModule onBackToMenu={handleBackToMenu} />;
  }

  if (mode === 'update-wheels') {
    return <UpdateWheelsModule onBackToMenu={handleBackToMenu} />;
  }

  if (mode === 'admin-login') {
    return (
      <AdminLogin 
        onLogin={() => setMode('admin-dashboard')} 
        onBack={handleBackToMenu} 
      />
    );
  }

  if (mode === 'admin-dashboard') {
    return (
      <AdminDashboard 
        onSelectModule={(mod) => mod === 'pendencies' ? setMode('admin-management') : null}
        onLogout={handleBackToMenu}
      />
    );
  }

  if (mode === 'admin-management') {
    return (
      <AdminManagementPanel 
        onBack={() => setMode('admin-dashboard')}
        onViewTable={() => setMode('admin-panel')}
        onViewHistory={() => setMode('admin-history')}
      />
    );
  }

  if (mode === 'admin-history') {
    return <HistoryModule onBack={() => setMode('admin-management')} />;
  }

  if (mode === 'admin-panel') {
    return <PendenciesModule onBackToMenu={() => setMode('admin-management')} isAdmin={true} />;
  }

  // mode === 'counting'
  return <CountingModule onBackToMenu={handleBackToMenu} />;
}