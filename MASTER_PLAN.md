# 🏆 MASTER PLAN — خطة التحسين الشاملة والنهائية لمشروع LiveMatch

> **التاريخ:** 2026-02-19  
> **يجمع:** IMPROVEMENT_PLAN.md + ADVANCED_IMPROVEMENT_PLAN.md + إضافات تقنية حصرية  
> **الهدف:** نظام scraping لا يمكن إيقافه — سريع، آمن، قابل للصيانة  
> **النهج:** التنفيذ مرحلي، كل مرحلة مستقلة وقابلة للاختبار

---

## 📊 خريطة الملفات المطلوب إنشاؤها/تعديلها

```
scrapers/
├── utils.js              [إنشاء جديد] — دوال مشتركة (timezone, hash, league...)
├── errors.js             [إنشاء جديد] — نظام أخطاء هرمي مع Retry
├── rate-limiter.js       [إنشاء جديد] — حماية من الحظر
├── browser-pool.js       [إنشاء جديد] — إدارة مركزية للمتصفحات
├── health-check.js       [إنشاء جديد] — مراقبة صحة النظام
├── scraper_manager.js    [تعديل] — استخدام الوحدات الجديدة
├── livekora_scraper.js   [تعديل] — timezone + parallel + utils
├── korah_scraper.js      [تعديل] — timezone + parallel + utils
└── koraplus_scraper.js   [تعديل] — timezone + parallel + utils

public/js/
└── matches-v2.js         [تعديل] — XSS protection + smart DOM update

.github/workflows/
└── hourly-scrape.yml     [تعديل] — race condition fix + smart commit
```

---

## 🔴 المرحلة 1 — الأساس المشترك (الأهم، ابدأ هنا)

### الخطوة 1.1 — إنشاء `scrapers/utils.js`

**الهدف:** إزالة تكرار الكود من 3 ملفات + حل مشكلة Timezone جذرياً

**الكود الكامل:**
```js
// scrapers/utils.js
// ============================================================
// الوحدة المشتركة — تُستخدم من جميع Scrapers
// ============================================================

/**
 * تحويل وقت محلي إلى Unix timestamp بتوقيت GMT
 * @param {string} timeStr - الوقت كنص ("19:30" أو "7:30 PM")
 * @param {number} offsetHours - فارق توقيت المصدر عن GMT (양إيجابي)
 *   livekora  → offsetHours = 1   (GMT+1)
 *   korah     → offsetHours = 3   (GMT+3, توقيت السعودية)
 *   koraplus  → offsetHours = 2   (GMT+2)
 * @returns {number} Unix timestamp بتوقيت GMT
 */
export function toGMTTimestamp(timeStr, offsetHours) {
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) {
        return Math.floor(Date.now() / 1000);
    }
    try {
        let hours = null, minutes = null;

        // صيغة 12 ساعة: "7:30 PM" أو "07:30 PM"
        const twelveH = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (twelveH) {
            hours = parseInt(twelveH[1], 10);
            minutes = parseInt(twelveH[2], 10);
            const ampm = twelveH[3].toUpperCase();
            if (ampm === 'PM' && hours < 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0;
        } else {
            // صيغة 24 ساعة: "19:30"
            const twentyFourH = timeStr.match(/(\d{1,2}):(\d{2})/);
            if (twentyFourH) {
                hours = parseInt(twentyFourH[1], 10);
                minutes = parseInt(twentyFourH[2], 10);
            }
        }

        if (hours === null) return Math.floor(Date.now() / 1000);

        const date = new Date();
        // الطرح من الساعة للوصول لـ GMT
        const gmtHours = hours - offsetHours;
        date.setUTCHours(gmtHours, minutes, 0, 0);

        // تصحيح حالة منتصف الليل: لو الوقت المحلي > 21 والـ GMT < 3
        // فالمباراة في نفس اليوم وليس اليوم القادم
        if (hours >= 21 && gmtHours < 0) {
            date.setUTCDate(date.getUTCDate() - 1);
        }

        return Math.floor(date.getTime() / 1000);
    } catch (e) {
        return Math.floor(Date.now() / 1000);
    }
}

/**
 * توليد ID ثابت للمباراة بناءً على الفريقين والتاريخ
 * يمنع تضاعف الإشعارات ويضمن نفس الـ ID من مصادر مختلفة
 */
export function generateMatchHash(homeTeam, awayTeam) {
    const dateStr = new Date().toISOString().split('T')[0];
    const str = `${dateStr}-${String(homeTeam).toLowerCase().trim()}-${String(awayTeam).toLowerCase().trim()}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // تحويل لـ 32-bit
    }
    return Math.abs(hash);
}

