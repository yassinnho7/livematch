/**
 * LIVE MATCH - SERVICE WORKER SELF-DESTRUCT
 * =========================================
 * This script exists solely to KILL any existing service worker.
 * If this file is loaded, it immediately unregisters itself.
 */

self.addEventListener('install', (event) => {
    console.log('💀 SW Self-Destruct: Installing...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('💀 SW Self-Destruct: Activating and Unregistering...');
    event.waitUntil(
        self.registration.unregister().then(() => {
            console.log('💥 SW Self-Destruct: Unregistered successfully.');
            return self.clients.matchAll();
        }).then(clients => {
            clients.forEach(client => client.navigate(client.url)); // Force reload to clear SW control
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Pass through everything, don't cache
    return;
});
