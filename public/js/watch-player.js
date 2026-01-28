// Watch Player with Ad Blocking - Based on embedblock.txt
// =========================================================

// Get match info from URL
const urlParams = new URLSearchParams(window.location.search);
const matchId = urlParams.get('match') || urlParams.get('id');

// Global variables for stream management
let currentMatch = null;
let availableStreams = [];
let currentStreamIndex = 0;
let streamLoadAttempts = 0;
const MAX_STREAM_ATTEMPTS = 3;

// Countdown timer
let countdown = 10;
const countdownElement = document.getElementById('countdown');
const monetizationLayer = document.getElementById('monetization-layer');
const streamContainer = document.getElementById('stream-container');
const streamIframe = document.getElementById('stream');

// Start countdown
const countdownInterval = setInterval(() => {
    countdown--;
    if (countdownElement) {
        countdownElement.textContent = countdown;
    }

    if (countdown <= 0) {
        clearInterval(countdownInterval);
        showStream();
    }
}, 1000);

// Show stream after countdown
function showStream() {
    // Hide monetization layer
    if (monetizationLayer) {
        monetizationLayer.style.display = 'none';
    }

    // Show stream container
    if (streamContainer) {
        streamContainer.style.display = 'block';
    }

    // Load best available stream
    loadBestStream();

    // Start ad blocking
    initAdBlocking();
}

// Load best available stream
function loadBestStream() {
    if (!availableStreams || availableStreams.length === 0) {
        console.error('No streams available');
        showStreamError('لا توجد روابط بث متاحة حالياً');
        return;
    }

    const stream = availableStreams[currentStreamIndex];
    console.log(`Loading stream ${currentStreamIndex + 1}/${availableStreams.length}:`, stream.source, stream.channel);

    if (streamIframe) {
        streamIframe.src = stream.url;

        // Handle stream load errors
        streamIframe.onerror = function () {
            console.error('Stream failed to load:', stream.url);
            tryNextStream();
        };

        // Timeout fallback
        setTimeout(() => {
            if (!streamIframe.contentDocument || streamIframe.contentDocument.readyState !== 'complete') {
                console.warn('Stream load timeout');
                tryNextStream();
            }
        }, 10000); // 10 seconds timeout
    }
}

// Try next stream
function tryNextStream() {
    streamLoadAttempts++;

    if (streamLoadAttempts >= MAX_STREAM_ATTEMPTS) {
        currentStreamIndex++;
        streamLoadAttempts = 0;
    }

    if (currentStreamIndex >= availableStreams.length) {
        console.error('All streams failed');
        showStreamError('جميع روابط البث غير متاحة حالياً. يرجى المحاولة لاحقاً.');
        return;
    }

    console.log('Trying next stream...');
    loadBestStream();
}

