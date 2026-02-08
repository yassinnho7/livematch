import LiveKoraScraper from './livekora_scraper.js';
import SiiirScraper from './siiir_scraper.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateMatchArticle, saveArticle } from './ai_content.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ScraperManager {
    constructor() {
        this.liveKora = new LiveKoraScraper();
        this.siiir = new SiiirScraper();
    }

    async runFullUpdate() {
        console.log('🚀 Starting Multi-Source Scrape: LiveKora + Siiir.tv');

        // 1. Get matches from LiveKora (Base data)
        const koraMatches = await this.liveKora.scrapeMatches();

        // 2. Get player links from Siiir.tv
        const siiirStreams = await this.siiir.scrapeMatches();

        // 3. Merge Siiir streams into LiveKora matches
        const finalMatches = this.mergeSources(koraMatches, siiirStreams);

        // 4. Generate AI Articles for matches
        await this.processArticles(finalMatches);

        // 5. Save results
        await this.saveMatches(finalMatches);

        return finalMatches;
    }

    async processArticles(matches) {
        console.log(`🤖 Generating AI Articles for ${matches.length} matches...`);
        for (const match of matches) {
            // Only generate for future matches or matches without articles
            const article = await generateMatchArticle(match);
            if (article) {
                await saveArticle(match.id, article);
                console.log(`📝 Generated article for: ${match.home.name} vs ${match.away.name}`);
            }
        }
    }

    mergeSources(matches, extraStreams) {
        console.log(`🔄 Merging ${extraStreams.length} Siiir streams into ${matches.length} matches...`);

        return matches.map(match => {
            // Find matching stream from Siiir
            const matchingSiiir = extraStreams.find(s => {
                const title = s.title.toLowerCase();
                const clean = (name) => name.toLowerCase()
                    .replace(/نادي|ال|fc|united|city|real|atletico|stade|club|f\.c/g, '')
                    .replace(/[^\w\u0621-\u064A\s]/g, '') // Remove symbols
                    .trim();

                const home = clean(match.home.name);
                const away = clean(match.away.name);

                // Multi-keyword check: if any significant word from team name is in title
                const hasMatch = (teamStr) => {
                    const words = teamStr.split(/\s+/).filter(w => w.length > 2);
                    return words.some(w => title.includes(w));
                };

                return (home.length > 2 && hasMatch(home)) || (away.length > 2 && hasMatch(away));
            });

            if (matchingSiiir) {
                console.log(`🔗 Linked Siiir stream to: ${match.home.name} vs ${match.away.name}`);

                // Add as Server 2 (VIP)
                match.streams.push({
                    id: `stream_siiir_${match.id}`,
                    source: 'siiir',
                    quality: 'VIP',
                    channel: 'VIP Server',
                    url: matchingSiiir.playerUrl,
                    priority: 2
                });
            }

            return match;
        });
    }

    async saveMatches(matches) {
        const data = {
            generated_at: new Date().toISOString(),
            count: matches.length,
            matches: matches
        };

        const outputPath = path.join(__dirname, '..', 'public', 'data', 'matches.json');
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`✅ Multi-source update complete. Saved ${matches.length} matches.`);
    }
}

// If running directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const manager = new ScraperManager();
    manager.runFullUpdate().then(() => process.exit(0)).catch(err => {
        console.error(err);
        process.exit(1);
    });
}

export default ScraperManager;
