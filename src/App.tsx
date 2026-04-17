import React, { useState } from 'react';
import { HomeMenu } from './components/HomeMenu';
import { CountingModule } from './components/CountingModule';
import { LocatorModule } from './components/LocatorModule';
import { PendenciesModule } from './components/PendenciesModule';

type AppMode = 'menu' | 'counting' | 'locator' | 'pendencies';

export default function App() {
  const [mode, setMode] = useState<AppMode>(() => {
    // Tenta persistir qual módulo o usuário estava, 
    // ou se tinha contagem salva, vai direto para a contagem
    const savedReadings = localStorage.getItem('@MK_SAVED_READINGS');
    if (savedReadings && savedReadings !== '[]') {
      return 'counting';
    }
    const savedMode = localStorage.getItem('@MK_APP_MODE') as AppMode;
    return savedMode || 'menu';
  });

  const handleSelectMode = (newMode: AppMode) => {
    setMode(newMode);
    localStorage.setItem('@MK_APP_MODE', newMode);
  };

  const handleBackToMenu = () => {
    setMode('menu');
    localStorage.setItem('@MK_APP_MODE', 'menu');
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

  // mode === 'counting'
  return <CountingModule onBackToMenu={handleBackToMenu} />;
}