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
        adsterraSocial: '',
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
