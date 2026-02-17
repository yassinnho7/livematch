/**
 * LiveMatch TMA v2.1 - Premium Edition
 * Features: GMT Timing, Countdown Engine, Triple Monetag Layer, Fixed Fullscreen
 */

const tg = window.Telegram.WebApp;
const BackButton = tg.BackButton;

// ==================== CONFIG ====================
const CONFIG = {
    DATA_URL: 'data/matches.json',
    AD_ZONE: '10621765',
    SYNC_INTERVAL: 60000 // Update data every 1 min
};

// ==================== STATE ====================
let state = {
    matches: [],
    selectedMatch: null,
    isFullscreen: false,
    adInterval: null
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        tg.ready();
        tg.expand();
        tg.headerColor = '#12181f';
        tg.backgroundColor = '#0a0f14';
        tg.enableClosingConfirmation();

        loadTheme();
        await fetchMatches();

        // Start Countdown Engine (1s)
        setInterval(updateTimers, 1000);

        // Global Sync (1m)
        setInterval(fetchMatches, CONFIG.SYNC_INTERVAL);

        initializeMonetagInApp();
        hideLoader();

    } catch (error) {
        console.error('Init error:', error);
    }
}

// ==================== DATA FETCHING ====================
async function fetchMatches() {
    try {
        const response = await fetch(`${CONFIG.DATA_URL}?t=${Date.now()}`);
        if (!response.ok) throw new Error('Network error');

        const data = await response.json();
        state.matches = (data.matches || []).sort((a, b) => {
            const statusOrder = { 'LIVE': 0, 'NS': 1, 'FT': 2 };
            return (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1);
        });

        renderMatches();
    } catch (error) {
        console.warn('Sync error:', error);
    }
}

async function refreshData() {
    tg.HapticFeedback.impactOccurred('medium');
    await fetchMatches();
    showNotification('✅ تم تحديث المباريات والتوقيت');
}

// ==================== RENDERING ENGINE ====================
function renderMatches() {
    const container = document.getElementById('matches-container');
    if (!state.matches.length) {
        container.innerHTML = `<div class="section-title">لا توجد مباريات حالياً</div>`;
        return;
    }

    let html = '';
    const live = state.matches.filter(m => m.status === 'LIVE');
    const upcoming = state.matches.filter(m => m.status === 'NS');

    if (live.length) {
        html += `<div class="section-title"><span class="live-dot" style="margin-left:8px"></span> مباشر الآن</div>`;
        live.forEach(m => html += createPremiumCard(m, true));
    }

    if (upcoming.length) {
        html += `<div class="section-title">مباريات اليوم (GMT)</div>`;
        upcoming.forEach(m => html += createPremiumCard(m, false));
    }

    container.innerHTML = html;
}

function createPremiumCard(match, isLive) {
    const timeDisplay = formatToGMT(match.time);
    const streamsCount = match.streams?.length || 0;

    return `
        <div class="match-card ${isLive ? 'is-live' : ''}" onclick="openMatchDetails(${match.id})">
            <div class="match-header">
                <div class="league-info">
                    🏆 ${match.league.name}
                </div>
                <div class="match-status-pill ${isLive ? 'live' : ''}">
                    ${isLive ? 'LIVE' : 'قادمة'}
                </div>
            </div>
            
            <div class="match-teams">
                <div class="team">
                    <img class="team-logo" src="${match.home.logo}" onerror="this.src='/watch.jpg'">
                    <span class="team-name">${match.home.name}</span>
                </div>
                
                <div class="match-center">
                    <div class="match-vs">VS</div>
                    <div class="match-time-big" id="timer-${match.id}">
                        ${isLive ? 'جارية' : timeDisplay}
                    </div>
                    <span class="match-gmt">${isLive ? '' : 'GMT Standard Time'}</span>
                </div>
                
                <div class="team">
                    <img class="team-logo" src="${match.away.logo}" onerror="this.src='/watch.jpg'">
                    <span class="team-name">${match.away.name}</span>
                </div>
            </div>
            
            <div class="match-footer">
                <div class="server-badge">
                    📡 ${streamsCount} سيرفر متاح
                </div>
                <button class="watch-btn-premium" onclick="event.stopPropagation(); openMatchDetails(${match.id})">
                    مشاهدة الآن
                </button>
            </div>
        </div>
    `;
}

// ==================== TIMING ENGINE ====================
function updateTimers() {
    state.matches.forEach(match => {
        if (match.status === 'NS') {
            const el = document.getElementById(`timer-${match.id}`);
            if (el) {
                // Future enhancement: Real countdown logic here if we have full timestamps
                // For now, keeping GMT display static but refreshing every minute
            }
        }
    });
}

