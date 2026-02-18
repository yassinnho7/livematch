import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Add stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);

class SportsOnlineScraper {
    constructor() {
        this.baseUrl = 'https://sportsonline.st/prog.txt';
        this.baseDomain = 'https://sprtsonline.click';
    }

    async scrapeMatches() {
        console.log('🔍 Starting SportsOnline scraper...');

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
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

            console.log('📡 Fetching SportsOnline schedule...');

            // Fetch the prog.txt directly as text
            const response = await page.goto(this.baseUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            const text = await response.text();

            console.log(`📄 Got ${text.length} characters of schedule data`);

            const matches = this.parseSchedule(text);

            console.log(`✅ Extracted ${matches.length} matches from SportsOnline`);

            await browser.close();
            return this.processMatches(matches);

        } catch (error) {
            console.error('❌ SportsOnline scraping error:', error.message);
            if (browser) await browser.close();
            return [];
        }
    }

    parseSchedule(text) {
        const matches = [];
        const lines = text.split('\n');

        // Get current day of week
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 3 = Wednesday, 4 = Thursday
        const currentDayName = today.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();

        console.log(`📅 Current day: ${currentDayName}`);

        let currentSection = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Detect day section
            if (line.includes('WEDNESDAY') || line.includes('THURSDAY') ||
                line.includes('FRIDAY') || line.includes('SATURDAY') ||
                line.includes('SUNDAY') || line.includes('MONDAY') || line.includes('TUESDAY')) {
                currentSection = line.split(' ')[0].replace('*', '').toUpperCase();
                continue;
            }

            // Skip header lines and empty lines
            if (!line || line.includes('====') || line.includes('INFO:') ||
                line.includes('UPDATE') || line.includes('DOMAIN') ||
                line.includes('CHANNELS') || line.includes('24/7') ||
                line.includes('WOMEN')) {
                continue;
            }

            // Parse either:
            // 1) TIME | Team1 x Team2 | URL
            // 2) TIME   Team1 x Team2 | URL
            const matchLine = line.match(/(\d{1,2}:\d{2})\s*(?:\|\s*)?(.+?)\s+x\s+(.+?)\s*\|\s*(https?:\/\/[^\s]+)/i);

            if (matchLine && matchLine[1] && matchLine[2] && matchLine[3] && matchLine[4]) {
                const time = matchLine[1];
                const homeTeam = matchLine[2].trim();
                const awayTeam = matchLine[3].trim();
                const streamUrl = matchLine[4].trim();

                // Extract channel from URL
                const channelMatch = streamUrl.match(/\/(\w+)\.php/);
                const channel = channelMatch ? channelMatch[1] : 'SportsOnline';

                // Determine if this is the current day
                const isCurrentDay = currentSection === currentDayName;

                // Skip if it's not today or the schedule doesn't specify day
                if (!currentSection || isCurrentDay || currentSection === today.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()) {
                    matches.push({
                        homeTeam: this.cleanTeamName(homeTeam),
                        awayTeam: this.cleanTeamName(awayTeam),
                        time: time,
                        channel: channel,
                        streamUrl: streamUrl,
                        day: currentSection
                    });
                }
            }
        }

        return matches;
    }

    cleanTeamName(name) {
        // Remove extra spaces, emoji, and clean team name
        return name
            .replace(/[^\w\s\u0621-\u064A]/g, '') // Remove non-Arabic/non-English chars
            .replace(/\s+/g, ' ')
            .trim();
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
            // Parse time and create timestamp
            let timestamp = Math.floor(Date.now() / 1000);

            if (match.time && match.time.includes(':')) {
                try {
                    const [hours, minutes] = match.time.split(':').map(Number);
                    const date = new Date();
                    date.setUTCHours(hours, minutes, 0, 0);
                    timestamp = Math.floor(date.getTime() / 1000);
                } catch (e) { }
            }

            const dateStr = new Date().toISOString().split('T')[0];
            const uniqueString = `${dateStr}-${match.homeTeam}-${match.awayTeam}`;
            const stableId = this.generateMatchHash(uniqueString);

            // Determine status
            let status = 'NS';
            const now = Math.floor(Date.now() / 1000);
            if (timestamp - 3600 < now && timestamp + 7200 > now) {
                status = 'LIVE'; // Match is within 1 hour before or 2 hours after
            }

            return {
                id: stableId,
                date: new Date(timestamp * 1000).toISOString(),
                timestamp: timestamp,
                status: status,
                time: match.time,
                time_label: `${match.time} GMT`,
                league: {
                    name: 'International',
                    country: 'International',
                    logo: 'https://cdn-icons-png.flaticon.com/512/1378/1378598.png'
                },
                home: {
                    name: match.homeTeam,
                    logo: ''
                },
                away: {
                    name: match.awayTeam,
                    logo: ''
                },
                score: null,
                streams: [{
                    id: `stream_sportsonline_${stableId}`,
                    source: 'sportsonline',
                    quality: 'HD',
                    channel: match.channel || 'SportsOnline',
                    url: match.streamUrl,
                    priority: 3 // Lower priority than Siiir
                }]
            };
        });
    }

    async saveMatches(matches) {
        const data = {
            generated_at: new Date().toISOString(),
            count: matches.length,
            matches: matches
        };
        const outputPath = path.join(__dirname_local, '..', 'public', 'data', 'sportsonline_matches.json');
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`✅ Saved ${matches.length} matches to ${outputPath}`);
    }
}

// Main execution
async function main() {
    try {
        const scraper = new SportsOnlineScraper();
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

export default SportsOnlineScraper;
