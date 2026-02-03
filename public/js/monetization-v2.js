/**
 * ============================================
 * LiveMatch - Monetization Manager v5.0 (Strict Clean)
 * ============================================
 */

class MonetizationManager {
    constructor() {
        this.config = { adsterra: { enabled: false } };
        this.state = { countdownFinished: false, streamUnlocked: false };
        this.init();
    }

    async init() {
        const localConfig = window.MONETIZATION_CONFIG || {};
        this.setupConfig(localConfig.adIds || {});
        if (this.config.adsterra.enabled) this.initAdsterra();

        document.addEventListener('countdownFinished', () => {
            document.getElementById('monetization-layer').style.display = 'none';
            document.getElementById('choice-layer').style.display = 'flex';
        });
    }

    setupConfig(adIds) {
        this.config.adsterra = {
            banner: adIds.adsterraBanner || '',
            socialBarKey: adIds.adsterraSocial || '',
            enabled: true
        };
    }

    selectServer(index) {
        // Multi-Network strategy
        if (index === 0) {
            window.open('https://otieu.com/4/10526676', '_blank', 'noopener,noreferrer');
        }

        document.getElementById('choice-layer').style.display = 'none';
        if (typeof window.selectServer === 'function') window.selectServer(index);
    }

    initAdsterra() {
        const container = document.getElementById('adsterra-banner-container');
        if (container && this.config.adsterra.banner) {
            const div = document.createElement('div');
            div.innerHTML = this.config.adsterra.banner;
            Array.from(div.querySelectorAll('script')).forEach(s => {
                const ns = document.createElement('script');
                Array.from(s.attributes).forEach(a => ns.setAttribute(a.name, a.value));
                ns.innerHTML = s.innerHTML;
                container.appendChild(ns);
            });
        }

        if (this.config.adsterra.socialBarKey) {
            const script = document.createElement('script');
            const srcMatch = this.config.adsterra.socialBarKey.match(/src=["']([^"']+)["']/);
            if (srcMatch) {
                script.src = srcMatch[1];
                script.async = true;
                document.body.appendChild(script);
            }
        }
    }
}

window.monetizationManager = new MonetizationManager();
