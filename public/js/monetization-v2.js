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
        // Ad-Maven popunder active
        document.getElementById('choice-layer').style.display = 'none';
        if (typeof window.selectServer === 'function') window.selectServer(index);
    }

    initAdsterra() {
        const container = document.getElementById('adsterra-banner-container');
        if (container && this.config.adsterra.banner) {
            console.log('📡 Injecting Adsterra Banner...');
            const bannerHtml = this.config.adsterra.banner;

            if (bannerHtml.includes('atOptions')) {
                const keyMatch = bannerHtml.match(/'key'\s*:\s*['"]([^'"]+)['"]/);
                const key = keyMatch ? keyMatch[1] : '129087cf28b991b1ac22461099f7d24c';

                window.atOptions = {
                    'key': key,
                    'format': 'iframe',
                    'height': 60,
                    'width': 468,
                    'params': {}
                };

                const script = document.createElement('script');
                script.type = 'text/javascript';
                script.src = `//www.highperformanceformat.com/${key}/invoke.js`;
                container.appendChild(script);
            } else {
                container.innerHTML = bannerHtml;
            }
        }

        if (this.config.adsterra.socialBarKey) {
            console.log('📡 Injecting Social Bar...');
            const socialContent = this.config.adsterra.socialBarKey;
            const srcMatch = socialContent.match(/src=["']([^"']+)["']/);

            if (srcMatch && srcMatch[1]) {
                const script = document.createElement('script');
                script.type = 'text/javascript';
                script.src = srcMatch[1];
                script.async = true;
                document.body.appendChild(script);
            } else {
                const div = document.createElement('div');
                div.innerHTML = socialContent;
                document.body.appendChild(div);
            }
        }
    }
}

window.monetizationManager = new MonetizationManager();
