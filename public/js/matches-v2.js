/**
 * LiveMatch - Matches Loader v3.0
 * Features: Viewer counter, countdown timers, hover overlay, live scores
 */

// ============ VIEWER COUNTER ============
function initViewerCounter() {
    const counterEl = document.getElementById('viewer-count');
    if (!counterEl) return;

    // Start with a realistic base number
    let baseCount = 1200 + Math.floor(Math.random() * 800);
    counterEl.textContent = baseCount.toLocaleString();

    // Fluctuate every 3-5 seconds
    setInterval(() => {
        const change = Math.floor(Math.random() * 40) - 15; // -15 to +25
        baseCount = Math.max(800, baseCount + change);
        counterEl.textContent = baseCount.toLocaleString();
    }, 3000 + Math.random() * 2000);
}

// ============ DATE DISPLAY ============
function setCurrentDate() {
    const dateEl = document.getElementById('current-date');
    if (!dateEl) return;
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// ============ COUNTDOWN TIMERS ============
const countdownIntervals = [];

function startCountdowns() {
    // Clear previous intervals
    countdownIntervals.forEach(id => clearInterval(id));
    countdownIntervals.length = 0;

    document.querySelectorAll('.match-countdown[data-timestamp]').forEach(el => {
        const timestamp = parseInt(el.dataset.timestamp) * 1000;

        function updateCountdown() {
            const now = Date.now();
            const diff = timestamp - now;

            if (diff <= 0) {
                el.textContent = '🔴 بدأت';
                el.style.color = '#f87171';
                return;
            }

            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);

            if (hours > 0) {
                el.textContent = `⏱ ${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            } else {
                el.textContent = `⏱ ${minutes}:${String(seconds).padStart(2, '0')}`;
            }
        }

        updateCountdown();
        const id = setInterval(updateCountdown, 1000);
        countdownIntervals.push(id);
    });
}

// ============ SKELETON LOADING ============
function showSkeletonLoaders() {
    const container = document.getElementById('matches-container');
    container.innerHTML = '';

    for (let i = 0; i < 5; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'match-card skeleton-card skeleton';
        container.appendChild(skeleton);
    }
}

// ============ ERROR DISPLAY ============
function showError(message, isRetryable = true) {
    const container = document.getElementById('matches-container');
    container.innerHTML = `
        <div class="error-state">
            <div class="error-icon">⚠️</div>
            <div class="error-message">${message}</div>
            ${isRetryable ? '<button class="retry-btn" onclick="loadMatches()">🔄 إعادة المحاولة</button>' : ''}
        </div>
    `;
}

// ============ LIVE BADGE ============
function updateLiveBadge(matches) {
    const badge = document.getElementById('live-badge');
    if (!badge) return;

    const hasLive = matches.some(m => m.status === 'LIVE');
    if (hasLive) {
        badge.classList.add('active');
    } else {
        badge.classList.remove('active');
    }
}

// ============ LOAD MATCHES ============
async function loadMatches() {
    const container = document.getElementById('matches-container');

    try {
        showSkeletonLoaders();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`data/matches.json?t=${Date.now()}`, {
            signal: controller.signal,
            cache: 'no-store'
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            throw new Error('البيانات غير صالحة');
        }

        if (!data || !data.matches || !Array.isArray(data.matches)) {
            throw new Error('لا توجد قائمة مباريات');
        }

        if (data.matches.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📅</div>
                    <div class="empty-message">لا توجد مباريات اليوم</div>
                    <div class="empty-hint">تحقق لاحقاً لمشاهدة المباريات القادمة</div>
                </div>
            `;
            return;
        }

        // Sort: LIVE first, then NS by time, then FT
        const sorted = [...data.matches].sort((a, b) => {
            const order = { 'LIVE': 0, 'NS': 1, 'FT': 2 };
            const oa = order[a.status] ?? 1;
            const ob = order[b.status] ?? 1;
            if (oa !== ob) return oa - ob;
            return (a.timestamp || 0) - (b.timestamp || 0);
        });

        // Update live badge
        updateLiveBadge(sorted);

        // Render
        container.innerHTML = '';
        sorted.forEach(match => {
            try {
                const card = createMatchCard(match);
                container.appendChild(card);
            } catch (e) {
                // Silent fail for individual cards
            }
        });

        // Start countdowns
        startCountdowns();

    } catch (error) {
        if (error.name === 'AbortError') {
            showError('انتهت مهلة الاتصال - تحقق من الإنترنت');
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            showError('لا يوجد اتصال بالإنترنت');
        } else if (error.message.includes('HTTP 404')) {
            showError('ملف المباريات غير موجود', false);
        } else if (error.message.includes('HTTP 5')) {
            showError('خطأ في الخادم - جاري الإصلاح');
        } else {
            showError(error.message || 'خطأ في تحميل المباريات');
        }
    }
}

// ============ CREATE MATCH CARD ============
function createMatchCard(match) {
    if (!match || !match.id || !match.home || !match.away) {
        throw new Error('Missing required match data');
    }

    const card = document.createElement('a');
    card.className = 'match-card';

    // Direct link to watch page (first available stream)
    if (match.streams && match.streams.length > 0) {
        card.href = `watch.html?match=${match.id}&server=0`;
    } else {
        card.href = `article.html?match=${match.id}`;
    }

    // Check if live
    if (match.status === 'LIVE') {
        card.classList.add('is-live');
    }

    // Time
    let timeString = match.time_label || '';
    if (!timeString && match.timestamp) {
        try {
            const matchDate = new Date(match.timestamp * 1000);
            timeString = matchDate.toLocaleTimeString('en-GB', {
                hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false
            }) + ' GMT';
        } catch (e) {
            timeString = '--:--';
        }
    }

    // Status
    let statusHTML = '';
    let scoreHTML = '';
    let countdownHTML = '';

    if (match.status === 'LIVE') {
        statusHTML = '<span class="match-status-badge status-live">🔴 مباشر</span>';
        if (match.score) {
            scoreHTML = `<div class="match-score">${match.score}</div>`;
        }
    } else if (match.status === 'FT') {
        statusHTML = '<span class="match-status-badge status-finished">انتهت</span>';
        if (match.score) {
            scoreHTML = `<div class="match-score">${match.score}</div>`;
        }
    } else {
        statusHTML = '<span class="match-status-badge status-upcoming">لم تبدأ</span>';
        if (match.timestamp) {
            countdownHTML = `<div class="match-countdown" data-timestamp="${match.timestamp}">⏱ --:--</div>`;
        }
    }

    // Team info
    const homeName = match.home.name || 'فريق 1';
    const awayName = match.away.name || 'فريق 2';
    const fallbackLogo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36'%3E%3Ccircle cx='18' cy='18' r='18' fill='%231e293b'/%3E%3C/svg%3E";
    const homeLogo = match.home.logo || fallbackLogo;
    const awayLogo = match.away.logo || fallbackLogo;

    // Channel & commentator meta
    let metaHTML = '';
    const metaParts = [];
    if (match.channel) {
        metaParts.push(`<span>📺 ${match.channel}</span>`);
    }
    if (match.commentator) {
        metaParts.push(`<span>🎙️ ${match.commentator}</span>`);
    }
    if (match.league && match.league.name) {
        metaParts.push(`<span>🏆 ${match.league.name}</span>`);
    }
    if (metaParts.length > 0) {
        metaHTML = `<div class="match-meta">${metaParts.join('')}</div>`;
    }

    card.innerHTML = `
        <div class="play-overlay">
            <div class="play-icon">
                <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
        </div>

        <div class="team">
            <span class="team-name">${homeName}</span>
            <img src="${homeLogo}" alt="${homeName}" width="36" height="36" class="team-logo" loading="lazy" onerror="this.src='${fallbackLogo}'">
        </div>
        
        <div class="match-center">
            <div class="match-time">${timeString}</div>
            ${scoreHTML}
            ${statusHTML}
            ${countdownHTML}
        </div>
        
        <div class="team">
            <img src="${awayLogo}" alt="${awayName}" width="36" height="36" class="team-logo" loading="lazy" onerror="this.src='${fallbackLogo}'">
            <span class="team-name">${awayName}</span>
        </div>

        ${metaHTML}
    `;

    return card;
}

// ============ INIT ============
initViewerCounter();
setCurrentDate();
loadMatches();

// Refresh every 60 seconds
setInterval(loadMatches, 60000);
