const CACHE_STATIC = 'elstock-static-v3';
const CACHE_API = 'elstock-api-v1';
const CACHE_IMAGES = 'elstock-images-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install — cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate — rensa gamla caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => ![CACHE_STATIC, CACHE_API, CACHE_IMAGES].includes(name))
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch — smart strategi beroende på request-typ
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. API-anrop — network-first (alltid friskt data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok && request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_API).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then(cached => {
            if (cached) return cached;
            if (request.headers.get('accept')?.includes('application/json')) {
              return new Response(
                JSON.stringify({ error: 'Offline — ingen anslutning', offline: true }),
                { status: 503, headers: { 'Content-Type': 'application/json' } }
              );
            }
            return new Response('Offline', { status: 503 });
          });
        })
    );
    return;
  }

  // 2. Bilder från uploads — cache-first med network-fallback
  if (url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          fetch(request).then(response => {
            if (response.ok) {
              caches.open(CACHE_IMAGES).then(cache => cache.put(request, response.clone()));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_IMAGES).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => {
          if (url.pathname.startsWith('/icons/')) {
            return caches.match('/icons/icon-192.png');
          }
          return new Response('', { status: 204 });
        });
      })
    );
    return;
  }

  // 3. Statiska filer (CSS, JS, HTML) — cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        fetch(request).then(response => {
          if (response.ok) {
            caches.open(CACHE_STATIC).then(cache => cache.put(request, response.clone()));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_STATIC).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('', { status: 204 });
      });
    })
  );
});

// Lyssna på meddelanden från appen
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
