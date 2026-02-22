/**
 * ========================================================
 *  LiveMatch Edge Stream Proxy — Cloudflare Worker
 * ========================================================
 *  Production-ready stream proxy that runs on Cloudflare's edge.
 *
 *  Features:
 *    ✅ HLS stream proxy with correct Referer/Origin headers
 *    ✅ M3U8 playlist rewriting (relative → proxied URLs)
 *    ✅ KV-backed stream URL cache (5-min TTL)
 *    ✅ HMAC request signature verification
 *    ✅ Per-IP rate limiting
 *    ✅ Match data API
 *    ✅ CORS everywhere
 *
 *  KV Namespaces needed:
 *    - STREAMS_KV  (stream URL cache)
 *    - MATCHES_KV  (match data from scraper)
 *
 *  Environment variables:
 *    - APP_SECRET   (HMAC signing secret)
 *    - RATE_LIMIT   (max requests per minute, default 60)
 * ========================================================
 */

// ── SB Algorithm ────────────────────────────────────────
function calculateSb() {
    const n = Date.now();
    let v = Math.floor(n / 14400000) + Math.floor(n / 86400000 * 1.5);
    let l = v % 7 + 6;
    const c = 'abcdefghijklmnopqrstuvwxyz';
    let r = '';
    for (; l--; v = Math.floor(v / 26)) r = c[v % 26] + r;
    return r;
}

// ── HMAC Verification ───────────────────────────────────
async function verifySignature(request, secret) {
    if (!secret) return true; // Skip if no secret configured

    const timestamp = request.headers.get('X-Timestamp');
    const signature = request.headers.get('X-App-Sig');
    const appVersion = request.headers.get('X-App-Version');

    if (!timestamp || !signature || !appVersion) return false;

    // Reject requests older than 5 minutes
    const age = Math.abs(Date.now() - parseInt(timestamp));
    if (age > 300_000) return false;

    // Compute expected HMAC
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['sign']
    );
    const data = encoder.encode(`${timestamp}:${appVersion}`);
    const sigBuffer = await crypto.subtle.sign('HMAC', key, data);
    const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

    return signature === expected;
}

// ── Rate Limiter (simple IP-based via KV) ───────────────
async function checkRateLimit(request, env) {
    const limit = parseInt(env.RATE_LIMIT || '120'); // per minute
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const key = `rl:${ip}:${Math.floor(Date.now() / 60_000)}`;

    const current = parseInt(await env.STREAMS_KV.get(key) || '0');
    if (current >= limit) return false;

    await env.STREAMS_KV.put(key, String(current + 1), { expirationTtl: 120 });
    return true;
}

