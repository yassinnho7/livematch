/**
 * LiveMatch TMA v2.0 - Professional Telegram Mini App
 * Features: Advanced filtering, favorites, search, smart ads, deep linking
 */

const tg = window.Telegram.WebApp;
const BackButton = tg.BackButton;

// ==================== CONFIG ====================
const CONFIG = {
    DATA_URL: 'data/matches.json',
    AD_ZONE: '10621765',
    STORAGE_KEY: 'livematch_favorites',
    REFRESH_INTERVAL: 300000, // 5 minutes
};

// ==================== STATE ====================
let state = {
    matches: [],
    filteredMatches: [],
    favorites: [],
    currentTab: 'all',
    currentLeague: 'all',
    searchQuery: '',
    selectedMatch: null,
    isLoading: false,
    lastUpdate: null
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

        // Setup back button
        setupBackButton();

        // Load favorites from localStorage
        loadFavorites();

        // Fetch matches
        await fetchMatches();

        // Setup pull to refresh
        setupPullToRefresh();

        // Handle deep linking
        handleDeepLinking();

        // Hide loader
        hideLoader();

        // Show notification for first time users
        showWelcomeNotification();

        // Setup auto refresh
        setupAutoRefresh();

        // Track first visit
        trackFirstVisit();

    } catch (error) {
        console.error('Init error:', error);
        showError('حدث خطأ في تحميل التطبيق. يرجى المحاولة مرة أخرى.');
    }
}

// ==================== DATA FETCHING ====================
async function fetchMatches() {
    state.isLoading = true;

    try {
        const response = await fetch(`${CONFIG.DATA_URL}?t=${Date.now()}`);

        if (!response.ok) {
            throw new Error('Failed to fetch matches');
        }

        const data = await response.json();
        state.matches = data.matches || [];
        state.lastUpdate = new Date();

        // Apply filters
        applyFilters();

        // Render
        renderLeagues();
        renderMatches();

    } catch (error) {
        console.error('Fetch error:', error);
        showNotification('⚠️', 'خطأ في الاتصال', 'تعذر جلب البيانات. سيتم إعادة المحاولة.');
    } finally {
        state.isLoading = false;
    }
}

async function refreshData() {
    tg.HapticFeedback.impactOccurred('light');
    await fetchMatches();
    showNotification('✅', 'تم التحديث', 'تم تحميل أحدث المباريات');
}

// ==================== FILTERS & SEARCH ====================
function applyFilters() {
    let matches = [...state.matches];

    // Filter by tab
    if (state.currentTab === 'live') {
        matches = matches.filter(m => m.status === 'LIVE');
    } else if (state.currentTab === 'upcoming') {
        matches = matches.filter(m => m.status === 'NS');
    } else if (state.currentTab === 'favorites') {
        matches = matches.filter(m =>
            state.favorites.includes(m.home.name) ||
            state.favorites.includes(m.away.name)
        );
    }

    // Filter by league
    if (state.currentLeague !== 'all') {
        matches = matches.filter(m => m.league.name.includes(state.currentLeague));
    }

    // Filter by search
    if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        matches = matches.filter(m =>
            m.home.name.toLowerCase().includes(query) ||
            m.away.name.toLowerCase().includes(query) ||
            m.league.name.toLowerCase().includes(query)
        );
    }

    // Sort: Live first, then by time
    matches.sort((a, b) => {
        const statusOrder = { 'LIVE': 0, 'NS': 1, 'FT': 2 };
        return (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1);
    });

    state.filteredMatches = matches;
}

function handleSearch(query) {
    state.searchQuery = query;
    applyFilters();
    renderMatches();
}

function switchTab(tab) {
    state.currentTab = tab;

    // Update UI
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });

    // Hide search for favorites
    document.querySelector('.search-container').style.display =
        tab === 'favorites' ? 'none' : 'block';

    applyFilters();
    renderMatches();

    tg.HapticFeedback.selectionChanged();
}

function filterByLeague(league) {
    state.currentLeague = league;

    // Update UI
    document.querySelectorAll('.league-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.league === league);
    });

    applyFilters();
    renderMatches();

    tg.HapticFeedback.selectionChanged();
}

