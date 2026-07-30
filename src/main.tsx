import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { queuePlatformFiles } from './services/platformIntake';

async function registerLaunchQueue(): Promise<void> {
  const launchQueue = (window as Window & {
    launchQueue?: {
      setConsumer: (consumer: (launchParams: { files: FileSystemFileHandle[] }) => Promise<void> | void) => void;
    };
  }).launchQueue;

  if (!launchQueue) {
    return;
  }

  launchQueue.setConsumer(async (launchParams) => {
    const files: File[] = [];

    for (const handle of launchParams.files || []) {
      try {
        files.push(await handle.getFile());
      } catch (error) {
        console.warn('[PWA] Falha ao abrir arquivo compartilhado:', error);
      }
    }

    if (files.length > 0) {
      queuePlatformFiles(files);

      if (window.location.pathname !== '/planejamento-split') {
        window.history.pushState({}, '', '/planejamento-split');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('[PWA] Service worker registration failed:', error);
    });
  });
}

void registerLaunchQueue();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
