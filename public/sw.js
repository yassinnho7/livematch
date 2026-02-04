/**
 * LIVE MATCH - THE CACHE KILLER v4.0 (NUCLEAR OPTION)
 * ==================================================
 * هذا السكربت يقتل أي كاش متبقي في متصفح الزائر نهائياً.
 */

self.addEventListener('install', (event) => {
    console.log('💀 SW Killer: Installing and clearing...');
    self.skipWaiting(); // تجاوي الانتظار
});

self.addEventListener('activate', (event) => {
    console.log('💀 SW Killer: Activating and destroying all caches...');
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    console.log('💥 Destroying cache:', key);
                    return caches.delete(key);
                })
            );
        }).then(() => {
            return self.clients.claim(); // السيطرة الفورية
        })
    );
});

// تعميم قاعدة: لا كاش أبداً، دائماً من الشبكة
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request, { cache: 'no-store' })
            .catch(() => fetch(event.request))
    );
});
