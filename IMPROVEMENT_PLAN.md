# 🚀 خطة تحسين مشروع LiveMatch — استراتيجية شاملة

> **التاريخ:** 2026-02-19  
> **الهدف:** حل جميع المشاكل المكتشفة + تسريع كبير في الإنجاز + أمان أفضل
> **النهج:** لا نكسر شيئاً يعمل — نُصلح بحذر، نختبر، نُكمل

---

## 🗂️ جدول الإصلاحات (حسب الأولوية)

| # | المشكلة | الأثر | الأولوية |
|---|---------|-------|---------|
| 1 | تضارب Timezone | ⚠️ أوقات خاطئة للمستخدمين | 🔴 عالية |
| 2 | تسلسل زيارات صفحات المباريات | 🐢 بطء الـ scraper | 🔴 عالية |
| 3 | تكرار الكود (hash/league/country) | 🗂️ صعوبة صيانة | 🟡 متوسطة |
| 4 | XSS في Frontend | 🔓 ثغرة أمنية | 🟡 متوسطة |
| 5 | `match.score = null` في mergeSources | 🐛 فقدان النتيجة أثناء LIVE | 🟡 متوسطة |
| 6 | Race Condition في Git Push | 🔄 push يُفقد ملفات | 🟡 متوسطة |
| 7 | `networkidle2` timeout مرتفع | ⏱ يضيع وقتاً | 🟢 منخفضة |
| 8 | Dead code (processArticles, cleanOldArticles) | 🗑️ إرباك | 🟢 منخفضة |

---

## 📋 الإصلاح 1 — توحيد Timezone (الأولوية القصوى)

### المشكلة
كل scraper يطرح عدداً مختلفاً من الساعات بشكل hardcoded داخل `processMatches()`:
- `livekora_scraper.js` → `hours - 1` (يفترض GMT+1)
- `korah_scraper.js` → `hours - 3` (يفترض GMT+3 توقيت السعودية)
- `koraplus_scraper.js` → `hours - 2` (يفترض GMT+2)

### الاستراتيجية
إنشاء دالة مشتركة `toGMTTimestamp(timeStr, sourceTimezone)` في ملف مشترك جديد `scrapers/utils.js`:

```js
// scrapers/utils.js
export function toGMTTimestamp(timeStr, offsetHours) {
    // offsetHours: الساعات التي يجب طرحها للوصول لـ GMT
    // livekora:  offsetHours = 1  (GMT+1)
    // korah:     offsetHours = 3  (GMT+3)
    // koraplus:  offsetHours = 2  (GMT+2)
    
    if (!timeStr || !timeStr.includes(':')) return Math.floor(Date.now() / 1000);
    
    try {
        let hours = null, minutes = null;
        
        // دعم كلا الصيغتين: 12h (AM/PM) و 24h
        const twelveH = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (twelveH) {
            hours = parseInt(twelveH[1], 10);
            minutes = parseInt(twelveH[2], 10);
            const ampm = twelveH[3].toUpperCase();
            if (ampm === 'PM' && hours < 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0;
        } else {
            const twentyFourH = timeStr.match(/(\d{1,2}):(\d{2})/);
            if (twentyFourH) {
                hours = parseInt(twentyFourH[1], 10);
                minutes = parseInt(twentyFourH[2], 10);
            }
        }
        
        if (hours === null) return Math.floor(Date.now() / 1000);
        
        const date = new Date();
        date.setUTCHours(hours - offsetHours, minutes, 0, 0);
        return Math.floor(date.getTime() / 1000);
    } catch (e) {
        return Math.floor(Date.now() / 1000);
    }
}
```

### التغييرات في كل ملف
| الملف | السطر الحالي | يُستبدل بـ |
|-------|-------------|-----------|
| `livekora_scraper.js:L247` | `date.setUTCHours(hours - 1, minutes, 0, 0)` | `toGMTTimestamp(match.time, 1)` |
| `korah_scraper.js:L390` | `date.setUTCHours(hours - 3, minutes, 0, 0)` | `toGMTTimestamp(match.time, 3)` |
| `koraplus_scraper.js:L247` | `date.setUTCHours(hours - 2, minutes, 0, 0)` | `toGMTTimestamp(match.time, 2)` |

---

## 📋 الإصلاح 2 — تسريع زيارة صفحات المباريات (Promise.all)

### المشكلة
```js
// الطريقة الحالية — تسلسلية 🐢
for (let i = 0; i < matches.length; i++) {
    const matchPage = await browser.newPage();
    await matchPage.goto(match.matchPageUrl, { timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    // ...
    await matchPage.close();
}
// مع 20 مباراة × 5 ثواني = 100 ثانية
```

