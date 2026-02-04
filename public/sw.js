/**
 * LiveMatch - Smart Service Worker v2.0
 * =====================================
 * الاستراتيجية الذكية:
 * 1. الأصول الثابتة (CSS/JS/Fonts/Icons) → Cache-First (سريع جداً)
 * 2. البيانات الديناميكية (matches.json) → Network-First (دائماً محدث)
 * 3. صفحات HTML → Stale-While-Revalidate (سريع + محدث)
 * 4. الإعلانات وسكربتات الشبكات → No-Cache أبداً
 */

const CACHE_NAME = 'livematch-smart-v2';
const STATIC_CACHE_NAME = 'livematch-static-v2';

// الأصول الثابتة للكاش (لا تتغير كثيراً)
const STATIC_ASSETS = [
    '/css/simple-style.css',
    '/js/config.js',
    '/js/analytics.js',
    '/js/matches-v2.js',
    '/js/monetization-v2.js',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
    'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap'
];

// الروابط التي لا يجب تخزينها أبداً (إعلانات وبيانات ديناميكية)
const NEVER_CACHE_PATTERNS = [
    /matches\.json/,           // بيانات المباريات - دائماً جديدة
    /cloudfront\.net/,         // Ad-Maven
    /highperformanceformat/,   // Adsterra
    /pollfish/,                // Pollfish
    /googletagmanager/,        // Analytics
    /gtag/,                    // Google Tag
    /admob|adsense|adcolony/i, // شبكات إعلانية
    /\/data\//,                // أي بيانات JSON
];

// التثبيت: تخزين الأصول الثابتة
self.addEventListener('install', (event) => {
    console.log('🚀 Smart SW: Installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then(cache => {
                console.log('📦 Caching static assets...');
                return cache.addAll(STATIC_ASSETS.filter(url => url.startsWith('/')));
            })
            .then(() => self.skipWaiting())
    );
});

// التنشيط: حذف الكاش القديم
self.addEventListener('activate', (event) => {
    console.log('✅ Smart SW: Activating...');
    event.waitUntil(
        caches.keys().then(keyList => {
            return Promise.all(
                keyList
                    .filter(key => key !== CACHE_NAME && key !== STATIC_CACHE_NAME)
                    .map(key => {
                        console.log('🗑️ Deleting old cache:', key);
                        return caches.delete(key);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// الجلب: الاستراتيجية الذكية
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // ===== 1. الإعلانات والبيانات الديناميكية: Network-Only (لا كاش أبداً) =====
    if (NEVER_CACHE_PATTERNS.some(pattern => pattern.test(event.request.url))) {
        event.respondWith(fetch(event.request));
        return;
    }

    // ===== 2. صفحات HTML: Stale-While-Revalidate =====
    if (event.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return fetch(event.request)
                    .then(response => {
                        // حفظ النسخة الجديدة
                        cache.put(event.request, response.clone());
                        return response;
                    })
                    .catch(() => {
                        // إذا فشل الاتصال، استخدم الكاش
                        return cache.match(event.request);
                    });
            })
        );
        return;
    }

    // ===== 3. الأصول الثابتة (CSS/JS/Fonts/Images): Cache-First =====
    if (
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.woff2') ||
        url.hostname.includes('fonts.googleapis') ||
        url.hostname.includes('fonts.gstatic')
    ) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    // أعد الكاش فوراً، وحدّث في الخلفية
                    fetch(event.request).then(response => {
                        caches.open(STATIC_CACHE_NAME).then(cache => {
                            cache.put(event.request, response);
                        });
                    }).catch(() => { });
                    return cachedResponse;
                }
                // لا يوجد كاش، اجلب من الشبكة
                return fetch(event.request).then(response => {
                    const responseClone = response.clone();
                    caches.open(STATIC_CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                });
            })
        );
        return;
    }

    // ===== 4. أي شيء آخر: Network-First =====
    event.respondWith(
        fetch(event.request)
            .catch(() => caches.match(event.request))
    );
});

console.log('🎯 LiveMatch Smart SW v2.0 Loaded');