function setFilter(type) {
    toggleFilter();

    switch (type) {
        case 'live':
            switchTab('live');
            break;
        case 'upcoming':
            switchTab('upcoming');
            break;
        default:
            switchTab('all');
    }
}

function toggleFilter() {
    document.getElementById('filter-menu').classList.toggle('active');
}

// ==================== RENDERING ====================
function renderLeagues() {
    const leagues = [...new Set(state.matches.map(m => m.league.name))].slice(0, 10);
    const container = document.getElementById('leagues-scroll');

    let html = `
        <div class="league-chip active" onclick="filterByLeague('all')" data-league="all">
            <span>🌍</span> كل البطولات
        </div>
    `;

    leagues.forEach(league => {
        const country = league.split(',')[0].trim();
        const leagueData = state.matches.find(m => m.league.name === league);
        const logo = leagueData?.league?.logo || '';

        html += `
            <div class="league-chip" onclick="filterByLeague('${country}')" data-league="${country}">
                <img src="${logo}" onerror="this.style.display='none'" alt="">
                <span>${country}</span>
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderMatches() {
    const container = document.getElementById('matches-container');
    const matches = state.filteredMatches;

    if (!matches.length) {
        container.innerHTML = getEmptyState();
        return;
    }

    let html = '';

    // Group by status
    const liveMatches = matches.filter(m => m.status === 'LIVE');
    const upcomingMatches = matches.filter(m => m.status === 'NS');

    if (liveMatches.length && (state.currentTab === 'all' || state.currentTab === 'live')) {
        html += `
            <div class="section-title">
                <span class="live-indicator"><span class="live-dot"></span> مباشر الآن</span>
            </div>
        `;

        liveMatches.forEach(match => {
            html += createMatchCard(match);
        });
    }

    if (upcomingMatches.length && (state.currentTab === 'all' || state.currentTab === 'upcoming')) {
        if (liveMatches.length) {
            html += `<div class="section-title" style="margin-top: 20px;">⏰ المباريات القادمة</div>`;
        }

        upcomingMatches.forEach(match => {
            html += createMatchCard(match);
        });
    }

    container.innerHTML = html;
}

function createMatchCard(match) {
    const isLive = match.status === 'LIVE';
    const timeLabel = isLive ? 'مباشر' : formatTime(match.time);
    const streamsCount = match.streams?.length || 0;
    const hasFavorites = state.favorites.includes(match.home.name) || state.favorites.includes(match.away.name);

    return `
        <div class="match-card" onclick="openServers(${match.id})">
            <div class="match-header">
                <div class="league-info">
                    <img class="league-logo" src="${match.league.logo}" onerror="this.style.display='none'" alt="">
                    <span class="league-name">${match.league.name}</span>
                </div>
                <div class="match-time ${isLive ? 'live' : ''}">
                    ${isLive ? '🔴' : '⏰'} ${timeLabel}
                </div>
            </div>
            
            <div class="match-teams">
                <div class="team">
                    <img class="team-logo" src="${match.home.logo}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/9312/9312098.png'" alt="${match.home.name}">
                    <span class="team-name">${match.home.name}</span>
                </div>
                <div class="match-vs">VS</div>
                <div class="team">
                    <img class="team-logo" src="${match.away.logo}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/9312/9312098.png'" alt="${match.away.name}">
                    <span class="team-name">${match.away.name}</span>
                </div>
            </div>
            
            <div class="match-footer">
                <div class="streams-count">
                    📺 ${streamsCount} سيرفر متاح
                    ${hasFavorites ? '<span style="margin-right: 8px;">⭐</span>' : ''}
                </div>
                <button class="watch-btn" onclick="event.stopPropagation(); openServers(${match.id})">
                    ▶️ مشاهدة
                </button>
            </div>
        </div>
    `;
}

function getEmptyState() {
    const tab = state.currentTab;
    let icon, title, text;

    switch (tab) {
        case 'live':
            icon = '🔴';
            title = 'لا توجد مباريات مباشرة';
            text = 'لا توجد مباريات جارية حالياً';
            break;
        case 'upcoming':
            icon = '⏰';
            title = 'لا توجد مباريات قادمة';
            text = 'لم يتم العثور على مباريات قادمة';
            break;
        case 'favorites':
            icon = '⭐';
            title = 'لا توجد فرق مفضلة';
            text = 'أضف فرقك المفضلة لمشاهدة مبارياتها';
            break;
        default:
            icon = '⚽';
            title = 'لا توجد مباريات';
            text = 'لم يتم العثور على مباريات';
    }

    return `
        <div class="empty-state">
            <div class="empty-icon">${icon}</div>
            <div class="empty-title">${title}</div>
            <div class="empty-text">${text}</div>
        </div>
    `;
}

// ==================== SERVERS VIEW ====================
function openServers(matchId) {
    const match = state.matches.find(m => m.id === matchId);
    if (!match) return;

    state.selectedMatch = match;
    tg.HapticFeedback.impactOccurred('medium');

    // Trigger ad before showing servers
    triggerAd('interstitial', () => {
        showServersView(match);
    });
}

function showServersView(match) {
    // Update banner
    document.getElementById('server-banner').innerHTML = `
        <img class="banner-logo" src="${match.home.logo}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/9312/9312098.png'">
        <div class="banner-teams">
            <span>${match.home.name}</span>
            <span class="banner-vs">VS</span>
            <span>${match.away.name}</span>
        </div>
        <img class="banner-logo" src="${match.away.logo}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/9312/9312098.png'">
    `;

    // Render servers
    const servers = match.streams || [];
    const container = document.getElementById('server-options');

    if (!servers.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📡</div>
                <div class="empty-title">لا توجد سيرفرات</div>
                <div class="empty-text">لم يتم العثور على روابط بث لهذه المباراة</div>
            </div>
        `;
    } else {
        let html = '';

        servers.forEach((stream, index) => {
            const isVIP = stream.quality === 'VIP';
            const icon = isVIP ? '👑' : '📺';
            const bgClass = isVIP ? 'vip' : '';
            const qualityLabel = stream.quality || 'HD';

            html += `
                <div class="server-option ${bgClass}" onclick="startStreaming('${stream.url}', ${match.id})">
                    <div class="server-info">
                        <div class="server-icon ${isVIP ? 'vip' : 'hd'}">${icon}</div>
                        <div class="server-details">
                            <h4>سيرفر ${index + 1}</h4>
                            <span>${qualityLabel} • ${stream.channel || 'بث مباشر'}</span>
                        </div>
                    </div>
                    <div class="play-icon">▶</div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    // Show view
    document.getElementById('servers-view').classList.add('active');

    // Setup back button
    BackButton.show();
    BackButton.onClick(closeServers);
}

function closeServers() {
    document.getElementById('servers-view').classList.remove('active');
    BackButton.hide();
}

// ==================== PLAYER VIEW ====================
function startStreaming(url, matchId) {
    tg.HapticFeedback.impactOccurred('medium');

    const match = state.selectedMatch;

    // Trigger popup ad
    triggerAd('popup', () => {
        showPlayerView(url, match);
    });
}

function showPlayerView(url, match) {
    // Update player info
    document.getElementById('player-match-name').textContent =
        `${match.home.name} VS ${match.away.name}`;

    // Set iframe src
    document.getElementById('main-iframe').src = url;

    // Show player view
    document.getElementById('player-view').classList.add('active');

    // Setup back button
    BackButton.show();
    BackButton.onClick(closePlayer);
}

function closePlayer() {
    document.getElementById('main-iframe').src = 'about:blank';
    document.getElementById('player-view').classList.remove('active');
    BackButton.show();
    BackButton.onClick(closeServers);
}

function toggleFullscreen() {
    const iframe = document.getElementById('main-iframe');

    if (iframe.requestFullscreen) {
        iframe.requestFullscreen();
    } else if (iframe.webkitRequestFullscreen) {
        iframe.webkitRequestFullscreen();
    } else if (iframe.msRequestFullscreen) {
        iframe.msRequestFullscreen();
    }

    tg.HapticFeedback.impactOccurred('light');
    tg.showAlert('💡 نصيحة: يمكنك أيضاً تدوير الهاتف للشاشة الكاملة');
}

// ==================== FAVORITES ====================
function loadFavorites() {
    try {
        const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (stored) {
            state.favorites = JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to load favorites:', e);
    }
}

function saveFavorites() {
    try {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.favorites));
    } catch (e) {
        console.error('Failed to save favorites:', e);
    }
}

function openFavorites() {
    renderFavoritesList();
    document.getElementById('favorites-modal').classList.add('active');
    tg.HapticFeedback.impactOccurred('light');
}

function closeFavorites(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('favorites-modal').classList.remove('active');
}

function renderFavoritesList() {
    const container = document.getElementById('favorites-list');

    if (!state.favorites.length) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 40px 20px;">
                <div class="empty-icon">⭐</div>
                <div class="empty-title">لا توجد مفضلات</div>
                <div class="empty-text">أضف فرقك المفضلة لمشاهدة مبارياتها أولاً بأول</div>
            </div>
        `;
        return;
    }

    // Find matches with favorite teams
    const favoriteMatches = state.matches.filter(m =>
        state.favorites.includes(m.home.name) ||
        state.favorites.includes(m.away.name)
    );

    let html = '';
    state.favorites.forEach(teamName => {
        const hasMatch = favoriteMatches.some(m => m.home.name === teamName || m.away.name === teamName);

        html += `
            <div class="favorite-team-item">
                <span>${hasMatch ? '🔴' : '⚪'}</span>
                <span>${teamName}</span>
                <button class="remove-fav" onclick="removeFavorite('${teamName}')">✕</button>
            </div>
        `;
    });

    container.innerHTML = html;
}

function addFavoritePrompt() {
    tg.showPrompt('أدخل اسم الفريق الذي تريد إضافته للمفضلة:', (teamName) => {
        if (teamName && teamName.trim()) {
            addFavorite(teamName.trim());
        }
    });
}

function addFavorite(teamName) {
    if (!state.favorites.includes(teamName)) {
        state.favorites.push(teamName);
        saveFavorites();
        renderFavoritesList();
        showNotification('⭐', 'تمت الإضافة', `تم إضافة ${teamName} للمفضلة`);
        tg.HapticFeedback.notificationOccurred('success');

        // Refresh if on favorites tab
        if (state.currentTab === 'favorites') {
            applyFilters();
            renderMatches();
        }
    }
}

function removeFavorite(teamName) {
    state.favorites = state.favorites.filter(f => f !== teamName);
    saveFavorites();
    renderFavoritesList();
    tg.HapticFeedback.notificationOccurred('warning');

    // Refresh if on favorites tab
    if (state.currentTab === 'favorites') {
        applyFilters();
        renderMatches();
    }
}

// ==================== ADS ====================
function triggerAd(type, callback) {
    const adFunction = window[`show_${CONFIG.AD_ZONE}`];

    if (typeof adFunction === 'function') {
        try {
            if (type === 'interstitial') {
                adFunction({ type: 'inApp' });
            } else if (type === 'popup') {
                adFunction('pop');
            }

            // Small delay before proceeding
            setTimeout(callback, 500);
        } catch (e) {
            console.warn('Ad error:', e);
            callback();
        }
    } else {
        // No ad SDK, just proceed
        callback();
    }
}

function initializeInAppAds() {
    const adFunction = window[`show_${CONFIG.AD_ZONE}`];

    if (typeof adFunction === 'function') {
        try {
            adFunction({
                type: 'inApp',
                inAppSettings: {
                    frequency: 2,
                    capping: 0.15,
                    interval: 30,
                    timeout: 5,
                    everyPage: false
                }
            });
        } catch (e) {
            console.warn('In-app ad init error:', e);
        }
    }
}

// ==================== UTILITIES ====================
function formatTime(timeStr) {
    if (!timeStr) return '';

    // Extract hours from time string like "17:00 GMT"
    const match = timeStr.match(/(\d+):(\d+)/);
    if (match) {
        const hours = parseInt(match[1]);
        const minutes = match[2];

        // Convert to local time (assuming GMT)
        const localHours = (hours + 1) % 24; // +1 for user's timezone (Africa/Algiers)

        return `${localHours}:${minutes}`;
    }

    return timeStr;
}

function showNotification(icon, title, text) {
    const notif = document.getElementById('notification');
    document.getElementById('notif-title').textContent = title;
    document.getElementById('notif-text').textContent = text;
    notif.querySelector('.notif-icon').textContent = icon;

    notif.classList.add('show');

    setTimeout(() => {
        notif.classList.remove('show');
    }, 3000);
}

function showError(message) {
    const loader = document.getElementById('main-loader');
    loader.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">❌</div>
            <div class="empty-title">حدث خطأ</div>
            <div class="empty-text">${message}</div>
            <button class="watch-btn" style="margin-top: 20px;" onclick="location.reload()">
                🔄 إعادة المحاولة
            </button>
        </div>
    `;
}

function hideLoader() {
    const loader = document.getElementById('main-loader');
    loader.classList.add('hidden');

    setTimeout(() => {
        loader.style.display = 'none';
    }, 400);
}

function setupBackButton() {
    BackButton.hide();
}

// ==================== PULL TO REFRESH ====================
function setupPullToRefresh() {
    let startY = 0;
    let currentY = 0;
    let isPulling = false;

    document.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
    });

    document.addEventListener('touchmove', (e) => {
        currentY = e.touches[0].clientY;

        if (startY < 50 && currentY > startY + 50) {
            isPulling = true;
            document.getElementById('refresh-hint').style.display = 'flex';
        }
    });

    document.addEventListener('touchend', () => {
        if (isPulling && currentY > startY + 100) {
            refreshData();
        }

        isPulling = false;
        currentY = 0;
        document.getElementById('refresh-hint').style.display = 'none';
    });
}

// ==================== DEEP LINKING ====================
function handleDeepLinking() {
    const startParam = tg.initDataUnsafe.start_param;

    if (startParam) {
        // Check if it's a match ID
        const matchId = parseInt(startParam);

        if (!isNaN(matchId)) {
            // Wait for data to load
            const checkMatch = setInterval(() => {
                if (state.matches.length) {
                    clearInterval(checkMatch);
                    const match = state.matches.find(m => m.id === matchId);
                    if (match) {
                        showNotification('🔗', 'رابط مباشر', `جارٍ فتح ${match.home.name} vs ${match.away.name}`);
                        setTimeout(() => openServers(match.id), 1500);
                    }
                }
            }, 100);
        }
    }
}

// ==================== SHARE ====================
function shareMatch(match) {
    const text = `🏆 شاهد ${match.home.name} vs ${match.away.name} مباشرة!\n\n${match.league.name}\n\n🔗 ${tg.initDataUnsafe.start_param || 'livematchtoday_bot'}`;

    tg.shareUrl(text);
    tg.HapticFeedback.impactOccurred('light');
}

// ==================== AUTO REFRESH ====================
function setupAutoRefresh() {
    setInterval(() => {
        if (!state.isLoading) {
            fetchMatches();
        }
    }, CONFIG.REFRESH_INTERVAL);
}

// ==================== NOTIFICATIONS ====================
function showWelcomeNotification() {
    // Check if first visit
    const firstVisit = localStorage.getItem('livematch_first_visit');

    if (!firstVisit) {
        localStorage.setItem('livematch_first_visit', 'true');

        setTimeout(() => {
            showNotification('👋', 'مرحباً بك!', 'اسحب للأسفل للتحديث');
        }, 2000);
    }
}

function trackFirstVisit() {
    // Track analytics (can be customized)
    const userId = tg.initDataUnsafe.user?.id || 'unknown';
    console.log(`User ${userId} opened the app`);
}

// ==================== HAPTIC FEEDBACK ====================
function haptic(type) {
    switch (type) {
        case 'light':
            tg.HapticFeedback.impactOccurred('light');
            break;
        case 'medium':
            tg.HapticFeedback.impactOccurred('medium');
            break;
        case 'heavy':
            tg.HapticFeedback.impactOccurred('heavy');
            break;
        case 'success':
            tg.HapticFeedback.notificationOccurred('success');
            break;
        case 'warning':
            tg.HapticFeedback.notificationOccurred('warning');
            break;
        case 'error':
            tg.HapticFeedback.notificationOccurred('error');
            break;
    }
}

// ==================== OFFLINE SUPPORT ====================
window.addEventListener('offline', () => {
    showNotification('📡', 'لا يوجد اتصال', 'تحقق من اتصالك بالإنترنت');
});

window.addEventListener('online', () => {
    showNotification('✅', 'تم الاتصال', 'جارٍ تحديث البيانات...');
    refreshData();
});

// ==================== ERROR HANDLING ====================
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled rejection:', e.reason);
});
