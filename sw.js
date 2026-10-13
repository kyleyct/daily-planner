/* Daily Planner service worker — cache-first shell + Web Push habit reminders */
const CACHE = 'daily-planner-v2';
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
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
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

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    try {
      data = { body: event.data && event.data.text() };
    } catch (e2) {
      data = {};
    }
  }
  const kind = (data.data && data.data.kind) || data.kind || 'morning';
  const title = data.title || (kind === 'evening' ? '今晚檢討' : '訂今日目標');
  const options = {
    body: data.body || (kind === 'evening'
      ? '回顧今日：完成了什麼、為什麼、明日可改進。檢討與計劃比分數重要。'
      : '花兩分鐘寫下今日目標。習慣比完成多少更重要。'),
    icon: data.icon || './icons/icon-192.png',
    badge: data.badge || './icons/icon-192.png',
    tag: data.tag || ('habit-' + kind),
    renotify: data.renotify !== false,
    lang: data.lang || 'zh-Hant-HK',
    data: Object.assign({ kind: kind }, data.data || {})
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const kind = (event.notification.data && event.notification.data.kind) || 'morning';
  const hash = kind === 'evening' ? '#night/review' : '#day/goals';
  const targetUrl = new URL('./' + hash, self.registration.scope).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const c = clientList[i];
        if (c.url && c.url.indexOf(self.registration.scope) === 0 && 'focus' in c) {
          return c.focus().then((client) => {
            if (client && client.postMessage) {
              client.postMessage({ type: 'habit-open', kind: kind });
            }
            return client;
          });
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
