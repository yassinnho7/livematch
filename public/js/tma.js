/**
 * LiveMatch TMA SPA Core v2.0
 * Features: SPA View Management, Monetag Integration, Telegram Native UI
 */

const tg = window.Telegram.WebApp;
const BackButton = tg.BackButton;

// DOM Elements
const views = {
    listing: document.getElementById('view-listing'),
    servers: document.getElementById('view-servers'),
    player: document.getElementById('view-player')
};
const matchesList = document.getElementById('matches-list');
const serverList = document.getElementById('server-list');
const mainIframe = document.getElementById('main-iframe');
const loader = document.getElementById('main-loader');

// State
let matchesData = [];
let selectedMatch = null;
let currentView = 'listing';

// --- Initialization ---

tg.ready();
tg.expand();
tg.headerColor = tg.themeParams.secondary_bg_color || '#16212c';
tg.backgroundColor = tg.themeParams.bg_color || '#0f1923';

async function init() {
    try {
        const response = await fetch(`data/matches.json?t=${Date.now()}`);
        const data = await response.json();
        matchesData = data.matches || [];

        renderMatches(matchesData);
        loader.style.display = 'none';

        // Deep linking
        const startParam = tg.initDataUnsafe.start_param;
        if (startParam) {
            const match = matchesData.find(m => m.id == startParam);
            if (match) openMatch(match);
        }

        initializeAdTimer();
    } catch (e) {
        console.error('Init error:', e);
        loader.innerHTML = '<p style="color:#f4212e;">حدث خطأ في تحميل البيانات.</p>';
    }
}

// --- View Management ---

function switchView(viewId) {
    currentView = viewId;

    // Hide all, show active
    Object.keys(views).forEach(key => {
        views[key].classList.toggle('active', key === viewId);
    });

    // Update BackButton
    if (viewId === 'listing') {
        BackButton.hide();
        mainIframe.src = 'about:blank'; // Stop audio/video
    } else {
        BackButton.show();
    }

    // Scroll to top
    window.scrollTo(0, 0);
}

BackButton.onClick(() => {
    if (currentView === 'player') {
        switchView('servers');
    } else if (currentView === 'servers') {
        switchView('listing');
    }
});

// --- Monetag Integration ---

function initializeAdTimer() {
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

async function triggerMatchAd() {
    tg.HapticFeedback.impactOccurred('medium');
    if (typeof show_10621765 === 'function') {
        try {
            await show_10621765();
        } catch (e) {
            console.warn('Ad skipped/error:', e);
        }
    }
}

async function triggerServerAd() {
    tg.HapticFeedback.impactOccurred('light');
    if (typeof show_10621765 === 'function') {
        try {
            await show_10621765('pop');
        } catch (e) {
            console.warn('Popup skipped/error:', e);
        }
    }
}

// --- Match Logic ---

function renderMatches(matches) {
    if (!matches.length) {
        matchesList.innerHTML = '<div style="text-align:center; padding:40px; color:#8899a6;">لا توجد مباريات جارية.</div>';
        return;
    }

    const sorted = [...matches].sort((a, b) => {
        const order = { 'LIVE': 0, 'NS': 1, 'FT': 2 };
        return (order[a.status] ?? 1) - (order[b.status] ?? 1);
    });

    matchesList.innerHTML = '';
    sorted.forEach(match => {
        const div = document.createElement('div');
        div.className = 'match-card';
        div.onclick = () => openMatch(match);

        const isLive = match.status === 'LIVE';
        const time = match.time_label || match.time || 'قريباً';

        div.innerHTML = `
            <div class="m-header">
                <span>🏆 ${match.league.name}</span>
                <span>${time}</span>
            </div>
            <div class="m-teams">
                <div class="t-box">
                    <img src="${match.home.logo}" class="t-logo" loading="lazy">
                    <span class="t-name">${match.home.name}</span>
                </div>
                <div class="m-vs">VS</div>
                <div class="t-box">
                    <img src="${match.away.logo}" class="t-logo" loading="lazy">
                    <span class="t-name">${match.away.name}</span>
                </div>
            </div>
            <div class="m-footer">
                ${isLive ? '<div class="live-tag"><span class="live-dot"></span> مباشر</div>' : '<div></div>'}
                <button class="btn-primary">مشاهدة</button>
            </div>
        `;
        matchesList.appendChild(div);
    });
}

async function openMatch(match) {
    selectedMatch = match;
    await triggerMatchAd();
    renderServers(match);
    switchView('servers');
}

function renderServers(match) {
    document.getElementById('s-match-title').textContent = `${match.home.name} VS ${match.away.name}`;
    serverList.innerHTML = '';

    if (!match.streams?.length) {
        serverList.innerHTML = '<p style="color:#f4212e; text-align:center;">لا توجد سيرفرات متاحة.</p>';
        return;
    }

    match.streams.forEach((s, i) => {
        const b = document.createElement('div');
        b.className = 'server-item';
        b.textContent = `سيرفر ${i + 1} (${s.quality || 'HD'})`;
        b.onclick = () => startStreaming(s.url);
        serverList.appendChild(b);
    });
}

async function startStreaming(url) {
    await triggerServerAd();

    document.getElementById('p-match-name').textContent = `${selectedMatch.home.name} VS ${selectedMatch.away.name}`;
    mainIframe.src = url;
    switchView('player');
}

// --- Player Helpers ---

function toggleMaximize() {
    const playerContainer = document.getElementById('player-container');
    if (playerContainer.style.height === '100vh') {
        playerContainer.style.height = 'auto';
        playerContainer.style.aspectRatio = '16 / 9';
    } else {
        playerContainer.style.height = '100vh';
        playerContainer.style.aspectRatio = 'unset';
        // Suggest landscape to user
        tg.showAlert('يرجى تدوير الهاتف للحصول على أفضل تجربة مشاهدة!');
    }
}

init();
