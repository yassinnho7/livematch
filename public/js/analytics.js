/**
 * LiveMatch - Google Analytics Loader (Performance Optimized)
 * Delays GTM loading to avoid blocking FCP/LCP
 */

(function initAnalytics() {
    if (typeof MONETIZATION_CONFIG === 'undefined' ||
        !MONETIZATION_CONFIG.analytics ||
        !MONETIZATION_CONFIG.analytics.enabled ||
        !MONETIZATION_CONFIG.analytics.gaId ||
        MONETIZATION_CONFIG.analytics.gaId.includes('XXXX')) {
        return;
    }

    const gaId = MONETIZATION_CONFIG.analytics.gaId;

    // Use requestIdleCallback to load analytics when browser is idle
    const loadGA = function () {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        window.gtag = gtag;

        gtag('js', new Date());
        gtag('config', gaId, { 'send_page_view': true });
    };

    if ('requestIdleCallback' in window) {
        requestIdleCallback(loadGA, { timeout: 3000 });
    } else {
        setTimeout(loadGA, 1500);
    }

    window.trackEvent = function (eventName, params = {}) {
        if (!window.gtag) return;
        window.gtag('event', eventName, params);
    };

    // Rage Click Detection (Silent)
    let clickConfig = { count: 0, lastTime: 0, element: null };
    document.addEventListener('click', (e) => {
        const now = Date.now();
        const el = e.target;

        if (now - clickConfig.lastTime < 300 && clickConfig.element === el) {
            clickConfig.count++;
            if (clickConfig.count === 3) {
                if (window.trackEvent) {
                    trackEvent('user_frustration', {
                        type: 'rage_click',
                        element_tag: el.tagName,
                        element_text: el.innerText.substring(0, 20),
                        element_class: el.className
                    });
                }
            }
        } else {
            clickConfig.count = 1;
            clickConfig.element = el;
        }
        clickConfig.lastTime = now;
    });
})();
