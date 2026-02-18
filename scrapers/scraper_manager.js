import LiveKoraScraper from './livekora_scraper.js';
import KorahScraper from './korah_scraper.js';
import SiiirScraper from './siiir_scraper.js';
import KoraplusScraper from './koraplus_scraper.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateMatchArticle, saveArticle } from './ai_content.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ScraperManager {
    constructor() {
        this.liveKora = new LiveKoraScraper();
        this.korah = new KorahScraper();
        this.siiir = new SiiirScraper();
        this.koraplus = new KoraplusScraper();
    }

    async runFullUpdate() {
        console.log('🚀 Starting Multi-Source Scrape: LiveKora + Korah.live + Koraplus + Siiir.tv');

        // 1. Get matches from all primary sources
        const [liveKoraMatches, korahMatches, koraplusMatches] = await Promise.all([
            this.liveKora.scrapeMatches().catch(e => { console.error('LiveKora Error:', e.message); return []; }),
            this.korah.scrapeMatches().catch(e => { console.error('Korah Error:', e.message); return []; }),
            this.koraplus.scrapeMatches().catch(e => { console.error('Koraplus Error:', e.message); return []; })
        ]);

        console.log(`📊 Sources: LiveKora(${liveKoraMatches.length}), Korah.live(${korahMatches.length}), Koraplus(${koraplusMatches.length})`);

        // 2. Merge and deduplicate
        // First merge LiveKora and Korah
        let combinedMatches = this.deduplicateMatches(liveKoraMatches, korahMatches);

        // Then merge Koraplus into the result
        // We use a custom merge for Koraplus to also extract its stream links
        combinedMatches = this.mergeKoraplus(combinedMatches, koraplusMatches);

        console.log(`✅ Unified match list: ${combinedMatches.length} matches total.`);

        // 3. Get player links from Siiir.tv
        const siiirStreams = await this.siiir.scrapeMatches();

        // 4. Merge Siiir streams into unified matches
        const finalMatches = this.mergeSources(combinedMatches, siiirStreams);

        // 5. Generate AI Articles for matches
        await this.processArticles(finalMatches);

        // 6. Save results
        await this.saveMatches(finalMatches);

        // 7. Clean old data (Articles & News)
        await this.cleanOldArticles();

        return finalMatches;
    }

    async cleanOldArticles() {
        console.log('🧹 Cleaning old match articles...');
        const articlesDir = path.join(__dirname, '..', 'public', 'data', 'articles');
        try {
            const files = await fs.readdir(articlesDir);
            const now = Date.now();
            const expiry = 24 * 60 * 60 * 1000; // 24 hours

            for (const file of files) {
                if (!file.endsWith('.json')) continue;
                const filePath = path.join(articlesDir, file);
                const stats = await fs.stat(filePath);
                if (now - stats.mtimeMs > expiry) {
                    await fs.unlink(filePath);
                    console.log(`🗑️ Deleted old article: ${file}`);
                }
            }
        } catch (e) {
            console.warn('⚠️ No articles directory to clean yet.');
        }
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

    mergeKoraplus(primary, koraplus) {
        const unified = [...primary];
        const clean = (name) => name.toLowerCase()
            .replace(/نادي|ال|fc|united|city|real|atletico|stade|club|f\.c/g, '')
            .replace(/[^\w\u0621-\u064A\s]/g, '')
            .trim();

        koraplus.forEach(kMatch => {
            const kHome = clean(kMatch.home.name);
            const kAway = clean(kMatch.away.name);

            const pIndex = unified.findIndex(pMatch => {
                const pHome = clean(pMatch.home.name);
                const pAway = clean(pMatch.away.name);
                return (pHome === kHome && pAway === kAway) || (pHome === kAway && pAway === kHome);
            });

            if (pIndex === -1) {
                // Not found, add it
                unified.push(kMatch);
            } else {
                // Found, add Koraplus streams to existing match if they don't exist
                kMatch.streams.forEach(kStream => {
                    const streamExists = unified[pIndex].streams.some(s => s.url === kStream.url);
                    if (!streamExists) {
                        unified[pIndex].streams.push(kStream);
                        console.log(`📡 Added Koraplus stream to existing match: ${unified[pIndex].home.name} vs ${unified[pIndex].away.name}`);
                    }
                });

                // Update logos if primary is missing them or Koraplus has better ones
                if (!unified[pIndex].home.logo && kMatch.home.logo) unified[pIndex].home.logo = kMatch.home.logo;
                if (!unified[pIndex].away.logo && kMatch.away.logo) unified[pIndex].away.logo = kMatch.away.logo;
            }
        });

        return unified;
    }

    deduplicateMatches(primary, secondary) {
        const unified = [...primary];
        const clean = (name) => name.toLowerCase()
            .replace(/نادي|ال|fc|united|city|real|atletico|stade|club|f\.c/g, '')
            .replace(/[^\w\u0621-\u064A\s]/g, '')
            .trim();

        secondary.forEach(sMatch => {
            const sHome = clean(sMatch.home.name);
            const sAway = clean(sMatch.away.name);

            const pIndex = primary.findIndex(pMatch => {
                const pHome = clean(pMatch.home.name);
                const pAway = clean(pMatch.away.name);
                return (pHome === sHome && pAway === sAway) || (pHome === sAway && pAway === sHome);
            });

            if (pIndex === -1) {
                unified.push(sMatch);
            } else {
                // If it exists in both, keep the primary but prioritize Korah's high-accuracy logo
                if (sMatch.home.logo) unified[pIndex].home.logo = sMatch.home.logo;
                if (sMatch.away.logo) unified[pIndex].away.logo = sMatch.away.logo;
                console.log(`🖼️ Applied high-accuracy logo from Korah for ${unified[pIndex].home.name} vs ${unified[pIndex].away.name}`);
            }
        });

        return unified;
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
