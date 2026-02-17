/**
 * LiveMatch TMA v3.0
 * Safer rendering, stronger UI flow, and smoother Telegram integration.
 */

const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

const CONFIG = {
    apiPath: "data/matches.json",
    syncIntervalMs: 60000,
    adZoneId: "10621765",
    adCooldownMs: 30000,
    adTimeoutMs: 2800,
    themeKey: "livematch_tma_theme_v3",
    fallbackLogo:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Crect width='56' height='56' rx='28' fill='%2312202e'/%3E%3Ccircle cx='28' cy='28' r='14' fill='%232a3d50'/%3E%3C/svg%3E"
};

const state = {
    matches: [],
    filtered: [],
    selectedMatch: null,
    selectedFilter: "ALL",
    searchQuery: "",
    currentView: "home",
    isFullscreen: false,
    adLastShownAt: 0,
    loadedOnce: false
};

const els = {
    loader: document.getElementById("main-loader"),
    notification: document.getElementById("notification"),
    matchesContainer: document.getElementById("matches-container"),
    searchInput: document.getElementById("search-input"),
    filterRow: document.getElementById("filter-row"),
    countAll: document.getElementById("count-all"),
    countLive: document.getElementById("count-live"),
    countNext: document.getElementById("count-next"),
    themeBtn: document.getElementById("theme-btn"),
    refreshBtn: document.getElementById("refresh-btn"),
    serversView: document.getElementById("servers-view"),
    serverList: document.getElementById("server-list"),
    serverTitle: document.getElementById("server-title"),
    serversBackBtn: document.getElementById("servers-back-btn"),
    playerView: document.getElementById("player-view"),
    playerBackBtn: document.getElementById("player-back-btn"),
    closePlayerBtn: document.getElementById("close-player-btn"),
    fullscreenBtn: document.getElementById("fullscreen-btn"),
    playerMatchName: document.getElementById("player-match-name"),
    mainIframe: document.getElementById("main-iframe"),
    playerStage: document.getElementById("player-stage")
};

document.addEventListener("DOMContentLoaded", bootstrap);

async function bootstrap() {
    initTelegramBridge();
    bindEvents();
    applyInitialTheme();
    showSkeletons(4);

    await fetchMatches();
    setInterval(fetchMatches, CONFIG.syncIntervalMs);
}

function initTelegramBridge() {
    if (!tg) return;

    tg.ready();
    tg.expand();

    if (tg.colorScheme === "light" || tg.colorScheme === "dark") {
        document.documentElement.setAttribute("data-theme", tg.colorScheme);
    }

    tg.BackButton.onClick(() => {
        if (state.currentView === "player") {
            navigateTo("servers");
            return;
        }
        if (state.currentView === "servers") {
            navigateTo("home");
        }
    });
}

function bindEvents() {
    els.searchInput.addEventListener("input", (event) => {
        state.searchQuery = (event.target.value || "").trim().toLowerCase();
        applyFiltersAndRender();
    });

    els.filterRow.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-filter]");
        if (!btn) return;

        state.selectedFilter = btn.getAttribute("data-filter");
        setActiveFilterButton();
        haptic("light");
        applyFiltersAndRender();
    });

    els.refreshBtn.addEventListener("click", async () => {
        haptic("light");
        await fetchMatches(true);
    });

    els.themeBtn.addEventListener("click", () => {
        toggleTheme();
        haptic("light");
    });

    els.matchesContainer.addEventListener("click", (event) => {
        const card = event.target.closest("[data-match-id]");
        if (!card) return;
        const matchId = Number(card.getAttribute("data-match-id"));
        selectMatch(matchId);
    });

    els.serversBackBtn.addEventListener("click", () => navigateTo("home"));
    els.playerBackBtn.addEventListener("click", () => navigateTo("servers"));
    els.closePlayerBtn.addEventListener("click", () => navigateTo("servers"));
    els.fullscreenBtn.addEventListener("click", toggleFullscreen);
}

function applyInitialTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") return;

    const saved = localStorage.getItem(CONFIG.themeKey);
    if (saved === "light" || saved === "dark") {
        document.documentElement.setAttribute("data-theme", saved);
        return;
    }

    document.documentElement.setAttribute("data-theme", "dark");
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(CONFIG.themeKey, next);
}

