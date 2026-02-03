const CACHE_NAME = 'livematch-v2';
const ASSETS = [
    '/',
    '/index.html',
    '/watch.html',
    '/css/style.css',
    '/css/simple-style.css',
    '/js/monetization.js',
    '/js/simple-matches.js',
    '/js/config.js',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// Install Event
self.addEventListener('install', event => {
    self.skipWaiting(); // Force activation
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS);
        })
    );
});

// Activate Event - Clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        console.log('🧹 Clearing old cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event - Network First for Data/HTML, Cache First for Assets
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Dynamic Content: Network First (Matches JSON, HTML pages)
    if (url.pathname.endsWith('.json') ||
        url.pathname.endsWith('.html') ||
        url.pathname === '/') {

        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Update cache with fresh copy
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request)) // Fallback to cache if offline
        );
        return;
    }

    // Static Assets: Cache First (Images, CSS, JS)
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).then(networkResponse => {
                const clone = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return networkResponse;
            });
        })
    );
});
