// scrapers/errors.js
// ============================================================
// نظام الأخطاء المركزي مع Retry تلقائي
// ============================================================

export class ScraperError extends Error {
    constructor(message, source, severity = 'medium') {
        super(message);
        this.name = 'ScraperError';
        this.source = source;
        this.severity = severity; // low | medium | high | critical
        this.timestamp = new Date().toISOString();
    }
}

export class BlockedError extends ScraperError {
    constructor(source) {
        super(`Bot detection triggered on ${source}`, source, 'high');
        this.name = 'BlockedError';
    }
}

export class TimeoutError extends ScraperError {
    constructor(source, timeoutMs) {
        super(`Timeout after ${timeoutMs}ms on ${source}`, source, 'medium');
        this.name = 'TimeoutError';
    }
}

/**
 * تنفيذ دالة مع إعادة المحاولة عند الفشل
 * @param {Function} fn - الدالة المراد تنفيذها
 * @param {Object} options
 *   maxRetries: عدد محاولات الإعادة (افتراضي: 3)
 *   delay: تأخير أول محاولة بـ ms (افتراضي: 2000)
 *   backoff: مضاعف التأخير (افتراضي: 2 → 2s, 4s, 8s)
 *   source: اسم المصدر للـ logging
 */
export async function withRetry(fn, options = {}) {
    const { maxRetries = 3, delay = 2000, backoff = 2, source = 'unknown' } = options;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const waitTime = delay * Math.pow(backoff, attempt - 1);
            console.warn(`⚠️ [${source}] Attempt ${attempt}/${maxRetries} failed: ${error.message}. Retrying in ${waitTime}ms...`);

            // لا تعيد المحاولة إذا كان محظوراً
            if (error instanceof BlockedError) {
                console.error(`🚫 [${source}] Blocked by bot detection. Skipping retries.`);
                break;
            }

            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, waitTime));
            }
        }
    }

    console.error(`❌ [${source}] All ${maxRetries} attempts failed.`);
    throw lastError;
}
