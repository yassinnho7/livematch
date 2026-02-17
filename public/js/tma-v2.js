const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

const CONFIG = {
    apiPath: "data/matches.json",
    syncIntervalMs: 60000,
    monetagZoneId: "10621765",
    interstitialTimeoutMs: 5000,
    themeKey: "tma_theme_v4",
    fallbackLogo:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Crect width='56' height='56' rx='28' fill='%23111f2b'/%3E%3Ccircle cx='28' cy='28' r='14' fill='%232a3a49'/%3E%3C/svg%3E"
};

const state = {
    matches: [],
    selectedMatch: null,
    currentView: "home",
    isFullscreen: false,
    bottomBannerMounted: false,
    serverBannerMounted: false
};

const els = {
    loader: document.getElementById("main-loader"),
    note: document.getElementById("note"),
    themeBtn: document.getElementById("theme-btn"),
    refreshBtn: document.getElementById("refresh-btn"),
    matches: document.getElementById("matches"),
    topBanner: document.getElementById("top-banner"),
    bottomBanner: document.getElementById("bottom-banner"),
    serversView: document.getElementById("servers-view"),
    serversBack: document.getElementById("servers-back"),
    serversTitle: document.getElementById("servers-title"),
    serversList: document.getElementById("servers-list"),
    serversBanner: document.getElementById("servers-banner"),
    playerView: document.getElementById("player-view"),
    playerStage: document.getElementById("player-stage"),
    playerControls: document.getElementById("player-controls"),
    iframe: document.getElementById("main-iframe"),
    fullscreenBtn: document.getElementById("fullscreen-btn")
};

document.addEventListener("DOMContentLoaded", bootstrap);

async function bootstrap() {
    initTelegram();
    bindEvents();
    applyTheme();
    mountTopBanner();
    showLoading();

    await fetchMatches();
    hideLoading();
    setInterval(fetchMatches, CONFIG.syncIntervalMs);
}

function initTelegram() {
    if (!tg) return;

    tg.ready();
    tg.expand();
    tg.BackButton.onClick(handleBack);

    if (tg.colorScheme === "dark" || tg.colorScheme === "light") {
        document.documentElement.setAttribute("data-theme", tg.colorScheme);
    }
}

function bindEvents() {
    els.themeBtn.addEventListener("click", () => {
        toggleTheme();
        haptic("light");
    });

    els.refreshBtn.addEventListener("click", async () => {
        haptic("light");
        showLoading();
        await fetchMatches();
        hideLoading();
    });

    els.matches.addEventListener("click", async (event) => {
        const card = event.target.closest("[data-match-id]");
        if (!card) return;
        const matchId = Number(card.getAttribute("data-match-id"));
        await onSelectMatch(matchId);
    });

    els.serversBack.addEventListener("click", () => navigateTo("home"));

    els.serversList.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-stream-url]");
        if (!btn) return;
        const streamUrl = btn.getAttribute("data-stream-url") || "";
        playStream(streamUrl);
    });

    els.fullscreenBtn.addEventListener("click", toggleFullscreen);

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
}

