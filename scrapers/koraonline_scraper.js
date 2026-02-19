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

class KoraOnlineScraper {
    constructor() {
        // According to user, https://www.kora-online.cc/ redirects to is_home/
        this.baseUrl = process.env.KORAONLINE_URL || 'https://www.kora-online.cc/is_home/';
    }

    async scrapeMatches() {
        console.log('ðŸ”  Starting Kora-Online.cc primary scraper with stealth mode...');

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
            page.on('console', msg => console.log('ðŸŒ  KORA-ONLINE BROWSER:', msg.text()));
            page.on('error', err => console.log('â Œ KORA-ONLINE BROWSER ERROR:', err.message));

            // Set realistic user agent
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Set extra headers
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            });

            console.log('ðŸ“¡ Navigating to Kora-Online.cc...');
            await page.goto(this.baseUrl, {
                waitUntil: 'networkidle2',
                timeout: 90000
            });

            console.log('â ³ Waiting for content to load...');

            // Wait for match cards
            let selectorFound = null;
            const selectors = [
                '.AY_Match',
                'div.AY_Block.AY-Fixture',
                '.match-card',
                'a[title*="vs"]',
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
                console.log('âš ï¸  No match cards found with known selectors on Kora-Online.cc');
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

            await new Promise(resolve => setTimeout(resolve, 2000));

            console.log('ðŸ“Š Extracting match data from Kora-Online.cc...');
            const matches = await page.evaluate((foundSelector) => {
                const results = [];

                const matchCards = document.querySelectorAll('.AY_Match, div.AY_Block.AY-Fixture, .match-card');

                if (matchCards.length > 0) {
                    matchCards.forEach((card, index) => {
                        try {
                            const linkEl = card.querySelector('a') || card.closest('a');
                            if (!linkEl) {
                                console.log('No link found in card', card.className);
                                return;
                            }

                            const href = linkEl.href || '';

                            // Team Names
                            const homeNameEl = card.querySelector('.TM1 .TM_Name') || card.querySelector('.TM1');
                            const awayNameEl = card.querySelector('.TM2 .TM_Name') || card.querySelector('.TM2');
                            let homeTeam = homeNameEl?.innerText?.trim() || '';
                            let awayTeam = awayNameEl?.innerText?.trim() || '';

                            if (!homeTeam || !awayTeam) {
                                console.log('No team names found. Home:', homeTeam, 'Away:', awayTeam);
                                return;
                            }

                            // Team Logos
                            const homeLogoEl = card.querySelector('.TM1 .TM_Logo img');
                            const awayLogoEl = card.querySelector('.TM2 .TM_Logo img');
                            const homeLogo = homeLogoEl?.getAttribute('data-src') || homeLogoEl?.src || '';
                            const awayLogo = awayLogoEl?.getAttribute('data-src') || awayLogoEl?.src || '';

                            // Time (Kora-Online is usually GMT+3)
                            const timeEl = card.querySelector('.MT_Time');
                            const timeText = timeEl?.innerText?.trim() || '';

                            // Status
                            const statusEl = card.querySelector('.MT_Status') || card.querySelector('.MT_Result');
                            let status = 'NS';
                            let scoreText = '';
                            if (statusEl) {
                                const statusText = statusEl.innerText?.trim() || '';
                                if (statusText.includes('Ø¬Ø§Ø±ÙŠØ©') || statusText.includes('Ù…Ø¨Ø§Ø´Ø±') || statusText.includes('LIVE')) {
                                    status = 'LIVE';
                                    const resEl = card.querySelector('.MT_Result');
                                    if (resEl) scoreText = resEl.innerText?.trim() || '';
                                } else if (statusText.includes('Ø§Ù†ØªÙ‡Øª') || statusText.includes('FT')) {
                                    status = 'FT';
                                    scoreText = statusText;
                                } else if (statusText.includes('-')) {
                                    // might be ongoing or finished score
                                    const textVal = statusText.replace(/[^\d-]/g, '');
                                    if (textVal.length >= 3) {
                                        status = 'LIVE';
                                        scoreText = textVal;
                                    }
                                }
                            }

                            // Info (Channel, Commentator, League)
                            const infoItems = card.querySelectorAll('.MT_Info li span');
                            let channelName = '';
                            let leagueName = 'مباريات كرة القدم';

                            if (infoItems.length >= 1) channelName = infoItems[0].innerText?.trim() || '';
                            if (infoItems.length >= 3) leagueName = infoItems[2].innerText?.trim() || leagueName;
                            else if (infoItems.length === 2) leagueName = infoItems[1].innerText?.trim() || leagueName;

                            results.push({
                                id: 300000 + index + 1,
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
                return results;
            }, selectorFound);

            console.log(`âœ… Successfully extracted ${matches.length} matches from Kora-Online.cc`);

            if (matches.length > 0) {
                console.log('ðŸ“‹ Extracting player URLs from match pages...');

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

                            await new Promise(resolve => setTimeout(resolve, 3000));

                            const extraction = await matchPage.evaluate(() => {
                                let direct = null;

                                const pickAlbaplayer = (value) => {
                                    if (!value || typeof value !== 'string') return null;
                                    const cleaned = value.trim();
                                    return cleaned.includes('/albaplayer/') ? cleaned : null;
                                };

                                const iframes = document.querySelectorAll('iframe');
                                for (const iframe of iframes) {
                                    const src = iframe.src || iframe.getAttribute('data-src');
                                    let found = pickAlbaplayer(src);
                                    if (found && !direct) direct = found;
                                }

                                const scripts = document.querySelectorAll('script');
                                for (const script of scripts) {
                                    const content = (script.innerText || '').replace(/\\\//g, '/');
                                    const match = content.match(/https?:\/\/[^\s"'<>]*albaplayer[^\s"'<>]*/i);
                                    if (match && match[0] && !direct) direct = match[0];
                                }

                                const links = document.querySelectorAll('a[href*="albaplayer"]');
                                for (const link of links) {
                                    let found = pickAlbaplayer(link.href);
                                    if (found && !direct) direct = found;
                                }

                                return { direct };
                            });

                            if (extraction && extraction.direct) {
                                try {
                                    match.streamLink = extraction.direct.split('?')[0];
                                    console.log(`  âœ… Found Kora-Online player: ${match.streamLink}`);
                                } catch (e) {
                                    match.streamLink = extraction.direct;
                                }
                            } else {
                                console.log(`  âš ï¸  No Kora-Online player URL found`);
                            }

                            await matchPage.close();

                        } catch (err) {
                            console.log(`  â Œ Error on Kora-Online match page: ${err.message}`);
                        }
                    }
                }
            }

            const processedMatches = this.processMatches(matches);
            await browser.close();
            return processedMatches;

        } catch (error) {
            console.error('â Œ Kora-Online.cc scraping error:', error.message);
            console.error(error.stack);
            if (browser) await browser.close();
            return [];
        }
    }

    processMatches(rawMatches) {
        return rawMatches.map(match => {
            // Kora-Online uses GMT+3 as observed by user (Saudi Arabia Time)
            const timestamp = toGMTTimestamp(match.time, 3);
            const stableId = generateMatchHash(match.homeTeam, match.awayTeam);

            let channel = match.channel || 'koraonline';
            if (match.streamLink) {
                try {
                    const url = new URL(match.streamLink);
                    const parts = url.pathname.split('/').filter(p => p);
                    if (parts.length > 0) {
                        channel = parts[parts.length - 1]; // e.g. "sports-3"
                    }
                } catch (e) { }
            }

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
        if (!cleaned || !cleaned.includes('/albaplayer/')) return [];

        return [{
            id: `stream_${channel}_ko_${stableId}`,
            source: 'koraonline',
            quality: 'HD',
            channel: channel,
            url: cleaned,
            priority: 1 // High priority for Kora-Online
        }];
    }

    parseScore(scoreText) {
        const match = scoreText.match(/(\d+)\s*[-:]\s*(\d+)/);
        if (match) {
            return {
                home: parseInt(match[1]),
                away: parseInt(match[2])
            };
        }
        return null;
    }
}

// Main execution for testing
async function main() {
    try {
        const scraper = new KoraOnlineScraper();
        const matches = await scraper.scrapeMatches();
        console.log(`ðŸ“Š Total matches extracted in standalone test: ${matches.length}`);
        process.exit(0);
    } catch (error) {
        console.error('ðŸ’¥ Fatal error:', error.message);
        process.exit(1);
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}

export default KoraOnlineScraper;
