import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { toGMTTimestamp, generateMatchHash, getCountryFromLeague, getLeagueLogo, formatGMTTime } from './utils.js';

// Add stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);

class KoraplusScraper {
    constructor() {
        this.baseUrl = 'https://koraplus.blog/matche-today/';
    }

    async scrapeMatches() {
        console.log('🔍 Starting Koraplus scraper...');

        let browser;
        try {
            browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-blink-features=AutomationControlled',
                    '--window-size=1920,1080'
                ]
            });

            const page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            console.log('📡 Navigating to Koraplus.blog...');
            await page.goto(this.baseUrl, {
                waitUntil: 'networkidle2',
                timeout: 60000
            });

            // Wait for match containers
            try {
                await page.waitForSelector('.match-container', { timeout: 15000 });
            } catch (e) {
                console.log('⚠️ No match containers found. Checking for block...');
                const content = await page.content();
                if (content.includes('cloudflare') || content.includes('captcha')) {
                    console.log('🚫 Blocked by Cloudflare');
                }
                await browser.close();
                return [];
            }

            console.log('📊 Extracting matches from main page...');
            const matches = await page.evaluate(() => {
                const items = document.querySelectorAll('.match-container');
                const results = [];

                items.forEach(item => {
                    const linkEl = item.querySelector('a');
                    if (!linkEl) return;

                    const homeName = item.querySelector('.right-team .team-name')?.innerText?.trim();
                    const awayName = item.querySelector('.left-team .team-name')?.innerText?.trim();
                    const homeLogo = item.querySelector('.right-team .team-logo img')?.getAttribute('data-src') || item.querySelector('.right-team .team-logo img')?.src;
                    const awayLogo = item.querySelector('.left-team .team-logo img')?.getAttribute('data-src') || item.querySelector('.left-team .team-logo img')?.src;

                    const timeEl = item.querySelector('.match-timing div:first-child');
                    const timeText = timeEl?.innerText?.trim();

                    const statusEl = item.querySelector('.match-timing .date');
                    const statusText = statusEl?.innerText?.trim();

                    const infoItems = item.querySelectorAll('.match-info ul li');
                    const channel = infoItems[0]?.innerText?.trim();
                    const league = infoItems[2]?.innerText?.trim() || 'بطولة';

                    results.push({
                        homeTeam: homeName,
                        awayTeam: awayName,
                        homeLogo,
                        awayLogo,
                        time: timeText,
                        statusText,
                        channel,
                        league,
                        matchUrl: linkEl.href
                    });
                });

                return results;
            });

            console.log(`✅ Found ${matches.length} matches. Extracting player URLs...`);

            // Detailed extraction for each match
            const finalMatches = [];
            for (let i = 0; i < matches.length; i++) {
                const match = matches[i];
                console.log(`🔗 Checking match ${i + 1}/${matches.length}: ${match.homeTeam} vs ${match.awayTeam}`);

                try {
                    await page.goto(match.matchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

                    const playerUrl = await page.evaluate(() => {
                        const playerUrls = [];

                        // Strategy 1: Search for iframeUrl in scripts
                        const scripts = Array.from(document.querySelectorAll('script'));
                        for (const script of scripts) {
                            const content = script.innerText;

                            // Match var iframeUrl = '...'
                            let match = content.match(/var\s+iframeUrl\s*=\s*['"]([^'"]+)['"]/);
                            if (match && match[1] && !playerUrls.includes(match[1])) {
                                playerUrls.push(match[1]);
                            }

                            // Match src="...albaplayer..."
                            const srcMatches = content.match(/src=["']([^"']*albaplayer[^"']*)["']/gi);
                            if (srcMatches) {
                                srcMatches.forEach(m => {
                                    const urlMatch = m.match(/["']([^"']+)[""]/);
                                    if (urlMatch && urlMatch[1] && !playerUrls.includes(urlMatch[1])) {
                                        playerUrls.push(urlMatch[1]);
                                    }
                                });
                            }

                            // Match live4.php or splayer links
                            const splayerMatches = content.match(/https?:\/\/[^\s"'<>]+\.(?:php|html)[^\s"'<>]*/gi);
                            if (splayerMatches) {
                                splayerMatches.forEach(url => {
                                    if ((url.includes('splayer') || url.includes('live4') || url.includes('koora')) &&
                                        !playerUrls.includes(url)) {
                                        playerUrls.push(url);
                                    }
                                });
                            }
                        }

                        // Strategy 2: Search for iframes
                        const iframes = document.querySelectorAll('iframe');
                        for (const iframe of iframes) {
                            const src = iframe.src || iframe.getAttribute('data-src');
                            if (src && (src.includes('player') || src.includes('albaplayer') || src.includes('splayer') || src.includes('koora')) &&
                                !playerUrls.includes(src)) {
                                playerUrls.push(src);
                            }
                        }

                        // Strategy 3: Search for links with player keywords
                        const links = document.querySelectorAll('a[href*="player"], a[href*="albaplayer"], a[href*="splayer"], a[href*="koora"]');
                        for (const link of links) {
                            const href = link.href;
                            if (href && !playerUrls.includes(href)) {
                                playerUrls.push(href);
                            }
                        }

                        return playerUrls.length > 0 ? playerUrls : null;
                    });

                    if (playerUrl && playerUrl.length > 0) {
                        console.log(`✨ Found ${playerUrl.length} player(s) for: ${match.homeTeam} vs ${match.awayTeam}`);

                        // Generate stable ID for the match
                        const dateStr = new Date().toISOString().split('T')[0];
                        const uniqueString = `${dateStr}-${match.homeTeam}-${match.awayTeam}`;
                        const matchStableId = generateMatchHash(uniqueString);

                        // Add all found player URLs as streams
                        match.streams = [];
                        playerUrl.forEach((url, idx) => {
                            match.streams.push({
                                id: `stream_koraplus_${matchStableId}_${idx}`,
                                source: 'koraplus',
                                quality: idx === 0 ? 'HD' : 'SD',
                                channel: match.channel || `Server ${idx + 1}`,
                                url: url,
                                priority: idx + 1
                            });
                        });
                        finalMatches.push(match);
                    } else {
                        console.log(`⚠️ No player URL found for this match.`);
                        finalMatches.push(match);
                    }
                } catch (err) {
                    console.log(`❌ Error on match page: ${err.message}`);
                    finalMatches.push(match);
                }
            }

            await browser.close();
            return this.processMatches(finalMatches);

        } catch (error) {
            console.error('❌ Koraplus scraping error:', error.message);
            if (browser) await browser.close();
            return [];
        }
    }


    processMatches(rawMatches) {
        return rawMatches.map((match, index) => {
            // Use centralized timezone conversion (koraplus = GMT+2)
            const timestamp = toGMTTimestamp(match.time, 2);
            const timeLabel = formatGMTTime(timestamp);

            // Use centralized hash generation
            const stableId = generateMatchHash(match.homeTeam, match.awayTeam);

            // Determine status
            let status = 'NS';
            if (match.statusText) {
                const statusText = String(match.statusText).toLowerCase();
                if (statusText.includes('live') || statusText.includes('مباشر') || statusText.includes('جارية')) status = 'LIVE';
                if (statusText.includes('ft') || statusText.includes('finished') || statusText.includes('انته')) status = 'FT';
            }

            const streams = [];
            const seenUrls = new Set();
            const pushStream = (stream, fallbackIndex = 0) => {
                if (!stream || !stream.url || seenUrls.has(stream.url)) return;
                seenUrls.add(stream.url);
                streams.push({
                    id: stream.id || `stream_koraplus_${stableId}_${fallbackIndex}`,
                    source: 'koraplus',
                    quality: stream.quality || (fallbackIndex === 0 ? 'HD' : 'SD'),
                    channel: stream.channel || match.channel || `Server ${fallbackIndex + 1}`,
                    url: stream.url,
                    priority: Number.isFinite(stream.priority) ? stream.priority : fallbackIndex + 1
                });
            };

            // Prefer extracted streams from scrape loop.
            if (Array.isArray(match.streams) && match.streams.length) {
                match.streams.forEach((stream, idx) => pushStream(stream, idx));
            }

            // Fallback for legacy field.
            if (match.playerUrl && Array.isArray(match.playerUrl)) {
                match.playerUrl.forEach((url, idx) => {
                    pushStream({
                        id: `stream_koraplus_${stableId}_${idx}`,
                        quality: idx === 0 ? 'HD' : 'SD',
                        channel: match.channel || `Server ${idx + 1}`,
                        url: url,
                        priority: idx + 1
                    }, streams.length + idx);
                });
            } else if (match.playerUrl) {
                pushStream({
                    id: `stream_koraplus_${stableId}`,
                    quality: 'HD',
                    channel: match.channel || 'Koraplus',
                    url: match.playerUrl,
                    priority: 1
                }, streams.length);
            }

            return {
                id: stableId,
                date: new Date(timestamp * 1000).toISOString(),
                timestamp: timestamp,
                status: status,
                time: timeLabel,
                time_label: `${timeLabel} GMT`,
                league: {
                    name: match.league,
                    country: getCountryFromLeague(match.league),
                    logo: getLeagueLogo(match.league)
                },
                home: {
                    name: match.homeTeam,
                    logo: match.homeLogo
                },
                away: {
                    name: match.awayTeam,
                    logo: match.awayLogo
                },
                score: null,
                streams: streams
            };
        });
    }


    async saveMatches(matches) {
        const data = {
            generated_at: new Date().toISOString(),
            count: matches.length,
            matches: matches
        };
        const outputPath = path.join(__dirname_local, '..', 'public', 'data', 'koraplus_matches.json');
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`✅ Saved ${matches.length} matches to ${outputPath}`);
    }
}

// Main execution
async function main() {
    try {
        const scraper = new KoraplusScraper();
        const matches = await scraper.scrapeMatches();
        await scraper.saveMatches(matches);
        process.exit(0);
    } catch (error) {
        console.error('💥 Fatal error:', error.message);
        process.exit(1);
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}

export default KoraplusScraper;
