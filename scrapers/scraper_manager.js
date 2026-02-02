import LiveKoraScraper from './livekora_scraper.js';
import SiiirScraper from './siiir_scraper.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

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

        // 4. Save results
        await this.saveMatches(finalMatches);

        return finalMatches;
    }

    mergeSources(matches, extraStreams) {
        console.log(`🔄 Merging ${extraStreams.length} Siiir streams into ${matches.length} matches...`);

        return matches.map(match => {
            // Find matching stream from Siiir
            const matchingSiiir = extraStreams.find(s => {
                const title = s.title.toLowerCase();
                const home = match.home.name.toLowerCase();
                const away = match.away.name.toLowerCase();

                // Match if both team names are found in the Siiir title
                return title.includes(home) || title.includes(away) ||
                    home.includes(title.split('vs')[0]?.trim()) ||
                    away.includes(title.split('vs')[1]?.trim());
            });

            if (matchingSiiir) {
                console.log(`🔗 Linked Siiir stream to: ${match.home.name} vs ${match.away.name}`);

                // Add as Server 2
                match.streams.push({
                    id: `stream_siiir_${match.id}`,
                    source: 'siiir',
                    quality: 'Premium',
                    channel: 'Server 2',
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