/**
 * استخراج بلد البطولة من اسمها بالعربية
 */
export function getCountryFromLeague(league) {
    if (!league) return 'International';
    const l = String(league);
    if (l.includes('الإسباني') || l.includes('إسبانيا')) return 'Spain';
    if (l.includes('الإنجليزي') || l.includes('إنجلترا')) return 'England';
    if (l.includes('الإيطالي') || l.includes('إيطاليا')) return 'Italy';
    if (l.includes('الألماني') || l.includes('ألمانيا')) return 'Germany';
    if (l.includes('الفرنسي') || l.includes('فرنسا')) return 'France';
    if (l.includes('السعودي') || l.includes('السعودية')) return 'Saudi Arabia';
    if (l.includes('المصري') || l.includes('مصر')) return 'Egypt';
    if (l.includes('المغربي') || l.includes('المغرب')) return 'Morocco';
    if (l.includes('التونسي') || l.includes('تونس')) return 'Tunisia';
    if (l.includes('الجزائري') || l.includes('الجزائر')) return 'Algeria';
    if (l.includes('أبطال أوروبا') || l.includes('اوروبا')) return 'Europe';
    if (l.includes('أفريقيا') || l.includes('أبطال أفريقيا')) return 'Africa';
    if (l.includes('آسيا') || l.includes('الخليج') || l.includes('أبطال آسيا')) return 'Asia';
    if (l.includes('عالم') || l.includes('مونديال')) return 'World';
    return 'International';
}

/**
 * استخراج شعار البطولة من اسمها
 */
export function getLeagueLogo(league) {
    if (!league) return 'https://cdn-icons-png.flaticon.com/512/1378/1378598.png';
    const logos = {
        'إسباني':       'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/15.png&h=40&w=40',
        'إنجليزي':      'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/23.png&h=40&w=40',
        'إيطالي':       'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/12.png&h=40&w=40',
        'ألماني':        'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/10.png&h=40&w=40',
        'فرنسي':        'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/9.png&h=40&w=40',
        'سعودي':        'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/3007.png&h=40&w=40',
        'مصري':         'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/1237.png&h=40&w=40',
        'تونسي':        'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/1247.png&h=40&w=40',
        'مغربي':        'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/1039.png&h=40&w=40',
        'أبطال أوروبا': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/2.png&h=40&w=40',
        'اوروبا':       'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/2.png&h=40&w=40',
        'أبطال أفريقيا':'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/1257.png&h=40&w=40',
        'أبطال آسيا':   'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/209.png&h=40&w=40',
        'الخليج':        'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/209.png&h=40&w=40',
        'عالم':         'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/4.png&h=40&w=40'
    };
    for (const [key, logo] of Object.entries(logos)) {
        if (league.includes(key)) return logo;
    }
    return 'https://cdn-icons-png.flaticon.com/512/1378/1378598.png';
}

/**
 * تنسيق وقت GMT للعرض
 */
export function formatGMTTime(timestamp) {
    const d = new Date(timestamp * 1000);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}
```

**التعديلات في كل ملف بعد إنشاء utils.js:**

```
livekora_scraper.js:
  السطر 1: أضف → import { toGMTTimestamp, generateMatchHash, getCountryFromLeague, getLeagueLogo, formatGMTTime } from './utils.js';
  السطر 247: استبدل → date.setUTCHours(hours - 1, minutes, 0, 0)
           بـ      → timestamp = toGMTTimestamp(match.time, 1)
  السطر 262-264: استبدل بـ → const stableId = generateMatchHash(match.homeTeam, match.awayTeam);
  السطر 279: استبدل بـ     → const gmtTimeStr = formatGMTTime(timestamp);
  احذف: الدالة getCountryFromLeague() كاملة (السطر 325-341)
  احذف: الدالة getLeagueLogo() كاملة (السطر 343-364)
  احذف: الدالة generateMatchHash() كاملة (السطر 222-230)

korah_scraper.js:
  السطر 1: أضف نفس الـ import
  السطر 390: استبدل → date.setUTCHours(hours - 3, minutes, 0, 0)
             بـ     → timestamp = toGMTTimestamp(match.time, 3)
  السطر 405-407: استبدل بـ → const stableId = generateMatchHash(match.homeTeam, match.awayTeam);
  احذف: getCountryFromLeague, getLeagueLogo, generateMatchHash

