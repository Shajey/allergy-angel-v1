const CACHE_NAME = 'allergy-angel-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET and API requests
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }
  // Don't cache icons/favicon — always fetch fresh so app icon updates deploy correctly
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/icons/') || url.pathname === '/favicon.ico') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request).then((c) => c ?? Response.error()))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Avoid respondWith(undefined) when offline / no cache (invalid → net::ERR in DevTools)
          return fetch(event.request).catch(() => Response.error());
        })
      )
  );
});
