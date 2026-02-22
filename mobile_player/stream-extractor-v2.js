/**
 * ========================================================
 *  Stream Extractor V2 — Unified Engine
 * ========================================================
 *  Replaces: extractor.js, smart-extractor.js,
 *            universal-extractor.js, browser-extractor.js
 *
 *  Features:
 *    ✅ Single `calculateSb()` — no more duplication
 *    ✅ Prioritised strategy pipeline
 *    ✅ In-memory + optional KV cache (4-min TTL)
 *    ✅ Recursive iframe extraction (max depth 3)
 *    ✅ Browser-based fallback via Puppeteer
 *    ✅ Export-friendly for Workers & Node
 * ========================================================
 */

// ============================================
//  Core Utility — SB Algorithm (single source)
// ============================================

function calculateSb() {
    const n = Date.now();
    let v = Math.floor(n / 14400000) + Math.floor(n / 86400000 * 1.5);
    let l = v % 7 + 6;
    const c = 'abcdefghijklmnopqrstuvwxyz';
    let r = '';
    for (; l--; v = Math.floor(v / 26)) {
        r = c[v % 26] + r;
    }
    return r;
}

// ============================================
//  In-Memory Cache (Node / Workers compatible)
// ============================================

class MemoryCache {
    constructor(ttlMs = 240_000) { // 4 minutes default
        this.store = new Map();
        this.ttl = ttlMs;
    }
    get(key) {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (Date.now() - entry.ts > this.ttl) { this.store.delete(key); return null; }
        return entry.data;
    }
    set(key, data) {
        this.store.set(key, { data, ts: Date.now() });
    }
    clear() { this.store.clear(); }
}

const cache = new MemoryCache();

// ============================================
//  HTML Fetcher (works in Node & CF Workers)
// ============================================

async function fetchHtml(url, options = {}) {
    // Try native fetch first (CF Workers / Node 18+)
    if (typeof globalThis.fetch === 'function' && !options.forceNodeFetch) {
        const response = await globalThis.fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
                'Cache-Control': 'no-cache',
                ...options.headers
            },
            signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined,
        });
        return response.text();
    }
    // Fallback: dynamic import node-fetch
    const nodeFetch = (await import('node-fetch')).default;
    const response = await nodeFetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
            'Cache-Control': 'no-cache',
            ...options.headers
        },
        timeout: options.timeout || 15_000,
    });
    return response.text();
}

// ============================================
//  Extraction Strategies (ordered by priority)
// ============================================

