/**
 * LIVE MATCH - SERVICE WORKER SELF-DESTRUCT (URGENT)
 * ==================================================
 * This script is designed to KILL any existing service worker 
 * and CLEAR all caches immediately.
 */

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    return caches.delete(cacheName);
                })
            );
        }).then(() => {
            return self.registration.unregister();
        }).then(() => {
            return self.clients.matchAll();
        }).then((clients) => {
            clients.forEach((client) => {
                if (client.url && 'navigate' in client) {
                    client.navigate(client.url);
                }
            });
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Do nothing, bypass everything to network
    return;
});