function applyTheme() {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") return;

    const saved = localStorage.getItem(CONFIG.themeKey);
    if (saved === "light" || saved === "dark") {
        document.documentElement.setAttribute("data-theme", saved);
    } else {
        document.documentElement.setAttribute("data-theme", "dark");
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(CONFIG.themeKey, next);
}

async function fetchMatches() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    try {
        const response = await fetch(`${CONFIG.apiPath}?t=${Date.now()}`, {
            signal: controller.signal,
            cache: "no-store"
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const list = Array.isArray(data.matches) ? data.matches : [];
        state.matches = list.map(normalizeMatch).filter(Boolean);

        renderMatches();
    } catch (_) {
        if (!state.matches.length) {
            renderError("تعذر تحميل المباريات حاليا");
        }
        showNote("فشل التحديث. سيتم المحاولة تلقائيا.");
    } finally {
        clearTimeout(timeout);
    }
}

function normalizeMatch(raw) {
    if (!raw || !raw.id || !raw.home || !raw.away) return null;

    return {
        id: Number(raw.id),
        status: normalizeStatus(raw.status),
        time: safeString(raw.time, "--:--"),
        score: normalizeScore(raw.score),
        leagueName: safeString(raw.league && raw.league.name, "بطولة"),
        leagueLogo: safeUrl(raw.league && raw.league.logo),
        homeName: safeString(raw.home && raw.home.name, "الفريق الأول"),
        homeLogo: safeUrl(raw.home && raw.home.logo),
        awayName: safeString(raw.away && raw.away.name, "الفريق الثاني"),
        awayLogo: safeUrl(raw.away && raw.away.logo),
        streams: normalizeStreams(raw.streams)
    };
}

function normalizeStatus(status) {
    if (status === "LIVE" || status === "NS" || status === "FT") return status;
    return "NS";
}

function normalizeScore(score) {
    if (!score) return "";
    if (typeof score === "string") return score;
    if (typeof score === "object" && Number.isFinite(score.home) && Number.isFinite(score.away)) {
        return `${score.home} - ${score.away}`;
    }
    return "";
}

function normalizeStreams(streams) {
    if (!Array.isArray(streams)) return [];
    return streams
        .map((s, index) => ({
            id: safeString(s && s.id, `stream_${index}`),
            channel: safeString(s && s.channel, "بث مباشر"),
            quality: safeString(s && s.quality, "HD"),
            url: safeUrl(s && s.url)
        }))
        .filter((s) => s.url);
}

function safeString(value, fallback = "") {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeUrl(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
        const url = new URL(value, window.location.origin);
        if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "data:") {
            return url.toString();
        }
    } catch (_) {
        return "";
    }
    return "";
}

function renderMatches() {
    clearNode(els.matches);

    if (!state.matches.length) {
        renderError("لا توجد مباريات متاحة الآن");
        return;
    }

    const sorted = [...state.matches].sort((a, b) => {
        const order = { LIVE: 0, NS: 1, FT: 2 };
        const byStatus = (order[a.status] ?? 9) - (order[b.status] ?? 9);
        if (byStatus !== 0) return byStatus;
        return a.time.localeCompare(b.time);
    });

    const live = sorted.filter((m) => m.status === "LIVE");
    const next = sorted.filter((m) => m.status === "NS");
    const done = sorted.filter((m) => m.status === "FT");

    if (live.length) els.matches.appendChild(createGroup("مباشر الآن", live));
    if (next.length) els.matches.appendChild(createGroup("مباريات قادمة", next));
    if (done.length) els.matches.appendChild(createGroup("مباريات منتهية", done));

    mountBottomBanner();
}

function createGroup(title, matches) {
    const group = createEl("section", "group");
    const head = createEl("div", "group-head");
    const h2 = createEl("h2", "", title);
    const count = createEl("span", "", String(matches.length));
    head.appendChild(h2);
    head.appendChild(count);
    group.appendChild(head);

    matches.forEach((match) => {
        group.appendChild(createMatchCard(match));
    });

    return group;
}

function createMatchCard(match) {
    const card = createEl("article", `match-card glass${match.status === "LIVE" ? " live" : ""}`);
    card.setAttribute("data-match-id", String(match.id));

    const top = createEl("div", "match-top");
    const league = createEl("div", "league");
    league.appendChild(createImg(match.leagueLogo || CONFIG.fallbackLogo, ""));
    league.appendChild(createEl("span", "", match.leagueName));
    top.appendChild(league);
    top.appendChild(createStatus(match));

    const main = createEl("div", "match-main");
    main.appendChild(createTeam(match.homeName, match.homeLogo));
    main.appendChild(createCenter(match));
    main.appendChild(createTeam(match.awayName, match.awayLogo));

    const bottom = createEl("div", "match-bottom");
    bottom.appendChild(createEl("span", "servers-count", `📺 ${match.streams.length} سيرفر`));
    bottom.appendChild(createEl("button", "watch-pill", "اختيار السيرفر"));

    card.appendChild(top);
    card.appendChild(main);
    card.appendChild(bottom);
    return card;
}

function createStatus(match) {
    if (match.status === "LIVE") return createEl("span", "status live", "مباشر");
    if (match.status === "FT") return createEl("span", "status ft", "انتهت");
    return createEl("span", "status", `${match.time} GMT`);
}

function createTeam(name, logo) {
    const team = createEl("div", "team");
    team.appendChild(createImg(logo || CONFIG.fallbackLogo, ""));
    team.appendChild(createEl("b", "", name));
    return team;
}

function createCenter(match) {
    const center = createEl("div", "center");
    if (match.score) center.appendChild(createEl("div", "score", match.score));
    else center.appendChild(createEl("div", "vs", "VS"));

    if (match.status !== "FT") {
        center.appendChild(createEl("div", "time", match.time || "--:--"));
        center.appendChild(createEl("div", "sub", match.status === "LIVE" ? "جارية الآن" : "بتوقيت GMT"));
    }
    return center;
}

function renderError(message) {
    clearNode(els.matches);
    const box = createEl("div", "empty glass", message);
    els.matches.appendChild(box);
}

async function onSelectMatch(matchId) {
    const match = state.matches.find((m) => m.id === matchId);
    if (!match) return;

    state.selectedMatch = match;
    haptic("medium");
    await showMonetagInterstitialFor5s();
    openServersView();
}

function openServersView() {
    if (!state.selectedMatch) return;
    state.currentView = "servers";
    els.serversTitle.textContent = `${state.selectedMatch.homeName} × ${state.selectedMatch.awayName}`;
    clearNode(els.serversList);

    const streams = state.selectedMatch.streams || [];
    if (!streams.length) {
        els.serversList.appendChild(createEl("div", "empty glass", "لا توجد سيرفرات متاحة لهذه المباراة"));
    } else {
        streams.forEach((stream, idx) => {
            const item = createEl("button", "server-item");
            item.type = "button";
            item.setAttribute("data-stream-url", stream.url);

            const icon = createEl("span", "server-icon", "📺");
            const text = createEl("div", "server-text");
            text.appendChild(createEl("b", "", `سيرفر ${idx + 1}`));
            text.appendChild(createEl("span", "", stream.channel));
            const quality = createEl("span", "server-quality", stream.quality);

            item.appendChild(icon);
            item.appendChild(text);
            item.appendChild(quality);
            els.serversList.appendChild(item);
        });
    }

    mountServersBanner();
    els.serversView.classList.add("active");
    els.playerView.classList.remove("active");
    syncBackButton();
}

function playStream(url) {
    if (!url) {
        showNote("رابط البث غير صالح.");
        return;
    }

    state.currentView = "player";
    haptic("success");
    els.iframe.src = "about:blank";
    els.serversView.classList.remove("active");
    els.playerView.classList.add("active");
    syncBackButton();

    setTimeout(() => {
        els.iframe.src = url;
    }, 140);
}

function navigateTo(view) {
    state.currentView = view;

    if (view === "home") {
        els.serversView.classList.remove("active");
        els.playerView.classList.remove("active");
        els.iframe.src = "about:blank";
        exitFullscreenIfNeeded();
    } else if (view === "servers") {
        els.playerView.classList.remove("active");
        els.serversView.classList.add("active");
        exitFullscreenIfNeeded();
    }

    syncBackButton();
}

function handleBack() {
    if (state.currentView === "player") {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            exitFullscreenIfNeeded();
            return;
        }
        navigateTo("servers");
        return;
    }

    if (state.currentView === "servers") {
        navigateTo("home");
        return;
    }

    askToExitApp();
}

