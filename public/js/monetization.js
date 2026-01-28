/**
 * ============================================
 * LiveMatch - نظام الربح الذكي المتقدم v3.0
 * ============================================
 * 
 * يدير التكامل الذكي بين:
 * - OGads Content Locker (iFrame-based)
 * - Monetag SmartLink (الاحتياطي)
 * - Adsterra Social Bar & Popunder (الربح السلبي)
 * 
 * @version 3.0
 * @author LiveMatch Team
 */

class MonetizationManager {
    constructor() {
        this.config = {
            ogads: { enabled: false },
            monetag: { enabled: false },
            adsterra: { enabled: false }
        };

        this.state = {
            ogadsShown: false,
            ogadsCompleted: false,
            monetagTriggered: false,
            countdownFinished: false,
            streamUnlocked: false,
            configLoaded: false
        };

        this.init();
    }

    /**
     * تهيئة نظام الربح
     */
    async init() {
        console.log('💰 Initializing LiveMatch Monetization System...');

        // 1. Fetch Configuration from Secure Cloudflare Function
        try {
            const response = await fetch('/config');
            if (!response.ok) throw new Error('Config fetch failed');
            const serverConfig = await response.json();

            this.setupConfig(serverConfig.adIds);
            console.log('✅ Configuration loaded securely from Cloudflare');
        } catch (error) {
            console.warn('⚠️ Could not load remote config, falling back to local/default config:', error);
            const localConfig = window.MONETIZATION_CONFIG || {};
            this.setupConfig(localConfig.adIds || {});
        }

        // 2. Initialize Ads based on loaded config
        if (this.config.adsterra.enabled) {
            this.initAdsterra();
        }

        // 3. Start Listeners
        this.listenForCountdownEnd();
        this.setupIframeListeners();

        this.state.configLoaded = true;
    }

    setupConfig(adIds) {
        this.config = {
            ogads: {
                // Now using full URL directly as requested
                lockerUrl: adIds.ogadsLockerUrl || 'https://lockedapp.space/cl/i/l776rj',
                enabled: true
            },
            monetag: {
                zoneId: adIds.monetagZoneId || '10526690',
                enabled: !!(adIds.monetagZoneId || '10526690')
            },
            adsterra: {
                socialBarKey: adIds.adsterraSocial || '',
                popunderKey: adIds.adsterraPop || '',
                enabled: !!(adIds.adsterraSocial && adIds.adsterraPop)
            }
        };
        console.log('📊 Active Config:', this.config);
    }

    /**
     * بدء عملية الربح (تعديل: إظهار نافذة الاختيار بدلاً من اللوكر مباشرة)
     */
    startMonetization() {
        console.log('🚀 Countdown finished. Showing choice modal...');
        this.state.countdownFinished = true;

        // إخفاء العد التنازلي
        const countdownLayer = document.getElementById('monetization-layer');
        if (countdownLayer) {
            countdownLayer.style.display = 'none';
        }

        // إظهار نافذة الاختيار
        const choiceLayer = document.getElementById('choice-layer');
        if (choiceLayer) {
            choiceLayer.style.display = 'flex';
        }
    }

    /**
     * معالجة اختيار المستخدم (HD vs Normal)
     * @param {string} quality 'hd' or 'normal'
     */
    selectQuality(quality) {
        console.log(`👤 User selected: ${quality} quality`);

        // إخفاء نافذة الاختيار
        const choiceLayer = document.getElementById('choice-layer');
        if (choiceLayer) {
            choiceLayer.style.display = 'none';
        }

        if (quality === 'hd') {
            // خيار HD: تفعيل OGads Locker
            if (this.config.ogads.enabled) {
                this.showOGadsLocker();
            } else {
                this.unlockStream();
            }
        } else {
            // خيار عادي: فتح البث + Monetag + Adsterra Popunder
            this.triggerPassiveMonetization();
            this.unlockStream();
        }
    }

    /**
     * تفعيل الإعلانات الثانوية (Normal Choice)
     */
    triggerPassiveMonetization() {
        // 1. Monetag In-Page Push
        if (this.config.monetag.enabled) {
            console.log('🔄 Triggering Monetag In-Page Push...');
            this.triggerMonetag();
        }

        // 2. Adsterra Popunder
        if (this.config.adsterra.enabled && this.config.adsterra.popunderKey) {
            console.log('🔄 Triggering Adsterra Popunder...');
            this.loadAdsterraPopunder();
        }
    }

    /**
     * عرض OGads Content Locker (iFrame-based)
     */
    showOGadsLocker() {
        console.log('🔒 Loading OGads Content Locker...');
        this.state.ogadsShown = true;

        const ogadsLayer = document.getElementById('ogads-layer');
        if (ogadsLayer) {
            ogadsLayer.style.display = 'flex';

            // تحديث progress bar
            setTimeout(() => this.updateProgress(30), 500);

            // تحميل iFrame using Direct URL
            const iframe = document.getElementById('ogads-iframe');
            if (iframe && !iframe.src) {
                iframe.src = this.config.ogads.lockerUrl; // Direct URL usage
                console.log('✅ OGads iFrame loaded with URL:', this.config.ogads.lockerUrl);
                this.updateProgress(60);
            }

            // بدء مؤقت الاحتياطي (30 ثانية)
            this.startFallbackTimer();
        }
    }

