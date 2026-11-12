/* 鲸语 Service Worker：离线壳 + 静态资源缓存（API 永不缓存） */
const VERSION = 'whaletalk-v1';
const SHELL = [
  '/',
  '/index.html',
  '/styles/tokens.css',
  '/styles/glass.css',
  '/styles/app.css',
  '/js/app.js',
  '/js/api.js',
  '/js/store.js',
  '/js/socket.js',
  '/js/dom.js',
  '/js/icons.js',
  '/js/format.js',
  '/js/ui.js',
  '/js/views/auth.js',
  '/js/views/chats.js',
  '/js/views/chat.js',
  '/js/views/friends.js',
  '/js/views/me.js',
  '/js/views/sheets.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/') || url.pathname === '/ws') {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
