const CACHE_NAME = 'tick-v4';
const SHELL = [
  '/Habits-App/',
  '/Habits-App/index.html',
  '/Habits-App/manifest.json',
  '/Habits-App/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('localhost') || event.request.url.includes('127.0.0.1')) return;

  // Network-first for Supabase — never serve stale auth/data
  if (event.request.url.includes('supabase.co')) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Network-first for the HTML shell so users get the latest <head>/icons
  const isHtml = event.request.mode === 'navigate' ||
                 event.request.destination === 'document' ||
                 event.request.url.endsWith('/Habits-App/') ||
                 event.request.url.endsWith('/Habits-App/index.html');
  if (isHtml) {
    event.respondWith(
      fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request).then((c) => c || caches.match('/Habits-App/index.html')))
    );
    return;
  }

  // Cache-first for hashed JS/CSS assets and icons
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match('/Habits-App/index.html'));
    })
  );
});