// ── Stream Extraction from HTML ─────────────────────────
function extractStreamFromHtml(html, pageUrl) {
    // Strategy 1: YallaShoot (D array + sb)
    const dMatch = html.match(/const\s+D\s*=\s*\[(.*?)\]/);
    const chMatch = html.match(/hls\/([^/]+)\/master\.m3u8/);
    if (dMatch && chMatch) {
        const domains = dMatch[1].split(',').map(s => s.replace(/['"]/g, '').trim()).filter(Boolean);
        const channel = chMatch[1];
        const sb = calculateSb();
        return {
            success: true,
            streamUrl: `https://${sb}.${domains[0]}/hls/${channel}/master.m3u8`,
            allDomains: domains.map(d => `https://${sb}.${d}/hls/${channel}/master.m3u8`),
            referer: pageUrl,
            strategy: 'YallaShoot',
        };
    }

    // Strategy 2: Direct m3u8 URL
    const m3u8Match = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
    if (m3u8Match) {
        return {
            success: true,
            streamUrl: m3u8Match[0],
            referer: pageUrl,
            strategy: 'DirectM3U8',
        };
    }

    // Strategy 3: JS variable
    const jsPatterns = [
        /(?:var|const|let)\s+(?:source|file|videoUrl|streamUrl)\s*=\s*['"]([^'"]+\.m3u8[^'"]*)['"]/,
        /["'](?:url|source|file)["']\s*:\s*["']([^"']+\.m3u8[^"']*)["']/,
    ];
    for (const p of jsPatterns) {
        const m = html.match(p);
        if (m) return { success: true, streamUrl: m[1], referer: pageUrl, strategy: 'JSVariable' };
    }

    return { success: false, error: 'No stream found' };
}

// ── Fetch & Extract with KV Cache ───────────────────────
async function getStreamUrl(pageUrl, env) {
    const cacheKey = `stream:${encodeURIComponent(pageUrl)}`;

    // Check KV cache
    const cached = await env.STREAMS_KV.get(cacheKey, 'json');
    if (cached && Date.now() - cached._ts < 240_000) { // 4-min TTL
        return { ...cached, cached: true };
    }

    // Fetch HTML from the source
    const response = await fetch(pageUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
        },
    });
    const html = await response.text();

    // Extract
    const result = extractStreamFromHtml(html, pageUrl);
    if (result.success) {
        const stamped = { ...result, _ts: Date.now() };
        await env.STREAMS_KV.put(cacheKey, JSON.stringify(stamped), { expirationTtl: 300 });
    }

    return result;
}

// ── HLS Proxy (rewrites m3u8 playlists) ─────────────────
async function proxyHls(targetUrl, referer, workerUrl) {
    const refererOrigin = referer ? new URL(referer).origin : 'https://aa.yallashoot2026.com';

    const response = await fetch(targetUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': referer || 'https://aa.yallashoot2026.com/',
            'Origin': refererOrigin,
            'Accept': '*/*',
        },
    });

    if (!response.ok) {
        return new Response(JSON.stringify({ error: `Upstream returned ${response.status}` }), {
            status: response.status,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
    }

    const contentType = response.headers.get('Content-Type') || '';
    const isM3U8 = contentType.includes('mpegurl') || targetUrl.endsWith('.m3u8') || contentType.includes('vnd.apple');

    if (isM3U8) {
        // Rewrite relative URLs in the m3u8 playlist to go through our proxy
        let body = await response.text();
        const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

        body = body.replace(/^(?!#)(.+\.ts.*)$/gm, (match) => {
            const absoluteUrl = match.startsWith('http') ? match : baseUrl + match;
            return `${workerUrl}/proxy?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(referer || '')}`;
        });

        // Also rewrite sub-playlist references (quality levels)
        body = body.replace(/^(?!#)(.+\.m3u8.*)$/gm, (match) => {
            const absoluteUrl = match.startsWith('http') ? match : baseUrl + match;
            return `${workerUrl}/proxy?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(referer || '')}`;
        });

        return new Response(body, {
            headers: {
                'Content-Type': 'application/vnd.apple.mpegurl',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Cache-Control': 'no-cache',
            },
        });
    }

    // Binary passthrough (TS segments, etc.)
    return new Response(response.body, {
        headers: {
            'Content-Type': contentType || 'video/mp2t',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Cache-Control': 'public, max-age=5',
        },
    });
}

// ── CORS Preflight ──────────────────────────────────────
function corsResponse() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Max-Age': '86400',
        },
    });
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
    });
}

