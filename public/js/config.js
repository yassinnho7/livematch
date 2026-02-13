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
    }
};

// Export for Node and Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MONETIZATION_CONFIG;
}
if (typeof window !== 'undefined') {
    window.MONETIZATION_CONFIG = MONETIZATION_CONFIG;
}
