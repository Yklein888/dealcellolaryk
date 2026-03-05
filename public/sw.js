// Service Worker for offline support and caching
const CACHE_NAME = 'dealcellular-v1';
const RUNTIME_CACHE = 'dealcellular-runtime';

// Files to cache on install
const urlsToCache = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/App.tsx',
  '/src/index.css',
];

// Install event - cache essential files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(err => {
        console.log('Cache addAll error:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(request).then(response => {
      // Return cached response if available
      if (response) {
        return response;
      }

      // Otherwise, fetch from network
      return fetch(request).then(response => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Clone the response for caching
        const responseToCache = response.clone();

        // Cache successful API/asset responses
        if (request.url.includes('/api/') || request.url.match(/\.(js|css|png|jpg|jpeg|svg|woff|woff2)$/)) {
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(request, responseToCache);
          });
        }

        return response;
      }).catch(() => {
        // Network request failed, return cached version or offline page
        return caches.match(request) || new Response('אין חיבור אינטרנט. אנא בדוק את ההתחברות שלך.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain; charset=utf-8'
          })
        });
      });
    })
  );
});

// Message handler for cache control from app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
