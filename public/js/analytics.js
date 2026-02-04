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

    gtag('js', new Date());
    gtag('config', gaId, {
        'page_title': document.title,
        'page_path': window.location.pathname + window.location.search
    });

    console.log('✅ Analytics Loaded Successfully.');
})();
