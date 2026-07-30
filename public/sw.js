const CACHE_NAME = 'btp-smarttools-ai-v2';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];
let pendingSharedFiles = [];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method === 'POST') {
    const url = new URL(request.url);
    if (url.pathname === '/share-target') {
      event.respondWith(handleShareTarget(request));
      return;
    }
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  const requestUrl = new URL(request.url);
  const isAppAsset =
    requestUrl.origin === self.location.origin && (
      requestUrl.pathname.startsWith('/assets/') ||
      requestUrl.pathname.endsWith('.js') ||
      requestUrl.pathname.endsWith('.css') ||
      requestUrl.pathname.endsWith('.mjs')
    );

  if (isAppAsset) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => cachedResponse);
    })
  );
});

  self.addEventListener('message', (event) => {
    if (!event.data || typeof event.data !== 'object') {
      return;
    }

    if (event.data.type === 'BTP_REQUEST_SHARED_FILES') {
      if (event.source && 'postMessage' in event.source) {
        event.source.postMessage({
          type: 'BTP_SHARED_FILES',
          files: pendingSharedFiles,
        });
        pendingSharedFiles = [];
      }
    }
  });

  async function handleShareTarget(request) {
    try {
      const formData = await request.formData();
      const sharedFiles = formData.getAll('sharedFiles').filter((item) => item instanceof File);
      pendingSharedFiles = sharedFiles;

      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      windows.forEach((client) => {
        client.postMessage({ type: 'BTP_SHARE_TARGET_READY', filesCount: pendingSharedFiles.length });
      });

      return Response.redirect('/escala?shared=1', 303);
    } catch (error) {
      return new Response('Erro ao receber arquivo compartilhado.', { status: 500 });
    }
  }