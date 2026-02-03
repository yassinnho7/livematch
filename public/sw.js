const CACHE_NAME = 'livematch-killer-v1';

// Install: Skip waiting to activate immediately
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Activate: Delete ALL caches and take control
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                console.log('🔥 Killer SW: Deleting cache', key);
                return caches.delete(key);
            }));
        })
    );
    self.clients.claim();
});

// Fetch: Always go to network (no cache)
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});
