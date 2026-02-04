/**
 * LiveMatch - Google Analytics Loader
 * Dynamically loads GA4 based on config.js
 */

(function initAnalytics() {
    // 1. Check for Config & GA ID
    if (typeof MONETIZATION_CONFIG === 'undefined' ||
        !MONETIZATION_CONFIG.analytics ||
        !MONETIZATION_CONFIG.analytics.enabled ||
        !MONETIZATION_CONFIG.analytics.gaId ||
        MONETIZATION_CONFIG.analytics.gaId.includes('XXXX')) {
        console.log('📊 Analytics: Disabled or ID not set.');
        return;
    }

    const gaId = MONETIZATION_CONFIG.analytics.gaId;
    console.log(`📊 Initializing Google Analytics (${gaId})...`);

    // 2. Inject GTM Script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(script);

    // 3. Initialize dataLayer
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag; // Make global

    // 4. Helper: Track Custom Event
    window.trackEvent = function (eventName, params = {}) {
        if (!window.gtag) return;
        gtag('event', eventName, params);
        console.log(`📊 Event Sent: ${eventName}`, params);
    };

    // 5. "Super Event": Detect Rage Clicks (User Frustration)
    let clickConfig = { count: 0, lastTime: 0, element: null };
    document.addEventListener('click', (e) => {
        const now = Date.now();
        const el = e.target;

        if (now - clickConfig.lastTime < 300 && clickConfig.element === el) {
            clickConfig.count++;
            if (clickConfig.count === 3) { // 3 Rapid clicks on same element
                trackEvent('user_frustration', {
                    type: 'rage_click',
                    element_tag: el.tagName,
                    element_text: el.innerText.substring(0, 20),
                    element_class: el.className
                });
            }
        } else {
            clickConfig.count = 1;
            clickConfig.element = el;
        }
        clickConfig.lastTime = now;
    });

    console.log('✅ Analytics Loaded Successfully (Advanced Mode).');
})();
