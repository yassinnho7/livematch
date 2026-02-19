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

class KorahScraper {
    constructor() {
        this.baseUrl = process.env.KORAH_URL || 'https://www.korah.live/matches-today/';
    }

    async scrapeMatches() {
        console.log('ðŸ” Starting Korah.live fallback scraper with stealth mode...');

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

            // Set realistic viewport
            await page.setViewport({ width: 1920, height: 1080 });

            // Log browser console messages
            page.on('console', msg => console.log('ðŸŒ KORAH BROWSER:', msg.text()));
            page.on('error', err => console.log('âŒ KORAH BROWSER ERROR:', err.message));

            // Set realistic user agent
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Set extra headers
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            });

            console.log('ðŸ“¡ Navigating to Korah.live...');
            await page.goto(this.baseUrl, {
                waitUntil: 'networkidle2',
                timeout: 90000
            });

            console.log('â³ Waiting for content to load...');

            // Wait for match cards - try multiple selectors
            let selectorFound = null;
            const selectors = [
                'a[title*="vs"]',
                '.match-card',
                '.matchCard',
                '.alba-match',
                'ul.matches li',
                '.match-item',
                'a[href*="match"]'
            ];

            for (const sel of selectors) {
                try {
                    await page.waitForSelector(sel, { timeout: 10000 });
                    selectorFound = sel;
                    console.log(`âœ… Found match elements with selector: ${sel}`);
                    break;
                } catch (e) {
                    // Try next selector
                }
            }

            if (!selectorFound) {
                console.log('âš ï¸ No match cards found with known selectors - trying generic extraction...');

                // Save screenshot for debugging
                try {
                    await page.screenshot({ path: 'debug_korah_screenshot.png', fullPage: true });
                    console.log('ðŸ“¸ Saved debug screenshot');
                } catch (err) {
                    console.log('Could not save screenshot');
                }

                // Check if we got blocked
                const pageContent = await page.content();
                console.log('ðŸ“„ Page Title:', await page.title());

                if (pageContent.includes('cloudflare') || pageContent.includes('captcha') || pageContent.includes('blocked')) {
                    console.log('ðŸš« Bot detection detected! Page was blocked.');
                    await fs.writeFile('debug_korah_source.html', pageContent);
                }

                await browser.close();
                return [];
            }

            // Auto-scroll to load lazy content
            console.log('ðŸ“œ Auto-scrolling to load all matches...');
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 100;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;

                        if (totalHeight >= scrollHeight) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 100);
                });
            });

            // Wait a bit after scrolling
            await new Promise(resolve => setTimeout(resolve, 2000));

            console.log('ðŸ“Š Extracting match data from Korah.live...');
            const matches = await page.evaluate((foundSelector) => {
                const results = [];

                // Strategy 1: Accurate extraction from match cards
                const matchCards = document.querySelectorAll('.AY_Match');

                if (matchCards.length > 0) {
                    matchCards.forEach((card, index) => {
                        try {
                            const linkEl = card.querySelector('a[href*="/matches/"]');
                            if (!linkEl) return;

                            const href = linkEl.href || '';
                            const title = linkEl.getAttribute('title') || '';

                            // Team Names
                            const homeNameEl = card.querySelector('.TM1 .TM_Name');
                            const awayNameEl = card.querySelector('.TM2 .TM_Name');
                            let homeTeam = homeNameEl?.innerText?.trim() || '';
                            let awayTeam = awayNameEl?.innerText?.trim() || '';

                            // Fallback to title parsing if name elements are empty
                            if (!homeTeam || !awayTeam) {
                                if (title.includes(' Ù…Ø¨Ø§Ø±Ø§Ø© ') && (title.includes(' Ùˆ ') || title.includes(' vs '))) {
                                    let matchPart = title.split(' Ù…Ø¨Ø§Ø±Ø§Ø© ')[1];
                                    if (matchPart.includes(' ÙƒÙˆØ±Ø© Ù„Ø§ÙŠÙ ')) {
                                        matchPart = matchPart.split(' ÙƒÙˆØ±Ø© Ù„Ø§ÙŠÙ ')[0];
                                    }
                                    if (matchPart.includes(' Ùˆ ')) {
                                        [homeTeam, awayTeam] = matchPart.split(' Ùˆ ').map(t => t.trim());
                                    } else if (matchPart.includes(' vs ')) {
                                        [homeTeam, awayTeam] = matchPart.split(' vs ').map(t => t.trim());
                                    }
                                }
                            }

                            if (!homeTeam || !awayTeam) return;

                            // Team Logos (Very accurate from Korah.live)
                            const homeLogoEl = card.querySelector('.TM1 .TM_Logo img');
                            const awayLogoEl = card.querySelector('.TM2 .TM_Logo img');

                            // Prefer data-src (lazy load) or src
                            const homeLogo = homeLogoEl?.getAttribute('data-src') || homeLogoEl?.src || '';
                            const awayLogo = awayLogoEl?.getAttribute('data-src') || awayLogoEl?.src || '';

                            // Time (Saudi Time GMT+3)
                            const timeEl = card.querySelector('.MT_Time');
                            const timeText = timeEl?.innerText?.trim() || '';

                            // Status
                            const statusEl = card.querySelector('.MT_Stat');
                            let status = 'NS';
                            if (statusEl) {
                                const statusText = statusEl.innerText?.trim() || '';
                                if (statusText.includes('Ø¬Ø§Ø±ÙŠØ©') || statusText.includes('Ù…Ø¨Ø§Ø´Ø±') || statusText.includes('LIVE')) {
                                    status = 'LIVE';
                                } else if (statusText.includes('Ø§Ù†ØªÙ‡Øª') || statusText.includes('FT')) {
                                    status = 'FT';
                                }
                            }

                            // Score
                            const scoreEl = card.querySelector('.MT_Result');
                            const scoreText = scoreEl?.innerText?.trim() || '';

                            // Info (Channel, Commentator, League)
                            const infoItems = card.querySelectorAll('.MT_Info li span');
                            let channelName = '';
                            let leagueName = 'Ø¨Ø·ÙˆÙ„Ø© Ø¹Ø§Ù„Ù…ÙŠØ©';

                            if (infoItems.length >= 1) {
                                channelName = infoItems[0].innerText?.trim() || '';
                            }
                            if (infoItems.length >= 3) {
                                leagueName = infoItems[2].innerText?.trim() || leagueName;
                            } else if (infoItems.length === 2) {
                                // Sometimes league is the second item if commentator is missing
                                leagueName = infoItems[1].innerText?.trim() || leagueName;
                            }

                            // Keep stream link empty initially; it will be extracted from the match page.
                            results.push({
                                id: 200000 + index + 1,
                                homeTeam,
                                awayTeam,
                                homeLogo,
                                awayLogo,
                                league: leagueName,
                                channel: channelName,
                                status,
                                time: timeText,
                                score: scoreText,
                                streamLink: '',
                                matchPageUrl: href
                            });
                        } catch (error) {
                            console.error('Error parsing match:', error.message);
                        }
                    });
                }

                // Strategy 2: Fallback (only if no matches found)
                if (results.length === 0) {
                    const allLinks = document.querySelectorAll('a[href*="/matches/"]');
                    allLinks.forEach((link, index) => {
                        try {
                            const href = link.href || '';
                            const title = link.getAttribute('title') || link.innerText?.trim() || '';

                            let homeTeam = '', awayTeam = '';
                            if (title.includes(' Ùˆ ')) {
                                const matchPart = title.split(' Ù…Ø¨Ø§Ø±Ø§Ø© ')?.pop()?.split(' ÙƒÙˆØ±Ø© ')?.[0] || title;
                                [homeTeam, awayTeam] = matchPart.split(' Ùˆ ').map(t => t.trim());
                            }

                            if (homeTeam && awayTeam) {
                                results.push({
                                    id: 200000 + 1000 + index + 1,
                                    homeTeam,
                                    awayTeam,
                                    homeLogo: '',
                                    awayLogo: '',
                                    league: 'Ø¨Ø·ÙˆÙ„Ø© Ø¹Ø§Ù„Ù…ÙŠØ©',
                                    channel: '',
                                    status: 'NS',
                                    time: '',
                                    score: '',
                                    streamLink: '',
                                    matchPageUrl: href
                                });
                            }
                        } catch (e) { }
                    });
                }

                return results;
            }, selectorFound);

            console.log(`âœ… Successfully extracted ${matches.length} matches from Korah.live`);

            if (matches.length === 0) {
                console.log('âš ï¸ No matches found after extraction');
            } else {
                console.log('ðŸ“‹ Extracting player URLs from match pages...');

                // Visit each match page to get the actual player URL
                for (let i = 0; i < matches.length; i++) {
                    const match = matches[i];
                    if (match.matchPageUrl) {
                        try {
                            console.log(`ðŸ”— Checking match ${i + 1}/${matches.length}: ${match.homeTeam} vs ${match.awayTeam}`);

                            const matchPage = await browser.newPage();
                            await matchPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

                            await matchPage.goto(match.matchPageUrl, {
                                waitUntil: 'domcontentloaded',
                                timeout: 30000
                            });

                            // Wait for iframe to load
                            await new Promise(resolve => setTimeout(resolve, 3000));

                            // Extract direct player URL and intermediate candidates from match page.
                            const extraction = await matchPage.evaluate(() => {
                                const candidates = [];
                                const seen = new Set();
                                const addCandidate = (value) => {
                                    if (!value || typeof value !== 'string') return;
                                    const cleaned = value.trim();
                                    if (!cleaned || seen.has(cleaned)) return;
                                    seen.add(cleaned);
                                    candidates.push(cleaned);
                                };

                                let direct = null;

                                const iframes = document.querySelectorAll('iframe');
                                for (const iframe of iframes) {
                                    const src = iframe.src || iframe.getAttribute('data-src');
                                    if (!src) continue;
                                    addCandidate(src);
                                    if (!direct && src.includes('/albaplayer/')) {
                                        direct = src;
                                    }
                                }

                                const scripts = document.querySelectorAll('script');
                                for (const script of scripts) {
                                    const content = script.innerText || '';
                                    const normalizedContent = content.replace(/\\\//g, '/');
                                    const directMatches = normalizedContent.match(/https?:\/\/[^\s"'<>]*albaplayer[^\s"'<>]*/gi) || [];
                                    directMatches.forEach(addCandidate);
                                    if (!direct && directMatches.length) {
                                        direct = directMatches[0];
                                    }

                                    const htmlMatches = normalizedContent.match(/https?:\/\/[^\s"'<>]+\.html[^\s"'<>]*/gi) || [];
                                    htmlMatches.forEach(addCandidate);
                                    const semohdMatches = normalizedContent.match(/[a-z0-9.-]*semohd\.online\/[^\s"'<>]*\.html[^\s"'<>]*/gi) || [];
                                    semohdMatches.forEach((m) => {
                                        if (m.startsWith('http')) addCandidate(m);
                                        else addCandidate(`https://${m}`);
                                    });
                                }

                                const links = document.querySelectorAll('a[href]');
                                for (const link of links) {
                                    const href = link.href;
                                    if (!href) continue;
                                    if (href.includes('albaplayer') || href.includes('.html') || href.includes('semohd')) {
                                        addCandidate(href);
                                    }
                                }

                                return { direct, candidates };
                            });

                            let playerUrl = extraction && extraction.direct ? extraction.direct : null;
                            if (!playerUrl) {
                                playerUrl = await this.resolveIntermediatePlayerUrl(
                                    browser,
                                    extraction && Array.isArray(extraction.candidates) ? extraction.candidates : [],
                                    match.matchPageUrl
                                );
                            }

                            if (playerUrl) {
                                // Extract clean player URL
                                try {
                                    match.streamLink = playerUrl.split('?')[0];
                                    console.log(`  âœ… Found player: ${match.streamLink}`);
                                } catch (e) {
                                    match.streamLink = playerUrl;
                                }
                            } else {
                                console.log(`  âš ï¸ No player URL found`);
                            }

                            await matchPage.close();

                        } catch (err) {
                            console.log(`  âŒ Error on match page: ${err.message}`);
                        }
                    }
                }

                console.log('ðŸ“‹ Matches found:');
                matches.forEach(m => {
                    console.log(`  - ${m.homeTeam} vs ${m.awayTeam} (${m.league}) [${m.status}] ${m.channel ? 'ðŸ“º ' + m.channel : ''}`);
                });
            }

            const processedMatches = this.processMatches(matches);

            await browser.close();
            return processedMatches;

        } catch (error) {
            console.error('âŒ Korah.live scraping error:', error.message);
            console.error(error.stack);
            if (browser) await browser.close();
            return [];
        }
    }

    processMatches(rawMatches) {
        return rawMatches.map(match => {
            // Use centralized timezone conversion (korah = GMT+3, Saudi time)
            const timestamp = toGMTTimestamp(match.time, 3);

            // Use centralized hash generation
            const stableId = generateMatchHash(match.homeTeam, match.awayTeam);

            let channel = 'stream';
            try {
                const url = new URL(match.streamLink);
                const parts = url.pathname.split('/').filter(p => p);
                if (parts.length > 0) {
                    channel = parts[parts.length - 1] || 'stream';
                }
            } catch (e) {
                // Keep default
            }

            // Use centralized formatting
            const gmtTimeStr = formatGMTTime(timestamp);
            const gmtDate = new Date(timestamp * 1000);

            return {
                id: stableId,
                date: gmtDate.toISOString(),
                timestamp: timestamp,
                status: match.status,
                time: gmtTimeStr,
                time_label: `${gmtTimeStr} GMT`,
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
                score: match.score ? this.parseScore(match.score) : null,
                streams: this.buildStreams(match.streamLink, channel, stableId)
            };
        });
    }

    buildStreams(streamLink, channel, stableId) {
        if (!streamLink || typeof streamLink !== 'string') return [];
        const cleaned = streamLink.trim();
        if (!cleaned) return [];

        // Do not expose raw match-page URLs as playable streams.
        const hasPlayerPattern = cleaned.includes('/albaplayer/');
        if (!hasPlayerPattern) return [];

        return [{
            id: `stream_${channel}_${stableId}`,
            source: 'korah',
            quality: 'HD',
            channel: channel,
            url: cleaned,
            priority: 1
        }];
    }

    normalizeUrl(rawUrl, baseUrl = '') {
        if (!rawUrl || typeof rawUrl !== 'string') return '';
        const trimmed = rawUrl.trim();
        if (!trimmed) return '';
        try {
            return new URL(trimmed, baseUrl || undefined).toString();
        } catch (_) {
            return '';
        }
    }

    async resolveIntermediatePlayerUrl(browser, candidates, baseUrl) {
        if (!Array.isArray(candidates) || !candidates.length) return null;

        for (const candidate of candidates) {
            const normalized = this.normalizeUrl(candidate, baseUrl);
            if (!normalized) continue;

            if (normalized.includes('/albaplayer/')) {
                return normalized.split('?')[0];
            }

            const shouldFollow = normalized.includes('semohd') ||
                normalized.includes('.html') ||
                normalized.includes('/2026/') ||
                normalized.includes('/2027/');
            if (!shouldFollow) continue;

            let page = null;
            try {
                page = await browser.newPage();
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
                await page.goto(normalized, {
                    waitUntil: 'domcontentloaded',
                    timeout: 30000
                });
                await new Promise(resolve => setTimeout(resolve, 1200));

                const nestedPlayer = await page.evaluate(() => {
                    const pickAlbaplayer = (value) => {
                        if (!value || typeof value !== 'string') return null;
                        const cleaned = value.trim();
                        return cleaned.includes('/albaplayer/') ? cleaned : null;
                    };

                    const iframes = document.querySelectorAll('iframe');
                    for (const iframe of iframes) {
                        const src = iframe.src || iframe.getAttribute('data-src');
                        const found = pickAlbaplayer(src);
                        if (found) return found;
                    }

                    const scripts = document.querySelectorAll('script');
                    for (const script of scripts) {
                        const content = (script.innerText || '').replace(/\\\//g, '/');
                        const match = content.match(/https?:\/\/[^\s"'<>]*albaplayer[^\s"'<>]*/i);
                        if (match && match[0]) return match[0];
                    }

                    const links = document.querySelectorAll('a[href*="albaplayer"]');
                    for (const link of links) {
                        const found = pickAlbaplayer(link.href);
                        if (found) return found;
                    }

                    return null;
                });

                if (nestedPlayer) {
                    const finalPlayer = this.normalizeUrl(nestedPlayer, normalized);
                    if (finalPlayer && finalPlayer.includes('/albaplayer/')) {
                        return finalPlayer.split('?')[0];
                    }
                }
            } catch (_) {
                // Try next candidate.
            } finally {
                if (page) {
                    try {
                        await page.close();
                    } catch (_) { }
                }
            }
        }

        return null;
    }
    parseScore(scoreText) {
        const match = scoreText.match(/(\d+)\s*-\s*(\d+)/);
        if (match) {
            return {
                home: parseInt(match[1]),
                away: parseInt(match[2])
            };
        }
        return null;
    }


    async saveMatches(matches) {
        const data = {
            generated_at: new Date().toISOString(),
            count: matches.length,
            matches: matches
        };

        const outputPath = path.join(__dirname_local, '..', 'public', 'data', 'matches.json');

        await fs.writeFile(
            outputPath,
            JSON.stringify(data, null, 2),
            'utf8'
        );

        console.log(`âœ… Saved ${matches.length} matches to ${outputPath}`);
    }
}

// Main execution
async function main() {
    try {
        const scraper = new KorahScraper();
        const matches = await scraper.scrapeMatches();

        if (matches.length === 0) {
            console.log('âš ï¸ No matches found - this might be due to:');
            console.log('  1. No matches scheduled for today');
            console.log('  2. Bot detection blocking the scraper');
            console.log('  3. Site structure changed');
        }

        await scraper.saveMatches(matches);

        console.log('ðŸŽ‰ Korah.live scraping completed!');
        console.log(`ðŸ“Š Total matches saved: ${matches.length}`);
        process.exit(0);
    } catch (error) {
        console.error('ðŸ’¥ Fatal error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}

export default KorahScraper;



