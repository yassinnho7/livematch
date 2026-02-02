import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs/promises';

// Add stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

class SiiirScraper {
    constructor() {
        this.baseUrl = 'https://w5.siiir.tv/koora-live/';
    }

    async scrapeMatches() {
        console.log('🔍 Starting Siiir.tv scraper (Network Sniffer Mode)...');

        let browser;
        try {
            browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-blink-features=AutomationControlled'
                ]
            });

            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            console.log('📡 Navigating to Siiir.tv match list...');
            await page.goto(this.baseUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            // Extract match links
            const matchLinks = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a.AY_Match'));
                return links.map(a => ({
                    url: a.href,
                    title: a.innerText.trim()
                })).filter(item => item.url && item.url.includes('match-'));
            });

            console.log(`✅ Found ${matchLinks.length} match links on Siiir.tv`);

            const results = [];

            for (const matchInfo of matchLinks.slice(0, 10)) { // Limit to 10 for safety
                console.log(`🕵️ Investigating: ${matchInfo.title}`);
                const matchResult = await this.extractPlayerLink(browser, matchInfo.url);
                if (matchResult && matchResult.playerUrl) {
                    results.push({
                        title: matchInfo.title,
                        playerUrl: matchResult.playerUrl
                    });
                }
            }

            await browser.close();
            return results;

        } catch (error) {
            console.error('❌ Siiir Scraping error:', error.message);
            if (browser) await browser.close();
            return [];
        }
    }

    async extractPlayerLink(browser, matchUrl) {
        const page = await browser.newPage();
        let playerUrl = null;

        try {
            // Enable request interception to sniff the player URL
            await page.setRequestInterception(true);
            page.on('request', request => {
                const url = request.url();
                if (url.includes('playerv2.php') && url.includes('key=')) {
                    playerUrl = url;
                    console.log(`🎯 Captured Player URL: ${playerUrl.substring(0, 50)}...`);
                }
                request.continue();
            });

            await page.goto(matchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

            // Wait a bit for the key to be generated and request to be made
            await new Promise(resolve => setTimeout(resolve, 3000));

            return { playerUrl };

        } catch (e) {
            console.error(`⚠️ Failed to extract from ${matchUrl}: ${e.message}`);
            return null;
        } finally {
            await page.close();
        }
    }
}

export default SiiirScraper;
