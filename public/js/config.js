// ==================== Monetization Configuration ====================
// استبدل جميع القيم بمفاتيحك الحقيقية

const MONETIZATION_CONFIG = {
    // ==================== Ad Network IDs ====================
    // Note: In production, these are loaded securely from Cloudflare Environment Variables
    // via the /config endpoint. Values here are fallbacks for local development.
    adIds: {
        ogadsLockerId: '',
        monetagZoneId: '10526690',
        adsterraSocial: '',
        adsterraPop: '',
        // --- Multi-Network Strategy (Future Slots) ---
        server2AdNetworkKey: '', // ضع هنا مفتاح إعلانات السيرفر الثاني لاحقاً
        server3AdNetworkKey: ''  // ضع هنا مفتاح إعلانات السيرفر الثالث لاحقاً
    },

    // ==================== OneSignal (Push Notifications) ====================
    oneSignal: {
        appId: 'YOUR_ONESIGNAL_APP_ID', // من https://onesignal.com
        enabled: true
    },

    // ==================== Propeller Ads ====================
    propellerAds: {
        enabled: true,
        zones: {
            nativeBanner: 'YOUR_NATIVE_BANNER_ZONE_ID',
            interstitial: 'YOUR_INTERSTITIAL_ZONE_ID',
            pushNotification: 'YOUR_PUSH_ZONE_ID'
        },
        domain: 'YOUR_PROPELLER_DOMAIN.com'
    },

    // ==================== Adsterra ====================
    adsterra: {
        enabled: true,
        keys: {
            socialBar: 'YOUR_SOCIAL_BAR_KEY',
            popunder: 'YOUR_POPUNDER_KEY',
            banner: 'YOUR_BANNER_KEY'
        }
    },

    // ==================== Monetag ====================
    monetag: {
        enabled: true, // تفعيل Monetag
        zoneId: '10526690',
        smartLink: 'https://your-monetag-smartlink.com'
    },

    // ==================== CPA Offers ====================
    cpaOffers: {
        vpn: {
            link: 'YOUR_VPN_AFFILIATE_LINK', // من MaxBounty أو شبكة أخرى
            name: 'VPN مجاني',
            description: 'شاهد جميع المباريات بدون حجب',
            badge: 'مجاناً'
        },
        iptv: {
            link: 'YOUR_IPTV_AFFILIATE_LINK',
            name: 'IPTV Premium',
            description: 'أكثر من 10,000 قناة بجودة عالية',
            badge: 'تجربة مجانية'
        },
        app: {
            link: 'YOUR_APP_AFFILIATE_LINK',
            name: 'تطبيق المباريات',
            description: 'جميع المباريات على هاتفك',
            badge: 'حمّل الآن'
        }
    },

    // ==================== Redirect URLs ====================
    redirectUrls: [
        'https://yalla-shoot.com',
        'https://koora-live.com',
        // أضف المزيد من روابط البث هنا
    ],

    // ==================== Countdown Settings ====================
    countdown: {
        duration: 15, // ثواني (10-20 موصى به)
        autoRedirect: false // true = إعادة توجيه تلقائية بعد العداد
    },

    // ==================== Analytics ====================
    analytics: {
        googleAnalyticsId: 'G-XXXXXXXXXX', // من Google Analytics
        facebookPixelId: 'YOUR_PIXEL_ID', // من Facebook Business
        enabled: true,
        trackEvents: {
            pageView: true,
            countdown: true,
            notifications: true,
            cpaClicks: true,
            redirects: true
        }
    },

    // ==================== API Settings ====================
    api: {
        matchesJsonUrl: 'data/matches.json',
        updateInterval: 60000, // تحديث كل دقيقة (بالميلي ثانية)
        cacheTimeout: 300000 // 5 دقائق
    },

    // ==================== Important Leagues (للتصفية) ====================
    importantLeagues: [
        'Premier League',
        'La Liga',
        'Serie A',
        'Bundesliga',
        'Ligue 1',
        'UEFA Champions League',
        'UEFA Europa League',
        'FIFA World Cup',
        'Copa del Rey',
        'FA Cup',
        'Coppa Italia'
    ],

    // ==================== Facebook Integration ====================
    facebook: {
        groupId: 'YOUR_FACEBOOK_GROUP_ID',
        accessToken: 'YOUR_FACEBOOK_ACCESS_TOKEN',
        postTemplate: `🔴 مباراة اليوم

{{home_team}} ⚡ {{away_team}}

🏆 {{league_name}}
🕒 {{match_time}}

👇 شاهد المباراة مباشرة`,
        postBeforeMatch: 120 // النشر قبل المباراة بـ 120 دقيقة
    },

    // ==================== n8n Settings ====================
    n8n: {
        apiFootballKey: 'YOUR_API_FOOTBALL_KEY', // من https://www.api-football.com
        githubToken: 'YOUR_GITHUB_TOKEN', // إذا كنت تستخدم GitHub
        githubRepo: 'YOUR_USERNAME/YOUR_REPO',
        cloudflareApiToken: 'YOUR_CLOUDFLARE_API_TOKEN' // إذا كنت تستخدم Cloudflare API
    },

    // ==================== Development Settings ====================
    development: {
        enableDebugLogs: true,
        mockData: false, // true = استخدام بيانات تجريبية
        disableAds: false // true = تعطيل الإعلانات للاختبار
    }
};

// ==================== Export Configuration ====================
// للاستخدام في الملفات الأخرى
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MONETIZATION_CONFIG;
}

// للاستخدام في المتصفح
if (typeof window !== 'undefined') {
    window.MONETIZATION_CONFIG = MONETIZATION_CONFIG;
}
