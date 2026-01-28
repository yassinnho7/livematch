const BaseScraper = require('./base_scraper');

class SimpleStreamScraper extends BaseScraper {
    constructor() {
        super('simple-stream', '');

        // قائمة المواقع الموثوقة
        this.trustedSites = [
            {
                name: 'yalashots',
                baseUrl: 'https://www.yalashots.com',
                playerPattern: '/albaplayer/'
            },
            {
                name: 'yalla-shoot1',
                baseUrl: 'https://www.yalla-shoot1.net',
                playerPattern: '/albaplayer/'
            },
            {
                name: 'pandalive',
                baseUrl: 'https://p1.pandalive.live',
                playerPattern: '/albaplayer/'
            },
            {
                name: 'bein4kora',
                baseUrl: 'https://plir.bein4kora.com',
                playerPattern: '/albaplayer/'
            }
        ];

        // قنوات معروفة
        this.knownChannels = [
            'bein1', 'bein2', 'bein3', 'bein4', 'bein5',
            'ssc1', 'ssc2', 'ssc3', 'ssc4', 'ssc5',
            'ssc-1', 'ssc-2', 'ssc-3',
            'sssc', 'thmanya1', 'thmanya2',
            'starz', 's-1', 's-2', 's-3'
        ];
    }

    async scrapeMatch(match) {
        const streams = [];
        const channels = this.getChannelsForLeague(match.league.name);

        // جرب كل موقع مع كل قناة
        for (const site of this.trustedSites) {
            for (const channel of channels) {
                // جرب أنماط مختلفة
                const patterns = [
                    `${site.baseUrl}${site.playerPattern}${channel}/`,
                    `${site.baseUrl}${site.playerPattern}${channel.replace('-', '')}/`,
                    `${site.baseUrl}${site.playerPattern}${channel.replace('ssc', 'sssc')}/`
                ];

                for (const url of patterns) {
                    const stream = this.createStream(
                        url,
                        channel,
                        'HD',
                        streams.length + 1
                    );

                    stream.source = site.name;
                    streams.push(stream);
                }
            }
        }

        // إزالة المكررات
        const unique = streams.filter((stream, index, self) =>
            index === self.findIndex(s => s.url === stream.url)
        );

        return unique.slice(0, 10); // أفضل 10 روابط
    }

    /**
     * جلب روابط بث لقناة معينة
     */
    async getStreamForChannel(channelName) {
        const streams = [];

        for (const site of this.trustedSites) {
            const url = `${site.baseUrl}${site.playerPattern}${channelName}/`;
            streams.push({
                url: url,
                source: site.name,
                channel: channelName,
                priority: streams.length + 1
            });
        }

        return streams;
    }
}

module.exports = SimpleStreamScraper;
