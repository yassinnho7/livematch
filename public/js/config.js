/**
 * ============================================
 * LiveMatch - Configuration v5.0 (Strict Clean)
 * ============================================
 */

const MONETIZATION_CONFIG = {
    // إعدادات الروابط والبيانات
    api: {
        matchesJsonUrl: 'data/matches.json',
        updateInterval: 60000
    },

    // هويات الإعلانات (أضف مفاتيحك هنا)
    adIds: {
        monetagZoneId: '10526690',
        adsterraSocial: '<script type=\'text/javascript\' src=\'//pl18402434.highperformanceformat.com/f2/87/00/f28700947761007a82643a12a514d7c0.js\'></script>',
        adsterraBanner: '<script type="text/javascript">atOptions = { "key": "129087cf28b991b1ac22461099f7d24c", "format": "iframe", "height": 60, "width": 468, "params": {} };</script><script type="text/javascript" src="//www.highperformanceformat.com/129087cf28b991b1ac22461099f7d24c/invoke.js"></script>',
        adsterraPop: '',
        server2AdNetworkKey: '',
        server3AdNetworkKey: ''
    },

    // إعدادات العداد
    countdown: {
        duration: 8
    }
};

// Export for Node and Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MONETIZATION_CONFIG;
}
if (typeof window !== 'undefined') {
    window.MONETIZATION_CONFIG = MONETIZATION_CONFIG;
}