koraplus_scraper.js:
  السطر 1: أضف نفس الـ import
  السطر 247: استبدل → date.setUTCHours(hours - 2, minutes, 0, 0)
             بـ     → timestamp = toGMTTimestamp(match.time, 2)
  السطر 262-264: استبدل بـ → const stableId = generateMatchHash(match.homeTeam, match.awayTeam);
  احذف: getCountryFromLeague, getLeagueLogo, generateMatchHash
```

---

### الخطوة 1.2 — إنشاء `scrapers/errors.js`

**الكود الكامل:**
```js
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
```

---

### الخطوة 1.3 — إنشاء `scrapers/rate-limiter.js`

**الكود الكامل:**
```js
// scrapers/rate-limiter.js
// ============================================================
// Rate Limiter — يمنع الحظر بالتحكم في سرعة الطلبات
// ============================================================

export class RateLimiter {
    constructor() {
        // الحد الأدنى بين الطلبات لكل مصدر (ms)
        this.delays = {
            livekora:    3000,
            korah:       2500,
            koraplus:    2500,
            sportsonline:2000,
            siiir:       4000,
            default:     2000
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
```

---

### الخطوة 1.4 — إنشاء `scrapers/browser-pool.js`

**الكود الكامل (مع تصحيح خطأ API الداخلية):**
```js
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
        console.log(`📦 Processing batch ${Math.floor(i/concurrency)+1}/${Math.ceil(items.length/concurrency)} (${batch.length} items)...`);
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
```

**طريقة التعديل في scrapers:**
```
في كل scraper (korah, koraplus, livekora):

1. أضف في أعلى الملف:
   import { withBrowser, createStealthPage, parallelPages } from './browser-pool.js';

2. استبدل كود إنشاء المتصفح:
   // قبل:
   let browser;
   try {
       browser = await puppeteer.launch({ ... });
       ...
   } catch(e) {
       if (browser) await browser.close();
   }

   // بعد:
   return await withBrowser(async (browser) => {
       const page = await createStealthPage(browser);
       ...
   });

3. استبدل حلقة زيارة صفحات المباريات التسلسلية:
   // قبل (korah_scraper):
   for (let i = 0; i < matches.length; i++) {
       const matchPage = await browser.newPage();
       ...
       await matchPage.close();
   }

   // بعد:
   const enriched = await parallelPages(browser, matches, async (browser, match) => {
       const page = await createStealthPage(browser);
       try {
           await page.goto(match.matchPageUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
           await new Promise(r => setTimeout(r, 1500)); // بدل 3000ms
           const playerUrl = await page.evaluate(/* نفس الكود الموجود */);
           return { ...match, playerUrl };
       } finally {
           await page.close().catch(() => {});
       }
   }, 5); // 5 صفحات متوازية
```

---

### الخطوة 1.5 — إنشاء `scrapers/health-check.js`

**الكود الكامل:**
```js
// scrapers/health-check.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'public', 'data', 'matches.json');

export async function healthCheck() {
    const report = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        checks: {}
    };

    // 1. هل الملف موجود؟
    try {
        const stats = await fs.stat(DATA_PATH);
        const ageMinutes = Math.round((Date.now() - stats.mtimeMs) / 60000);
        report.checks.dataFile = {
            status: ageMinutes < 15 ? 'fresh' : ageMinutes < 60 ? 'stale' : 'old',
            ageMinutes
        };
        if (ageMinutes >= 60) report.status = 'degraded';
    } catch {
        report.checks.dataFile = { status: 'missing' };
        report.status = 'critical';
    }

    // 2. عدد المباريات
    try {
        const raw = await fs.readFile(DATA_PATH, 'utf8');
        const data = JSON.parse(raw);
        const count = data.matches?.length ?? 0;
        report.checks.matchCount = {
            status: count > 0 ? 'ok' : 'empty',
            count
        };
        if (count === 0) report.status = 'degraded';
    } catch (e) {
        report.checks.matchCount = { status: 'parse_error', error: e.message };
        report.status = 'critical';
    }

    // 3. هل توجد مباريات بدون streams؟
    try {
        const raw = await fs.readFile(DATA_PATH, 'utf8');
        const data = JSON.parse(raw);
        const noStream = data.matches?.filter(m => !m.streams || m.streams.length === 0).length ?? 0;
        report.checks.streamsPresence = {
            status: noStream === 0 ? 'ok' : 'partial',
            matchesWithoutStream: noStream
        };
    } catch {}

    console.log('🏥 Health Check:', JSON.stringify(report, null, 2));
    return report;
}

// تشغيل مستقل: node scrapers/health-check.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    healthCheck().then(r => {
        process.exit(r.status === 'critical' ? 1 : 0);
    });
}
```

---

## 🟡 المرحلة 2 — تحسين scraper_manager.js

### التعديلات المطلوبة بالترتيب:

**1. إصلاح `match.score = null` في `mergeSources()`:**
```js
// السطر 205 — قبل:
match.score = null;

