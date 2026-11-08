/* StockMeta AI — service worker
   Cache-first untuk aset, network-first untuk halaman.
   Naikkan CACHE_VERSION setiap kali file diubah. */
const CACHE_VERSION = 'stockmeta-v1.0.8';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Permintaan ke Gemini / proxy Google Suggest tidak di-cache.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Proxy/jaringan bisa membalas 5xx: jangan tampilkan halaman error,
          // pakai app shell yang sudah di-cache.
          if (!response || !response.ok) throw new Error('navigation response not ok');
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('./index.html');
          if (cached) return cached;
          return new Response(
            '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
            '<body style="font-family:sans-serif;background:#070d1a;color:#e2e8f0;padding:24px">' +
            '<h1>StockMeta AI</h1><p>Aplikasi belum tersimpan untuk mode offline. ' +
            'Sambungkan internet, buka sekali lagi, lalu coba kembali.</p></body>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 200 }
          );
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

