/**
 * LiveMatch - Service Worker v3.0 (Disabled)
 * ==========================================
 * الكاشينغ معطل تماماً لتجنب مشاكل الإعلانات والتحديثات
 */

const CACHE_NAME = 'livematch-disabled-v3';

// التثبيت: تخطي فوري
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// التنشيط: حذف جميع الكاش
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keyList => {
            return Promise.all(keyList.map(key => caches.delete(key)));
        }).then(() => self.clients.claim())
    );
});

// الجلب: دائماً من الشبكة (بدون كاش)
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});
