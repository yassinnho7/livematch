// ==================== Configuration ====================
const CONFIG = {
    matchesJsonUrl: 'data/matches.json',
    updateInterval: 60000, // Update every minute
    importantLeagues: [
        'Premier League',
        'La Liga',
        'Serie A',
        'Bundesliga',
        'Ligue 1',
        'UEFA Champions League',
        'UEFA Europa League',
        'FIFA World Cup'
    ]
};

// ==================== State Management ====================
let matchesData = null;
let updateTimer = null;

// ==================== Utility Functions ====================

/**
 * Format timestamp to local time
 */
function formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

/**
 * Format date
 */
function formatDate(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    });
}

/**
 * Get match status
 */
function getMatchStatus(statusCode, timestamp) {
    const now = Math.floor(Date.now() / 1000);

    // Live statuses
    if (['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(statusCode)) {
        return { text: 'مباشر الآن', class: 'status-live' };
    }

    // Finished statuses
    if (['FT', 'AET', 'PEN', 'FT'].includes(statusCode)) {
        return { text: 'انتهت', class: 'status-finished' };
    }

    // Not started
    if (timestamp > now) {
        return { text: 'لم تبدأ', class: 'status-not-started' };
    }

    return { text: 'قريباً', class: 'status-not-started' };
}

/**
 * Get channel name (placeholder - can be enhanced with scraping)
 */
function getChannelName(league) {
    const channels = {
        'Premier League': 'beIN Sports',
        'La Liga': 'beIN Sports',
        'Serie A': 'beIN Sports',
        'Bundesliga': 'beIN Sports',
        'Ligue 1': 'beIN Sports',
        'UEFA Champions League': 'beIN Sports',
        'UEFA Europa League': 'beIN Sports'
    };

    return channels[league] || 'قنوات متعددة';
}

/**
 * Check if match is important
 */
function isImportantMatch(league) {
    return CONFIG.importantLeagues.includes(league);
}

/**
 * Group matches by league
 */
function groupMatchesByLeague(matches) {
    const grouped = {};

    matches.forEach(match => {
        const leagueName = match.league.name;
        if (!grouped[leagueName]) {
            grouped[leagueName] = {
                league: match.league,
                matches: []
            };
        }
        grouped[leagueName].matches.push(match);
    });

    // Sort leagues: important first, then alphabetically
    return Object.entries(grouped).sort((a, b) => {
        const aImportant = isImportantMatch(a[0]);
        const bImportant = isImportantMatch(b[0]);

        if (aImportant && !bImportant) return -1;
        if (!aImportant && bImportant) return 1;
        return a[0].localeCompare(b[0], 'ar');
    });
}

// ==================== Rendering Functions ====================

/**
 * Create match card HTML
 */
function createMatchCard(match) {
    const status = getMatchStatus(match.status, match.timestamp);
    const time = formatTime(match.timestamp);
    const date = formatDate(match.timestamp);
    const channel = getChannelName(match.league.name);
    const isLive = status.class === 'status-live';
    const canWatch = isLive || match.timestamp <= Math.floor(Date.now() / 1000);

    return `
        <div class="match-card" data-match-id="${match.id}">
            <div class="match-header">
                <div class="match-time">
                    <span class="time">${time}</span>
                    <span class="date">${date}</span>
                </div>
                <div class="match-status ${status.class}">
                    ${status.text}
                </div>
            </div>
            
            <div class="match-teams">
                <div class="team">
                    <img src="${match.home.logo}" alt="${match.home.name}" class="team-logo" loading="lazy">
                    <span class="team-name">${match.home.name}</span>
                </div>
                
                <div class="vs">VS</div>
                
                <div class="team">
                    <img src="${match.away.logo}" alt="${match.away.name}" class="team-logo" loading="lazy">
                    <span class="team-name">${match.away.name}</span>
                </div>
            </div>
            
            <div class="match-footer">
                <div class="channel-info">
                    <span class="channel-icon">📺</span>
                    <span>${channel}</span>
                </div>
                ${canWatch ?
            `<a href="watch.html?match=${match.id}" class="watch-btn">
                        ${isLive ? '🔴 شاهد الآن' : '▶️ شاهد المباراة'}
                    </a>` :
            `<button class="watch-btn disabled" disabled>لم تبدأ بعد</button>`
        }
            </div>
        </div>
    `;
}

/**
 * Create league section HTML
 */
function createLeagueSection(leagueName, leagueData) {
    const matchesHtml = leagueData.matches
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(match => createMatchCard(match))
        .join('');

    return `
        <div class="league-section">
            <div class="league-header">
                <img src="${leagueData.league.logo}" alt="${leagueName}" class="league-logo" loading="lazy">
                <div class="league-info">
                    <h3>${leagueName}</h3>
                    <p>${leagueData.league.country} • ${leagueData.matches.length} مباراة</p>
                </div>
            </div>
            <div class="matches-grid">
                ${matchesHtml}
            </div>
        </div>
    `;
}

/**
 * Render all matches
 */
function renderMatches(data) {
    const container = document.getElementById('matches-container');
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const noMatches = document.getElementById('no-matches');

    // Hide all states
    loading.style.display = 'none';
    error.style.display = 'none';
    noMatches.style.display = 'none';
    container.style.display = 'none';

    if (!data || !data.matches || data.matches.length === 0) {
        noMatches.style.display = 'block';
        return;
    }

    // Group and render matches
    const groupedMatches = groupMatchesByLeague(data.matches);
    const html = groupedMatches
        .map(([leagueName, leagueData]) => createLeagueSection(leagueName, leagueData))
        .join('');

    container.innerHTML = html;
    container.style.display = 'block';

    // Add animation delay to cards
    const cards = document.querySelectorAll('.match-card');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.05}s`;
    });
}

/**
 * Show error state
 */
function showError() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    document.getElementById('matches-container').style.display = 'none';
    document.getElementById('no-matches').style.display = 'none';
}

// ==================== Data Fetching ====================

/**
 * Fetch matches data
 */
async function fetchMatches() {
    try {
        // Add cache busting parameter
        const url = `${CONFIG.matchesJsonUrl}?t=${Date.now()}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        matchesData = data;
        renderMatches(data);

        console.log(`✅ Loaded ${data.matches?.length || 0} matches`);
        console.log(`📅 Generated at: ${data.generated_at}`);

    } catch (error) {
        console.error('❌ Error fetching matches:', error);
        showError();
    }
}

