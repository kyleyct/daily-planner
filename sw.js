/* Daily Planner service worker — cache-first shell.
 * Phases 1–2 only: NO Web Push / push event handlers.
 * (Optional future: push / notificationclick can be added later.)
 */
const CACHE = 'daily-planner-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Same-origin only; let cross-origin (e.g. Google Fonts) go to network
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Cache successful same-origin navigations / static assets
        if (res && res.ok && (req.mode === 'navigate' || SHELL.some((p) => url.pathname.endsWith(p.replace('./', '/')) || url.pathname.endsWith(p.slice(1))))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        } else if (res && res.ok && req.destination && ['document', 'script', 'style', 'image', 'font', 'manifest'].includes(req.destination)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => {
        if (req.mode === 'navigate') return caches.match('./index.html');
        return caches.match(req);
      });
    })
  );
});

// No push / notificationclick — Web Push is out of scope for phases 1–2.
