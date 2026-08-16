import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register the PWA service worker with an update notification prompt.
// This is critical for iOS standalone PWAs because they do not have a reload button.
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Uma nova versão do aplicativo está disponível. Deseja atualizar agora?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('Aplicativo pronto para uso offline.');
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

