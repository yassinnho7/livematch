// Base Scraper Class
class BaseScraper {
  constructor(name, baseUrl) {
    this.name = name;
    this.baseUrl = baseUrl;
    this.timeout = 10000;
  }

  async scrapeMatch(match) {
    throw new Error('scrapeMatch() must be implemented');
  }

  async verifyStream(url) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(this.timeout)
      });
      return response.ok;
    } catch (error) {
      console.error(`[${this.name}] Failed to verify: ${url}`, error.message);
      return false;
    }
  }

  getChannelsForLeague(leagueName) {
    const channelMap = {
      'Premier League': ['bein1', 'bein2', 'ssc1'],
      'La Liga': ['bein1', 'bein2'],
      'Serie A': ['bein3', 'ssc2'],
      'Bundesliga': ['bein3'],
      'Ligue 1': ['bein3'],
      'UEFA Champions League': ['bein1', 'bein2', 'bein3'],
      'UEFA Europa League': ['bein4', 'bein5']
    };

    return channelMap[leagueName] || ['bein1', 'bein2'];
  }

  createStream(url, channel, quality = 'HD', priority = 1) {
    return {
      id: `${this.name}_${channel}_${Date.now()}`,
      source: this.name,
      quality: quality,
      channel: channel,
      url: url,
      priority: priority,
      verified: false,
      last_checked: new Date().toISOString()
    };
  }
}

module.exports = BaseScraper;
