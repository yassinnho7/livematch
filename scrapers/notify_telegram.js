import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const WEBAPP_URL = process.env.TMA_URL || 'https://livematch-991.pages.dev/tma';

const MATCHES_PATH = path.join(__dirname, '..', 'public', 'data', 'matches.json');
const SUBSCRIBERS_PATH = path.join(__dirname, '..', 'sent_telegram_notifications.json');
const STATE_PATH = path.join(__dirname, '..', 'telegram_prekick_state.json');

const PRE_KICKOFF_SECONDS = 10 * 60;
const MIN_REMAINING_SECONDS = 30;
const RETENTION_HOURS = 72;

function requestJson(url, payload) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data || '{}');
                    if (!parsed.ok) {
                        reject(new Error(parsed.description || `Telegram API error (${res.statusCode})`));
                        return;
                    }
                    resolve(parsed);
                } catch (err) {
                    reject(err);
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function readJsonFile(filePath, fallback) {
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        return JSON.parse(raw);
    } catch (_) {
        return fallback;
    }
}

function uniqueChatIds(ids) {
    return [...new Set(
        ids
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0)
    )];
}

function collectChatIds(fileIds, envChatId) {
    const fromFile = Array.isArray(fileIds) ? fileIds : [];
    const fromEnv = String(envChatId || '')
        .split(/[\s,]+/)
        .map((v) => v.trim())
        .filter(Boolean);
    return uniqueChatIds([...fromFile, ...fromEnv]);
}

function hasRealStreams(match) {
    if (!Array.isArray(match?.streams)) return false;
    return match.streams.some((stream) => {
        const url = String(stream?.url || '').toLowerCase();
        if (!url.startsWith('http')) return false;
        if (url.includes('koraplus.blog/kooracity')) return false;
        if (url.includes('koraplus.blog/koora-live')) return false;
        return true;
    });
}

function formatRemaining(seconds) {
    const mins = Math.max(1, Math.round(seconds / 60));
    return `${mins} دقيقة`;
}

function buildMessage(match, secondsLeft) {
    const home = String(match?.home?.name || 'الفريق الأول');
    const away = String(match?.away?.name || 'الفريق الثاني');
    const league = String(match?.league?.name || 'بطولة');
    const timeLabel = String(match?.time_label || `${match?.time || '--:--'} GMT`);
    return [
        '🔔 تذكير قبل بداية المباراة',
        '',
        `⚽ ${home} × ${away}`,
        `🏆 ${league}`,
        `🕒 بعد حوالي ${formatRemaining(secondsLeft)} (${timeLabel})`,
        '',
        'ادخل الآن لاختيار السيرفر قبل بداية اللقاء.'
    ].join('\n');
}

function buildStateKey(match) {
    const id = Number(match?.id) || 0;
    const ts = Number(match?.timestamp) || 0;
    return `${id}_${ts}`;
}

function pruneState(state, nowSec) {
    const sent = state?.sent && typeof state.sent === 'object' ? state.sent : {};
    const maxAge = RETENTION_HOURS * 60 * 60;
    const pruned = {};
    Object.entries(sent).forEach(([k, value]) => {
        const ts = Number(value) || 0;
        if (ts > 0 && nowSec - ts <= maxAge) {
            pruned[k] = ts;
        }
    });
    return { sent: pruned };
}

async function notifyTelegram() {
    if (!TELEGRAM_TOKEN) {
        console.log('📱 Telegram skipped: TELEGRAM_BOT_TOKEN is missing.');
        return;
    }

    const now = Math.floor(Date.now() / 1000);

    const matchesData = await readJsonFile(MATCHES_PATH, { matches: [] });
    const subscribersData = await readJsonFile(SUBSCRIBERS_PATH, []);
    const stateRaw = await readJsonFile(STATE_PATH, { sent: {} });
    const state = pruneState(stateRaw, now);

    const chatIds = collectChatIds(subscribersData, CHAT_ID);
    if (!chatIds.length) {
        console.log('📱 Telegram skipped: no subscriber chat IDs found.');
        await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
        return;
    }

    const matches = Array.isArray(matchesData.matches) ? matchesData.matches : [];
    const candidates = matches.filter((match) => {
        const status = String(match?.status || '').toUpperCase();
        if (status !== 'NS') return false;
        if (!hasRealStreams(match)) return false;

        const ts = Number(match?.timestamp) || 0;
        if (ts <= 0) return false;

        const left = ts - now;
        if (left > PRE_KICKOFF_SECONDS || left < MIN_REMAINING_SECONDS) return false;

        const key = buildStateKey(match);
        return !state.sent[key];
    });

    if (!candidates.length) {
        console.log('📱 Telegram: no pre-kickoff notifications to send.');
        await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
        return;
    }

    const apiUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    let sentCount = 0;

    for (const match of candidates) {
        const left = (Number(match.timestamp) || now) - now;
        const text = buildMessage(match, left);
        const key = buildStateKey(match);

        for (const chatId of chatIds) {
            try {
                await requestJson(apiUrl, {
                    chat_id: chatId,
                    text,
                    disable_web_page_preview: true,
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '📺 دخول للمشاهدة', url: WEBAPP_URL }
                        ]]
                    }
                });
                sentCount++;
            } catch (err) {
                console.warn(`⚠️ Telegram send failed for ${chatId}: ${err.message}`);
            }
        }

        state.sent[key] = now;
    }

    await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
    console.log(`📱 Telegram pre-kickoff notifications sent: ${sentCount}`);
}

export { notifyTelegram };

notifyTelegram();