function askToExitApp() {
    if (tg && typeof tg.showConfirm === "function") {
        tg.showConfirm("هل تريد الخروج من التطبيق؟", (ok) => {
            if (ok && typeof tg.close === "function") tg.close();
        });
        return;
    }

    const ok = window.confirm("هل تريد الخروج من التطبيق؟");
    if (ok) window.close();
}

async function toggleFullscreen() {
    const full = document.fullscreenElement || document.webkitFullscreenElement;

    if (!full) {
        try {
            if (els.playerStage.requestFullscreen) await els.playerStage.requestFullscreen();
            else if (els.playerStage.webkitRequestFullscreen) els.playerStage.webkitRequestFullscreen();

            state.isFullscreen = true;
            els.playerView.classList.add("fullscreen-mode");
            lockOrientation("landscape");
            haptic("light");
        } catch (_) {
            showNote("ملء الشاشة غير مدعوم على هذا الجهاز.");
        }
    } else {
        exitFullscreenIfNeeded();
    }
}

function onFullscreenChange() {
    const full = document.fullscreenElement || document.webkitFullscreenElement;
    if (full) {
        state.isFullscreen = true;
        els.playerView.classList.add("fullscreen-mode");
        return;
    }

    state.isFullscreen = false;
    els.playerView.classList.remove("fullscreen-mode");
    lockOrientation("portrait");
}