// بعد:
if (match.status === 'NS') match.score = null; // فقط للمباريات التي لم تبدأ
```

**2. إضافة حماية "آخر نسخة صالحة" في `saveMatches()`:**
```js
async saveMatches(matches) {
    // لا تكتب إذا كانت النتيجة 0 مباريات (أكيد حدث خطأ ما)
    if (!matches || matches.length === 0) {
        console.warn('⚠️ Refusing to save 0 matches — keeping previous data intact.');
        return;
    }
    const data = {
        generated_at: new Date().toISOString(),
        count: matches.length,
        matches
    };
    const outputPath = path.join(__dirname, '..', 'public', 'data', 'matches.json');
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ Saved ${matches.length} matches.`);
}
```

**3. إضافة تشغيل healthCheck بعد الحفظ:**
```js
// في نهاية runFullUpdate() — أضف:
import { healthCheck } from './health-check.js';
// ...
await this.saveMatches(finalMatches);
await healthCheck(); // تحقق من صحة البيانات المحفوظة
return finalMatches;
```

**4. تخفيض timeout في `networkidle2` → `domcontentloaded`:**

في كل scraper استبدل:
```js
// قبل:
await page.goto(this.baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });

// بعد:
await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
await new Promise(resolve => setTimeout(resolve, 2000)); // انتظار JS
```

---

## 🟢 المرحلة 3 — الأمان والجودة

### الخطوة 3.1 — إصلاح XSS في `public/js/matches-v2.js`

**أضف في أعلى الملف مباشرة بعد comment السطر 1:**
```js
// ============ SECURITY ============
function sanitizeText(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}
```

**في `createMatchCard()` — استبدل:**
```js
// قبل (السطر 277-279):
if (match.channel) metaParts.push(`<span>📺 ${match.channel}</span>`);
if (match.commentator) metaParts.push(`<span>🎙️ ${match.commentator}</span>`);
if (match.league && match.league.name) metaParts.push(`<span>🏆 ${match.league.name}</span>`);

// بعد:
if (match.channel) metaParts.push(`<span>📺 ${sanitizeText(match.channel)}</span>`);
if (match.commentator) metaParts.push(`<span>🎙️ ${sanitizeText(match.commentator)}</span>`);
if (match.league && match.league.name) metaParts.push(`<span>🏆 ${sanitizeText(match.league.name)}</span>`);
```

---

### الخطوة 3.2 — إصلاح `hourly-scrape.yml`

**الاستبدال الكامل لقسم "Commit and Push Changes":**
```yaml
      - name: Commit and Push Changes
        run: |
          git config --global user.name "GitHub Actions Bot"
          git config --global user.email "actions@github.com"
          
          # أضف الملفات الأساسية
          git add public/data/matches.json
          git add --all public/posters 2>/dev/null || true
          git add --all public/data/articles 2>/dev/null || true
          git add sent_notifications.json 2>/dev/null || true
          git add sent_telegram_notifications.json 2>/dev/null || true

          # إذا لم تكن هناك تغييرات، توقف بشكل نظيف
          if git diff --cached --quiet; then
            echo "✅ No changes to commit — skipping push"
            exit 0
          fi
          
          git commit -m "🔄 Auto-update: LiveKora matches data ($(date '+%H:%M'))"
          
          # Push مع Retry ذكي — لا يُلغي التغييرات
          MAX=5
          for n in $(seq 1 $MAX); do
            echo "📤 Push attempt $n/$MAX..."
            git fetch origin main --quiet
            git rebase origin/main --quiet && git push origin main && break
            
            if [ $n -eq $MAX ]; then
              echo "❌ All push attempts failed"
              exit 1
            fi
            echo "⏳ Waiting 20s before retry..."
            sleep 20
          done
```

**زيادة timeout من 15 دقيقة إلى 12 (بعد التسريع ستكفي):**
```yaml
    timeout-minutes: 12
```

---

## 🧪 دليل الاختبار لكل مرحلة

### اختبار المرحلة 1 (utils.js + errors.js)
```powershell
cd c:\Users\sonr0353\Desktop\sitefoot

# تحقق من export الدوال المشتركة
node -e "import('./scrapers/utils.js').then(m => console.log('✅ utils exports:', Object.keys(m)))"

# تحقق من حساب الـ timestamp بشكل صحيح
node -e "
import('./scrapers/utils.js').then(({ toGMTTimestamp }) => {
    const ts = toGMTTimestamp('21:00', 3); // 9 PM GMT+3 = 6 PM GMT
    const d = new Date(ts * 1000);
    console.log('Input: 21:00 GMT+3 → Expected: 18:00 GMT → Got:', d.toISOString());
});"

# تحقق من Retry
node -e "
import('./scrapers/errors.js').then(({ withRetry }) => {
    let count = 0;
    withRetry(() => { count++; if (count < 3) throw new Error('fail'); return 'ok'; },
        { maxRetries: 3, delay: 100, source: 'test' }
    ).then(r => console.log('✅ Retry worked:', r, 'attempts:', count));
});"
```

### اختبار المرحلة 1 (browser-pool.js)
```powershell
node -e "
import('./scrapers/browser-pool.js').then(({ withBrowser, createStealthPage }) => {
    withBrowser(async (browser) => {
        const page = await createStealthPage(browser);
        await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 10000 });
        const title = await page.title();
        console.log('✅ Browser pool works. Page title:', title);
        await page.close();
    });
});"
```

### اختبار الـ Timezone
```powershell
# شغّل الـ scraper وراقب الأوقات
node scrapers/scraper_manager.js

# ثم تحقق من matches.json
node -e "
import('fs/promises').then(async (fs) => {
    const data = JSON.parse(await fs.readFile('public/data/matches.json', 'utf8'));
    data.matches.slice(0, 5).forEach(m => {
        console.log(m.home.name, 'vs', m.away.name, '—', m.time_label, '(source:', m.streams?.[0]?.source, ')');
    });
});"
```

### اختبار Health Check
```powershell
node scrapers/health-check.js
```

### اختبار XSS
```powershell
# أضف بيانات مسمومة مؤقتاً
node -e "
import('fs/promises').then(async (fs) => {
    const data = JSON.parse(await fs.readFile('public/data/matches.json', 'utf8'));
    if (data.matches[0]) {
        data.matches[0].league = { name: '<script>alert(1)</script>' };
        await fs.writeFile('public/data/matches.json', JSON.stringify(data));
        console.log('✅ Test data injected — open index.html and verify no alert appears');
    }
});"
```

---

## 📊 التوقعات بعد اكتمال جميع المراحل

| المقياس | قبل | بعد |
|---------|-----|-----|
| وقت الـ GitHub Action | ~8-10 دقائق | ~4-5 دقائق |
| تكرار الكود | 3 نسخ من كل دالة | نسخة واحدة مركزية |
| دقة التوقيت GMT | ❌ متضاربة بين المصادر | ✅ موحدة بنفس الـ offset |
| حماية XSS | ❌ معرض | ✅ محمي |
| فقدان البيانات عند فشل كل المصادر | ❌ يُبقي `matches.json` فارغاً | ✅ يحتفظ بالنسخة السابقة |
| تشخيص الأخطاء | ❌ console.log عشوائي | ✅ structured errors + health check |
| مقاومة الحظر | ❌ لا يوجد | ✅ RateLimiter + penalty على 429 |
| الـ Retry عند الفشل | ❌ فشل نهائي فوري | ✅ 3 محاولات مع exponential backoff |

---

## 🗓️ ترتيب التنفيذ المقترح

```
اليوم 1:
  └── إنشاء scrapers/utils.js كاملاً
  └── تحديث import في livekora + korah + koraplus
  └── حذف الدوال المكررة من الملفات الثلاثة
  └── اختبار node scraper_manager.js والتحقق من الأوقات

اليوم 2:
  └── إنشاء scrapers/errors.js
  └── إنشاء scrapers/rate-limiter.js
  └── إنشاء scrapers/browser-pool.js
  └── تحديث KorahScraper وKoraplusScraper لاستخدام parallelPages

اليوم 3:
  └── إنشاء scrapers/health-check.js
  └── إصلاح saveMatches() في scraper_manager.js
  └── إصلاح match.score = null
  └── إصلاح matches-v2.js (sanitizeText)
  └── إصلاح hourly-scrape.yml (race condition)
```

---

*هذا الملف يجمع IMPROVEMENT_PLAN.md + ADVANCED_IMPROVEMENT_PLAN.md مع تصحيح الأخطاء التقنية وإضافة الناقص.*
