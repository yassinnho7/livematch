// scrapers/rate-limiter.js
// ============================================================
// Rate Limiter — يمنع الحظر بالتحكم في سرعة الطلبات
// ============================================================

export class RateLimiter {
    constructor() {
        // الحد الأدنى بين الطلبات لكل مصدر (ms)
        this.delays = {
            livekora: 3000,
            korah: 2500,
            koraplus: 2500,
            sportsonline: 2000,
            siiir: 4000,
            default: 2000
        };
        this.lastRequest = new Map();
    }

    async wait(source) {
        const delay = this.delays[source] ?? this.delays.default;
        const last = this.lastRequest.get(source);

        if (last) {
            const elapsed = Date.now() - last;
            if (elapsed < delay) {
                const waitTime = delay - elapsed;
                console.log(`⏳ [RateLimit] Waiting ${waitTime}ms for ${source}...`);
                await new Promise(r => setTimeout(r, waitTime));
            }
        }

        this.lastRequest.set(source, Date.now());
    }

    /**
     * عند الحصول على 403/429 — نُضاعف التأخير تلقائياً
     */
    penalize(source, multiplier = 1.5) {
        const current = this.delays[source] ?? this.delays.default;
        this.delays[source] = Math.min(current * multiplier, 15000); // حد أقصى 15 ثانية
        console.warn(`⚠️ [RateLimit] Penalized ${source}: new delay = ${this.delays[source]}ms`);
    }
}

// instance واحد مشترك لكل البرنامج
export const globalLimiter = new RateLimiter();
