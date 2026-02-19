import LiveKoraScraper from './livekora_scraper.js';
import KorahScraper from './korah_scraper.js';
import SiiirScraper from './siiir_scraper.js';
import KoraplusScraper from './koraplus_scraper.js';
import SportsOnlineScraper from './sportsonline_scraper.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateMatchArticle, saveArticle } from './ai_content.js';
import { healthCheck } from './health-check.js';

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

        const [liveKoraMatches, korahMatches, koraplusMatches, sportsonlineMatches] = await Promise.all([
            this.liveKora.scrapeMatches().catch((e) => { console.error('LiveKora Error:', e.message); return []; }),
            this.korah.scrapeMatches().catch((e) => { console.error('Korah Error:', e.message); return []; }),
            this.koraplus.scrapeMatches().catch((e) => { console.error('Koraplus Error:', e.message); return []; }),
            this.sportsonline.scrapeMatches().catch((e) => { console.error('SportsOnline Error:', e.message); return []; })
        ]);

        console.log(`📊 Sources: LiveKora(${liveKoraMatches.length}), Korah.live(${korahMatches.length}), Koraplus(${koraplusMatches.length}), SportsOnline(${sportsonlineMatches.length})`);

        let combinedMatches = this.deduplicateMatches(liveKoraMatches, korahMatches);
        combinedMatches = this.mergeKoraplus(combinedMatches, koraplusMatches);
        combinedMatches = this.mergeSportsOnline(combinedMatches, sportsonlineMatches);

        console.log(`✅ Unified match list: ${combinedMatches.length} matches total.`);

        const siiirStreams = await this.siiir.scrapeMatches().catch(() => []);
        const finalMatches = this.mergeSources(combinedMatches, siiirStreams);

        await this.saveMatches(finalMatches);
        return finalMatches;
    }

    async cleanOldArticles() {
        console.log('🧹 [DISABLED] Cleaning old match articles...');
        const articlesDir = path.join(__dirname, '..', 'public', 'data', 'articles');
        try {
            const files = await fs.readdir(articlesDir);
            const now = Date.now();
            const expiry = 24 * 60 * 60 * 1000;

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
        console.log(`🤖 [DISABLED] Generating AI Articles for ${matches.length} matches...`);
        for (const match of matches) {
            const article = await generateMatchArticle(match);
            if (article) {
                await saveArticle(match.id, article);
                console.log(`📝 Generated article for: ${match.home.name} vs ${match.away.name}`);
            }
        }
    }

    normalizeTeamName(name) {
        if (!name) return '';
        let value = String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        value = value
            .replace(/[\u064B-\u065F\u0670]/g, '')
            .replace(/[أإآ]/g, 'ا')
            .replace(/ى/g, 'ي')
            .replace(/ة/g, 'ه')
            .replace(/ؤ/g, 'و')
            .replace(/ئ/g, 'ي')
            .replace(/[^\w\u0600-\u06FF\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const arabicContainsAliases = [
            ['كلوب بروج', 'club brugge'],
            ['اتلتيكو مدريد', 'atletico madrid'],
            ['تلتيكو مدريد', 'atletico madrid'],
            ['اتالانتا', 'atalanta'],
            ['بودو جليمت', 'bodo glimt'],
            ['انتر ميلان', 'inter milan'],
            ['ميلان', 'ac milan'],
            ['كومو', 'como'],
            ['ليفانتي', 'levante'],
            ['فياريال', 'villarreal'],
            ['وولفرهامبتون', 'wolverhampton wanderers'],
            ['ارسنال', 'arsenal'],
            ['اولمبياكوس', 'olympiacos'],
            ['باير ليفركوزن', 'bayer leverkusen'],
            ['النصر', 'al nassr'],
            ['اركاداج', 'arkadag'],
            ['كارباغ اغدام', 'qarabag'],
            ['نيوكاسل يونايتد', 'newcastle united'],
            ['الاهلي', 'al ahly'],
            ['الزوراء', 'al zorra'],
            ['الوصل', 'al wasl'],
            ['الشباب', 'al shabab'],
            ['بوروسيا دورتموند', 'borussia dortmund']
        ];
        for (const [needle, canonical] of arabicContainsAliases) {
            if (value.includes(needle)) return canonical;
        }

        value = value
            .replace(/\batltico\b/g, 'atletico')
            .replace(/\binternazionale\b/g, 'inter milan')
            .replace(/\bbod\b/g, 'bodo')
            .replace(/\bqaraba\b/g, 'qarabag')
            .replace(/\bohiggins\b/g, 'ohiggins');

        const englishExactAliases = [
            [/^club brugge$/, 'club brugge'],
            [/^atletico madrid$/, 'atletico madrid'],
            [/^atalanta$/, 'atalanta'],
            [/^inter milan$/, 'inter milan'],
            [/^ac milan$/, 'ac milan'],
            [/^milan$/, 'ac milan'],
            [/^como$/, 'como'],
            [/^levante$/, 'levante'],
            [/^villarreal$/, 'villarreal'],
            [/^wolverhampton wanderers$/, 'wolverhampton wanderers'],
            [/^arsenal$/, 'arsenal'],
            [/^olympiakos piraeus$/, 'olympiacos'],
            [/^olympiacos$/, 'olympiacos'],
            [/^bayer leverkusen$/, 'bayer leverkusen'],
            [/^al nassr$/, 'al nassr'],
            [/^arkadag$/, 'arkadag'],
            [/^qarabag$/, 'qarabag'],
            [/^newcastle united$/, 'newcastle united'],
            [/^al ahly$/, 'al ahly'],
            [/^al ahli saudi$/, 'al ahly'],
            [/^borussia dortmund$/, 'borussia dortmund'],
            [/^bodo glimt$/, 'bodo glimt']
        ];
        for (const [pattern, canonical] of englishExactAliases) {
            if (pattern.test(value)) return canonical;
        }

        const stopwords = new Set([
            'club', 'fc', 'cf', 'sc', 'ac', 'real', 'united', 'city', 'stade',
            'نادي', 'ال', 'فريق'
        ]);
        return value.split(' ').filter((t) => t && !stopwords.has(t)).join(' ').trim();
    }

    isMatchPair(homeA, awayA, homeB, awayB) {
        const a1 = this.normalizeTeamName(homeA);
        const a2 = this.normalizeTeamName(awayA);
        const b1 = this.normalizeTeamName(homeB);
        const b2 = this.normalizeTeamName(awayB);
        if (!a1 || !a2 || !b1 || !b2) return false;
        return (a1 === b1 && a2 === b2) || (a1 === b2 && a2 === b1);
    }

    findMatchIndex(matches, home, away) {
        return matches.findIndex((m) => this.isMatchPair(m.home.name, m.away.name, home, away));
    }

    addUniqueStreams(targetMatch, streams) {
        if (!targetMatch.streams) targetMatch.streams = [];
        if (!Array.isArray(streams) || !streams.length) return;
        streams.forEach((stream) => {
            if (!stream || !stream.url) return;
            const exists = targetMatch.streams.some((s) => s.url === stream.url);
            if (!exists) targetMatch.streams.push(stream);
        });
    }

    shouldOverrideAhlyLogo(baseMatch, incomingMatch, side) {
        const teamName = side === 'home' ? baseMatch.home.name : baseMatch.away.name;
        const normalized = this.normalizeTeamName(teamName);
        if (normalized !== 'al ahly') return false;

        const league = String((baseMatch.league && baseMatch.league.name) || '').toLowerCase();
        const isAsianContext = league.includes('asia') || league.includes('آسيا') || league.includes('سعود');
        if (!isAsianContext) return false;

        const incomingLogo = side === 'home' ? incomingMatch.home.logo : incomingMatch.away.logo;
        return Boolean(incomingLogo);
    }

    mergeSources(matches, extraStreams) {
        console.log(`🔄 Merging ${extraStreams.length} Siiir streams into ${matches.length} matches...`);
        return matches.map((match) => {
            // Only reset score for matches that haven't started (NS)
            if (match.status === 'NS') {
                match.score = null;
            }

            const matchingSiiir = extraStreams.find((s) => {
                const title = String(s.title || '').toLowerCase();
                const home = this.normalizeTeamName(match.home.name);
                const away = this.normalizeTeamName(match.away.name);
                if (!home || !away) return false;
                return title.includes(home) || title.includes(away);
            });

            if (matchingSiiir && matchingSiiir.playerUrl) {
                this.addUniqueStreams(match, [{
                    id: `stream_siiir_${match.id}`,
                    source: 'siiir',
                    quality: 'VIP',
                    channel: 'VIP Server',
                    url: matchingSiiir.playerUrl,
                    priority: 2
                }]);
                console.log(`🔗 Linked Siiir stream to: ${match.home.name} vs ${match.away.name}`);
            }

            return match;
        });
    }

    mergeKoraplus(primary, koraplus) {
        const unified = [...primary];
        koraplus.forEach((kMatch) => {
            const pIndex = this.findMatchIndex(unified, kMatch.home.name, kMatch.away.name);
            if (pIndex === -1) {
                kMatch.score = null;
                unified.push(kMatch);
                return;
            }

            const base = unified[pIndex];
            this.addUniqueStreams(base, kMatch.streams);

            if (!base.home.logo && kMatch.home.logo) base.home.logo = kMatch.home.logo;
            if (!base.away.logo && kMatch.away.logo) base.away.logo = kMatch.away.logo;

            if (this.shouldOverrideAhlyLogo(base, kMatch, 'home')) base.home.logo = kMatch.home.logo;
            if (this.shouldOverrideAhlyLogo(base, kMatch, 'away')) base.away.logo = kMatch.away.logo;
        });
        return unified;
    }

    deduplicateMatches(primary, secondary) {
        const unified = [...primary];
        secondary.forEach((sMatch) => {
            const pIndex = this.findMatchIndex(unified, sMatch.home.name, sMatch.away.name);
            if (pIndex === -1) {
                sMatch.score = null;
                unified.push(sMatch);
                return;
            }

            if (sMatch.home.logo) unified[pIndex].home.logo = sMatch.home.logo;
            if (sMatch.away.logo) unified[pIndex].away.logo = sMatch.away.logo;
            this.addUniqueStreams(unified[pIndex], sMatch.streams);
        });
        return unified;
    }

    mergeSportsOnline(primary, sportsonline) {
        const unified = [...primary];
        sportsonline.forEach((sMatch) => {
            const pIndex = this.findMatchIndex(unified, sMatch.home.name, sMatch.away.name);
            if (pIndex === -1) return;
            this.addUniqueStreams(unified[pIndex], sMatch.streams);
            console.log(`📡 Added SportsOnline stream(s) to: ${unified[pIndex].home.name} vs ${unified[pIndex].away.name}`);
        });
        return unified;
    }

    async saveMatches(matches) {
        // Don't save if 0 matches (something went wrong)
        if (!matches || matches.length === 0) {
            console.warn('⚠️ Refusing to save 0 matches — keeping previous data intact.');
            return;
        }
        const data = {
            generated_at: new Date().toISOString(),
            count: matches.length,
            matches
        };
        const outputPath = path.join(__dirname, '..', 'public', 'data', 'matches.json');
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`✅ Multi-source update complete. Saved ${matches.length} matches.`);

        // Run health check after saving
        await healthCheck();
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const manager = new ScraperManager();
    manager.runFullUpdate().then(() => process.exit(0)).catch((err) => {
        console.error(err);
        process.exit(1);
    });
}

export default ScraperManager;
