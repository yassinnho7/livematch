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
            countdownFinished: false,
            streamUnlocked: false,
            configLoaded: false,
            socialBarShowCount: parseInt(sessionStorage.getItem('ad_sb_count') || '0'),
            monetagTriggered: false,
            ggAgencyTriggered: false,
            shieldActive: false
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
        console.log('✅ Monetization System Ready - State:', this.state);
    }

    setupConfig(adIds) {
        const clean = (val) => (val && typeof val === 'string') ? val.trim() : '';

        this.config = {
            ogads: {
                lockerUrl: clean(adIds.ogadsLockerUrl),
                enabled: !!clean(adIds.ogadsLockerUrl)
            },
            adsterra: {
                banner: clean(adIds.adsterraBanner),
                errorBanner: clean(adIds.adsterraErrorBanner),
                socialBarKey: clean(adIds.adsterraSocial),
                enabled: true
            },
            monetag: {
                directLink: clean(adIds.monetagDirectLink),
                enabled: !!clean(adIds.monetagDirectLink)
            },
            ggAgency: {
                linkUrl: clean(adIds.ggAgencyLink),
                enabled: !!clean(adIds.ggAgencyLink)
            }
        };
        console.log('📊 Active Monetization Config');
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
            document.body.classList.add('modal-open'); // منع التمرير في الخلفية
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
            document.body.classList.remove('modal-open');
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
        console.log('🔄 Triggering Passive Monetization...');
        this.unlockStream(); // Open stream immediately for 'normal'
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
            document.body.classList.add('modal-open');

            // تحديث progress bar
            setTimeout(() => this.updateProgress(30), 500);

            // تحميل iFrame using Direct URL
            const iframe = document.getElementById('ogads-iframe');
            if (iframe && !iframe.src) {
                iframe.src = this.config.ogads.lockerUrl;
                console.log('✅ OGads iFrame loaded');
                this.updateProgress(60);
            }

            // إضافة زر العودة أسفل اللوكر
            this.injectLockerBackButton();

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
     * تفعيل GG.Agency Clickunder
     */
    triggerGGAgency() {
        if (this.state.ggAgencyTriggered || !this.config.ggAgency.enabled) return;

        console.log('🔄 Activating GG.Agency Link...');
        this.state.ggAgencyTriggered = true;

        const url = this.config.ggAgency.linkUrl;
        if (url) {
            window.open(url, '_blank');
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
            document.body.classList.remove('modal-open');
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

        // تفعيل الحماية من الاختطاف (Anti-Takeover Shield)
        this.enableAntiTakeoverShield();

        // 4. Monetag (Strictly 3s after stream starts, opens safely in new tab)
        setTimeout(() => {
            if (this.state.monetagTriggered) return;
            console.log('⏱️ 3 seconds passed since stream started, safe opening Monetag...');
            this.safeOpen(this.config.monetag.directLink);
            this.state.monetagTriggered = true;
        }, 3000);

        // 5. GG.Agency (Strictly 1m after stream starts, if user is still watching)
        setTimeout(() => {
            if (this.state.ggAgencyTriggered) return;
            console.log('⏱️ 1 minute passed, safe opening GG.Agency...');
            this.safeOpen(this.config.ggAgency.linkUrl);
            this.state.ggAgencyTriggered = true;
        }, 60000);
    }

    /**
     * تهيئة Adsterra
     */
    initAdsterra() {
        // Load Banner (immediately for countdown)
        this.loadAdsterraBanner();

        // Social Bar (limited to 3 times per session)
        if (this.state.socialBarShowCount < 3) {
            this.loadAdsterraSocialBar();
            this.state.socialBarShowCount++;
            sessionStorage.setItem('ad_sb_count', this.state.socialBarShowCount);
        } else {
            console.log('📢 Adsterra Social Bar: limit reached (3)');
        }
    }

    /**
     * تحميل Adsterra Error Banner (728x90)
     */
    loadAdsterraErrorBanner() {
        const container = document.getElementById('adsterra-error-banner');
        if (!container || !this.config.adsterra.errorBanner) return;

        console.log('📢 Injecting Adsterra Error Banner (728x90)...');
        const scriptContent = this.config.adsterra.errorBanner;

        container.innerHTML = ''; // Clear previous
        const div = document.createElement('div');
        div.innerHTML = scriptContent;

        Array.from(div.querySelectorAll('script')).forEach(oldScript => {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
            newScript.appendChild(document.createTextNode(oldScript.innerHTML));
            container.appendChild(newScript);
        });
    }

    /**
     * تحميل Adsterra Banner (320x50)
     */
    loadAdsterraBanner() {
        const container = document.getElementById('adsterra-banner-container');
        if (!container || !this.config.adsterra.banner) return;

        console.log('📢 Injecting Adsterra Banner...');
        const scriptContent = this.config.adsterra.banner;

        // Inject script tags into container
        const div = document.createElement('div');
        div.innerHTML = scriptContent;

        // Ensure scripts inside innerHTML actually execute
        Array.from(div.querySelectorAll('script')).forEach(oldScript => {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
            newScript.appendChild(document.createTextNode(oldScript.innerHTML));
            container.appendChild(newScript);
        });
    }

    /**
     * تحميل Adsterra Social Bar
     */
    loadAdsterraSocialBar() {
        console.log('📢 Loading Adsterra Social Bar...');
        const fullScript = this.config.adsterra.socialBarKey;

        if (fullScript && fullScript.includes('src=')) {
            const srcMatch = fullScript.match(/src=["']([^"']+)["']/);
            if (srcMatch && srcMatch[1]) {
                const script = document.createElement('script');
                script.src = srcMatch[1];
                script.async = true;
                document.body.appendChild(script);
            }
        }
    }

    /**
     * فتح الإعلان في نافذة جديدة وبشكل "منفصل" تماماً
     * نستخدم noopener و noreferrer لمنع الإعلان من التحكم في موقعنا (الحماية من الاختطاف)
     */
    safeOpen(url) {
        if (!url || !url.startsWith('http')) {
            console.warn('⚠️ Invalid or missing Ad URL');
            return;
        }

        console.log('�️ SafeOpen: Disconnecting ad from main site...');

        // محاولة الفتح في نافذة جديدة مع قطع الاتصال بالأصل
        const adWin = window.open(url, '_blank', 'noopener,noreferrer');

        if (!adWin || adWin.closed || typeof adWin.closed === 'undefined') {
            console.warn('⚠️ Ad blocked by browser popup blocker');
        } else {
            console.log('✅ Ad opened successfully in a separate tab');
        }
    }

    /**
     * حماية الموقع من إعادة التوجيه القسري
     */
    enableAntiTakeoverShield() {
        if (this.state.shieldActive) return;
        this.state.shieldActive = true;

        console.log('�️ Anti-Takeover Shield: ACTIVE');

        // منع الإطارات الخارجية من اختطاف النافذة الأم
        window.addEventListener('beforeunload', (event) => {
            if (this.state.streamUnlocked) {
                const msg = 'هل تريد حقاً مغادرة صفحة البث؟';
                event.returnValue = msg;
                return msg;
            }
        });
    }

    /**
     * تفعيل Monetag (تم الاستغناء عنها لصالح safeOpen)
     */
    triggerMonetag() {
        this.safeOpen(this.config.monetag.directLink);
    }

    /**
     * تفعيل GG.Agency (تم الاستغناء عنها لصالح safeOpen)
     */
    triggerGGAgency() {
        this.safeOpen(this.config.ggAgency.linkUrl);
    }

    /**
     * إضافة زر عودة للوكر
     */
    injectLockerBackButton() {
        const container = document.querySelector('.ogads-container');
        if (!container || document.getElementById('locker-back-btn')) return;

        const backBtn = document.createElement('button');
        backBtn.id = 'locker-back-btn';
        backBtn.innerHTML = '← العودة للخلف';
        backBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.3);
            padding: 10px 20px;
            border-radius: 8px;
            margin: 15px auto;
            cursor: pointer;
            font-family: inherit;
            font-weight: 600;
            display: block;
            transition: all 0.2s;
        `;

        backBtn.onmouseover = () => backBtn.style.background = 'rgba(255, 255, 255, 0.3)';
        backBtn.onmouseout = () => backBtn.style.background = 'rgba(255, 255, 255, 0.2)';

        backBtn.onclick = () => {
            const ogadsLayer = document.getElementById('ogads-layer');
            const choiceLayer = document.getElementById('choice-layer');
            if (ogadsLayer) ogadsLayer.style.display = 'none';
            if (choiceLayer) choiceLayer.style.display = 'flex';
            document.body.classList.add('modal-open');
        };

        container.appendChild(backBtn);
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
window.MonetizationManager = MonetizationManager;
window.triggerMonetization = triggerMonetization;
window.skipMonetization = skipMonetization;
