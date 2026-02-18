import LiveKoraScraper from './livekora_scraper.js';
import KorahScraper from './korah_scraper.js';
import SiiirScraper from './siiir_scraper.js';
import KoraplusScraper from './koraplus_scraper.js';
import SportsOnlineScraper from './sportsonline_scraper.js';
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
        this.sportsonline = new SportsOnlineScraper();
    }

    async runFullUpdate() {
        console.log('🚀 Starting Multi-Source Scrape: LiveKora + Korah.live + Koraplus + Siiir.tv + SportsOnline');

        // 1. Get matches from all primary sources
        const [liveKoraMatches, korahMatches, koraplusMatches, sportsonlineMatches] = await Promise.all([
            this.liveKora.scrapeMatches().catch(e => { console.error('LiveKora Error:', e.message); return []; }),
            this.korah.scrapeMatches().catch(e => { console.error('Korah Error:', e.message); return []; }),
            this.koraplus.scrapeMatches().catch(e => { console.error('Koraplus Error:', e.message); return []; }),
            this.sportsonline.scrapeMatches().catch(e => { console.error('SportsOnline Error:', e.message); return []; })
        ]);

        console.log(`📊 Sources: LiveKora(${liveKoraMatches.length}), Korah.live(${korahMatches.length}), Koraplus(${koraplusMatches.length}), SportsOnline(${sportsonlineMatches.length})`);

        // 2. Merge and deduplicate - Priority: Korah for logos, collect all streams
        let combinedMatches = this.deduplicateMatches(liveKoraMatches, korahMatches);
        combinedMatches = this.mergeKoraplus(combinedMatches, koraplusMatches);
        combinedMatches = this.mergeSportsOnline(combinedMatches, sportsonlineMatches);

        console.log(`✅ Unified match list: ${combinedMatches.length} matches total.`);

        // 3. Get player links from Siiir.tv (VIP fast streams)
        const siiirStreams = await this.siiir.scrapeMatches();

        // 4. Merge Siiir streams into unified matches
        const finalMatches = this.mergeSources(combinedMatches, siiirStreams);

        // 5. Generate AI Articles for matches (DISABLED)
        // await this.processArticles(finalMatches);

        // 6. Save results
        await this.saveMatches(finalMatches);

        // 7. Clean old data (Articles & News) (DISABLED)
        // await this.cleanOldArticles();

        return finalMatches;
    }

    // DISABLED - Articles generation disabled
    async cleanOldArticles() {
        console.log('🧹 [DISABLED] Cleaning old match articles...');
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

    // DISABLED - Articles generation disabled
    async processArticles(matches) {
        console.log(`🤖 [DISABLED] Generating AI Articles for ${matches.length} matches...`);
        for (const match of matches) {
            const article = await generateMatchArticle(match);
            if (article) {
                await saveArticle(match.id, article);
                console.log(`📝 Generated article for: ${match.home.name} vs ${match.away.name}`);
            }
        }
    }

    /**
     * Merge Siiir VIP streams into matches
     * - Removes score data to avoid conflicts between sources
     * - Adds Siiir streams as VIP quality
     */
    mergeSources(matches, extraStreams) {
        console.log(`🔄 Merging ${extraStreams.length} Siiir streams into ${matches.length} matches...`);

        return matches.map(match => {
            // Remove score data to avoid conflicts between sources (different sources show different scores)
            match.score = null;

            const matchingSiiir = extraStreams.find(s => {
                const title = s.title.toLowerCase();
                const clean = (name) => name.toLowerCase()
                    .replace(/نادي|lon|fc|united|city|real|atletico|stade|club|f\.c/g, '')
                    .replace(/[^\w\u0621-\u064A\s]/g, '')
                    .trim();

                const home = clean(match.home.name);
                const away = clean(match.away.name);

                const hasMatch = (teamStr) => {
                    const words = teamStr.split(/\s+/).filter(w => w.length > 2);
                    return words.some(w => title.includes(w));
                };

                return (home.length > 2 && hasMatch(home)) || (away.length > 2 && hasMatch(away));
            });

            if (matchingSiiir) {
                console.log(`🔗 Linked Siiir stream to: ${match.home.name} vs ${match.away.name}`);

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

    /**
     * Merge Koraplus streams into matches
     * - Collects all streams from Koraplus without duplicates
     * - Prioritizes Korah for logos (better accuracy)
     */
    mergeKoraplus(primary, koraplus) {
        const unified = [...primary];
        const clean = (name) => name.toLowerCase()
            .replace(/نادي|lon|fc|united|city|real|atletico|stade|club|f\.c/g, '')
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
                // Match not found in primary sources - add it
                // Remove score from Koraplus to avoid conflicts
                kMatch.score = null;
                unified.push(kMatch);
            } else {
                // Match exists - merge streams without duplicates
                kMatch.streams.forEach(kStream => {
                    const streamExists = unified[pIndex].streams.some(s => s.url === kStream.url);
                    if (!streamExists) {
                        unified[pIndex].streams.push(kStream);
                        console.log(`📡 Added Koraplus stream to existing match: ${unified[pIndex].home.name} vs ${unified[pIndex].away.name}`);
                    }
                });

                // Use Korah logos if available (better accuracy), otherwise use Koraplus
                if (!unified[pIndex].home.logo && kMatch.home.logo) unified[pIndex].home.logo = kMatch.home.logo;
                if (!unified[pIndex].away.logo && kMatch.away.logo) unified[pIndex].away.logo = kMatch.away.logo;
            }
        });

        return unified;
    }

    /**
     * Deduplicate matches between sources
     * - Prioritizes Korah for logos (better accuracy)
     * - Keeps all unique matches from both sources
     */
    deduplicateMatches(primary, secondary) {
        const unified = [...primary];
        const clean = (name) => name.toLowerCase()
            .replace(/نادي|lon|fc|united|city|real|atletico|stade|club|f\.c/g, '')
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
                // Match not in primary - add it (remove score to avoid conflicts)
                sMatch.score = null;
                unified.push(sMatch);
            } else {
                // Match exists in both - prioritize Korah logos
                if (sMatch.home.logo) unified[pIndex].home.logo = sMatch.home.logo;
                if (sMatch.away.logo) unified[pIndex].away.logo = sMatch.away.logo;
                console.log(`🖼️ Applied high-accuracy logo from Korah for ${unified[pIndex].home.name} vs ${unified[pIndex].away.name}`);
            }
        });

        return unified;
    }

    /**
     * Merge SportsOnline streams into matches
     * - Adds SportsOnline streams without duplicates
     * - Lower priority than other sources
     */
    mergeSportsOnline(primary, sportsonline) {
        const unified = [...primary];
        const clean = (name) => name.toLowerCase()
            .replace(/نادي|lon|fc|united|city|real|atletico|stade|club|f\.c/g, '')
            .replace(/[^\w\u0621-\u064A\s]/g, '')
            .trim();

        sportsonline.forEach(sMatch => {
            const sHome = clean(sMatch.home.name);
            const sAway = clean(sMatch.away.name);

            const pIndex = unified.findIndex(pMatch => {
                const pHome = clean(pMatch.home.name);
                const pAway = clean(pMatch.away.name);
                return (pHome === sHome && pAway === sAway) || (pHome === sAway && pAway === sHome);
            });

            if (pIndex === -1) {
                // Match not found in primary sources - add it as new match
                sMatch.score = null;
                unified.push(sMatch);
                console.log(`🆕 Added new match from SportsOnline: ${sMatch.home.name} vs ${sMatch.away.name}`);
            } else {
                // Match exists - add SportsOnline stream without duplicates
                sMatch.streams.forEach(sStream => {
                    const streamExists = unified[pIndex].streams.some(existing => existing.url === sStream.url);
                    if (!streamExists) {
                        unified[pIndex].streams.push(sStream);
                        console.log(`📡 Added SportsOnline stream to: ${unified[pIndex].home.name} vs ${unified[pIndex].away.name}`);
                    }
                });
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