### الاستراتيجية
تحويل الحلقة إلى **دفعات متوازية** مع حد جزئي (Concurrency Limit):

```js
// الطريقة الجديدة — متوازية مع حد 5 ✅
async function fetchMatchPages(browser, matches, concurrency = 5) {
    const results = [];
    
    for (let i = 0; i < matches.length; i += concurrency) {
        const batch = matches.slice(i, i + concurrency);
        const batchResults = await Promise.all(
            batch.map(match => fetchSingleMatchPage(browser, match))
        );
        results.push(...batchResults);
    }
    
    return results;
}

async function fetchSingleMatchPage(browser, match) {
    const page = await browser.newPage();
    try {
        await page.goto(match.matchPageUrl, { 
            waitUntil: 'domcontentloaded',  // بدل networkidle2
            timeout: 20000 
        });
        await new Promise(resolve => setTimeout(resolve, 1500)); // بدل 3000ms
        const playerUrl = await page.evaluate(/* ... */);
        return { ...match, playerUrl };
    } catch (e) {
        return match; // فشل بصمت، لا يوقف الباقي
    } finally {
        await page.close().catch(() => {}); // دائماً يُغلق الصفحة
    }
}
```

**التوفير المتوقع:**
| | قبل | بعد |
|--|-----|-----|
| 20 مباراة (korah) | ~100 ثانية | ~25 ثانية |
| 15 مباراة (koraplus) | ~75 ثانية | ~18 ثانية |
| **المجموع** | ~175 ثانية | ~43 ثانية |

---

## 📋 الإصلاح 3 — ملف مشترك `scrapers/utils.js`

### الأهداف
- دالة `toGMTTimestamp()` (الإصلاح 1)
- دالة `generateMatchHash()` (مكررة 3 مرات حالياً)
- دالة `getCountryFromLeague()` (مكررة 3 مرات)
- دالة `getLeagueLogo()` (مكررة 3 مرات)
- دالة `sanitizeHTML()` (الإصلاح 4 — XSS)

```js
// scrapers/utils.js — الهيكل الكامل

export function toGMTTimestamp(timeStr, offsetHours) { /* ... */ }

export function generateMatchHash(str) {
    // نفس الخوارزمية الحالية ولكن في مكان واحد
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

export function getCountryFromLeague(league) { /* ... نسخة موحدة ... */ }

export function getLeagueLogo(league) { /* ... نسخة موحدة ... */ }
```

### التغيير في كل scraper
```js
// قبل
import puppeteer from 'puppeteer-extra';
// ... تعريف generateMatchHash داخلياً ...

// بعد
import { generateMatchHash, getCountryFromLeague, getLeagueLogo, toGMTTimestamp } from './utils.js';
// ... إزالة التكرارات من كل ملف ...
```

---

## 📋 الإصلاح 4 — منع XSS في Frontend

### المشكلة
```js
// matches-v2.js
metaParts.push(`<span>📺 ${match.channel}</span>`);   // ⚠️ خطر
metaParts.push(`<span>🎙️ ${match.commentator}</span>`); // ⚠️ خطر
```

### الحل
```js
// إضافة دالة sanitizeHTML في matches-v2.js
function sanitizeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

// الاستخدام
metaParts.push(`<span>📺 ${sanitizeHTML(match.channel)}</span>`);
metaParts.push(`<span>🎙️ ${sanitizeHTML(match.commentator)}</span>`);
```

---

## 📋 الإصلاح 5 — منع فقدان النتيجة في `mergeSources()`

### المشكلة
```js
// scraper_manager.js:L205
return matches.map((match) => {
    match.score = null;  // ⚠️ يُلغي النتيجة دائماً
    // ...
```

### الحل
```js
// لا نُعيد ضبط الـ score إذا كانت المباراة LIVE أو FT
return matches.map((match) => {
    if (match.status === 'NS') {
        match.score = null; // فقط للمباريات التي لم تبدأ
    }
    // ...
```

---

## 📋 الإصلاح 6 — Race Condition في Git Push

### المشكلة الحالية
```yaml
git checkout .         # ⚠️ يُلغي الملفات غير المُدمجة
git pull --rebase origin main
git push origin main && break
```

