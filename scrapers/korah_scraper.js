import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Add stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);

class KorahScraper {
    constructor() {
        this.baseUrl = process.env.KORAH_URL || 'https://www.korah.live/matches-today/';
    }

    async scrapeMatches() {
        console.log('🔍 Starting Korah.live fallback scraper with stealth mode...');

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
            page.on('console', msg => console.log('🌐 KORAH BROWSER:', msg.text()));
            page.on('error', err => console.log('❌ KORAH BROWSER ERROR:', err.message));

            // Set realistic user agent
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Set extra headers
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            });

            console.log('📡 Navigating to Korah.live...');
            await page.goto(this.baseUrl, {
                waitUntil: 'networkidle2',
                timeout: 90000
            });

            console.log('⏳ Waiting for content to load...');

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
                    console.log(`✅ Found match elements with selector: ${sel}`);
                    break;
                } catch (e) {
                    // Try next selector
                }
            }

            if (!selectorFound) {
                console.log('⚠️ No match cards found with known selectors - trying generic extraction...');

                // Save screenshot for debugging
                try {
                    await page.screenshot({ path: 'debug_korah_screenshot.png', fullPage: true });
                    console.log('📸 Saved debug screenshot');
                } catch (err) {
                    console.log('Could not save screenshot');
                }

                // Check if we got blocked
                const pageContent = await page.content();
                console.log('📄 Page Title:', await page.title());

                if (pageContent.includes('cloudflare') || pageContent.includes('captcha') || pageContent.includes('blocked')) {
                    console.log('🚫 Bot detection detected! Page was blocked.');
                    await fs.writeFile('debug_korah_source.html', pageContent);
                }

                await browser.close();
                return [];
            }

            // Auto-scroll to load lazy content
            console.log('📜 Auto-scrolling to load all matches...');
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

            console.log('📊 Extracting match data from Korah.live...');
            const matches = await page.evaluate((foundSelector) => {
                const results = [];

                // Strategy 1: Try various match-specific links
                const matchCards = document.querySelectorAll('a[title*=" و "], a[title*=" vs "], a[href*="/matches/"]');

                if (matchCards.length > 0) {
                    console.log(`Found ${matchCards.length} potential match elements`);

                    matchCards.forEach((card, index) => {
                        try {
                            const title = card.getAttribute('title') || '';
                            const href = card.href || '';
                            if (!href.includes('/matches/')) return;

                            let homeTeam = '', awayTeam = '';

                            // Try to parse title
                            // Example: "بث مباشر مباراة العين و القادسية كورة لايف koora live"
                            if (title.includes(' مباراة ') && (title.includes(' و ') || title.includes(' vs '))) {
                                let matchPart = title.split(' مباراة ')[1];
                                if (matchPart.includes(' كورة لايف ')) {
                                    matchPart = matchPart.split(' كورة لايف ')[0];
                                }

                                if (matchPart.includes(' و ')) {
                                    [homeTeam, awayTeam] = matchPart.split(' و ').map(t => t.trim());
                                } else if (matchPart.includes(' vs ')) {
                                    [homeTeam, awayTeam] = matchPart.split(' vs ').map(t => t.trim());
                                }
                            } else if (title.includes(' vs ')) {
                                [homeTeam, awayTeam] = title.split(' vs ').map(t => t.trim());
                            } else if (title.includes(' و ')) {
                                [homeTeam, awayTeam] = title.split(' و ').map(t => t.trim());
                            }

                            // If title parsing failed, try href slug
                            if (!homeTeam || !awayTeam) {
                                try {
                                    const urlObj = new URL(href);
                                    let slug = decodeURIComponent(urlObj.pathname).replace(/^\/|\/$/g, '').split('/').pop();
                                    if (slug.includes('-و-')) {
                                        [homeTeam, awayTeam] = slug.split('-و-').map(t => t.replace(/-/g, ' ').trim());
                                    } else if (slug.includes('-vs-')) {
                                        [homeTeam, awayTeam] = slug.split('-vs-').map(t => t.replace(/-/g, ' ').trim());
                                    }
                                } catch (e) { }
                            }

                            if (!homeTeam || !awayTeam) return;

                            // Team logos
                            const teamLogos = card.querySelectorAll('img');
                            const homeLogo = teamLogos[0]?.src || '';
                            const awayLogo = teamLogos[1]?.src || '';

                            // Time - try multiple selectors
                            const timeEl = card.querySelector('#match-time') ||
                                card.querySelector('.match-time') ||
                                card.querySelector('[data-time]') ||
                                card.querySelector('.time');
                            const timeText = timeEl?.innerText?.trim() || '';

                            // ISO timestamp
                            const dateEl = card.querySelector('.date[data-start]') ||
                                card.querySelector('[data-start]');
                            const isoTimestamp = dateEl?.getAttribute('data-start') || '';

                            // Status
                            const statusEl = card.querySelector('.match-status') ||
                                card.querySelector('.status');
                            let status = 'NS';
                            if (statusEl) {
                                const statusText = statusEl.innerText?.trim() || '';
                                if (statusText.includes('جارية') || statusText.includes('مباشر') || statusText.includes('LIVE')) {
                                    status = 'LIVE';
                                } else if (statusText.includes('انتهت') || statusText.includes('FT')) {
                                    status = 'FT';
                                }
                            }

                            // Score
                            const scoreEl = card.querySelector('.match-score') ||
                                card.querySelector('.score');
                            const scoreText = scoreEl?.innerText?.trim() || '';

                            // League
                            let leagueName = 'بطولة عالمية';
                            const leagueEl = card.querySelector('.match-info li:nth-child(3)') ||
                                card.querySelector('.match-info li:last-child') ||
                                card.querySelector('.league') ||
                                card.querySelector('.championship');
                            if (leagueEl) {
                                leagueName = leagueEl.innerText?.trim() || leagueName;
                            }

                            // Channel
                            let channelName = '';
                            const channelEl = card.querySelector('.match-info li:first-child') ||
                                card.querySelector('.channel');
                            if (channelEl) {
                                channelName = channelEl.innerText?.trim() || '';
                            }

                            // Stream link
                            const streamLink = href;

                            // Transform URL to albaplayer format
                            let processedStreamLink = streamLink;
                            try {
                                const urlObj = new URL(streamLink);
                                const cleanPath = urlObj.pathname.replace(/^\/|\/$/g, '');
                                const channelSlug = cleanPath.split('/').pop();

                                if (channelSlug && channelSlug.length > 1) {
                                    processedStreamLink = `https://pl.kooralive.fit/albaplayer/${channelSlug}`;

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
                                        isoTimestamp,
                                        score: scoreText,
                                        streamLink: processedStreamLink
                                    });
                                } else {
                                    console.warn(`⚠️ Skipping match ${homeTeam} vs ${awayTeam}: No channel slug found.`);
                                }
                            } catch (e) {
                                console.warn('⚠️ Could not transform URL:', streamLink);
                            }
                        } catch (error) {
                            console.error('Error parsing match:', error.message);
                        }
                    });
                }

                // Strategy 2: If no matches found yet, try generic link extraction
                if (results.length === 0) {
                    console.log('Trying generic match link extraction...');

                    const allLinks = document.querySelectorAll('a[href*="/matches/"]');
                    allLinks.forEach((link, index) => {
                        try {
                            const href = link.href || '';
                            const title = link.getAttribute('title') || link.innerText?.trim() || '';

                            let homeTeam = '', awayTeam = '';
                            if (title.includes(' و ')) {
                                const matchPart = title.split(' مباراة ')?.pop()?.split(' كورة ')?.[0] || title;
                                [homeTeam, awayTeam] = matchPart.split(' و ').map(t => t.trim());
                            } else {
                                try {
                                    const slug = decodeURIComponent(new URL(href).pathname).replace(/^\/|\/$/g, '').split('/').pop();
                                    if (slug.includes('-و-')) {
                                        [homeTeam, awayTeam] = slug.split('-و-').map(t => t.replace(/-/g, ' ').trim());
                                    }
                                } catch (e) { }
                            }

                            if (homeTeam && awayTeam) {
                                let processedStreamLink = href;
                                try {
                                    const urlObj = new URL(href);
                                    const cleanPath = urlObj.pathname.replace(/^\/|\/$/g, '');
                                    const channelSlug = cleanPath.split('/').pop();
                                    if (channelSlug && channelSlug.length > 1) {
                                        processedStreamLink = `https://pl.kooralive.fit/albaplayer/${channelSlug}`;
                                    }
                                } catch (e) { }

                                results.push({
                                    id: 200000 + 1000 + index + 1,
                                    homeTeam,
                                    awayTeam,
                                    homeLogo: '',
                                    awayLogo: '',
                                    league: 'بطولة عالمية',
                                    channel: '',
                                    status: 'NS',
                                    time: '',
                                    isoTimestamp: '',
                                    score: '',
                                    streamLink: processedStreamLink
                                });
                            }
                        } catch (e) { }
                    });
                }

                return results;
            }, selectorFound);

            console.log(`✅ Successfully extracted ${matches.length} matches from Korah.live`);

            if (matches.length === 0) {
                console.log('⚠️ No matches found after extraction');
            } else {
                console.log('📋 Matches found:');
                matches.forEach(m => {
                    console.log(`  - ${m.homeTeam} vs ${m.awayTeam} (${m.league}) [${m.status}] ${m.channel ? '📺 ' + m.channel : ''}`);
                });
            }

            const processedMatches = this.processMatches(matches);

            await browser.close();
            return processedMatches;

        } catch (error) {
            console.error('❌ Korah.live scraping error:', error.message);
            console.error(error.stack);
            if (browser) await browser.close();
            return [];
        }
    }

    // Helper to create a simple hash from string
    generateMatchHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    processMatches(rawMatches) {
        return rawMatches.map(match => {
            let timestamp;

            if (match.time && match.time.includes(':')) {
                try {
                    const timeMatch = match.time.match(/(\d+):(\d+)/);
                    if (timeMatch) {
                        let hours = parseInt(timeMatch[1]);
                        const minutes = parseInt(timeMatch[2]);

                        // Create date object for TODAY with this time
                        const date = new Date();
                        date.setUTCHours(hours - 1, minutes, 0, 0); // Assume scraped time is GMT+1, so -1 to get GMT

                        timestamp = Math.floor(date.getTime() / 1000);
                    } else {
                        timestamp = Math.floor(Date.now() / 1000);
                    }
                } catch (e) {
                    timestamp = Math.floor(Date.now() / 1000);
                }
            } else {
                timestamp = Math.floor(Date.now() / 1000); // Fallback
            }

            // Generate Stable ID based on teams and date
            const dateStr = new Date().toISOString().split('T')[0];
            const uniqueString = `${dateStr}-${match.homeTeam}-${match.awayTeam}`;
            const stableId = this.generateMatchHash(uniqueString);

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

            // Format time for GMT display
            const gmtDate = new Date(timestamp * 1000);
            const gmtTimeStr = gmtDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

            return {
                id: stableId,
                date: gmtDate.toISOString(),
                timestamp: timestamp,
                status: match.status,
                time: gmtTimeStr,
                time_label: `${gmtTimeStr} GMT`,
                league: {
                    name: match.league,
                    country: this.getCountryFromLeague(match.league),
                    logo: this.getLeagueLogo(match.league)
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
                streams: [{
                    id: `stream_${channel}_${stableId}`,
                    source: 'korah',
                    quality: 'HD',
                    channel: channel,
                    url: match.streamLink,
                    priority: 1
                }]
            };
        });
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

    getCountryFromLeague(league) {
        if (league.includes('الإسباني') || league.includes('إسبانيا')) return 'Spain';
        if (league.includes('الإنجليزي') || league.includes('إنجلترا')) return 'England';
        if (league.includes('الإيطالي') || league.includes('إيطاليا')) return 'Italy';
        if (league.includes('الألماني') || league.includes('ألمانيا')) return 'Germany';
        if (league.includes('الفرنسي') || league.includes('فرنسا')) return 'France';
        if (league.includes('السعودي') || league.includes('السعودية')) return 'Saudi Arabia';
        if (league.includes('المصري') || league.includes('مصر')) return 'Egypt';
        if (league.includes('المغربي') || league.includes('المغرب')) return 'Morocco';
        if (league.includes('التونسي') || league.includes('تونس')) return 'Tunisia';
        if (league.includes('الجزائري') || league.includes('الجزائر')) return 'Algeria';
        if (league.includes('أبطال أوروبا') || league.includes('اوروبا')) return 'Europe';
        if (league.includes('أفريقيا')) return 'Africa';
        if (league.includes('آسيا') || league.includes('الخليج')) return 'Asia';
        if (league.includes('عالم') || league.includes('مونديال')) return 'World';
        return 'International';
    }

    getLeagueLogo(league) {
        const logos = {
            'إسباني': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/15.png&h=40&w=40',
            'إنجليزي': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/23.png&h=40&w=40',
            'إيطالي': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/12.png&h=40&w=40',
            'ألماني': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/10.png&h=40&w=40',
            'فرنسي': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/9.png&h=40&w=40',
            'سعودي': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/3007.png&h=40&w=40',
            'مصري': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/1237.png&h=40&w=40',
            'تونسي': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/1247.png&h=40&w=40',
            'مغربي': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/1039.png&h=40&w=40',
            'أبطال أوروبا': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/2.png&h=40&w=40',
            'اوروبا': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/2.png&h=40&w=40',
            'أبطال أفريقيا': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/1257.png&h=40&w=40',
            'أبطال آسيا': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/209.png&h=40&w=40',
            'الخليج': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/209.png&h=40&w=40',
            'عالم': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/4.png&h=40&w=40'
        };

        for (const [key, logo] of Object.entries(logos)) {
            if (league.includes(key)) return logo;
        }

        return 'https://cdn-icons-png.flaticon.com/512/1378/1378598.png';
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

        console.log(`✅ Saved ${matches.length} matches to ${outputPath}`);
    }
}

// Main execution
async function main() {
    try {
        const scraper = new KorahScraper();
        const matches = await scraper.scrapeMatches();

        if (matches.length === 0) {
            console.log('⚠️ No matches found - this might be due to:');
            console.log('  1. No matches scheduled for today');
            console.log('  2. Bot detection blocking the scraper');
            console.log('  3. Site structure changed');
        }

        await scraper.saveMatches(matches);

        console.log('🎉 Korah.live scraping completed!');
        console.log(`📊 Total matches saved: ${matches.length}`);
        process.exit(0);
    } catch (error) {
        console.error('💥 Fatal error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}

export default KorahScraper;