// Show stream error
function showStreamError(message) {
    if (streamContainer) {
        streamContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #000; color: #fff; font-family: Cairo, sans-serif; text-align: center; padding: 20px;">
                <div>
                    <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                    <h3 style="margin-bottom: 10px;">${message}</h3>
                    <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 30px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">إعادة المحاولة</button>
                </div>
            </div>
        `;
    }
}

// Ad Blocking System (from embedblock.txt)
// ==========================================

function initAdBlocking() {
    // Prevent all popups
    window.open = function () { return null; };

    // Prevent window.alert, confirm, prompt
    window.alert = function () { return false; };
    window.confirm = function () { return false; };
    window.prompt = function () { return null; };

    // Block clicks on suspicious links
    document.addEventListener('click', function (e) {
        if (e.target.tagName === 'A' && e.target.target === '_blank') {
            const href = e.target.href;
            if (href && (
                href.includes('ad') ||
                href.includes('ads') ||
                href.includes('popup') ||
                href.includes('sponsor') ||
                href.includes('click') ||
                href.includes('track')
            )) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
        }
    }, true);

    // Ad keywords to block
    const adKeywords = [
        'ad', 'ads', 'adv', 'advertising', 'advertisement',
        'banner', 'popup', 'sponsor', 'promo', 'promotion',
        'doubleclick', 'googlesyndication', 'googleadservices',
        'adservice', 'adsystem', 'adserver', 'adtech'
    ];

    // Remove ads continuously
    function removeAds() {
        // Remove suspicious iframes
        document.querySelectorAll('iframe').forEach(frame => {
            if (frame.id !== 'stream') {
                const src = frame.src.toLowerCase();
                const id = (frame.id || '').toLowerCase();
                const className = (frame.className || '').toLowerCase();

                for (let keyword of adKeywords) {
                    if (src.includes(keyword) || id.includes(keyword) || className.includes(keyword)) {
                        frame.remove();
                        break;
                    }
                }
            }
        });

        // Remove suspicious elements
        document.querySelectorAll('div, a, img, video').forEach(el => {
            const id = (el.id || '').toLowerCase();
            const className = (el.className || '').toLowerCase();

            for (let keyword of adKeywords) {
                if (id.includes(keyword) || className.includes(keyword)) {
                    el.remove();
                    break;
                }
            }
        });
    }

    // Run ad removal every 500ms
    setInterval(removeAds, 500);

    // Monitor DOM changes
    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            mutation.addedNodes.forEach(function (node) {
                if (node.nodeType === 1) {
                    const tagName = node.tagName;
                    const src = (node.src || '').toLowerCase();
                    const id = (node.id || '').toLowerCase();
                    const className = (node.className || '').toLowerCase();

                    // Remove suspicious elements immediately
                    for (let keyword of adKeywords) {
                        if (src.includes(keyword) || id.includes(keyword) || className.includes(keyword)) {
                            node.remove();
                            return;
                        }
                    }

                    // Remove iframes except main stream
                    if (tagName === 'IFRAME' && node.id !== 'stream') {
                        node.remove();
                    }
                }
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'href', 'class', 'id']
    });

    // Block ad requests via Service Worker
    if ('serviceWorker' in navigator) {
        const swCode = `
            self.addEventListener('fetch', function(event) {
                const url = event.request.url.toLowerCase();
                const adPatterns = ['ad', 'ads', 'doubleclick', 'googlesyndication', 'banner', 'popup', 'sponsor'];
                
                for (let pattern of adPatterns) {
                    if (url.includes(pattern)) {
                        event.respondWith(new Response('', {status: 200}));
                        return;
                    }
                }
            });
        `;

        const blob = new Blob([swCode], { type: 'application/javascript' });
        const swUrl = URL.createObjectURL(blob);

        navigator.serviceWorker.register(swUrl).catch(() => {
            // Service Worker not supported or failed
        });
    }

    // Prevent tracking
    if (navigator.doNotTrack !== '1') {
        Object.defineProperty(navigator, 'doNotTrack', {
            get: function () { return '1'; }
        });
    }

    // Block console errors from ads
    const originalError = console.error;
    console.error = function (...args) {
        const message = args.join(' ').toLowerCase();
        for (let keyword of adKeywords) {
            if (message.includes(keyword)) {
                return;
            }
        }
        originalError.apply(console, args);
    };

    // Prevent clicks on overlay ads
    document.addEventListener('mousedown', function (e) {
        if (e.target !== document.getElementById('stream') &&
            e.target.parentNode !== document.querySelector('.iframe-wrapper')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }
    }, true);

    // Protection against click hijacking
    let lastClick = 0;
    document.addEventListener('click', function (e) {
        const now = Date.now();
        if (now - lastClick < 300) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }
        lastClick = now;
    }, true);
}

// Load match info
async function loadMatchInfo() {
    try {
        const response = await fetch('/data/matches.json');
        const data = await response.json();

        if (data.matches && matchId) {
            const match = data.matches.find(m => m.id == matchId);

            if (match) {
                currentMatch = match;

                // Store available streams
                if (match.streams && match.streams.length > 0) {
                    availableStreams = match.streams;
                    console.log(`Found ${availableStreams.length} streams for this match`);
                } else {
                    console.warn('No streams found in match data');
                    availableStreams = [];
                }

                // Update match info with correct property names
                const homeNameEl = document.getElementById('home-name');
                const awayNameEl = document.getElementById('away-name');
                const homeLogoEl = document.getElementById('home-logo');
                const awayLogoEl = document.getElementById('away-logo');
                const leagueNameEl = document.getElementById('league-name');
                const leagueLogoEl = document.getElementById('league-logo');

                if (homeNameEl) homeNameEl.textContent = match.home.name;
                if (awayNameEl) awayNameEl.textContent = match.away.name;
                if (homeLogoEl) homeLogoEl.src = match.home.logo;
                if (awayLogoEl) awayLogoEl.src = match.away.logo;
                if (leagueNameEl) leagueNameEl.textContent = match.league.name;
                if (leagueLogoEl) leagueLogoEl.src = match.league.logo;

                // Update time with ENGLISH numerals
                const matchDate = new Date(match.timestamp * 1000);
                const timeString = matchDate.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });

                const matchTimeEl = document.getElementById('match-time');
                if (matchTimeEl) matchTimeEl.textContent = timeString;

                // Update status
                const now = Date.now() / 1000;
                let status = 'لم تبدأ';
                if (match.status === 'LIVE') {
                    status = 'بث مباشر 🔴';
                } else if (match.status === 'FT') {
                    status = 'انتهت';
                } else if (now >= match.timestamp && now < match.timestamp + 7200) {
                    status = 'بث مباشر 🔴';
                } else if (now >= match.timestamp + 7200) {
                    status = 'انتهت';
                }

                const matchStatusEl = document.getElementById('match-status');
                if (matchStatusEl) matchStatusEl.textContent = status;

                // Update info section
                const infoLeagueEl = document.getElementById('info-league');
                const infoTimeEl = document.getElementById('info-time');
                const infoStatusEl = document.getElementById('info-status');

                if (infoLeagueEl) infoLeagueEl.textContent = match.league.name;
                if (infoTimeEl) infoTimeEl.textContent = timeString;
                if (infoStatusEl) infoStatusEl.textContent = status;

                // Update page title
                document.title = `${match.home.name} vs ${match.away.name} - بث مباشر`;
            }
        }
    } catch (error) {
        console.error('Error loading match info:', error);
    }
}

// Initialize
loadMatchInfo();

// Monetization Integration Points
// ================================

// OGads Content Locker
// Add your OGads code here:
/*
(function() {
    // OGads locker code
})();
*/

// Adsterra Social Bar
// Add your Adsterra code here:
/*
atOptions = {
    'key' : 'YOUR_ADSTERRA_KEY',
    'format' : 'iframe',
    'height' : 60,
    'width' : 468,
    'params' : {}
};
*/

// Monetag Banner
// Add your Monetag code here:
/*
(function() {
    // Monetag banner code
})();
*/
