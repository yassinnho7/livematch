/**
 * PWA Install Prompt Logic
 * Handles the 'beforeinstallprompt' event to show a custom install button.
 */

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI notify the user they can install the PWA
    showInstallPromotion();
});

function showInstallPromotion() {
    // Create the install banner if it doesn't exist
    if (!document.getElementById('pwa-install-banner')) {
        const banner = document.createElement('div');
        banner.id = 'pwa-install-banner';
        banner.className = 'pwa-install-banner';
        banner.innerHTML = `
            <div class="pwa-content">
                <img src="/icons/icon-192x192.png" alt="App Icon" class="pwa-icon">
                <div class="pwa-text">
                    <h3>ثبت التطبيق الآن</h3>
                    <p>تابع المباريات بدون تقطيع وبسرعة صاروخية! 🚀</p>
                </div>
            </div>
            <button id="pwa-install-btn" class="pwa-btn">تثبيت</button>
            <button id="pwa-close-btn" class="pwa-close">✕</button>
        `;
        document.body.appendChild(banner);

        // Add event listeners
        document.getElementById('pwa-install-btn').addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                deferredPrompt = null;
            }
            hideInstallPromotion();
        });

        document.getElementById('pwa-close-btn').addEventListener('click', () => {
            hideInstallPromotion();
        });

        // Show with animation
        setTimeout(() => {
            banner.classList.add('visible');
        }, 100);
    }
}

function hideInstallPromotion() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) {
        banner.classList.remove('visible');
        setTimeout(() => {
            banner.remove();
        }, 300); // Wait for transition
    }
}

// Check if app is already installed
window.addEventListener('appinstalled', () => {
    hideInstallPromotion();
    console.log('PWA was installed');
});
