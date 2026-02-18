import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

// Add stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

class LiveKoraScraper {
    constructor() {
        this.baseUrl = process.env.SOURCE_URL || 'https://www.livekora.vip/';
    }

    async scrapeMatches() {
        console.log('🔍 Starting LiveKora scraper with stealth mode...');

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
            page.on('console', msg => console.log('🌐 BROWSER:', msg.text()));
            page.on('error', err => console.log('❌ BROWSER ERROR:', err.message));

            // Set realistic user agent
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Set extra headers
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            });

            console.log('📡 Navigating to LiveKora...');
            await page.goto(this.baseUrl, {
                waitUntil: 'networkidle2',
                timeout: 90000
            });

            console.log('⏳ Waiting for content to load...');

            // Wait for match cards OR check if we got blocked
            try {
                await page.waitForSelector('a[title*="vs"]', { timeout: 30000 });
                console.log('✅ Match cards found!');
            } catch (e) {
                console.log('⚠️ No match cards found - checking page content...');

                // Save screenshot for debugging
                try {
                    await page.screenshot({ path: 'debug_screenshot.png', fullPage: true });
                    console.log('📸 Saved debug screenshot');
                } catch (err) {
                    console.log('Could not save screenshot');
                }

                // Check if we got blocked
                const pageContent = await page.content();
                console.log('📄 Page Title:', await page.title());

                if (pageContent.includes('cloudflare') || pageContent.includes('captcha') || pageContent.includes('blocked')) {
                    console.log('🚫 Bot detection detected! Page was blocked.');
                    // Save page source for debugging
                    await fs.writeFile('debug_source.html', pageContent);
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

            console.log('📊 Extracting match data...');
            const matches = await page.evaluate(() => {
                const matchCards = document.querySelectorAll('a[title*="vs"]');
                console.log(`Found ${matchCards.length} match cards`);

                const results = [];

                matchCards.forEach((card, index) => {
                    try {
                        const title = card.getAttribute('title');
                        if (!title || !title.includes(' vs ')) return;

                        const [homeTeam, awayTeam] = title.split(' vs ').map(t => t.trim());

                        const teamLogos = card.querySelectorAll('.team-logo img');
                        const homeLogo = teamLogos[0]?.src || '';
                        const awayLogo = teamLogos[1]?.src || '';

                        const timeEl = card.querySelector('#match-time');
                        const timeText = timeEl?.innerText?.trim() || '';

                        const dateEl = card.querySelector('.date[data-start]');
                        const isoTimestamp = dateEl?.getAttribute('data-start') || '';

                        const statusEl = card.querySelector('.match-status');
                        let status = 'NS';
                        if (statusEl) {
                            const statusText = statusEl.innerText?.trim() || '';
                            if (statusText.includes('جارية') || statusText.includes('مباشر')) {
                                status = 'LIVE';
                            } else if (statusText.includes('انتهت')) {
                                status = 'FT';
                            }
                        }

                        const scoreEl = card.querySelector('.match-score');
                        const scoreText = scoreEl?.innerText?.trim() || '';

                        let leagueName = 'بطولة عالمية';
                        const leagueEl = card.querySelector('.match-info li:nth-child(3)') ||
                            card.querySelector('.match-info li:last-child');
                        if (leagueEl) {
                            leagueName = leagueEl.innerText?.trim() || leagueName;
                        }

                        const streamLink = card.href || '';

                        // تحويل رابط المقال إلى رابط المشغل (albaplayer) بشكل صارم
                        // الهدف: https://pl.kooralive.fit/albaplayer/el-watania-2
                        let processedStreamLink = streamLink;
                        try {
                            const urlObj = new URL(streamLink);
                            // حذف أي slashes زائدة من المسار
                            const cleanPath = urlObj.pathname.replace(/^\/|\/$/g, '');
                            // اسم القناة هو آخر جزء في المسار
                            const channelSlug = cleanPath.split('/').pop();

                            // بناء الرابط الجديد بالشكل المطلوب تماماً
                            if (channelSlug && channelSlug.length > 1) {
                                processedStreamLink = `${urlObj.origin}/albaplayer/${channelSlug}`;

                                results.push({
                                    id: 100000 + index + 1,
                                    homeTeam,
                                    awayTeam,
                                    homeLogo,
                                    awayLogo,
                                    league: leagueName,
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

                return results;
            });

            console.log(`✅ Successfully extracted ${matches.length} matches`);

            if (matches.length === 0) {
                console.log('⚠️ No matches found after extraction');
            } else {
                console.log('📋 Matches found:');
                matches.forEach(m => {
                    console.log(`  - ${m.homeTeam} vs ${m.awayTeam} (${m.league}) [${m.status}]`);
                });
            }

            const processedMatches = this.processMatches(matches);

            await browser.close();
            return processedMatches;

        } catch (error) {
            console.error('❌ Scraping error:', error.message);
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
            // GMT Correction: The site is likely GMT+1 (e.g. 18:30). We want GMT (17:30).
            // So we need to parse the time and subtract 1 hour.

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

            // Generate Stable ID based on teams and date (Day-Month-Year)
            // This ensures the ID remains the same for the entire day, preventing duplicate notifications
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
                time: gmtTimeStr, // Now converted to GMT
                time_label: `${gmtTimeStr} GMT`, // Explicit label
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
                    source: 'livekora',
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
        if (league.includes('أبطال أوروبا')) return 'Europe';
        if (league.includes('أفريقيا')) return 'Africa';
        if (league.includes('آسيا')) return 'Asia';
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
            'أبطال أوروبا': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/2.png&h=40&w=40',
            'أبطال أفريقيا': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/1257.png&h=40&w=40',
            'أبطال آسيا': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/209.png&h=40&w=40',
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

        // Use path from project root
        const path = await import('path');
        const { fileURLToPath } = await import('url');
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const outputPath = path.join(__dirname, '..', 'public', 'data', 'matches.json');

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
        // تم إزالة فترة الهدوء - السكرابير يعمل 24/24
        const scraper = new LiveKoraScraper();
        const matches = await scraper.scrapeMatches();

        if (matches.length === 0) {
            console.log('⚠️ No matches found - this might be due to:');
            console.log('  1. No matches scheduled for today');
            console.log('  2. Bot detection blocking the scraper');
            console.log('  3. Site structure changed');
        }

        await scraper.saveMatches(matches);

        console.log('🎉 Scraping completed!');
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

export default LiveKoraScraper;
