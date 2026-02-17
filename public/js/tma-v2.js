/**
 * LiveMatch TMA v2.1 - Premium Edition
 * Integrated SPA Architecture
 */

const tg = window.Telegram.WebApp;

const config = {
    apiPath: 'data/matches.json',
    syncInterval: 60000, // 1 min
    adZoneId: '10621765',
    themeKey: 'livematch_premium_theme'
};

let state = {
    matches: [],
    selectedMatch: null,
    currentView: 'home',
    isFullscreen: false,
    theme: 'dark'
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    tg.ready();
    tg.expand();

    // Set colors from Telegram
    document.documentElement.setAttribute('data-theme', tg.colorScheme);

    // Initial load
    fetchMatches();

    // Auto sync
    setInterval(fetchMatches, config.syncInterval);

    // Handle back button
    tg.BackButton.onClick(() => {
        if (state.currentView === 'player') navigateTo('servers');
        else if (state.currentView === 'servers') navigateTo('home');
    });

    // Hide loader
    setTimeout(() => {
        document.getElementById('main-loader').classList.add('hidden');
    }, 1000);
});

async function fetchMatches() {
    try {
        const response = await fetch(`${config.apiPath}?t=${Date.now()}`);
        const data = await response.json();
        state.matches = data.matches || [];
        renderMatches();
    } catch (e) {
        console.error('Fetch error:', e);
        showNotification('خطأ في الاتصال بالسيرفر ❌');
    }
}

// ==================== NAVIGATION ====================
function navigateTo(view) {
    state.currentView = view;

    // UI Transitions
    document.getElementById('servers-view').classList.remove('active');
    document.getElementById('player-view').classList.remove('active');

    if (view === 'home') {
        tg.BackButton.hide();
    } else if (view === 'servers') {
        document.getElementById('servers-view').classList.add('active');
        tg.BackButton.show();
        renderServers();
    } else if (view === 'player') {
        document.getElementById('player-view').classList.add('active');
        tg.BackButton.show();
    }
}

// ==================== RENDERERS ====================
function renderMatches() {
    const container = document.getElementById('matches-container');
    if (!container) return;

    if (state.matches.length === 0) {
        container.innerHTML = '<div class="section-title">لا توجد مباريات متاحة حالياً</div>';
        return;
    }

    let html = '';

    // Grouping
    const live = state.matches.filter(m => m.status === 'LIVE');
    const upcoming = state.matches.filter(m => m.status === 'NS');
    const finished = state.matches.filter(m => m.status === 'FT');

    if (live.length) {
        html += '<div class="section-title">🔴 مباشر الآن</div>';
        live.forEach(m => html += createMatchCard(m));
    }

    if (upcoming.length) {
        html += '<div class="section-title">📅 مباريات قادمة</div>';
        upcoming.forEach(m => html += createMatchCard(m));
    }

    if (finished.length) {
        html += '<div class="section-title">✅ مباريات منتهية</div>';
        finished.forEach(m => html += createMatchCard(m));
    }

    container.innerHTML = html;
}

function createMatchCard(match) {
    const isLive = match.status === 'LIVE';
    const isFinished = match.status === 'FT';

    let statusLabel = '';
    if (isLive) statusLabel = '<span class="match-status-pill live">مباشر</span>';
    else if (isFinished) statusLabel = '<span class="match-status-pill finished">منتهية</span>';
    else statusLabel = `<span class="match-status-pill">${match.time || '--:--'} GMT</span>`;

    return `
        <div class="match-card ${isLive ? 'is-live' : ''}" onclick="selectMatch(${match.id})">
            <div class="match-header">
                <div class="league-info">
                    <img src="${match.league.logo}" style="width:18px;height:18px;border-radius:4px">
                    <span>${match.league.name}</span>
                </div>
                ${statusLabel}
            </div>
            <div class="match-teams">
                <div class="team">
                    <img src="${match.home.logo}" class="team-logo">
                    <span class="team-name">${match.home.name}</span>
                </div>
                <div class="match-center">
                    <div class="match-vs">VS</div>
                    ${isFinished ? '' : `<div class="match-time-big">${match.time}</div>`}
                </div>
                <div class="team">
                    <img src="${match.away.logo}" class="team-logo">
                    <span class="team-name">${match.away.name}</span>
                </div>
            </div>
            <div class="match-footer">
                <div class="server-badge">📺 ${match.streams ? match.streams.length : 0} سيرفر</div>
                <button class="watch-btn-premium">${isFinished ? 'النتيجة' : 'شاهد الآن'}</button>
            </div>
        </div>
    `;
}

