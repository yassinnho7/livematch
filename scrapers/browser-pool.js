// scrapers/browser-pool.js
// ============================================================
// إدارة مركزية لمتصفحات Puppeteer — منع تسريب الذاكرة
// ============================================================
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const LAUNCH_OPTIONS = {
    headless: 'new',
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-sync',
        '--disable-translate'
    ]
};

/**
 * تشغيل متصفح مع ضمان إغلاقه في جميع الحالات
 * الاستخدام: await withBrowser(async (browser) => { ... });
 */
export async function withBrowser(fn) {
    const browser = await puppeteer.launch(LAUNCH_OPTIONS);
    try {
        return await fn(browser);
    } finally {
        // يُغلق دائماً حتى لو حدث خطأ
        await browser.close().catch(e => console.warn('Browser close error:', e.message));
    }
}

/**
 * إنشاء صفحة مع إعدادات موحدة
 */
export async function createStealthPage(browser) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });
    // منع تحميل الصور والـ fonts لتسريع الصفحات الداخلية
    await page.setRequestInterception(true);
    page.on('request', req => {
        if (['image', 'font', 'stylesheet'].includes(req.resourceType())) {
            req.abort();
        } else {
            req.continue();
        }
    });
    return page;
}

/**
 * زيارة صفحات متعددة بشكل متوازٍ مع حد أقصى للتزامن
 * @param {Browser} browser
 * @param {Array} items - قائمة العناصر
 * @param {Function} handler - async (browser, item) => result
 * @param {number} concurrency - عدد الصفحات المتوازية (افتراضي: 5)
 */
export async function parallelPages(browser, items, handler, concurrency = 5) {
    const results = [];
    for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency);
        console.log(`📦 Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(items.length / concurrency)} (${batch.length} items)...`);
        const batchResults = await Promise.all(
            batch.map(item => handler(browser, item).catch(e => {
                console.warn(`⚠️ Batch item failed: ${e.message}`);
                return null; // فشل صامت لعنصر واحد لا يوقف الباقي
            }))
        );
        results.push(...batchResults.filter(Boolean));
    }
    return results;
}
