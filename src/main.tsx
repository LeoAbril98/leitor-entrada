import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// A premium vanilla modal that displays when a PWA update is detected
const showBeautifulUpdateModal = (onConfirm: () => void) => {
  if (document.getElementById('pwa-update-modal')) return;

  // Backdrop container
  const modalContainer = document.createElement('div');
  modalContainer.id = 'pwa-update-modal';
  Object.assign(modalContainer.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '99999',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    backgroundColor: 'rgba(2, 6, 23, 0.75)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    opacity: '0',
    transition: 'opacity 0.25s ease-out'
  });

  // Modal card
  const card = document.createElement('div');
  Object.assign(card.style, {
    width: '100%',
    maxWidth: '380px',
    backgroundColor: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(16, 185, 129, 0.1)',
    textAlign: 'center',
    transform: 'scale(0.92)',
    transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
  });

  // Inner elements
  card.innerHTML = `
    <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background-color: rgba(16, 185, 129, 0.1); border-radius: 9999px; margin-bottom: 16px;">
      <svg style="width: 28px; height: 28px; color: #10b981;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"></path>
      </svg>
    </div>
    <h3 style="color: #ffffff; font-size: 18px; font-weight: 700; margin: 0 0 8px 0; font-family: system-ui, -apple-system, sans-serif;">Nova Versão Disponível</h3>
    <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 0 0 24px 0; font-family: system-ui, -apple-system, sans-serif;">Uma versão atualizada com correções e melhorias de velocidade para o leitor de código de barras está pronta.</p>
    <div style="display: flex; gap: 12px;">
      <button id="pwa-cancel-btn" style="flex: 1; padding: 12px; border-radius: 14px; border: 1px solid #334155; background: transparent; color: #cbd5e1; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s; font-family: system-ui, -apple-system, sans-serif;">Mais Tarde</button>
      <button id="pwa-confirm-btn" style="flex: 1; padding: 12px; border-radius: 14px; border: none; background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; font-weight: 600; font-size: 14px; cursor: pointer; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25); transition: all 0.2s; font-family: system-ui, -apple-system, sans-serif;">Atualizar</button>
    </div>
  `;

  modalContainer.appendChild(card);
  document.body.appendChild(modalContainer);

  // Fade-in animation
  requestAnimationFrame(() => {
    modalContainer.style.opacity = '1';
    card.style.transform = 'scale(1)';
  });

  const closeModal = () => {
    modalContainer.style.opacity = '0';
    card.style.transform = 'scale(0.92)';
    setTimeout(() => {
      if (modalContainer.parentNode) {
        modalContainer.parentNode.removeChild(modalContainer);
      }
    }, 250);
  };

  const confirmBtn = card.querySelector('#pwa-confirm-btn') as HTMLButtonElement;
  const cancelBtn = card.querySelector('#pwa-cancel-btn') as HTMLButtonElement;

  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      closeModal();
      onConfirm();
    });
    confirmBtn.addEventListener('mouseenter', () => {
      confirmBtn.style.transform = 'translateY(-1px)';
      confirmBtn.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.35)';
    });
    confirmBtn.addEventListener('mouseleave', () => {
      confirmBtn.style.transform = 'none';
      confirmBtn.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.25)';
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      closeModal();
    });
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
      cancelBtn.style.borderColor = '#475569';
    });
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.backgroundColor = 'transparent';
      cancelBtn.style.borderColor = '#334155';
    });
  }
};

// Register the PWA service worker with an update notification prompt.
const updateSW = registerSW({
  onNeedRefresh() {
    showBeautifulUpdateModal(() => {
      updateSW(true);
    });
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
