/**
 * LiveMatch - Matches Loader v2.1 (With Error Boundaries & Skeleton Loading)
 */

// Show skeleton loading state
function showSkeletonLoaders() {
    const container = document.getElementById('matches-container');
    container.innerHTML = '';

    // Create 4 skeleton cards
    for (let i = 0; i < 4; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'match-row skeleton-card';
        skeleton.innerHTML = `
            <div class="team">
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-logo"></div>
            </div>
            <div class="match-center">
                <div class="skeleton skeleton-time"></div>
                <div class="skeleton skeleton-vs"></div>
            </div>
            <div class="team">
                <div class="skeleton skeleton-logo"></div>
                <div class="skeleton skeleton-text"></div>
            </div>
        `;
        container.appendChild(skeleton);
    }
}

// Show user-friendly error message
function showError(message, isRetryable = true) {
    const container = document.getElementById('matches-container');
    container.innerHTML = `
        <div class="error-state">
            <div class="error-icon">⚠️</div>
            <div class="error-message">${message}</div>
            ${isRetryable ? '<button class="retry-btn" onclick="loadMatches()">🔄 إعادة المحاولة</button>' : ''}
        </div>
    `;

    // Track error event
    if (window.trackEvent) {
        trackEvent('matches_load_error', { message: message });
    }
}

// Load and display matches with comprehensive error handling
async function loadMatches() {
    const container = document.getElementById('matches-container');

    try {
        // Show skeleton while loading
        showSkeletonLoaders();

        // Fetch with timeout (10 seconds max)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch('data/matches.json', {
            signal: controller.signal,
            cache: 'no-store' // Always get fresh data
        });
        clearTimeout(timeoutId);

        // Check HTTP status
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Parse JSON safely
        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            throw new Error('البيانات غير صالحة');
        }

        // Validate data structure
        if (!data || typeof data !== 'object') {
            throw new Error('تنسيق البيانات غير صحيح');
        }

        if (!data.matches || !Array.isArray(data.matches)) {
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

        // Render matches
        container.innerHTML = '';
        data.matches.forEach(match => {
            try {
                const card = createMatchCard(match);
                container.appendChild(card);
            } catch (cardError) {
                // Silent fail for individual cards
            }
        });

        // Track successful load
        if (window.trackEvent) {
            trackEvent('matches_loaded', { count: data.matches.length });
        }

    } catch (error) {

        // Determine error type and show appropriate message
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

function createMatchCard(match) {
    // Validate required fields
    if (!match || !match.id || !match.home || !match.away) {
        throw new Error('Missing required match data');
    }

    const card = document.createElement('a');
    card.className = 'match-row';
    card.href = `watch.html?match=${match.id}`;

    // Time with fallback
    let timeString = match.time_label || '';
    if (!timeString && match.timestamp) {
        try {
            const matchDate = new Date(match.timestamp * 1000);
            const formattedTime = matchDate.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'UTC',
                hour12: false
            });
            timeString = `${formattedTime} GMT`;
        } catch (e) {
            timeString = '--:--';
        }
    }

    // Status with safe defaults
    let statusText = 'لم تبدأ';
    let statusClass = 'status-upcoming';
    if (match.status === 'LIVE') {
        statusText = '🔴 مباشر';
        statusClass = 'status-live';
    } else if (match.status === 'FT') {
        statusText = 'انتهت';
        statusClass = 'status-finished';
    }

    // Safe team names and logos
    const homeName = match.home.name || 'فريق 1';
    const awayName = match.away.name || 'فريق 2';
    const fallbackLogo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect fill='%23333' width='32' height='32'/%3E%3C/svg%3E";
    const homeLogo = match.home.logo || fallbackLogo;
    const awayLogo = match.away.logo || fallbackLogo;

    card.innerHTML = `
        <div class="team">
            <span class="team-name">${homeName}</span>
            <img src="${homeLogo}" alt="${homeName}" class="team-logo" onerror="this.src='${fallbackLogo}'">
        </div>
        
        <div class="match-center">
            <div class="match-time">${timeString}</div>
            <div class="vs">VS</div>
            <div class="match-status ${statusClass}">${statusText}</div>
        </div>
        
        <div class="team">
            <img src="${awayLogo}" alt="${awayName}" class="team-logo" onerror="this.src='${fallbackLogo}'">
            <span class="team-name">${awayName}</span>
        </div>
    `;

    return card;
}

// Load matches on page load
loadMatches();

// Refresh every minute
setInterval(loadMatches, 60000);
