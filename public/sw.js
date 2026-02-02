const CACHE_NAME = 'livematch-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/watch.html',
    '/css/style.css',
    '/js/monetization.js',
    '/data/matches.json'
];

// Install Event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS);
        })
    );
});

// Fetch Event
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