/**
 * Update match statuses
 */
function updateMatchStatuses() {
    if (!matchesData) return;

    const now = Math.floor(Date.now() / 1000);
    const cards = document.querySelectorAll('.match-card');

    cards.forEach(card => {
        const matchId = parseInt(card.dataset.matchId);
        const match = matchesData.matches.find(m => m.id === matchId);

        if (!match) return;

        const status = getMatchStatus(match.status, match.timestamp);
        const statusElement = card.querySelector('.match-status');
        const watchBtn = card.querySelector('.watch-btn');
        const canWatch = status.class === 'status-live' || match.timestamp <= now;

        // Update status
        statusElement.className = `match-status ${status.class}`;
        statusElement.textContent = status.text;

        // Update button
        if (canWatch && watchBtn.classList.contains('disabled')) {
            watchBtn.classList.remove('disabled');
            watchBtn.removeAttribute('disabled');
            watchBtn.href = `watch.html?match=${match.id}`;
            watchBtn.innerHTML = status.class === 'status-live' ? '🔴 شاهد الآن' : '▶️ شاهد المباراة';
        }
    });
}

/**
 * Start auto-update timer
 */
function startAutoUpdate() {
    if (updateTimer) {
        clearInterval(updateTimer);
    }

    updateTimer = setInterval(() => {
        updateMatchStatuses();
    }, CONFIG.updateInterval);
}

// ==================== Initialization ====================

/**
 * Initialize the application
 */
function init() {
    console.log('⚽ Football Matches App Initialized');

    // Fetch matches on load
    fetchMatches();

    // Start auto-update
    startAutoUpdate();

    // Refresh data every 5 minutes
    setInterval(fetchMatches, 5 * 60 * 1000);
}

// ==================== Event Listeners ====================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (updateTimer) {
        clearInterval(updateTimer);
    }
});