// ========================================================
//  Worker Entry Point
// ========================================================

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const workerUrl = `${url.protocol}//${url.host}`;

        // CORS preflight
        if (request.method === 'OPTIONS') return corsResponse();

        // ── Rate Limiting ──
        if (!(await checkRateLimit(request, env))) {
            return jsonResponse({ error: 'Rate limit exceeded' }, 429);
        }

        // ── Routes ──

        // 1. GET /api/matches — Current match data
        if (url.pathname === '/api/matches') {
            const data = await env.MATCHES_KV.get('matches:today', 'json');
            return jsonResponse(data || []);
        }

        // 2. GET /api/extract?url=... — Extract stream from a page
        if (url.pathname === '/api/extract') {
            const pageUrl = url.searchParams.get('url');
            if (!pageUrl) return jsonResponse({ error: 'Missing url parameter' }, 400);

            // Optional signature check
            if (env.APP_SECRET) {
                const valid = await verifySignature(request, env.APP_SECRET);
                if (!valid) return jsonResponse({ error: 'Invalid signature' }, 403);
            }

            const result = await getStreamUrl(pageUrl, env);
            return jsonResponse(result);
        }

        // 3. GET /proxy?url=...&referer=... — Proxy HLS stream
        if (url.pathname === '/proxy') {
            const targetUrl = url.searchParams.get('url');
            const referer = url.searchParams.get('referer');
            if (!targetUrl) return jsonResponse({ error: 'Missing url parameter' }, 400);

            return proxyHls(targetUrl, referer, workerUrl);
        }

        // 4. GET /api/stream/:matchId — Get proxied stream for a match
        if (url.pathname.startsWith('/api/stream/')) {
            const matchId = url.pathname.split('/')[3];
            const serverIndex = parseInt(url.searchParams.get('server') || '0');

            // Get match data
            const matches = await env.MATCHES_KV.get('matches:today', 'json');
            const match = (matches || []).find(m =>
                m.id === matchId || m.slug === matchId
            );

            if (!match || !match.streams || match.streams.length === 0) {
                return jsonResponse({ error: 'Match or streams not found' }, 404);
            }

            const stream = match.streams[Math.min(serverIndex, match.streams.length - 1)];
            const streamResult = await getStreamUrl(stream.url || stream.embedUrl, env);

            if (!streamResult.success) {
                return jsonResponse({ error: 'Stream extraction failed', details: streamResult }, 502);
            }

            // Return proxied URL
            const proxiedUrl = `${workerUrl}/proxy?url=${encodeURIComponent(streamResult.streamUrl)}&referer=${encodeURIComponent(streamResult.referer || '')}`;
            return jsonResponse({
                success: true,
                proxiedUrl,
                directUrl: streamResult.streamUrl,
                referer: streamResult.referer,
                strategy: streamResult.strategy,
                servers: match.streams.length,
                currentServer: serverIndex,
            });
        }

        // 5. GET /api/sb — Current SB value (debug)
        if (url.pathname === '/api/sb') {
            return jsonResponse({ sb: calculateSb(), timestamp: Date.now() });
        }

        // 6. GET /api/health — Health check
        if (url.pathname === '/api/health') {
            return jsonResponse({
                status: 'ok',
                timestamp: new Date().toISOString(),
                sb: calculateSb(),
            });
        }

        // 7. GET / — API info page
        if (url.pathname === '/') {
            return new Response(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>LiveMatch Edge API</title>
    <style>
        body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; max-width: 700px; margin: 0 auto; }
        h1 { color: #38bdf8; }
        code { background: #1e293b; padding: 2px 8px; border-radius: 4px; color: #22c55e; }
        a { color: #38bdf8; }
        .endpoint { background: #1e293b; padding: 12px 16px; border-radius: 8px; margin: 8px 0; }
    </style>
</head>
<body>
    <h1>⚡ LiveMatch Edge API</h1>
    <p>Stream proxy running on Cloudflare's global edge network.</p>
    <h2>Endpoints</h2>
    <div class="endpoint"><code>GET</code> <a href="/api/matches">/api/matches</a> — Today's matches</div>
    <div class="endpoint"><code>GET</code> /api/extract?url=URL — Extract stream</div>
    <div class="endpoint"><code>GET</code> /api/stream/:matchId — Get proxied stream</div>
    <div class="endpoint"><code>GET</code> /proxy?url=URL&referer=REF — Proxy HLS</div>
    <div class="endpoint"><code>GET</code> <a href="/api/sb">/api/sb</a> — Current SB value</div>
    <div class="endpoint"><code>GET</code> <a href="/api/health">/api/health</a> — Health check</div>
</body>
</html>`, {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
        }

        return jsonResponse({ error: 'Not found' }, 404);
    },
};