    /**
     * إعداد event listeners لـ iFrame
     */
    setupIframeListeners() {
        // الاستماع لرسائل من OGads iFrame
        window.addEventListener('message', (event) => {
            // تحقق من المصدر
            if (event.origin.includes('applocked.store') || event.origin.includes('ogads.com')) {
                console.log('📨 Message from OGads:', event.data);

                // إذا كانت الرسالة تشير إلى إكمال العرض
                if (event.data === 'conversion' || event.data.type === 'conversion') {
                    this.handleOGadsSuccess();
                }
            }
        });
    }

    /**
     * معالجة نجاح OGads
     */
    handleOGadsSuccess() {
        console.log('🎉 OGads conversion completed!');
        this.state.ogadsCompleted = true;
        this.updateProgress(100);
        this.showSuccessMessage();

        // فتح البث بعد 2 ثانية
        setTimeout(() => {
            this.unlockStream();
        }, 2000);
    }

    /**
     * تحديث شريط التقدم
     */
    updateProgress(percentage) {
        const progressBar = document.querySelector('.ogads-progress-fill');
        if (progressBar) {
            progressBar.style.width = percentage + '%';
        }
    }

    /**
     * عرض رسالة النجاح
     */
    showSuccessMessage() {
        const container = document.querySelector('.ogads-container');
        if (container) {
            container.innerHTML = `
                <div class="ogads-success">
                    <div class="ogads-success-icon">✓</div>
                    <h3>تم بنجاح!</h3>
                    <p>جاري تحميل البث المباشر...</p>
                </div>
            `;
        }
    }



    /**
     * مؤقت احتياطي - إذا لم يكمل المستخدم OGads خلال 30 ثانية
     */
    startFallbackTimer() {
        setTimeout(() => {
            if (!this.state.ogadsCompleted && !this.state.streamUnlocked) {
                console.log('⏱️ Fallback timer triggered');
                this.triggerMonetag();
            }
        }, 30000); // 30 ثانية
    }

    /**
     * تفعيل Monetag OnClick (Popunder) كاحتياطي
     */
    triggerMonetag() {
        if (this.state.monetagTriggered || !this.config.monetag.enabled) {
            // إذا تم تفعيل Monetag مسبقاً أو معطل، افتح البث مباشرة
            this.unlockStream();
            return;
        }

        console.log('🔄 Triggering Monetag OnClick (Popunder) fallback...');
        this.state.monetagTriggered = true;

        // الكود الكامل من المتغير البيئي
        // مثال: <script src="https://quge5.com/88/tag.min.js" data-zone="205965" async data-cfasync="false"></script>
        const fullScript = this.config.monetag.zoneId;

        if (fullScript && fullScript.includes('src=')) {
            // استخراج الرابط و data-zone
            const srcMatch = fullScript.match(/src=["']([^"']+)["']/);
            const zoneMatch = fullScript.match(/data-zone=["']([^"']+)["']/);

            if (srcMatch && srcMatch[1]) {
                const script = document.createElement('script');
                script.src = srcMatch[1];
                if (zoneMatch && zoneMatch[1]) {
                    script.setAttribute('data-zone', zoneMatch[1]);
                }
                script.setAttribute('data-cfasync', 'false');
                script.async = true;

                script.onload = () => {
                    console.log('✅ Monetag OnClick (Popunder) loaded');
                    // بعد 2 ثواني، افتح البث
                    setTimeout(() => {
                        this.unlockStream();
                    }, 2000);
                };

                script.onerror = () => {
                    console.error('❌ Monetag failed');
                    // افتح البث مباشرة
                    this.unlockStream();
                };

                document.head.appendChild(script);
            } else {
                console.warn('⚠️ Could not extract Monetag script URL');
                this.unlockStream();
            }
        } else {
            console.warn('⚠️ Monetag zone ID is not a full script tag');
            this.unlockStream();
        }
    }

    /**
     * فتح البث
     */
    unlockStream() {
        if (this.state.streamUnlocked) {
            return; // تجنب الفتح المتكرر
        }

        console.log('🎬 Unlocking stream...');
        this.state.streamUnlocked = true;

        // إخفاء طبقة OGads
        const ogadsLayer = document.getElementById('ogads-layer');
        if (ogadsLayer) {
            ogadsLayer.style.opacity = '0';
            setTimeout(() => {
                ogadsLayer.style.display = 'none';
            }, 300);
        }

        // إظهار البث
        const streamContainer = document.getElementById('stream-container');
        if (streamContainer) {
            streamContainer.style.display = 'block';
            streamContainer.style.opacity = '0';
            setTimeout(() => {
                streamContainer.style.opacity = '1';
            }, 100);
        }

        // تحميل البث
        if (typeof loadStream === 'function') {
            loadStream();
        }
    }

