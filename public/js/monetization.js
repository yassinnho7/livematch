/**
 * ============================================
 * LiveMatch - نظام الربح الذكي المتقدم v3.1
 * ============================================
 * 
 * المكونات النشطة:
 * - Adsterra (Social Bar & Banners)
 * - Monetag (Vignette via watch.html)
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
        console.log('💰 Initializing LiveMatch Monetization System...');

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

        // Inject Vignette ONLY here (Server Selection Page)
        this.injectVignette();
    }

    injectVignette() {
        if (this.state.vignetteInjected) return;
        console.log('📢 Injecting Vignette Ad (Selection Phase)...');
        const script = document.createElement('script');
        script.innerHTML = `(function (s) { s.dataset.zone = '10555101', s.src = 'https://gizokraijaw.net/vignette.min.js' })([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))`;
        document.body.appendChild(script);
        this.state.vignetteInjected = true;
    }

    selectServer(index) {
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
        }

        // Show Back Button ONLY now
        const backBtn = document.getElementById('back-home-btn');
        if (backBtn) {
            backBtn.style.display = 'flex';
        }

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
