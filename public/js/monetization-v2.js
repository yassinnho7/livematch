/**
 * ============================================
 * LiveMatch - نظام الربح الذكي المتقدم v3.2
 * ============================================
 * 
 * المكونات النشطة:
 * - Adsterra (Social Bar & Banners)
 * - Monetag (Popunder - Server 1 Only)
 */

class MonetizationManager {
    constructor() {
        this.config = {
            adsterra: { enabled: false }
        };

        this.state = {
            countdownFinished: false,
            streamUnlocked: false,
            configLoaded: false,
            socialBarShowCount: parseInt(sessionStorage.getItem('ad_sb_count') || '0'),
            shieldActive: false
        };

        this.init();
    }

    async init() {
        console.log('💰 Initializing LiveMatch Monetization System v3.2...');

        try {
            const response = await fetch('/config');
            if (!response.ok) throw new Error('Config fetch failed');
            const serverConfig = await response.json();
            this.setupConfig(serverConfig.adIds);
        } catch (error) {
            console.warn('⚠️ Fallback to local config');
            const localConfig = window.MONETIZATION_CONFIG || {};
            this.setupConfig(localConfig.adIds || {});
        }

        if (this.config.adsterra.enabled) {
            this.initAdsterra();
        }

        this.listenForCountdownEnd();
        this.enableAntiTakeoverShield();

        this.state.configLoaded = true;
    }

    setupConfig(adIds) {
        const clean = (val) => (val && typeof val === 'string') ? val.trim() : '';
        this.config = {
            adsterra: {
                banner: clean(adIds.adsterraBanner),
                errorBanner: clean(adIds.adsterraErrorBanner),
                socialBarKey: clean(adIds.adsterraSocial),
                enabled: true
            }
        };
    }

    startMonetization() {
        this.state.countdownFinished = true;
        const countdownLayer = document.getElementById('monetization-layer');
        if (countdownLayer) countdownLayer.style.display = 'none';

        const choiceLayer = document.getElementById('choice-layer');
        if (choiceLayer) {
            choiceLayer.style.display = 'flex';
            document.body.classList.add('modal-open');
        }
    }

    selectServer(index) {
        // Server 1 (LiveKora) - index 0
        if (index === 0) {
            console.log('💎 Server 1 Selected - Triggering Monetag Popunder');
            const popUrl = 'https://otieu.com/4/10526676';
            window.open(popUrl, '_blank', 'noopener,noreferrer');
        }
        // Server 2 (Siiir.tv) - index 1
        else if (index === 1) {
            console.log('🚀 Server 2 (VIP) Selected - Ad strategy to be added by partner');
            // Future: add your second ad network here
        }

        const choiceLayer = document.getElementById('choice-layer');
        if (choiceLayer) {
            choiceLayer.style.display = 'none';
            document.body.classList.remove('modal-open');
        }

        if (typeof window.selectServer === 'function') {
            window.selectServer(index);
        }
        this.unlockStream();
    }

    unlockStream() {
        if (this.state.streamUnlocked) return;
        this.state.streamUnlocked = true;

        const streamContainer = document.getElementById('stream-container');
        if (streamContainer) {
            streamContainer.style.display = 'block';
            streamContainer.style.opacity = '1';

            // Prevent Vignette/Banners from capturing clicks on the stream
            streamContainer.addEventListener('click', (e) => {
                e.stopPropagation();
            }, true);
        }

        // Show Back Button ONLY now and ensure high Z-Index
        let backBtn = document.getElementById('back-home-btn');
        if (!backBtn) {
            // If missing, recreate/force it
            console.warn('⚠️ Back Button missing, re-creating it...');
            backBtn = document.createElement('a');
            backBtn.id = 'back-home-btn';
            backBtn.href = '/';
            backBtn.className = 'back-btn';
            backBtn.textContent = 'الرئيسية';
            document.body.appendChild(backBtn);
        }

        console.log('✅ Showing Back Button');
        backBtn.style.display = 'flex';
        backBtn.style.setProperty('display', 'flex', 'important'); // Force override
        backBtn.style.zIndex = '2147483647';

        if (typeof loadStream === 'function') {
            loadStream();
        }

        this.enableAntiTakeoverShield();
    }

    initAdsterra() {
        this.loadAdsterraBanner();
        if (this.state.socialBarShowCount < 3) {
            this.loadAdsterraSocialBar();
            this.state.socialBarShowCount++;
            sessionStorage.setItem('ad_sb_count', this.state.socialBarShowCount);
        }
    }

    loadAdsterraErrorBanner() {
        const container = document.getElementById('adsterra-error-banner');
        if (!container || !this.config.adsterra.errorBanner) return;
        this.injectScript(container, this.config.adsterra.errorBanner);
    }

    loadAdsterraBanner() {
        const container = document.getElementById('adsterra-banner-container');
        if (!container || !this.config.adsterra.banner) return;
        this.injectScript(container, this.config.adsterra.banner);
    }

    injectScript(container, scriptContent) {
        container.innerHTML = '';
        const div = document.createElement('div');
        div.innerHTML = scriptContent;
        // Strip out any suspicious <script> behavior if possible, but Adsterra needs scripts.
        Array.from(div.querySelectorAll('script')).forEach(oldScript => {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
            newScript.appendChild(document.createTextNode(oldScript.innerHTML));
            container.appendChild(newScript);
        });
    }

    loadAdsterraSocialBar() {
        const fullScript = this.config.adsterra.socialBarKey;
        if (fullScript && fullScript.includes('src=')) {
            const srcMatch = fullScript.match(/src=["']([^"']+)["']/);
            if (srcMatch && srcMatch[1]) {
                const script = document.createElement('script');
                script.src = srcMatch[1];
                script.async = true;
                // Add defer to lower priority
                script.defer = true;
                document.body.appendChild(script);
            }
        }
    }

    enableAntiTakeoverShield() {
        if (this.state.shieldActive) return;
        this.state.shieldActive = true;
        if (window.top !== window.self) {
            try { window.top.location = window.self.location; } catch (e) { }
        }
    }

    listenForCountdownEnd() {
        document.addEventListener('countdownFinished', () => this.startMonetization());
        const checkCountdown = setInterval(() => {
            const countdownElement = document.getElementById('countdown');
            if (countdownElement && parseInt(countdownElement.textContent) <= 0) {
                clearInterval(checkCountdown);
                this.startMonetization();
            }
        }, 100);
    }
}

function initWhenReady() {
    const isWatchPage = window.location.pathname.includes('watch') || window.location.search.includes('match=');
    if (isWatchPage && !window.monetizationManager) {
        window.monetizationManager = new MonetizationManager();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWhenReady);
} else {
    initWhenReady();
}

window.MonetizationManager = MonetizationManager;
