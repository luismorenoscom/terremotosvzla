const SHELL_CACHE = 'tv-shell-v3';
const DATA_CACHE  = 'tv-data-v3';

const PRECACHE = ['/', '/logo.png', '/icon.png', '/manifest.json'];

// ── Instalación: pre-cachea el shell ────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(PRECACHE).catch(() => {}))
  );
});

// ── Activación: elimina caches viejos ───────────────────────
self.addEventListener('activate', event => {
  const CURRENT = [SHELL_CACHE, DATA_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys.filter(k => !CURRENT.includes(k)).map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: estrategia por tipo de recurso ───────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo GET del mismo origen
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  // API de sismos: red primero → cache de respaldo
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const cloned = res.clone();
            caches.open(DATA_CACHE).then(c => c.put(request, cloned));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then(cached =>
            cached ||
            new Response('[]', {
              headers: { 'Content-Type': 'application/json' },
            })
          )
        )
    );
    return;
  }

  // Assets de Next.js (con hash) — cache permanente
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok) {
            const cloned = res.clone();
            caches.open(SHELL_CACHE).then(c => c.put(request, cloned));
          }
          return res;
        });
      })
    );
    return;
  }

  // Todo lo demás (HTML, imágenes): red primero → cache de respaldo
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          const cloned = res.clone();
          caches.open(SHELL_CACHE).then(c => c.put(request, cloned));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});