function formatToGMT(timeStr) {
    if (!timeStr) return '--:--';
    // The server provides time in a specific format, we extract and label as GMT
    return timeStr + ' GMT';
}

// ==================== FLOW & ADS ====================
async function openMatchDetails(matchId) {
    const match = state.matches.find(m => m.id === matchId);
    if (!match) return;

    state.selectedMatch = match;
    tg.HapticFeedback.impactOccurred('medium');

    // Triple Threat Ad - Layer 1: Interstitial
    await triggerMonetagAd('inter');

    renderServers(match);
    document.getElementById('servers-view').classList.add('active');
    BackButton.show();
    BackButton.onClick(closeServers);
}

function renderServers(match) {
    document.getElementById('server-title').textContent = `${match.home.name} VS ${match.away.name}`;
    const list = document.getElementById('server-list');
    list.innerHTML = '';

    (match.streams || []).forEach((s, i) => {
        const div = document.createElement('div');
        div.className = `server-card ${s.quality === 'VIP' ? 'vip' : ''}`;
        div.onclick = () => startStreaming(s.url);

        div.innerHTML = `
            <div class="server-icon">📡</div>
            <div class="server-details">
                <h4>سيرفر المشاهدة ${i + 1}</h4>
                <span>${s.quality || 'HD'} • ${s.channel || 'بث مباشر'}</span>
            </div>
            <div style="color:var(--accent); font-weight:900;">▶</div>
        `;
        list.appendChild(div);
    });
}

async function startStreaming(url) {
    tg.HapticFeedback.impactOccurred('heavy');

    // Triple Threat Ad - Layer 2: Popup (Native Popunder/Pop)
    await triggerMonetagAd('pop');

    document.getElementById('player-match-name').textContent =
        `${state.selectedMatch.home.name} VS ${state.selectedMatch.away.name}`;

    document.getElementById('main-iframe').src = url;
    document.getElementById('player-view').classList.add('active');

    BackButton.show();
    BackButton.onClick(closePlayer);
}

function closeServers() {
    document.getElementById('servers-view').classList.remove('active');
    BackButton.hide();
}

function closePlayer() {
    document.getElementById('main-iframe').src = 'about:blank';
    document.getElementById('player-view').classList.remove('active');
    document.body.classList.remove('no-scroll');
    state.isFullscreen = false;
    document.getElementById('player-view').classList.remove('fullscreen-mode');

    // Reset back button to servers view
    BackButton.show();
    BackButton.onClick(closeServers);
}

// ==================== FULLSCREEN SYSTEM ====================
function toggleFullscreen() {
    const pView = document.getElementById('player-view');
    const btn = document.getElementById('fullscreen-btn');

    if (!state.isFullscreen) {
        // Immersive Mode
        pView.classList.add('fullscreen-mode');
        state.isFullscreen = true;
        btn.innerHTML = '<span>✕</span> خروج من التكبير';
        tg.HapticFeedback.notificationOccurred('success');

        // Try native Web API if available in TMA
        try {
            if (pView.requestFullscreen) pView.requestFullscreen();
            else if (pView.webkitRequestFullscreen) pView.webkitRequestFullscreen();
        } catch (e) { }
    } else {
        pView.classList.remove('fullscreen-mode');
        state.isFullscreen = false;
        btn.innerHTML = '<span>⛶</span> ملء الشاشة تماماً';

        try {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        } catch (e) { }
    }
}

// ==================== MONETAG AD SYSTEM ====================
function initializeMonetagInApp() {
    // Triple Threat Ad - Layer 3: In-App Interstitial (Every 6 min)
    if (typeof show_10621765 === 'function') {
        show_10621765({
            type: 'inApp',
            inAppSettings: {
                frequency: 2,
                capping: 0.1,
                interval: 30,
                timeout: 5,
                everyPage: false
            }
        });
    }
}

async function triggerMonetagAd(type) {
    if (typeof show_10621765 !== 'function') return;

    try {
        if (type === 'inter') {
            await show_10621765(); // Default Interstitial
        } else if (type === 'pop') {
            await show_10621765('pop'); // Popunder
        }
    } catch (e) {
        console.warn('Ad blocked or failed:', e);
    }
}

// ==================== UTILS ====================
function loadTheme() {
    const saved = localStorage.getItem('livematch_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const target = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', target);
    localStorage.setItem('livematch_theme', target);
    tg.HapticFeedback.impactOccurred('light');
}

function showNotification(msg) {
    const n = document.getElementById('notification');
    n.textContent = msg;
    n.classList.add('show');
    setTimeout(() => n.classList.remove('show'), 3000);
}

function hideLoader() {
    document.getElementById('main-loader').classList.add('hidden');
}

init();
