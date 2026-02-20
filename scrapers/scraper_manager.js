import KoraOnlineScraper from './koraonline_scraper.js';
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
        this.koraonline = new KoraOnlineScraper();
        this.liveKora = new LiveKoraScraper();
        this.korah = new KorahScraper();
        this.siiir = new SiiirScraper();
        this.koraplus = new KoraplusScraper();
        this.sportsonline = new SportsOnlineScraper();
    }

    async runFullUpdate() {
        console.log('ðŸš€ Starting Multi-Source Scrape: Kora-Online.cc (Primary) + Korah.live (Secondary) + Koraplus + LiveKora + SportsOnline + Siiir.tv');

        // First, get KoraOnline as PRIMARY source (better logos), Korah as secondary
        const [koraonlineMatches, korahMatches, koraplusMatches, liveKoraMatches, sportsonlineMatches] = await Promise.all([
            this.koraonline.scrapeMatches().catch((e) => { console.error('KoraOnline Error:', e.message); return []; }),
            this.korah.scrapeMatches().catch((e) => { console.error('Korah Error:', e.message); return []; }),
            this.koraplus.scrapeMatches().catch((e) => { console.error('Koraplus Error:', e.message); return []; }),
            this.liveKora.scrapeMatches().catch((e) => { console.error('LiveKora Error:', e.message); return []; }),
            this.sportsonline.scrapeMatches().catch((e) => { console.error('SportsOnline Error:', e.message); return []; })
        ]);

        console.log(`ðŸ“Š Sources: KoraOnline(${koraonlineMatches.length}), Korah.live(${korahMatches.length}), Koraplus(${koraplusMatches.length}), LiveKora(${liveKoraMatches.length}), SportsOnline(${sportsonlineMatches.length})`);

        // Use KoraOnline as primary source for match metadata
        let combinedMatches = [...koraonlineMatches];

        // Enrich and add unique matches from Korah.live (now secondary)
        // Korah can provide valid extra fixtures even when stream links are unavailable.
        combinedMatches = this.addUniqueMatches(combinedMatches, korahMatches, {
            includeWithoutStreams: true,
            sourceName: 'Korah.live'
        });

        // Enrich matches from other sources.
        combinedMatches = this.mergeSportsOnline(combinedMatches, koraplusMatches, 'Koraplus');
        combinedMatches = this.mergeSportsOnline(combinedMatches, liveKoraMatches, 'LiveKora');

        // Koraplus/LiveKora are used as enrichment sources only.
        // Do not add unique fixtures from them to avoid carrying stale previous-day matches.

        // SportsOnline remains streams-only (no new matches from this source).
        combinedMatches = this.mergeSportsOnline(combinedMatches, sportsonlineMatches, 'SportsOnline');

        console.log(`âœ… Unified match list: ${combinedMatches.length} matches total.`);

        const siiirStreams = await this.siiir.scrapeMatches().catch(() => []);
        const mergedMatches = this.mergeAllStreams(combinedMatches, siiirStreams);
        const finalMatches = this.filterOutFinishedAndStaleMatches(mergedMatches);

        await this.saveMatches(finalMatches);
        return finalMatches;
    }

    async cleanOldArticles() {
        console.log('ðŸ§¹ [DISABLED] Cleaning old match articles...');
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
                    console.log(`ðŸ—‘ï¸ Deleted old article: ${file}`);
                }
            }
        } catch (e) {
            console.warn('âš ï¸ No articles directory to clean yet.');
        }
    }

    async processArticles(matches) {
        console.log(`ðŸ¤– [DISABLED] Generating AI Articles for ${matches.length} matches...`);
        for (const match of matches) {
            const article = await generateMatchArticle(match);
            if (article) {
                await saveArticle(match.id, article);
                console.log(`ðŸ“ Generated article for: ${match.home.name} vs ${match.away.name}`);
            }
        }
    }

    normalizeTeamName(name) {
        if (!name) return '';
        let value = String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        value = value
            .replace(/[\u064B-\u065F\u0670]/g, '')
            .replace(/[Ø£Ø¥Ø¢]/g, 'Ø§')
            .replace(/Ù‰/g, 'ÙŠ')
            .replace(/Ø©/g, 'Ù‡')
            .replace(/Ø¤/g, 'Ùˆ')
            .replace(/Ø¦/g, 'ÙŠ')
            .replace(/[\u0623\u0625\u0622]/g, '\u0627')
            .replace(/\u0649/g, '\u064A')
            .replace(/\u0629/g, '\u0647')
            .replace(/\u0624/g, '\u0648')
            .replace(/\u0626/g, '\u064A')
            .replace(/[^\w\u0600-\u06FF\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const arabicContainsAliases = [
            ['ÙƒÙ„ÙˆØ¨ Ø¨Ø±ÙˆØ¬', 'club brugge'],
            ['Ø§ØªÙ„ØªÙŠÙƒÙˆ Ù…Ø¯Ø±ÙŠØ¯', 'atletico madrid'],
            ['ØªÙ„ØªÙŠÙƒÙˆ Ù…Ø¯Ø±ÙŠØ¯', 'atletico madrid'],
            ['Ø§ØªØ§Ù„Ø§Ù†ØªØ§', 'atalanta'],
            ['Ø¨ÙˆØ¯Ùˆ Ø¬Ù„ÙŠÙ…Øª', 'bodo glimt'],
            ['Ø§Ù†ØªØ± Ù…ÙŠÙ„Ø§Ù†', 'inter milan'],
            ['Ù…ÙŠÙ„Ø§Ù†', 'ac milan'],
            ['ÙƒÙˆÙ…Ùˆ', 'como'],
            ['Ù„ÙŠÙØ§Ù†ØªÙŠ', 'levante'],
            ['ÙÙŠØ§Ø±ÙŠØ§Ù„', 'villarreal'],
            ['ÙˆÙˆÙ„ÙØ±Ù‡Ø§Ù…Ø¨ØªÙˆÙ†', 'wolverhampton wanderers'],
            ['Ø§Ø±Ø³Ù†Ø§Ù„', 'arsenal'],
            ['Ø§ÙˆÙ„Ù…Ø¨ÙŠØ§ÙƒÙˆØ³', 'olympiacos'],
            ['Ø¨Ø§ÙŠØ± Ù„ÙŠÙØ±ÙƒÙˆØ²Ù†', 'bayer leverkusen'],
            ['Ø§Ù„Ù†ØµØ±', 'al nassr'],
            ['Ø§Ø±ÙƒØ§Ø¯Ø§Ø¬', 'arkadag'],
            ['ÙƒØ§Ø±Ø¨Ø§Øº Ø§ØºØ¯Ø§Ù…', 'qarabag'],
            ['Ù†ÙŠÙˆÙƒØ§Ø³Ù„ ÙŠÙˆÙ†Ø§ÙŠØªØ¯', 'newcastle united'],
            ['Ø§Ù„Ø§Ù‡Ù„ÙŠ', 'al ahly'],
            ['Ø§Ù„Ø²ÙˆØ±Ø§Ø¡', 'al zorra'],
            ['Ø§Ù„ÙˆØµÙ„', 'al wasl'],
            ['Ø§Ù„Ø´Ø¨Ø§Ø¨', 'al shabab'],
            ['Ø¨ÙˆØ±ÙˆØ³ÙŠØ§ Ø¯ÙˆØ±ØªÙ…ÙˆÙ†Ø¯', 'borussia dortmund'],
            ['\u0628\u0631\u0627\u0646 \u0628\u064A\u0631\u063A\u0646', 'brann'],
            ['\u0628\u0648\u0644\u0648\u0646\u064A\u0627', 'bologna'],
            ['\u0633\u064A\u0644\u062A\u0627 \u0641\u064A\u062C\u0648', 'celta vigo'],
            ['\u0628\u0627\u0648\u0643 \u0633\u0627\u0644\u0648\u0646\u064A\u0643\u0627', 'paok'],
            ['\u062F\u064A\u0646\u0627\u0645\u0648 \u0632\u063A\u0631\u0628', 'dinamo zagreb'],
            ['\u0623\u062A\u0644\u062A\u064A\u0643 \u0628\u0644\u0628\u0627\u0648', 'athletic bilbao'],
            ['\u0627\u062A\u0644\u062A\u064A\u0643 \u0628\u0644\u0628\u0627\u0648', 'athletic bilbao'],
            ['\u0625\u0644\u062A\u0634\u064A', 'elche'],
            ['\u0627\u0644\u062A\u0634\u064A', 'elche'],
            ['\u0628\u0644\u0627\u0643\u0628\u064A\u0631\u0646 \u0631\u0648\u0641\u0631\u0632', 'blackburn rovers'],
            ['\u0628\u0631\u064A\u0633\u062A\u0648\u0646 \u0646\u0648\u0631\u062B \u0625\u0646\u062F', 'preston north end'],
            ['\u0628\u0631\u064A\u0633\u062A\u0648\u0646 \u0646\u0648\u0631\u062B \u0627\u0646\u062F', 'preston north end'],
            ['\u0623\u0648\u0644\u0645\u0628\u064A\u0643 \u0645\u0627\u0631\u0633\u064A\u0644\u064A\u0627', 'marseille'],
            ['\u0628\u0631\u064A\u0633\u062A', 'brest'],
            ['\u0645\u0627\u064A\u0646\u0632 05', 'mainz 05'],
            ['\u0647\u0627\u0645\u0628\u0648\u0631\u062C', 'hamburger sv']
        ];
        for (const [needle, canonical] of arabicContainsAliases) {
            if (value.includes(needle)) return canonical;
        }

        value = value
            .replace(/\batltico\b/g, 'atletico')
            .replace(/\binternazionale\b/g, 'inter milan')
            .replace(/\bbod\b/g, 'bodo')
            .replace(/\bqaraba\b/g, 'qarabag')
            .replace(/\bohiggins\b/g, 'ohiggins')
            .replace(/\bathletic club de bilbao\b/g, 'athletic bilbao')
            .replace(/\bathletic club\b/g, 'athletic bilbao')
            .replace(/\bolympique marseille\b/g, 'marseille');

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
            [/^bodo glimt$/, 'bodo glimt'],
            [/^athletic club$/, 'athletic bilbao'],
            [/^athletic bilbao$/, 'athletic bilbao'],
            [/^athletic club de bilbao$/, 'athletic bilbao'],
            [/^elche$/, 'elche'],
            [/^olympique marseille$/, 'marseille'],
            [/^marseille$/, 'marseille'],
            [/^blackburn rovers$/, 'blackburn rovers'],
            [/^preston north end$/, 'preston north end'],
            [/^mainz 05$/, 'mainz 05'],
            [/^hamburger sv$/, 'hamburger sv'],
            [/^brest$/, 'brest']
        ];
        for (const [pattern, canonical] of englishExactAliases) {
            if (pattern.test(value)) return canonical;
        }

        const stopwords = new Set([
            'club', 'fc', 'cf', 'sc', 'ac', 'real', 'united', 'city', 'stade',
            'Ù†Ø§Ø¯ÙŠ', 'Ø§Ù„', 'ÙØ±ÙŠÙ‚',
            '\u0646\u0627\u062F\u064A', '\u0627\u0644', '\u0641\u0631\u064A\u0642'
        ]);
        return value.split(' ').filter((t) => t && !stopwords.has(t)).join(' ').trim();
    }

    transliterateArabicToLatin(text) {
        const map = {
            '\u0627': 'a', '\u0623': 'a', '\u0625': 'i', '\u0622': 'a', '\u0628': 'b', '\u062A': 't', '\u062B': 'th',
            '\u062C': 'j', '\u062D': 'h', '\u062E': 'kh', '\u062F': 'd', '\u0630': 'dh', '\u0631': 'r', '\u0632': 'z',
            '\u0633': 's', '\u0634': 'sh', '\u0635': 's', '\u0636': 'd', '\u0637': 't', '\u0638': 'z', '\u0639': 'a',
            '\u063A': 'gh', '\u0641': 'f', '\u0642': 'q', '\u0643': 'k', '\u0644': 'l', '\u0645': 'm', '\u0646': 'n',
            '\u0647': 'h', '\u0648': 'o', '\u0624': 'o', '\u064A': 'i', '\u0649': 'a', '\u0626': 'i', '\u0629': 'h'
        };
        return String(text || '')
            .split('')
            .map((ch) => map[ch] || ch)
            .join('')
            .replace(/\s+/g, ' ')
            .trim();
    }

    levenshteinDistance(a, b) {
        const s = String(a || '');
        const t = String(b || '');
        const m = s.length;
        const n = t.length;
        if (!m) return n;
        if (!n) return m;

        const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                const cost = s[i - 1] === t[j - 1] ? 0 : 1;
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost
                );
            }
        }
        return dp[m][n];
    }

    wordsSimilar(w1, w2) {
        const a = String(w1 || '').trim().toLowerCase();
        const b = String(w2 || '').trim().toLowerCase();
        if (!a || !b) return false;
        if (a === b) return true;
        if ((a.length >= 4 && b.startsWith(a)) || (b.length >= 4 && a.startsWith(b))) return true;
        const dist = this.levenshteinDistance(a, b);
        const limit = Math.max(1, Math.floor(Math.min(a.length, b.length) * 0.4));
        return dist <= limit;
    }

    areTeamNamesEquivalent(nameA, nameB) {
        const a = this.normalizeTeamName(nameA);
        const b = this.normalizeTeamName(nameB);
        if (!a || !b) return false;
        if (a === b) return true;

        const variantsA = [a, this.transliterateArabicToLatin(a)].filter(Boolean);
        const variantsB = [b, this.transliterateArabicToLatin(b)].filter(Boolean);

        for (const va of variantsA) {
            for (const vb of variantsB) {
                if (!va || !vb) continue;
                if (va === vb) return true;

                const wordsA = va.split(' ').filter((w) => w.length >= 3);
                const wordsB = vb.split(' ').filter((w) => w.length >= 3);
                if (!wordsA.length || !wordsB.length) continue;

                let hits = 0;
                for (const wa of wordsA) {
                    if (wordsB.some((wb) => this.wordsSimilar(wa, wb))) {
                        hits++;
                    }
                }

                const coverage = hits / Math.min(wordsA.length, wordsB.length);
                if (coverage >= 0.6) return true;
            }
        }

        return false;
    }

    isMatchPair(homeA, awayA, homeB, awayB) {
        const direct = this.areTeamNamesEquivalent(homeA, homeB) && this.areTeamNamesEquivalent(awayA, awayB);
        const swapped = this.areTeamNamesEquivalent(homeA, awayB) && this.areTeamNamesEquivalent(awayA, homeB);
        return direct || swapped;
    }

    findMatchIndex(matches, home, away) {
        return matches.findIndex((m) => this.isMatchPair(m.home.name, m.away.name, home, away));
    }

    findMatchIndexByKickoffAndSingleTeam(matches, incomingMatch) {
        if (!incomingMatch || !incomingMatch.home?.name || !incomingMatch.away?.name) return -1;
        const incomingTs = Number(incomingMatch.timestamp);
        if (!Number.isFinite(incomingTs) || incomingTs <= 0) return -1;

        const maxDelta = 20 * 60;
        let bestIndex = -1;
        let bestScore = 0;

        for (let i = 0; i < matches.length; i++) {
            const candidate = matches[i];
            const candidateTs = Number(candidate.timestamp);
            if (!Number.isFinite(candidateTs) || candidateTs <= 0) continue;
            if (Math.abs(candidateTs - incomingTs) > maxDelta) continue;

            let score = 0;
            if (this.areTeamNamesEquivalent(candidate.home?.name, incomingMatch.home.name) ||
                this.areTeamNamesEquivalent(candidate.home?.name, incomingMatch.away.name)) score++;
            if (this.areTeamNamesEquivalent(candidate.away?.name, incomingMatch.home.name) ||
                this.areTeamNamesEquivalent(candidate.away?.name, incomingMatch.away.name)) score++;

            if (score > bestScore) {
                bestScore = score;
                bestIndex = i;
            }
        }

        return bestScore >= 1 ? bestIndex : -1;
    }

    titleMatchesMatch(title, match) {
        const normalizedTitle = this.normalizeTeamName(title);
        const home = this.normalizeTeamName(match.home.name);
        const away = this.normalizeTeamName(match.away.name);
        if (!normalizedTitle || !home || !away) return false;
        return normalizedTitle.includes(home) && normalizedTitle.includes(away);
    }

    addUniqueStreams(targetMatch, streams) {
        if (!targetMatch.streams) targetMatch.streams = [];
        if (!Array.isArray(streams) || !streams.length) return;

        // Use normalized URL-based deduplication to avoid duplicates from different sources
        const normalizeStreamUrl = (url) => String(url || '').trim().replace(/\/+$/, '');
        const existingUrls = new Set(targetMatch.streams.map((s) => normalizeStreamUrl(s.url)));

        streams.forEach((stream) => {
            if (!stream || !stream.url) return;
            const normalizedUrl = normalizeStreamUrl(stream.url);
            if (!normalizedUrl) return;
            if (this.isBlockedPlaceholderStream(normalizedUrl)) return;
            // Only add if URL doesn't exist
            if (!existingUrls.has(normalizedUrl)) {
                existingUrls.add(normalizedUrl);
                targetMatch.streams.push(stream);
            }
        });
    }

    getUsableStreams(streams) {
        if (!Array.isArray(streams)) return [];
        return streams.filter((stream) => {
            if (!stream || !stream.url) return false;
            const normalized = String(stream.url).trim().replace(/\/+$/, '');
            if (!normalized) return false;
            return !this.isBlockedPlaceholderStream(normalized);
        });
    }

    isBlockedPlaceholderStream(url) {
        const value = String(url || '').toLowerCase();
        return value.includes('koraplus.blog/kooracity') || value.includes('koraplus.blog/koora-live');
    }

    getStatusPriority(status) {
        const value = String(status || '').toUpperCase();
        if (value === 'FT') return 3;
        if (value === 'LIVE') return 2;
        return 1;
    }

    reconcileMatchState(targetMatch, incomingMatch) {
        if (!targetMatch || !incomingMatch) return;

        const targetPriority = this.getStatusPriority(targetMatch.status);
        const incomingPriority = this.getStatusPriority(incomingMatch.status);

        if (incomingPriority > targetPriority) {
            targetMatch.status = incomingMatch.status;

            if (incomingMatch.score) {
                targetMatch.score = incomingMatch.score;
            }

            if (Number.isFinite(Number(incomingMatch.timestamp)) && Number(incomingMatch.timestamp) > 0) {
                targetMatch.timestamp = Number(incomingMatch.timestamp);
                if (incomingMatch.date) targetMatch.date = incomingMatch.date;
                if (incomingMatch.time) targetMatch.time = incomingMatch.time;
                if (incomingMatch.time_label) targetMatch.time_label = incomingMatch.time_label;
            }
        }
    }

    // Add unique matches from a source (that don't exist in primary)
    addUniqueMatches(primaryMatches, newMatches, options = {}) {
        const includeWithoutStreams = Boolean(options.includeWithoutStreams);
        const sourceName = String(options.sourceName || 'source');
        const unified = [...primaryMatches];
        const now = Math.floor(Date.now() / 1000);

        newMatches.forEach((newMatch) => {
            const existingIndex = this.findMatchIndex(unified, newMatch.home.name, newMatch.away.name);

            // Only process matches that have at least one stream
            const usableStreams = this.getUsableStreams(newMatch.streams);
            const hasStreams = usableStreams.length > 0;
            const isFinished = String(newMatch.status || '').toUpperCase() === 'FT';
            const timestamp = Number(newMatch.timestamp);
            const isStale = Number.isFinite(timestamp) && timestamp > 0 && timestamp < (now - (6 * 60 * 60));

            if (existingIndex === -1) {
                // Match doesn't exist - add if valid and either has streams or source is trusted for fixtures.
                if ((hasStreams || includeWithoutStreams) && !isFinished && !isStale) {
                    newMatch.streams = usableStreams;
                    newMatch.score = null;
                    unified.push(newMatch);
                    if (hasStreams) {
                        console.log(`➕ Added new match with stream from ${sourceName}: ${newMatch.home.name} vs ${newMatch.away.name}`);
                    } else {
                        console.log(`➕ Added fixture without stream from ${sourceName}: ${newMatch.home.name} vs ${newMatch.away.name}`);
                    }
                }
            } else {
                // Match exists - merge streams only
                const existingMatch = unified[existingIndex];
                this.addUniqueStreams(existingMatch, usableStreams);
                this.reconcileMatchState(existingMatch, newMatch);

                // Also merge logos if missing
                if (!existingMatch.home.logo && newMatch.home.logo) {
                    existingMatch.home.logo = newMatch.home.logo;
                }
                if (!existingMatch.away.logo && newMatch.away.logo) {
                    existingMatch.away.logo = newMatch.away.logo;
                }
            }
        });

        return unified;
    }

    filterOutFinishedAndStaleMatches(matches) {
        const now = Math.floor(Date.now() / 1000);
        const maxPastSeconds = 6 * 60 * 60;
        const staleNotStartedSeconds = 90 * 60;
        return matches.filter((match) => {
            const status = String(match.status || '').toUpperCase();
            if (status === 'FT') return false;

            const ts = Number(match.timestamp);
            if (!Number.isFinite(ts) || ts <= 0) return true;
            if (status === 'NS' && ts < (now - staleNotStartedSeconds)) return false;
            return ts >= (now - maxPastSeconds);
        });
    }

    // Merge all streams from all sources with proper deduplication
    mergeAllStreams(matches, siiirStreams) {
        console.log(`ðŸ”„ Merging streams from all sources (including Siiir.tv)...`);

        return matches.map((match) => {
            // Reset score for matches that haven't started (NS)
            if (match.status === 'NS') {
                match.score = null;
            }

            // Find and add Siiir streams
            const matchingSiiir = siiirStreams.find((s) => {
                const title = String(s.title || '');
                return this.titleMatchesMatch(title, match);
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
                console.log(`ðŸ”— Linked Siiir stream to: ${match.home.name} vs ${match.away.name}`);
            }

            // Sort streams by priority
            if (match.streams && match.streams.length > 0) {
                match.streams.sort((a, b) => (a.priority || 999) - (b.priority || 999));
            }

            return match;
        });
    }

    shouldOverrideAhlyLogo(baseMatch, incomingMatch, side) {
        const teamName = side === 'home' ? baseMatch.home.name : baseMatch.away.name;
        const normalized = this.normalizeTeamName(teamName);
        if (normalized !== 'al ahly') return false;

        const league = String((baseMatch.league && baseMatch.league.name) || '').toLowerCase();
        const isAsianContext = league.includes('asia') || league.includes('Ø¢Ø³ÙŠØ§') || league.includes('Ø³Ø¹ÙˆØ¯');
        if (!isAsianContext) return false;

        const incomingLogo = side === 'home' ? incomingMatch.home.logo : incomingMatch.away.logo;
        return Boolean(incomingLogo);
    }

    mergeSources(matches, extraStreams) {
        console.log(`ðŸ”„ Merging ${extraStreams.length} Siiir streams into ${matches.length} matches...`);
        return matches.map((match) => {
            // Only reset score for matches that haven't started (NS)
            if (match.status === 'NS') {
                match.score = null;
            }

            const matchingSiiir = extraStreams.find((s) => {
                const title = String(s.title || '');
                return this.titleMatchesMatch(title, match);
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
                console.log(`ðŸ”— Linked Siiir stream to: ${match.home.name} vs ${match.away.name}`);
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

    mergeSportsOnline(primary, sportsonline, sourceName = 'SportsOnline') {
        const unified = [...primary];
        sportsonline.forEach((sMatch) => {
            let pIndex = this.findMatchIndex(unified, sMatch.home.name, sMatch.away.name);
            if (pIndex === -1) {
                pIndex = this.findMatchIndexByKickoffAndSingleTeam(unified, sMatch);
            }
            if (pIndex === -1) return;
            this.addUniqueStreams(unified[pIndex], sMatch.streams);
            console.log(`ðŸ“¡ Added ${sourceName} stream(s) to: ${unified[pIndex].home.name} vs ${unified[pIndex].away.name}`);
        });
        return unified;
    }

    async saveMatches(matches) {
        // Don't save if 0 matches (something went wrong)
        if (!matches || matches.length === 0) {
            console.warn('âš ï¸ Refusing to save 0 matches â€” keeping previous data intact.');
            return;
        }
        const data = {
            generated_at: new Date().toISOString(),
            count: matches.length,
            matches
        };
        const outputPath = path.join(__dirname, '..', 'public', 'data', 'matches.json');
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`âœ… Multi-source update complete. Saved ${matches.length} matches.`);

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


