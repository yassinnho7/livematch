function extractStreamUrl(html) {
    // 1. Extract domains array D
    const dMatch = html.match(/const\s+D\s*=\s*\[(.*?)\]/);
    if (!dMatch) return null;
    const domains = dMatch[1].split(',').map(s => s.replace(/['"]/g, '').trim());

    // 2. Extract channel name (e.g., ch10)
    const chMatch = html.match(/hls\/([^\/]+)\/master\.m3u8/);
    if (!chMatch) return null;
    const channel = chMatch[1];

    // 3. Generate subdomain 'sb'
    const sb = (() => {
        let n = Date.now();
        let v = Math.floor(n / 14400000) + Math.floor(n / 86400000 * 1.5);
        let l = v % 7 + 6;
        let c = 'abcdefghijklmnopqrstuvwxyz';
        let r = '';
        for (; l--; v = Math.floor(v / 26)) {
            r = c[v % 26] + r;
        }
        return r;
    })();

    // 4. Construct final URL
    const domain = domains[0]; // just pick the first one for testing
    return `https://${sb}.${domain}/hls/${channel}/master.m3u8`;
}

async function test() {
    for (let i = 1; i <= 3; i++) {
        try {
            const url = `https://aa.yallashoot2026.com/albaplayer/sports-d1/?serv=${i}`;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                }
            });
            const html = await response.text();

            const streamUrl = extractStreamUrl(html);
            const dMatch = html.match(/const\s+D\s*=\s*\[(.*?)\]/);
            const chMatch = html.match(/hls\/([^\/]+)\/master\.m3u8/);
            console.log(`Server ${i}:`);
            console.log(`  URL:     ${streamUrl}`);
            console.log(`  Domains: [${dMatch ? dMatch[1] : 'none'}]`);
            console.log(`  Channel: ${chMatch ? chMatch[1] : 'none'}`);
        } catch (e) {
            console.error(`Error on server ${i}:`, e.message);
        }
    }
}

test();