function exitFullscreenIfNeeded() {
    const full = document.fullscreenElement || document.webkitFullscreenElement;
    if (!full) {
        state.isFullscreen = false;
        els.playerView.classList.remove("fullscreen-mode");
        lockOrientation("portrait");
        return;
    }

    if (document.exitFullscreen) document.exitFullscreen().catch(() => { });
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();

    state.isFullscreen = false;
    els.playerView.classList.remove("fullscreen-mode");
    lockOrientation("portrait");
}

function lockOrientation(mode) {
    if (!screen.orientation || typeof screen.orientation.lock !== "function") return;
    screen.orientation.lock(mode).catch(() => { });
}

async function showMonetagInterstitialFor5s() {
    const adFn = window[`show_${CONFIG.monetagZoneId}`];
    if (typeof adFn !== "function") return;

    const timeout = wait(CONFIG.interstitialTimeoutMs);
    const adTask = adFn({ type: "preload" })
        .then(() => adFn())
        .catch(() => { });

    await Promise.race([adTask, timeout]);
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function mountTopBanner() {
    if (!els.topBanner) return;
    clearNode(els.topBanner);
    mountBanner(els.topBanner, "15d1ca482efd28581d78b70b9bb40556", 468, 60);
}

function mountBottomBanner() {
    if (state.bottomBannerMounted || !els.bottomBanner) return;
    state.bottomBannerMounted = true;
    clearNode(els.bottomBanner);
    mountBanner(els.bottomBanner, "2895cfc4a233371917690acdf46458f6", 300, 250);
}

function mountServersBanner() {
    if (state.serverBannerMounted || !els.serversBanner) return;
    state.serverBannerMounted = true;
    clearNode(els.serversBanner);
    mountBanner(els.serversBanner, "15d1ca482efd28581d78b70b9bb40556", 468, 60);
}

function mountBanner(container, key, width, height) {
    const setupScript = document.createElement("script");
    setupScript.text = `atOptions = { 'key': '${key}', 'format': 'iframe', 'height': ${height}, 'width': ${width}, 'params': {} };`;
    const invokeScript = document.createElement("script");
    invokeScript.src = `https://www.highperformanceformat.com/${key}/invoke.js`;
    container.appendChild(setupScript);
    container.appendChild(invokeScript);
}

function syncBackButton() {
    if (!tg) return;
    if (state.currentView === "home") tg.BackButton.show();
    else tg.BackButton.show();
}

function haptic(level) {
    if (!tg || !tg.HapticFeedback) return;
    if (level === "success") tg.HapticFeedback.notificationOccurred("success");
    else tg.HapticFeedback.impactOccurred(level || "light");
}

function showLoading() {
    if (!els.loader) return;
    els.loader.classList.remove("hidden");
}

function hideLoading() {
    if (!els.loader) return;
    els.loader.classList.add("hidden");
}

function showNote(text) {
    if (!els.note) return;
    els.note.textContent = text;
    els.note.classList.add("show");
    setTimeout(() => {
        els.note.classList.remove("show");
    }, 2500);
}

function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (typeof text === "string" && text.length) el.textContent = text;
    return el;
}

function createImg(src, className) {
    const img = document.createElement("img");
    if (className) img.className = className;
    img.loading = "lazy";
    img.src = src || CONFIG.fallbackLogo;
    img.alt = "";
    img.addEventListener("error", () => {
        img.src = CONFIG.fallbackLogo;
    });
    return img;
}

function clearNode(node) {
    while (node.firstChild) {
        node.removeChild(node.firstChild);
    }
}