    /**
     * تهيئة Adsterra (Social Bar + Popunder)
     */
    initAdsterra() {
        console.log('📢 Initializing Adsterra...');

        // Social Bar
        if (this.config.adsterra.socialBarKey) {
            this.loadAdsterraSocialBar();
        }

        // Popunder
        if (this.config.adsterra.popunderKey) {
            this.loadAdsterraPopunder();
        }
    }

    /**
     * تحميل Adsterra Social Bar
     * يستخدم الكود الكامل من Environment Variable
     */
    loadAdsterraSocialBar() {
        console.log('📢 Loading Adsterra Social Bar...');

        // الكود الكامل من المتغير البيئي (مثال: <script src="https://pl28582110.effectivegatecpm.com/bf/db/5e/bfdb5e4549c4611a6c774636cc09cc3f.js"></script>)
        const fullScript = this.config.adsterra.socialBarKey;

        if (fullScript && fullScript.includes('src=')) {
            // استخراج الرابط من الكود
            const srcMatch = fullScript.match(/src=["']([^"']+)["']/);
            if (srcMatch && srcMatch[1]) {
                const script = document.createElement('script');
                script.src = srcMatch[1];
                script.async = true;
                document.body.appendChild(script);
                console.log('✅ Adsterra Social Bar loaded:', srcMatch[1]);
            }
        } else {
            console.warn('⚠️ Adsterra Social Bar key is not a full script tag');
        }
    }

    /**
     * تحميل Adsterra Popunder
     * يستخدم الكود الكامل من Environment Variable
     */
    loadAdsterraPopunder() {
        console.log('📢 Loading Adsterra Popunder...');

        // الكود الكامل من المتغير البيئي
        const fullScript = this.config.adsterra.popunderKey;

        if (fullScript && fullScript.includes('src=')) {
            // استخراج الرابط من الكود
            const srcMatch = fullScript.match(/src=["']([^"']+)["']/);
            if (srcMatch && srcMatch[1]) {
                const script = document.createElement('script');
                script.src = srcMatch[1];
                script.async = true;
                document.head.appendChild(script);
                console.log('✅ Adsterra Popunder loaded:', srcMatch[1]);
            }
        } else {
            console.warn('⚠️ Adsterra Popunder key is not a full script tag');
        }
    }

    /**
     * الاستماع لحدث انتهاء العد التنازلي
     */
    listenForCountdownEnd() {
        // يمكنك استخدام custom event أو مراقبة DOM
        document.addEventListener('countdownFinished', () => {
            this.startMonetization();
        });

        // أو مراقبة العد التنازلي
        const checkCountdown = setInterval(() => {
            const countdownElement = document.getElementById('countdown');
            if (countdownElement && parseInt(countdownElement.textContent) <= 0) {
                clearInterval(checkCountdown);
                this.startMonetization();
            }
        }, 100);
    }
}

// ============================================
// دوال مساعدة عامة
// ============================================

/**
 * Toggle AI Assistant Message
 */
function toggleAssistant() {
    const message = document.getElementById('ogads-assistant-message');
    if (message) {
        message.style.display = message.style.display === 'none' ? 'block' : 'none';
    }
}

/**
 * Toggle Help
 */
function toggleHelp() {
    alert('💡 نصائح:\n\n1. اختر عرض سهل (Email Submit)\n2. أكمل المطلوب بدقة\n3. البث سيفتح تلقائياً\n\nإذا واجهت مشكلة، جرب عرض آخر!');
}

/**
 * تفعيل الربح يدوياً (للاختبار)
 */
function triggerMonetization() {
    if (window.monetizationManager) {
        window.monetizationManager.startMonetization();
    } else {
        console.error('Monetization Manager not initialized');
    }
}

/**
 * فتح البث مباشرة (للاختبار)
 */
function skipMonetization() {
    if (window.monetizationManager) {
        window.monetizationManager.unlockStream();
    } else {
        console.error('Monetization Manager not initialized');
    }
}

// ============================================
// تهيئة تلقائية عند تحميل الصفحة
// ============================================

// ============================================
// تهيئة تلقائية عند تحميل الصفحة
// ============================================

function initWhenReady() {
    // تحقق من أننا في صفحة المشاهدة (يدعم watch.html و /watch)
    const isWatchPage = window.location.pathname.includes('watch') ||
        window.location.search.includes('match=');

    if (isWatchPage && !window.monetizationManager) {
        window.monetizationManager = new MonetizationManager();
        console.log('💰 Monetization Manager v3.0 initialized');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWhenReady);
} else {
    initWhenReady();
}

// تصدير للاستخدام العام
// تصدير للاستخدام العام
window.MonetizationManager = MonetizationManager;
window.toggleHelp = toggleHelp;
window.triggerMonetization = triggerMonetization;
window.skipMonetization = skipMonetization;