const strategies = [

    // ── 1. YallaShoot Style (D array + sb) ──────────────
    {
        name: 'YallaShoot',
        priority: 1,
        detect: (html) => html.includes('const D=') || html.includes('const D ='),
        extract: (html, baseUrl) => {
            const dMatch = html.match(/const\s+D\s*=\s*\[(.*?)\]/);
            const chMatch = html.match(/hls\/([^/]+)\/master\.m3u8/);
            if (!dMatch || !chMatch) return null;

            const domains = dMatch[1].split(',').map(s => s.replace(/['"]/g, '').trim()).filter(Boolean);
            const channel = chMatch[1];
            const sb = calculateSb();

            return {
                success: true,
                streamUrl: `https://${sb}.${domains[0]}/hls/${channel}/master.m3u8`,
                allDomains: domains.map(d => `https://${sb}.${d}/hls/${channel}/master.m3u8`),
                domains,
                channel,
                sb,
                referer: baseUrl,
                strategy: 'YallaShoot',
            };
        },
    },

    // ── 2. JW Player ────────────────────────────────────
    {
        name: 'JWPlayer',
        priority: 2,
        detect: (html) => /jwplayer|jwPlayer/i.test(html),
        extract: (html, baseUrl) => {
            const patterns = [
                /jwplayer\s*\([^)]*\)\.setup\s*\(\s*\{[\s\S]*?file\s*:\s*['"]([^'"]+)['"]/,
                /jwplayer\s*\([^)]*\)\.setup\s*\(\s*\{[\s\S]*?source\s*:\s*['"]([^'"]+)['"]/,
                /jwplayer\s*\([^)]*\)\.load\s*\(\s*\[\s*\{[\s\S]*?file\s*:\s*['"]([^'"]+)['"]/,
                /"file"\s*:\s*"([^"]+\.m3u8[^"]*)"/,
                /"source"\s*:\s*"([^"]+\.m3u8[^"]*)"/,
            ];
            for (const p of patterns) {
                const m = html.match(p);
                if (m) return { success: true, streamUrl: m[1], referer: baseUrl, strategy: 'JWPlayer' };
            }
            return null;
        },
    },

    // ── 3. Video.js ─────────────────────────────────────
    {
        name: 'VideoJS',
        priority: 3,
        detect: (html) => /videojs|video-js|video\.js/i.test(html),
        extract: (html, baseUrl) => {
            const patterns = [
                /src\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/,
                /<source[^>]+src\s*=\s*['"]([^'"]+\.m3u8[^'"]*)['"]/,
                /player\.src\s*\(\s*['"]([^'"]+\.m3u8[^'"]*)['"]\s*\)/,
                /player\.src\s*\(\s*\{[\s\S]*?src\s*:\s*['"]([^'"]+)['"]/,
            ];
            for (const p of patterns) {
                const m = html.match(p);
                if (m) return { success: true, streamUrl: m[1], referer: baseUrl, strategy: 'VideoJS' };
            }
            return null;
        },
    },

    // ── 4. Clappr Player ────────────────────────────────
    {
        name: 'Clappr',
        priority: 4,
        detect: (html) => /[Cc]lappr/.test(html),
        extract: (html, baseUrl) => {
            const patterns = [
                /sources\s*:\s*\[\s*['"]([^'"]+\.m3u8[^'"]*)['"]/,
                /source\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/,
            ];
            for (const p of patterns) {
                const m = html.match(p);
                if (m) return { success: true, streamUrl: m[1], referer: baseUrl, strategy: 'Clappr' };
            }
            return null;
        },
    },

    // ── 5. Plyr Player ──────────────────────────────────
    {
        name: 'Plyr',
        priority: 5,
        detect: (html) => /[Pp]lyr/.test(html),
        extract: (html, baseUrl) => {
            const patterns = [
                /<video[^>]*>[\s\S]*?<source[^>]+src\s*=\s*['"]([^'"]+\.m3u8[^'"]*)['"]/,
                /sources\s*:\s*\[\s*\{[\s\S]*?src\s*:\s*['"]([^'"]+)['"]/,
            ];
            for (const p of patterns) {
                const m = html.match(p);
                if (m) return { success: true, streamUrl: m[1], referer: baseUrl, strategy: 'Plyr' };
            }
            return null;
        },
    },

    // ── 6. JSON Embedded ────────────────────────────────
    {
        name: 'JSONEmbed',
        priority: 6,
        detect: (html) => /["'](?:url|source|file|stream)["']\s*:\s*["']https?:\/\/[^"']+\.m3u8["']/.test(html),
        extract: (html, baseUrl) => {
            const patterns = [
                /["']url["']\s*:\s*["']([^"']+\.m3u8[^"']*)["']/,
                /["']source["']\s*:\s*["']([^"']+\.m3u8[^"']*)["']/,
                /["']file["']\s*:\s*["']([^"']+\.m3u8[^"']*)["']/,
                /["']stream["']\s*:\s*["']([^"']+\.m3u8[^"']*)["']/,
            ];
            for (const p of patterns) {
                const m = html.match(p);
                if (m) return { success: true, streamUrl: m[1], referer: baseUrl, strategy: 'JSONEmbed' };
            }
            return null;
        },
    },

    // ── 7. JS Variable ──────────────────────────────────
    {
        name: 'JSVariable',
        priority: 7,
        detect: (html) => /(?:var|const|let)\s+(?:source|file|videoUrl|streamUrl|url)\s*=\s*['"]/.test(html),
        extract: (html, baseUrl) => {
            const patterns = [
                /(?:var|const|let)\s+source\s*=\s*['"]([^'"]+)['"]/,
                /(?:var|const|let)\s+file\s*=\s*['"]([^'"]+)['"]/,
                /(?:var|const|let)\s+videoUrl\s*=\s*['"]([^'"]+)['"]/,
                /(?:var|const|let)\s+streamUrl\s*=\s*['"]([^'"]+)['"]/,
                /source:\s*['"]([^'"]+)['"]/,
                /file:\s*['"]([^'"]+)['"]/,
            ];
            for (const p of patterns) {
                const m = html.match(p);
                if (m && m[1].includes('.m3u8')) {
                    return { success: true, streamUrl: m[1], referer: baseUrl, strategy: 'JSVariable' };
                }
            }
            return null;
        },
    },

    // ── 8. Direct M3U8 URL in HTML ──────────────────────
    {
        name: 'DirectM3U8',
        priority: 8,
        detect: (html) => /https?:\/\/[^\s"']+\.m3u8/.test(html),
        extract: (html, baseUrl) => {
            const matches = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/g);
            if (matches && matches.length > 0) {
                const streamUrl = matches[0].replace(/[<>""'']/g, '');
                return { success: true, streamUrl, referer: baseUrl, strategy: 'DirectM3U8' };
            }
            return null;
        },
    },

    // ── 9. Base64 Encoded ───────────────────────────────
    {
        name: 'Base64',
        priority: 9,
        detect: (html) => /atob\s*\(/.test(html),
        extract: (html, baseUrl) => {
            const match = html.match(/atob\s*\(\s*['"]([A-Za-z0-9+/=]+)['"]\s*\)/);
            if (match) {
                try {
                    // Works in both Node and CF Workers
                    const decoded = typeof atob === 'function'
                        ? atob(match[1])
                        : Buffer.from(match[1], 'base64').toString('utf-8');
                    if (decoded.includes('.m3u8')) {
                        return { success: true, streamUrl: decoded, referer: baseUrl, strategy: 'Base64' };
                    }
                } catch { /* ignore decode errors */ }
            }
            return null;
        },
    },

    // ── 10. Iframe (recursive — handled in extract()) ───
    {
        name: 'Iframe',
        priority: 10,
        detect: (html) => /<iframe[^>]+src\s*=\s*['"][^'"]+['"]/i.test(html),
        extract: (html, baseUrl) => {
            const match = html.match(/<iframe[^>]+src\s*=\s*['"]([^'"]+)['"]/i);
            if (!match) return null;
            let iframeUrl = match[1];

            // Resolve relative URLs
            if (iframeUrl.startsWith('//')) {
                iframeUrl = 'https:' + iframeUrl;
            } else if (iframeUrl.startsWith('/')) {
                const u = new URL(baseUrl);
                iframeUrl = `${u.protocol}//${u.host}${iframeUrl}`;
            } else if (!iframeUrl.startsWith('http')) {
                const u = new URL(baseUrl);
                iframeUrl = `${u.protocol}//${u.host}/${iframeUrl}`;
            }

            return {
                success: true,
                iframeUrl,
                needsFurtherExtraction: true,
                referer: baseUrl,
                strategy: 'Iframe',
            };
        },
    },
];

// ============================================
//  Main Extraction Engine
// ============================================

/**
 * Extract stream URL from a page.
 * @param {string} url - The page URL to extract from
 * @param {object} [opts] - Options
 * @param {number} [opts.depth=0] - Current recursion depth
 * @param {number} [opts.maxDepth=3] - Max iframe recursion depth
 * @param {boolean} [opts.useCache=true] - Whether to use cache
 * @param {boolean} [opts.useBrowser=false] - Whether to use Puppeteer fallback
 * @param {object} [opts.kvStore=null] - Cloudflare KV namespace (optional)
 * @returns {Promise<object>} Extraction result
 */
async function extractStream(url, opts = {}) {
    const { depth = 0, maxDepth = 3, useCache = true, useBrowser = false, kvStore = null } = opts;

    if (depth > maxDepth) {
        return { success: false, error: 'Maximum iframe depth reached' };
    }

    // ── Cache check ──
    const cacheKey = `v2:${url}`;
    if (useCache) {
        // In-memory first
        const memCached = cache.get(cacheKey);
        if (memCached) return { ...memCached, cached: 'memory' };

        // KV second (if provided — Cloudflare Workers)
        if (kvStore) {
            try {
                const kvCached = await kvStore.get(cacheKey, 'json');
                if (kvCached && Date.now() - kvCached._ts < 240_000) {
                    cache.set(cacheKey, kvCached); // warm memory cache
                    return { ...kvCached, cached: 'kv' };
                }
            } catch { /* KV read errors are non-fatal */ }
        }
    }

    // ── Fetch HTML ──
    let html;
    try {
        html = await fetchHtml(url, { timeout: 15_000 });
    } catch (err) {
        return { success: false, error: `Fetch failed: ${err.message}` };
    }

    // ── Run strategies ──
    for (const strategy of strategies) {
        if (!strategy.detect(html)) continue;

        const result = strategy.extract(html, url);
        if (!result || !result.success) continue;

        // Recursive iframe extraction
        if (result.needsFurtherExtraction && result.iframeUrl) {
            const inner = await extractStream(result.iframeUrl, { ...opts, depth: depth + 1 });
            if (inner.success) {
                inner.parentUrl = url;
                await cacheResult(cacheKey, inner, kvStore);
                return inner;
            }
            continue; // iframe failed, try next strategy
        }

        await cacheResult(cacheKey, result, kvStore);
        return result;
    }

    // ── Fallback: any m3u8 URL ──
    const fallbackMatch = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
    if (fallbackMatch) {
        const result = { success: true, streamUrl: fallbackMatch[0], referer: url, strategy: 'Fallback' };
        await cacheResult(cacheKey, result, kvStore);
        return result;
    }

    // ── Fallback: iframe (even if strategy didn't fire) ──
    const iframeMatch = html.match(/<iframe[^>]+src\s*=\s*['"]([^'"]+)['"]/i);
    if (iframeMatch && depth < maxDepth) {
        let iframeUrl = iframeMatch[1];
        if (iframeUrl.startsWith('//')) iframeUrl = 'https:' + iframeUrl;
        else if (iframeUrl.startsWith('/')) {
            const u = new URL(url);
            iframeUrl = `${u.protocol}//${u.host}${iframeUrl}`;
        }
        const inner = await extractStream(iframeUrl, { ...opts, depth: depth + 1 });
        if (inner.success) {
            inner.parentUrl = url;
            await cacheResult(cacheKey, inner, kvStore);
            return inner;
        }
    }

    // ── Last resort: Browser-based extraction (Node only) ──
    if (useBrowser && depth === 0) {
        const browserResult = await extractWithBrowser(url);
        if (browserResult.success) {
            await cacheResult(cacheKey, browserResult, kvStore);
            return browserResult;
        }
    }

    return { success: false, error: 'All strategies exhausted' };
}

// ============================================
//  Cache Helper
// ============================================

async function cacheResult(key, result, kvStore) {
    const stamped = { ...result, _ts: Date.now() };
    cache.set(key, stamped);
    if (kvStore) {
        try {
            await kvStore.put(key, JSON.stringify(stamped), { expirationTtl: 300 });
        } catch { /* KV write errors are non-fatal */ }
    }
}

// ============================================
//  Browser-Based Fallback (Puppeteer)
// ============================================

async function extractWithBrowser(url) {
    let browser = null;
    try {
        const puppeteer = (await import('puppeteer')).default;
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
        });

        const page = await browser.newPage();
        const streamUrls = [];

        await page.setRequestInterception(true);

        page.on('request', (req) => {
            const reqUrl = req.url();
            if (/\.m3u8/i.test(reqUrl)) streamUrls.push(reqUrl);
            req.continue();
        });

        page.on('response', (res) => {
            const ct = res.headers()['content-type'] || '';
            if (ct.includes('mpegurl') || ct.includes('x-mpegURL')) {
                streamUrls.push(res.url());
            }
        });

        page.on('console', (msg) => {
            const m = msg.text().match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
            if (m) streamUrls.push(m[0]);
        });

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });
        await new Promise(r => setTimeout(r, 5000));

        // Try clicking play button
        try {
            const playBtn = await page.$('.play-button, .vjs-big-play-button, .jw-icon-playback, [class*="play"]');
            if (playBtn) {
                await playBtn.click();
                await new Promise(r => setTimeout(r, 3000));
            }
        } catch { /* play button click failures are non-fatal */ }

        await browser.close();
        browser = null;

        const unique = [...new Set(streamUrls)];
        if (unique.length > 0) {
            return {
                success: true,
                streamUrl: unique[0],
                allStreams: unique,
                referer: url,
                strategy: 'Browser',
            };
        }

        return { success: false, error: 'No stream found via browser' };
    } catch (err) {
        if (browser) await browser.close();
        return { success: false, error: `Browser extraction failed: ${err.message}` };
    }
}

// ============================================
//  Multi-Server Extraction (batch utility)
// ============================================

async function extractFromServers(servers, opts = {}) {
    const results = [];
    for (const server of servers) {
        const result = await extractStream(server.url, opts);
        results.push({ name: server.name, url: server.url, ...result });
        // Small delay between requests
        await new Promise(r => setTimeout(r, 1500));
    }
    return results;
}

// ============================================
//  Built-in Server List
// ============================================

const DEFAULT_SERVERS = [
    { name: 'YallaShoot',      url: 'https://aa.yallashoot2026.com/albaplayer/sports-d1/' },
    { name: 'Baranews',        url: 'https://live.baranewssumsel.online/albaplayer/ad-premium-1/' },
    { name: 'Gomatch',         url: 'https://pl.gomatch-live.com/albaplayer/ad-premium-1/' },
    { name: 'SIIIR',           url: 'https://eyj0exaioijkv1qilcjhbgcioijiuzi1nij99sss.yallashot.us/playerv2.php?match=match6&key=c0ae1abba6eebd7e6cc5b88b1d2B71547' },
    { name: 'SportsOnline HD', url: 'https://www1.sprtsonline.click/channels/hd/hd7.php' },
    { name: 'SportsOnline BR', url: 'https://www1.sprtsonline.click/channels/bra/br2.php' },
];

// ============================================
//  Test utility
// ============================================

async function testAllServers() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║       🎬 Stream Extractor V2 — Full Test                ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    const results = await extractFromServers(DEFAULT_SERVERS, { useBrowser: false });

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                    RESULTS SUMMARY                       ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    for (const r of results) {
        const icon = r.success ? '✅' : '❌';
        console.log(`║ ${icon} ${r.name.padEnd(20)} ${(r.strategy || 'failed').padEnd(15)}`);
        if (r.success) {
            console.log(`║   → ${r.streamUrl.substring(0, 55)}...`);
        } else {
            console.log(`║   ✗ ${r.error}`);
        }
    }
    console.log('╚══════════════════════════════════════════════════════════╝');

    return results;
}

// ============================================
//  Exports
// ============================================

export {
    // Core
    calculateSb,
    extractStream,
    extractWithBrowser,
    extractFromServers,
    testAllServers,

    // Internals (for testing / extension)
    strategies,
    fetchHtml,
    cache,
    MemoryCache,
    DEFAULT_SERVERS,
};

// ── Run test if executed directly ──
if (typeof process !== 'undefined' && process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
    testAllServers().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