async function fetchMatches(manual = false) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    try {
        if (!state.loadedOnce && !manual) showSkeletons(4);

        const response = await fetch(`${CONFIG.apiPath}?t=${Date.now()}`, {
            signal: controller.signal,
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const incoming = Array.isArray(data.matches) ? data.matches : [];
        state.matches = incoming.map(normalizeMatch).filter(Boolean);

        updateStats();
        applyFiltersAndRender();
        state.loadedOnce = true;
        hideLoader();
    } catch (error) {
        if (!state.loadedOnce) {
            renderEmpty("تعذر تحميل المباريات", "تحقق من الاتصال ثم حاول مرة أخرى.");
        }
        showNotification("فشل التحديث. سيتم إعادة المحاولة تلقائيا.");
        hideLoader();
    } finally {
        clearTimeout(timeout);
    }
}

function normalizeMatch(raw) {
    if (!raw || !raw.id || !raw.home || !raw.away) return null;

    const status = normalizeStatus(raw.status);
    const homeName = safeString(raw.home.name, "الفريق الأول");
    const awayName = safeString(raw.away.name, "الفريق الثاني");
    const leagueName = safeString(raw.league && raw.league.name, "بطولة");

    return {
        id: Number(raw.id),
        status,
        time: safeString(raw.time, "--:--"),
        timeLabel: safeString(raw.time_label, ""),
        score: normalizeScore(raw.score),
        league: {
            name: leagueName,
            logo: safeUrl(raw.league && raw.league.logo)
        },
        home: {
            name: homeName,
            logo: safeUrl(raw.home.logo)
        },
        away: {
            name: awayName,
            logo: safeUrl(raw.away.logo)
        },
        streams: Array.isArray(raw.streams)
            ? raw.streams
                .map((s, idx) => ({
                    id: safeString(s && s.id, `s_${idx}`),
                    channel: safeString(s && s.channel, `Server ${idx + 1}`),
                    quality: safeString(s && s.quality, "HD"),
                    url: safeUrl(s && s.url)
                }))
                .filter((s) => s.url)
            : []
    };
}

function normalizeStatus(status) {
    if (status === "LIVE" || status === "FT" || status === "NS") return status;
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

function updateStats() {
    const all = state.matches.length;
    const live = state.matches.filter((m) => m.status === "LIVE").length;
    const next = state.matches.filter((m) => m.status === "NS").length;

    els.countAll.textContent = String(all);
    els.countLive.textContent = String(live);
    els.countNext.textContent = String(next);
}

function applyFiltersAndRender() {
    const sorted = [...state.matches].sort((a, b) => {
        const order = { LIVE: 0, NS: 1, FT: 2 };
        const diff = (order[a.status] ?? 9) - (order[b.status] ?? 9);
        if (diff !== 0) return diff;
        return a.time.localeCompare(b.time);
    });

    const byFilter = sorted.filter((match) => {
        if (state.selectedFilter === "ALL") return true;
        return match.status === state.selectedFilter;
    });

    const q = state.searchQuery;
    state.filtered = byFilter.filter((match) => {
        if (!q) return true;
        const haystack = `${match.home.name} ${match.away.name} ${match.league.name}`.toLowerCase();
        return haystack.includes(q);
    });

    renderMatches();
}

function renderMatches() {
    clearElement(els.matchesContainer);

    if (!state.filtered.length) {
        renderEmpty("لا توجد نتائج", "حاول تغيير الفلتر أو البحث.");
        return;
    }

    const groups = {
        LIVE: state.filtered.filter((m) => m.status === "LIVE"),
        NS: state.filtered.filter((m) => m.status === "NS"),
        FT: state.filtered.filter((m) => m.status === "FT")
    };

    if (groups.LIVE.length) {
        els.matchesContainer.appendChild(createSection("مباشر الآن", groups.LIVE));
    }
    if (groups.NS.length) {
        els.matchesContainer.appendChild(createSection("مباريات قادمة", groups.NS));
    }
    if (groups.FT.length) {
        els.matchesContainer.appendChild(createSection("مباريات منتهية", groups.FT));
    }
}

function createSection(title, matches) {
    const block = createEl("section", "section-block");
    const head = createEl("div", "section-head");
    const titleEl = createEl("h3", "section-title", title);
    const count = createEl("span", "section-count", `${matches.length}`);

    head.appendChild(titleEl);
    head.appendChild(count);
    block.appendChild(head);

    for (const match of matches) {
        block.appendChild(createMatchCard(match));
    }

    return block;
}

function createMatchCard(match) {
    const live = match.status === "LIVE";
    const finished = match.status === "FT";

    const card = createEl("article", `match-card glass${live ? " live-card" : ""}`);
    card.setAttribute("data-match-id", String(match.id));

    const header = createEl("div", "match-header");
    const league = createEl("div", "league");
    const leagueLogo = createImg(match.league.logo || CONFIG.fallbackLogo, "league-logo", "league");
    const leagueName = createEl("span", "league-name", match.league.name);
    league.appendChild(leagueLogo);
    league.appendChild(leagueName);
    header.appendChild(league);
    header.appendChild(createStatusPill(match));

    const main = createEl("div", "match-main");
    main.appendChild(createTeam(match.home.name, match.home.logo));
    main.appendChild(createCenterBox(match, live, finished));
    main.appendChild(createTeam(match.away.name, match.away.logo));

    const footer = createEl("div", "card-footer");
    footer.appendChild(createEl("span", "server-chip", `📺 ${match.streams.length} سيرفر`));
    footer.appendChild(createEl("button", "watch-chip", finished ? "عرض التفاصيل" : "شاهد الآن"));

    card.appendChild(header);
    card.appendChild(main);
    card.appendChild(footer);
    return card;
}

function createStatusPill(match) {
    if (match.status === "LIVE") return createEl("span", "status-pill live", "مباشر");
    if (match.status === "FT") return createEl("span", "status-pill finished", "انتهت");
    const label = match.time ? `${match.time} GMT` : "لم تبدأ";
    return createEl("span", "status-pill", label);
}

function createTeam(name, logo) {
    const team = createEl("div", "team");
    team.appendChild(createImg(logo || CONFIG.fallbackLogo, "team-logo", name));
    team.appendChild(createEl("span", "team-name", name));
    return team;
}

function createCenterBox(match, live, finished) {
    const center = createEl("div", "center-box");

    if (match.score) {
        center.appendChild(createEl("div", "score", match.score));
    } else {
        center.appendChild(createEl("div", "vs", "VS"));
    }

    if (!finished) {
        center.appendChild(createEl("div", "time", match.time || "--:--"));
        center.appendChild(createEl("div", "time-sub", live ? "جارية الآن" : "بتوقيت GMT"));
    } else if (!match.score) {
        center.appendChild(createEl("div", "time-sub", "منتهية"));
    }

    return center;
}

function renderEmpty(title, hint) {
    clearElement(els.matchesContainer);
    const empty = createEl("div", "empty-wrap glass");
    empty.appendChild(createEl("h3", "", title));
    empty.appendChild(createEl("p", "", hint));
    els.matchesContainer.appendChild(empty);
}

function showSkeletons(count) {
    clearElement(els.matchesContainer);
    for (let i = 0; i < count; i += 1) {
        els.matchesContainer.appendChild(createEl("div", "skeleton"));
    }
}

async function selectMatch(matchId) {
    const match = state.matches.find((m) => m.id === matchId);
    if (!match) return;

    state.selectedMatch = match;
    haptic("medium");

    await triggerMonetagAd("inter");
    navigateTo("servers");
    renderServers();
}

function renderServers() {
    clearElement(els.serverList);

    const match = state.selectedMatch;
    if (!match) {
        renderServerMessage("لم يتم اختيار مباراة بعد.");
        return;
    }

    els.serverTitle.textContent = `${match.home.name} × ${match.away.name}`;

    if (!match.streams.length) {
        renderServerMessage("لا توجد روابط متاحة لهذه المباراة حالياً.");
        return;
    }

    match.streams.forEach((stream, idx) => {
        const button = createEl("button", "server-item");
        button.type = "button";
        button.addEventListener("click", () => playStream(stream.url));

        const icon = createEl("span", "server-icon", "📺");
        const info = createEl("div", "server-info");
        const title = createEl("b", "", `سيرفر ${idx + 1}`);
        const subtitle = createEl("span", "", stream.channel || "قناة البث");
        const quality = createEl("span", "server-quality", stream.quality || "HD");

        info.appendChild(title);
        info.appendChild(subtitle);
        button.appendChild(icon);
        button.appendChild(info);
        button.appendChild(quality);

        els.serverList.appendChild(button);
    });
}

function renderServerMessage(message) {
    const box = createEl("div", "empty-wrap glass");
    box.appendChild(createEl("h3", "", "تنبيه"));
    box.appendChild(createEl("p", "", message));
    els.serverList.appendChild(box);
}

async function playStream(url) {
    if (!url) {
        showNotification("رابط البث غير صالح.");
        return;
    }

    haptic("success");
    await triggerMonetagAd("pop");
    navigateTo("player");

    if (state.selectedMatch) {
        els.playerMatchName.textContent = `${state.selectedMatch.home.name} × ${state.selectedMatch.away.name}`;
    }

    els.mainIframe.src = "about:blank";
    setTimeout(() => {
        els.mainIframe.src = url;
    }, 280);
}

function navigateTo(view) {
    state.currentView = view;

    els.serversView.classList.remove("active");
    els.playerView.classList.remove("active");

    if (view === "servers") {
        els.serversView.classList.add("active");
    } else if (view === "player") {
        els.playerView.classList.add("active");
    } else if (view === "home") {
        els.mainIframe.src = "about:blank";
        state.isFullscreen = false;
        els.fullscreenBtn.textContent = "⛶ تكبير";
    }

    if (!tg) return;
    if (view === "home") tg.BackButton.hide();
    else tg.BackButton.show();
}

async function toggleFullscreen() {
    if (!document.fullscreenElement) {
        try {
            await els.playerStage.requestFullscreen();
            state.isFullscreen = true;
            els.fullscreenBtn.textContent = "🗗 تصغير";
            haptic("light");
        } catch (_) {
            showNotification("التكبير غير مدعوم على هذا الجهاز.");
        }
    } else {
        try {
            await document.exitFullscreen();
            state.isFullscreen = false;
            els.fullscreenBtn.textContent = "⛶ تكبير";
        } catch (_) {
            // ignore
        }
    }
}

async function triggerMonetagAd(type) {
    const now = Date.now();
    if (now - state.adLastShownAt < CONFIG.adCooldownMs) return;

    const adFn = window[`show_${CONFIG.adZoneId}`];
    if (typeof adFn !== "function") return;

    const timeoutGuard = new Promise((resolve) => {
        setTimeout(resolve, CONFIG.adTimeoutMs);
    });

    try {
        if (type === "inter") {
            await Promise.race([adFn({ type: "preload" }).then(() => adFn()), timeoutGuard]);
        } else if (type === "pop") {
            await Promise.race([adFn({ type: "pop" }), timeoutGuard]);
        }
        state.adLastShownAt = Date.now();
    } catch (_) {
        // ignore ad failures to keep UX smooth
    }
}

function haptic(level) {
    if (!tg || !tg.HapticFeedback) return;

    if (level === "success") {
        tg.HapticFeedback.notificationOccurred("success");
        return;
    }

    tg.HapticFeedback.impactOccurred(level || "light");
}

function setActiveFilterButton() {
    const buttons = els.filterRow.querySelectorAll("[data-filter]");
    buttons.forEach((btn) => {
        const active = btn.getAttribute("data-filter") === state.selectedFilter;
        btn.classList.toggle("active", active);
    });
}

function showNotification(message) {
    els.notification.textContent = message;
    els.notification.classList.add("show");
    setTimeout(() => {
        els.notification.classList.remove("show");
    }, 2600);
}

function hideLoader() {
    if (!els.loader) return;
    els.loader.classList.add("hidden");
}

function clearElement(node) {
    while (node.firstChild) {
        node.removeChild(node.firstChild);
    }
}

function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (typeof text === "string" && text.length) el.textContent = text;
    return el;
}

function createImg(src, className, alt) {
    const img = document.createElement("img");
    img.className = className;
    img.alt = alt || "";
    img.loading = "lazy";
    img.src = src || CONFIG.fallbackLogo;
    img.addEventListener("error", () => {
        img.src = CONFIG.fallbackLogo;
    });
    return img;
}
