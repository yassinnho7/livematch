const SimpleStreamScraper = require('./simple_stream_scraper');
const FallbackManager = require('./fallback_manager');

class ScraperManager {
    constructor() {
        this.scraper = new SimpleStreamScraper();
        this.fallback = new FallbackManager();
    }

    /**
     * جلب روابط البث لجميع المباريات
     */
    async scrapeAllMatches(matches) {
        const results = [];

        for (const match of matches) {
            console.log(`🔍 Scraping: ${match.home.name} vs ${match.away.name}`);

            const streams = await this.scraper.scrapeMatch(match);

            // إضافة للـ fallback manager
            this.fallback.addStreams(match.id, streams);

            results.push({
                ...match,
                streams: streams,
                broadcast_info: this.getBroadcastInfo(match.league.name)
            });
        }

        return results;
    }

    /**
     * معلومات البث حسب الدوري
     */
    getBroadcastInfo(leagueName) {
        const broadcastMap = {
            'Premier League': {
                primary_channel: 'beIN Sports 1',
                alternative_channels: ['beIN Sports 2', 'SSC 1']
            },
            'La Liga': {
                primary_channel: 'beIN Sports 1',
                alternative_channels: ['beIN Sports 2']
            },
            'Serie A': {
                primary_channel: 'beIN Sports 3',
                alternative_channels: ['SSC 2']
            },
            'Bundesliga': {
                primary_channel: 'beIN Sports 3',
                alternative_channels: []
            },
            'Ligue 1': {
                primary_channel: 'beIN Sports 3',
                alternative_channels: []
            },
            'UEFA Champions League': {
                primary_channel: 'beIN Sports 1',
                alternative_channels: ['beIN Sports 2', 'beIN Sports 3']
            },
            'UEFA Europa League': {
                primary_channel: 'beIN Sports 4',
                alternative_channels: ['beIN Sports 5']
            }
        };

        return broadcastMap[leagueName] || {
            primary_channel: 'beIN Sports',
            alternative_channels: []
        };
    }

    /**
     * حفظ النتائج في ملف JSON
     */
    async saveResults(matches, outputPath) {
        const fs = require('fs').promises;

        const data = {
            generated_at: new Date().toISOString(),
            count: matches.length,
            matches: matches
        };

        await fs.writeFile(
            outputPath,
            JSON.stringify(data, null, 2),
            'utf8'
        );

        console.log(`✅ Saved ${matches.length} matches to ${outputPath}`);
    }

    /**
     * الحصول على إحصائيات
     */
    getStats() {
        return this.fallback.getStats();
    }
}

module.exports = ScraperManager;