### الاستراتيجية المحسّنة
```yaml
- name: Commit and Push Changes
  run: |
    git config --global user.name "GitHub Actions Bot"
    git config --global user.email "actions@github.com"
    
    git add public/data/matches.json
    git add --all public/posters || true
    git add --all public/data/articles || true
    git add sent_notifications.json || true
    git add sent_telegram_notifications.json || true

    # لا نُعمل commit إذا لم تكن هناك تغييرات
    if git diff --cached --quiet; then
      echo "✅ No changes to commit"
      exit 0
    fi
    
    git commit -m "🔄 Auto-update: LiveKora matches data"
    
    # Push مع retry ذكي — لا نُلغي التغييرات
    for n in 1 2 3 4 5; do
      echo "📤 Push attempt $n..."
      git fetch origin main
      git rebase origin/main || git rebase --abort
      git push origin main && break
      echo "⏳ Waiting 15s before retry..."
      sleep 15
    done
```

---

## 📋 الإصلاح 7 — تحسين `networkidle2` timeout

### المشكلة
```js
await page.goto(this.baseUrl, {
    waitUntil: 'networkidle2',  // ينتظر 500ms بدون طلبات — قد لا يصل أبداً
    timeout: 90000              // 90 ثانية timeout ← طويل
});
```

### الحل الموصى به
```js
// استبدال networkidle2 بـ domcontentloaded + انتظار محدد
await page.goto(this.baseUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 45000              // نصف الوقت الحالي
});
// انتظار 2 ثانية فقط إضافية لـ JS
await new Promise(resolve => setTimeout(resolve, 2000));
```

---

## 📋 الإصلاح 8 — إزالة الكود الميت

### الملف: `scraper_manager.js`
الدوال `processArticles()` و`cleanOldArticles()` موجودة لكن لا تُستدعى أبداً في `runFullUpdate()`.

**الخيار A (مؤقت):** إضافة تعليق واضح يوضح أنها معطلة عمداً  
**الخيار B (نهائي):** حذفهما كلياً أو نقلهما لملف `ai_content.js`

---

## 🗓️ ترتيب التنفيذ المقترح

```
المرحلة 1 (الأسرع أثراً):
  └── إنشاء scrapers/utils.js
  └── نقل generateMatchHash + getCountryFromLeague + getLeagueLogo
  └── تطبيق toGMTTimestamp بالـ offsetHours الصحيح لكل scraper
  └── إزالة الدوال المكررة من الملفات الثلاثة

المرحلة 2 (التسريع):
  └── تحويل حلقة اليارة التسلسلية → دفعات متوازية (concurrency=5)
  └── تخفيض networkidle2 → domcontentloaded في جميع scrapers
  └── تخفيض sleep من 3000ms → 1500ms

المرحلة 3 (الأمان والجودة):
  └── إضافة sanitizeHTML في matches-v2.js
  └── إصلاح match.score = null في mergeSources
  └── إصلاح race condition في hourly-scrape.yml
  └── إزالة/توثيق الكود الميت
```

---

## ✅ كيفية التحقق من نجاح كل إصلاح

### التحقق من Timezone (الإصلاح 1)
```bash
cd c:\Users\sonr0353\Desktop\sitefoot
node scrapers/scraper_manager.js
```
ثم افتح `public/data/matches.json` وتحقق أن:
- أوقات المباريات المتكررة بين أكثر من مصدر متطابقة
- الأوقات منطقية (مباريات مسائية تظهر بعد الظهر بتوقيت GMT)

### التحقق من التسريع (الإصلاح 2)
```bash
# قياس الوقت قبل
Measure-Command { node scrapers/korah_scraper.js }
# قياس الوقت بعد التعديل
Measure-Command { node scrapers/korah_scraper.js }
```
المتوقع: انخفاض من ~100s إلى ~25s

### التحقق من XSS (الإصلاح 4)
في `public/data/matches.json` أضف يدوياً:
```json
"channel": "<script>alert('xss')</script>"
```
ثم افتح `public/index.html` في المتصفح — يجب ألا يظهر أي alert.

### التحقق من الكود المشترك (الإصلاح 3)
```bash
node -e "import('./scrapers/utils.js').then(m => console.log(Object.keys(m)))"
# يجب أن يُظهر: ['toGMTTimestamp', 'generateMatchHash', 'getCountryFromLeague', 'getLeagueLogo']
```

---

## 📊 التوفير المتوقع بعد كل المراحل

| المقياس | قبل | بعد |
|---------|-----|-----|
| وقت الـ GitHub Action الكامل | ~8-10 دقائق | ~4-5 دقائق |
| دقة التوقيت GMT | ❌ متضاربة | ✅ موحدة |
| تكرار الكود | 3× لكل دالة | 1× مركزي |
| مقاومة XSS | ❌ معرض | ✅ محمي |
| وضوح الكود | 🟡 متوسط | 🟢 عالي |

---

*انتهت الخطة. ابدأ التنفيذ بالمرحلة 1.*
