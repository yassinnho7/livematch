import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

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
                        // Search for iframeUrl in scripts
                        const scripts = Array.from(document.querySelectorAll('script'));
                        for (const script of scripts) {
                            const content = script.innerText;
                            const match = content.match(/var\s+iframeUrl\s*=\s*['"]([^'"]+)['"]/);
                            if (match && match[1]) {
                                return match[1];
                            }
                        }

                        // Fallback to searching for iframe src in placeholder
                        const iframe = document.querySelector('#iframe-placeholder iframe');
                        if (iframe && iframe.src) return iframe.src;

                        return null;
                    });

                    if (playerUrl) {
                        console.log(`✨ Found player: ${playerUrl}`);
                        match.playerUrl = playerUrl;
                        finalMatches.push(match);
                    } else {
                        console.log(`⚠️ No player URL found for this match.`);
                        // Even without player URL, we might want to keep the match info for metadata
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

    generateMatchHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    processMatches(rawMatches) {
        return rawMatches.map((match, index) => {
            let timestamp;
            let timeLabel = '';

            // User says site is GMT+2. Subtract 2 to get GMT.
            if (match.time && match.time.includes(':')) {
                try {
                    const timeMatch = match.time.match(/(\d+):?(\d+)?\s*(AM|PM)/i);
                    if (timeMatch) {
                        let hours = parseInt(timeMatch[1]);
                        const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
                        const ampm = timeMatch[3].toUpperCase();

                        if (ampm === 'PM' && hours < 12) hours += 12;
                        if (ampm === 'AM' && hours === 12) hours = 0;

                        const date = new Date();
                        // GMT+2 to UTC -> hours - 2
                        date.setUTCHours(hours - 2, minutes, 0, 0);
                        timestamp = Math.floor(date.getTime() / 1000);

                        timeLabel = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
                    }
                } catch (e) {
                    timestamp = Math.floor(Date.now() / 1000);
                }
            }

            if (!timestamp) timestamp = Math.floor(Date.now() / 1000);
            if (!timeLabel) {
                const d = new Date(timestamp * 1000);
                timeLabel = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
            }

            const dateStr = new Date().toISOString().split('T')[0];
            const uniqueString = `${dateStr}-${match.homeTeam}-${match.awayTeam}`;
            const stableId = this.generateMatchHash(uniqueString);

            // Determine status
            let status = 'NS';
            if (match.statusText) {
                if (match.statusText.includes('جارية') || match.statusText.includes('بث مباشر')) status = 'LIVE';
                if (match.statusText.includes('انتهت')) status = 'FT';
            }

            const streams = [];
            if (match.playerUrl) {
                streams.push({
                    id: `stream_koraplus_${stableId}`,
                    source: 'koraplus',
                    quality: 'HD',
                    channel: match.channel || 'Koraplus',
                    url: match.playerUrl,
                    priority: 1
                });
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
                score: null,
                streams: streams
            };
        });
    }

    getCountryFromLeague(league) {
        if (!league) return 'International';
        if (league.includes('الإسباني') || league.includes('إسبانيا')) return 'Spain';
        if (league.includes('الإنجليزي') || league.includes('إنجلترا')) return 'England';
        if (league.includes('الإيطالي') || league.includes('إيطاليا')) return 'Italy';
        if (league.includes('السعودي') || league.includes('السعودية')) return 'Saudi Arabia';
        if (league.includes('المصري') || league.includes('مصر')) return 'Egypt';
        if (league.includes('المغربي') || league.includes('المغرب')) return 'Morocco';
        if (league.includes('أبطال أوروبا') || league.includes('اوروبا')) return 'Europe';
        if (league.includes('آسيا') || league.includes('الخليج')) return 'Asia';
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
            'أبطال أوروبا': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/2.png&h=40&w=40',
            'أبطال آسيا': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/209.png&h=40&w=40'
        };

        for (const [key, logo] of Object.entries(logos)) {
            if (league && league.includes(key)) return logo;
        }
        return 'https://cdn-icons-png.flaticon.com/512/1378/1378598.png';
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
