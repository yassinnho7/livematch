/**
 * LiveMatch TMA v2.0 - Optimized Edition
 * Features: Clean UI, Monetag integration, Fullscreen fix, Theme toggle
 */

const tg = window.Telegram.WebApp;
const BackButton = tg.BackButton;

// ==================== CONFIG ====================
const CONFIG = {
    DATA_URL: 'data/matches.json',
    AD_ZONE: '10621765',
    THEME_KEY: 'livematch_theme'
};

// ==================== STATE ====================
let state = {
    matches: [],
    filteredMatches: [],
    currentLeague: 'all',
    selectedMatch: null,
    isFullscreen: false
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        // Setup Telegram
        tg.ready();
        tg.expand();
        tg.headerColor = '#16212c';
        tg.backgroundColor = '#0f1923';

        // Enable closing confirmation
        tg.enableClosingConfirmation();

        // Load theme
        loadTheme();

        // Fetch matches
        await fetchMatches();

        // Setup league chips
        setupLeagueChips();

        // Hide loader
        hideLoader();

    } catch (error) {
        console.error('Init error:', error);
    }
}

// ==================== DATA FETCHING ====================
async function fetchMatches() {
    try {
        const response = await fetch(`${CONFIG.DATA_URL}?t=${Date.now()}`);

        if (!response.ok) {
            throw new Error('Failed to fetch matches');
        }

        const data = await response.json();
        state.matches = data.matches || [];

        applyFilters();
        renderMatches();

    } catch (error) {
        console.error('Fetch error:', error);
        showNotification('⚠️ خطأ في تحميل البيانات');
    }
}

async function refreshData() {
    tg.HapticFeedback.impactOccurred('light');
    await fetchMatches();
    showNotification('✅ تم التحديث');
}

// ==================== FILTERS ====================
function applyFilters() {
    let matches = [...state.matches];

    // Filter by league
    if (state.currentLeague !== 'all') {
        matches = matches.filter(m =>
            m.league.name.includes(state.currentLeague) ||
            m.league.country === state.currentLeague
        );
    }

    // Sort: Live first, then by time
    matches.sort((a, b) => {
        const statusOrder = { 'LIVE': 0, 'NS': 1, 'FT': 2 };
        return (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1);
    });

    state.filteredMatches = matches;
}

function setupLeagueChips() {
    document.querySelectorAll('.league-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const league = chip.dataset.league;

            // Update active state
            document.querySelectorAll('.league-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            // Filter
            state.currentLeague = league;
            applyFilters();
            renderMatches();

            tg.HapticFeedback.selectionChanged();
        });
    });
}

