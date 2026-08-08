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

if ('serviceWorker' in navigator && import.meta.env.DEV) {
  // The service worker caches `.tsx`/`.ts` module requests cache-first (see public/sw.js),
  // which silently serves stale source files during development — a previously-registered
  // SW would otherwise keep intercepting Vite's dev requests forever. Drop it in dev so
  // every reload always hits the live dev server, matching what's actually on disk.
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('[PWA] Service worker registration failed:', error);
    });

    navigator.serviceWorker.ready
      .then((registration) => {
        if (registration.active) {
          registration.active.postMessage({ type: 'BTP_REQUEST_SHARED_FILES' });
        }
      })
      .catch((error) => {
        console.warn('[PWA] Unable to request shared files from service worker:', error);
      });
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') {
      return;
    }

    if (data.type === 'BTP_SHARE_TARGET_READY') {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.active) {
          registration.active.postMessage({ type: 'BTP_REQUEST_SHARED_FILES' });
        }
      });
      return;
    }

    if (data.type === 'BTP_SHARED_FILES' && Array.isArray(data.files) && data.files.length > 0) {
      queuePlatformFiles(data.files as File[]);
      if (window.location.pathname !== '/escala') {
        window.history.pushState({}, '', '/escala?shared=1');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }
  });
}

void registerLaunchQueue();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