function selectMatch(id) {
    const match = state.matches.find(m => m.id === id);
    if (!match) return;

    state.selectedMatch = match;
    tg.HapticFeedback.impactOccurred('medium');

    // Show interstitial before servers
    triggerMonetagAd('inter', () => {
        navigateTo('servers');
    });
}

function renderServers() {
    const list = document.getElementById('server-list');
    const match = state.selectedMatch;
    document.getElementById('server-title').textContent = `${match.home.name} vs ${match.away.name}`;

    if (!match.streams || match.streams.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:40px;opacity:0.6">لا توجد روابط متاحة لهذه المباراة</div>';
        return;
    }

    let html = '';
    match.streams.forEach((s, idx) => {
        html += `
            <div class="server-card" onclick="playStream('${encodeURIComponent(s.url)}')">
                <div class="server-icon">📺</div>
                <div class="server-details">
                    <h4>سيرفر جودة ${s.quality || 'HD'}</h4>
                    <span>${s.channel || 'القناة الصوتية 1'}</span>
                </div>
                <div style="font-size:1.2rem;opacity:0.5">◀</div>
            </div>
        `;
    });
    list.innerHTML = html;
}

function playStream(url) {
    const streamUrl = decodeURIComponent(url);
    const iframe = document.getElementById('main-iframe');

    tg.HapticFeedback.notificationOccurred('success');
    document.getElementById('player-match-name').textContent = `${state.selectedMatch.home.name} vs ${state.selectedMatch.away.name}`;

    // Clear iframe
    iframe.src = 'about:blank';

    // Show Popunder before player
    triggerMonetagAd('pop', () => {
        navigateTo('player');

        // Delay loading to ensure ad is active
        setTimeout(() => {
            iframe.src = streamUrl;
        }, 300);
    });
}

// ==================== FULLSCREEN SYSTEM ====================
function toggleFullscreen() {
    const pView = document.getElementById('player-view');
    const btn = document.getElementById('fullscreen-btn');

    if (!state.isFullscreen) {
        pView.classList.add('fullscreen-mode');
        state.isFullscreen = true;
        btn.innerHTML = '<span>✕</span> خروج من التكبير';
        tg.HapticFeedback.notificationOccurred('success');
    } else {
        pView.classList.remove('fullscreen-mode');
        state.isFullscreen = false;
        btn.innerHTML = '<span>⛶</span> ملء الشاشة تماماً';
    }
}

// ==================== UTILS ====================
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    tg.HapticFeedback.impactOccurred('light');
}

function refreshData() {
    tg.HapticFeedback.impactOccurred('light');
    fetchMatches();
}

function showNotification(msg) {
    const el = document.getElementById('notification');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3000);
}

function closeServers() { navigateTo('home'); }

// ==================== AD SYSTEM ====================
function triggerMonetagAd(type, callback) {
    const zoneId = config.adZoneId;
    if (typeof window[`show_${zoneId}`] === 'function') {
        const adFn = window[`show_${zoneId}`];

        if (type === 'inter') {
            adFn({ type: 'preload' }).then(() => adFn()).finally(callback);
        } else if (type === 'pop') {
            adFn({ type: 'pop' }).finally(callback);
        } else {
            callback();
        }
    } else {
        callback();
    }
}