// ==================== RENDERING ====================
function renderMatches() {
    const container = document.getElementById('matches-container');
    const matches = state.filteredMatches;

    if (!matches.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚽</div>
                <div>لا توجد مباريات متاحة</div>
            </div>
        `;
        return;
    }

    let html = '';

    // Group by status
    const liveMatches = matches.filter(m => m.status === 'LIVE');
    const upcomingMatches = matches.filter(m => m.status === 'NS');

    if (liveMatches.length) {
        html += `<div class="section-title"><span class="live-dot"></span> مباشر الآن</div>`;
        liveMatches.forEach(match => html += createMatchCard(match));
    }

    if (upcomingMatches.length) {
        if (liveMatches.length) html += `<div class="section-title" style="margin-top:20px">المباريات القادمة</div>`;
        upcomingMatches.forEach(match => html += createMatchCard(match));
    }

    container.innerHTML = html;
}

function createMatchCard(match) {
    const isLive = match.status === 'LIVE';
    const timeLabel = isLive ? 'مباشر' : formatTime(match.time);
    const streamsCount = match.streams?.length || 0;

    return `
        <div class="match-card" onclick="openServers(${match.id})">
            <div class="match-header">
                <span class="league-name">${match.league.name}</span>
                <span class="match-time ${isLive ? 'live' : ''}">${timeLabel}</span>
            </div>
            <div class="match-teams">
                <div class="team">
                    <img class="team-logo" src="${match.home.logo}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/9312/9312098.png'" alt="${match.home.name}">
                    <span class="team-name">${match.home.name}</span>
                </div>
                <span class="match-vs">VS</span>
                <div class="team">
                    <img class="team-logo" src="${match.away.logo}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/9312/9312098.png'" alt="${match.away.name}">
                    <span class="team-name">${match.away.name}</span>
                </div>
            </div>
            <div class="match-footer">
                <span class="streams-count">${streamsCount} سيرفر متاح</span>
                <button class="watch-btn" onclick="event.stopPropagation(); openServers(${match.id})">▶️ مشاهدة</button>
            </div>
        </div>
    `;
}

// ==================== SERVERS VIEW ====================
function openServers(matchId) {
    const match = state.matches.find(m => m.id === matchId);
    if (!match) return;

    state.selectedMatch = match;
    tg.HapticFeedback.impactOccurred('medium');

    // Show interstitial ad
    showInterstitialAd(() => {
        showServersView(match);
    });
}

function showServersView(match) {
    document.getElementById('server-title').textContent = `${match.home.name} vs ${match.away.name}`;

    const servers = match.streams || [];
    const container = document.getElementById('server-list');

    if (!servers.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📡</div>
                <div>لا توجد سيرفرات متاحة</div>
            </div>
        `;
    } else {
        let html = '';
        servers.forEach((stream, index) => {
            const isVIP = stream.quality === 'VIP';
            const qualityLabel = stream.quality || 'HD';

            html += `
                <div class="server-option ${isVIP ? 'vip' : ''}" onclick="startStreaming('${stream.url}', ${match.id})">
                    <div class="server-info">
                        <h4>سيرفر ${index + 1}</h4>
                        <span>${qualityLabel} • ${stream.channel || 'بث مباشر'}</span>
                    </div>
                    <div class="play-icon">▶</div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    document.getElementById('servers-view').classList.add('active');
    BackButton.show();
    BackButton.onClick(closeServers);
}

function closeServers() {
    document.getElementById('servers-view').classList.remove('active');
    BackButton.hide();
}

// ==================== PLAYER VIEW ====================
function startStreaming(url, matchId) {
    const match = state.selectedMatch;

    // Show popup ad before streaming
    showPopupAd(() => {
        showPlayerView(url, match);
    });
}

function showPlayerView(url, match) {
    document.getElementById('player-match-name').textContent =
        `${match.home.name} vs ${match.away.name}`;

    document.getElementById('main-iframe').src = url;
    document.getElementById('player-view').classList.add('active');

    BackButton.show();
    BackButton.onClick(closePlayer);
}

function closePlayer() {
    document.getElementById('main-iframe').src = 'about:blank';
    document.getElementById('player-view').classList.remove('active');
    document.getElementById('fullscreen-btn').textContent = '⛶ ملء الشاشة';
    state.isFullscreen = false;
    BackButton.show();
    BackButton.onClick(closeServers);
}

// ==================== FULLSCREEN ====================
function toggleFullscreen() {
    const playerView = document.getElementById('player-view');
    const btn = document.getElementById('fullscreen-btn');

    if (!state.isFullscreen) {
        // Enter fullscreen
        if (playerView.requestFullscreen) {
            playerView.requestFullscreen();
        } else if (playerView.webkitRequestFullscreen) {
            playerView.webkitRequestFullscreen();
        } else if (playerView.msRequestFullscreen) {
            playerView.msRequestFullscreen();
        }

        // Also try iframe
        const iframe = document.getElementById('main-iframe');
        if (iframe.requestFullscreen) {
            iframe.requestFullscreen();
        }

        state.isFullscreen = true;
        btn.textContent = '⬜ خروج';
        tg.HapticFeedback.impactOccurred('light');
    } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }

        state.isFullscreen = false;
        btn.textContent = '⛶ ملء الشاشة';
    }
}

// Listen for fullscreen changes
document.addEventListener('fullscreenchange', onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);

function onFullscreenChange() {
    const btn = document.getElementById('fullscreen-btn');
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        state.isFullscreen = false;
        btn.textContent = '⛶ ملء الشاشة';
    }
}

// ==================== MONETAG ADS ====================
function showInterstitialAd(callback) {
    const adFunction = window[`show_${CONFIG.AD_ZONE}`];

    if (typeof adFunction === 'function') {
        // Preload first
        adFunction({ type: 'preload' })
            .then(() => {
                // Show the ad
                return adFunction();
            })
            .then(() => {
                callback();
            })
            .catch(() => {
                // If ad fails, just continue
                callback();
            });
    } else {
        callback();
    }
}

function showPopupAd(callback) {
    const adFunction = window[`show_${CONFIG.AD_ZONE}`];

    if (typeof adFunction === 'function') {
        adFunction({ type: 'pop' })
            .then(() => {
                callback();
            })
            .catch(() => {
                callback();
            });
    } else {
        callback();
    }
}

// ==================== THEME ====================
function loadTheme() {
    const savedTheme = localStorage.getItem(CONFIG.THEME_KEY);
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
}

function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    html.setAttribute('data-theme', newTheme);
    localStorage.setItem(CONFIG.THEME_KEY, newTheme);

    tg.HapticFeedback.impactOccurred('light');
    showNotification(newTheme === 'dark' ? '🌙 الوضع الداكن' : '☀️ الوضع الفاتح');
}

// ==================== UTILITIES ====================
function formatTime(timeStr) {
    if (!timeStr) return '';
    const match = timeStr.match(/(\d+):(\d+)/);
    if (match) {
        const hours = parseInt(match[1]);
        const minutes = match[2];
        const localHours = (hours + 1) % 24;
        return `${localHours}:${minutes}`;
    }
    return timeStr;
}

function showNotification(text) {
    const notif = document.getElementById('notification');
    notif.textContent = text;
    notif.classList.add('show');
    setTimeout(() => notif.classList.remove('show'), 2500);
}

function hideLoader() {
    const loader = document.getElementById('main-loader');
    loader.classList.add('hidden');
    setTimeout(() => loader.style.display = 'none', 400);
}

// ==================== ERROR HANDLING ====================
window.addEventListener('error', (e) => {
    console.error('Error:', e.error);
});
