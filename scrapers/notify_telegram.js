import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const WEBAPP_URL = process.env.TMA_URL || 'https://livematch-991.pages.dev/tma';
const WELCOME_IMAGE_URL = process.env.TELEGRAM_WELCOME_IMAGE_URL || 'https://livematch-991.pages.dev/icons/icon-512x512.png';

const MATCHES_PATH = path.join(__dirname, '..', 'public', 'data', 'matches.json');
const SUBSCRIBERS_PATH = path.join(__dirname, '..', 'sent_telegram_notifications.json');
const STATE_PATH = path.join(__dirname, '..', 'telegram_prekick_state.json');
const BOT_STATE_PATH = path.join(__dirname, '..', 'telegram_bot_state.json');

const PRE_WINDOW_SECONDS = 30 * 60;
const POST_WINDOW_SECONDS = 15 * 60;
const MIN_REMAINING_SECONDS = 30;
const RETENTION_HOURS = 72;

function telegramApiPost(method, payload) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const req = https.request(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${method}`, {
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

function telegramApiGet(method, params = {}) {
    return new Promise((resolve, reject) => {
        const qs = new URLSearchParams(params).toString();
        const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/${method}${qs ? `?${qs}` : ''}`;
        https.get(url, (res) => {
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
        }).on('error', reject);
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

async function writeJsonFile(filePath, value) {
    await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
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
    const mins = Math.max(1, Math.round(Math.abs(seconds) / 60));
    return `${mins} Ø¯Ù‚ÙŠÙ‚Ø©`;
}

function buildMessage(match, secondsLeft) {
    const home = String(match?.home?.name || 'Ø§Ù„ÙØ±ÙŠÙ‚ Ø§Ù„Ø£ÙˆÙ„');
    const away = String(match?.away?.name || 'Ø§Ù„ÙØ±ÙŠÙ‚ Ø§Ù„Ø«Ø§Ù†ÙŠ');
    const league = String(match?.league?.name || 'Ø¨Ø·ÙˆÙ„Ø©');
    const timeLabel = String(match?.time_label || `${match?.time || '--:--'} GMT`);

    const timingLine = secondsLeft >= 0
        ? `ðŸ•’ Ù…ØªØ¨Ù‚ÙŠ Ø­ÙˆØ§Ù„ÙŠ ${formatRemaining(secondsLeft)} (${timeLabel})`
        : `ðŸ•’ Ø¨Ø¯Ø£Øª Ù…Ù†Ø° Ø­ÙˆØ§Ù„ÙŠ ${formatRemaining(secondsLeft)} (${timeLabel})`;

    return [
        'ðŸ”” ØªÙ†Ø¨ÙŠÙ‡ Ù…Ø¨Ø§Ø±Ø§Ø©',
        '',
        `âš½ ${home} Ã— ${away}`,
        `ðŸ† ${league}`,
        timingLine,
        '',
        'Ø§Ø¯Ø®Ù„ Ø§Ù„Ø¢Ù† Ù„Ø§Ø®ØªÙŠØ§Ø± Ø§Ù„Ø³ÙŠØ±ÙØ± ÙˆØ§Ù„Ù…Ø´Ø§Ù‡Ø¯Ø© Ù…Ø¨Ø§Ø´Ø±Ø©.'
    ].join('\n');
}

function buildWelcomeCaption() {
    return [
        'Ø£Ù‡Ù„Ø§Ù‹ Ø¨Ùƒ ÙÙŠ ØªÙ†Ø¨ÙŠÙ‡Ø§Øª LiveMatch ðŸ‘‹',
        '',
        'Ø³Ø£Ø±Ø³Ù„ Ù„Ùƒ ØªÙ†Ø¨ÙŠÙ‡Ù‹Ø§ Ù‚Ø¨Ù„ Ø§Ù„Ù…Ø¨Ø§Ø±ÙŠØ§Øª Ø§Ù„Ù…Ù‡Ù…Ø©ØŒ Ù…Ø¹ Ø²Ø± Ø¯Ø®ÙˆÙ„ Ù…Ø¨Ø§Ø´Ø± Ù„Ù„Ù…Ø´Ø§Ù‡Ø¯Ø©.',
        'Ù„Ø¥ÙŠÙ‚Ø§Ù Ø§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª ÙÙŠ Ø£ÙŠ ÙˆÙ‚Øª Ø£Ø±Ø³Ù„: /stop'
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

async function sendWelcome(chatId) {
    const caption = buildWelcomeCaption();
    try {
        await telegramApiPost('sendPhoto', {
            chat_id: chatId,
            photo: WELCOME_IMAGE_URL,
            caption,
            reply_markup: {
                inline_keyboard: [[
                    { text: 'ðŸ“º ÙØªØ­ Ø§Ù„Ø¨Ø« Ø§Ù„Ù…Ø¨Ø§Ø´Ø±', url: WEBAPP_URL }
                ]]
            }
        });
    } catch (err) {
        await telegramApiPost('sendMessage', {
            chat_id: chatId,
            text: caption,
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [[
                    { text: 'ðŸ“º ÙØªØ­ Ø§Ù„Ø¨Ø« Ø§Ù„Ù…Ø¨Ø§Ø´Ø±', url: WEBAPP_URL }
                ]]
            }
        });
        console.warn(`âš ï¸ Welcome photo failed for ${chatId}, sent text fallback: ${err.message}`);
    }
}

async function processBotCommands(existingSubscribers) {
    const botState = await readJsonFile(BOT_STATE_PATH, { last_update_id: 0 });
    const lastUpdateId = Number(botState.last_update_id) || 0;

    let updates = [];
    try {
        const response = await telegramApiGet('getUpdates', {
            timeout: '0',
            allowed_updates: JSON.stringify(['message']),
            offset: String(lastUpdateId + 1)
        });
        updates = Array.isArray(response.result) ? response.result : [];
    } catch (err) {
        console.warn(`âš ï¸ getUpdates failed: ${err.message}`);
        return existingSubscribers;
    }

    if (!updates.length) return existingSubscribers;

    const subscribers = new Set(existingSubscribers.map((id) => Number(id)));
    let maxUpdateId = lastUpdateId;

    for (const update of updates) {
        const updateId = Number(update.update_id) || 0;
        if (updateId > maxUpdateId) maxUpdateId = updateId;

        const message = update.message;
        if (!message || !message.chat || !message.text) continue;

        const chatId = Number(message.chat.id);
        if (!Number.isFinite(chatId) || chatId <= 0) continue;

        const text = String(message.text || '').trim().toLowerCase();

        if (text.startsWith('/start')) {
            subscribers.add(chatId);
            await sendWelcome(chatId);
            continue;
        }

        if (text.startsWith('/stop')) {
            subscribers.delete(chatId);
            try {
                await telegramApiPost('sendMessage', {
                    chat_id: chatId,
                    text: 'ØªÙ… Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ ÙÙŠ Ø§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª. ÙŠÙ…ÙƒÙ†Ùƒ Ø§Ù„Ø¹ÙˆØ¯Ø© ÙÙŠ Ø£ÙŠ ÙˆÙ‚Øª Ø¹Ø¨Ø± /start'
                });
            } catch (err) {
                console.warn(`âš ï¸ stop ack failed for ${chatId}: ${err.message}`);
            }
            continue;
        }

        if (text.startsWith('/help')) {
            try {
                await telegramApiPost('sendMessage', {
                    chat_id: chatId,
                    text: 'Ø§Ù„Ø£ÙˆØ§Ù…Ø± Ø§Ù„Ù…ØªØ§Ø­Ø©:\n/start Ù„Ù„Ø§Ø´ØªØ±Ø§Ùƒ\n/stop Ù„Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ\n/help Ù„Ù„Ù…Ø³Ø§Ø¹Ø¯Ø©'
                });
            } catch (err) {
                console.warn(`âš ï¸ help ack failed for ${chatId}: ${err.message}`);
            }
        }
    }

    await writeJsonFile(BOT_STATE_PATH, { last_update_id: maxUpdateId });
    return uniqueChatIds([...subscribers]);
}

function isInNotificationWindow(match, now) {
    const ts = Number(match?.timestamp) || 0;
    if (ts <= 0) return false;
    const left = ts - now;

    const preWindow = left <= PRE_WINDOW_SECONDS && left >= MIN_REMAINING_SECONDS;
    const postWindow = left < 0 && Math.abs(left) <= POST_WINDOW_SECONDS;
    return preWindow || postWindow;
}

async function notifyTelegram() {
    if (!TELEGRAM_TOKEN) {
        console.log('ðŸ“± Telegram skipped: TELEGRAM_BOT_TOKEN is missing.');
        return;
    }

    const now = Math.floor(Date.now() / 1000);

    const matchesData = await readJsonFile(MATCHES_PATH, { matches: [] });
    const subscribersData = await readJsonFile(SUBSCRIBERS_PATH, []);
    const stateRaw = await readJsonFile(STATE_PATH, { sent: {} });
    const state = pruneState(stateRaw, now);

    const withEnv = collectChatIds(subscribersData, CHAT_ID);
    const updatedSubscribers = await processBotCommands(withEnv);
    const chatIds = uniqueChatIds(updatedSubscribers);

    await writeJsonFile(SUBSCRIBERS_PATH, chatIds);

    if (!chatIds.length) {
        console.log('ðŸ“± Telegram skipped: no subscriber chat IDs found.');
        await writeJsonFile(STATE_PATH, state);
        return;
    }

    const matches = Array.isArray(matchesData.matches) ? matchesData.matches : [];
    const candidates = matches.filter((match) => {
        const status = String(match?.status || '').toUpperCase();
        if (status !== 'NS') return false;
        if (!hasRealStreams(match)) return false;
        if (!isInNotificationWindow(match, now)) return false;

        const key = buildStateKey(match);
        return !state.sent[key];
    });

    if (!candidates.length) {
        console.log('ðŸ“± Telegram: no match reminders to send.');
        await writeJsonFile(STATE_PATH, state);
        return;
    }

    let sentCount = 0;

    for (const match of candidates) {
        const left = (Number(match.timestamp) || now) - now;
        const text = buildMessage(match, left);
        const key = buildStateKey(match);

        for (const chatId of chatIds) {
            try {
                await telegramApiPost('sendMessage', {
                    chat_id: chatId,
                    text,
                    disable_web_page_preview: true,
                    reply_markup: {
                        inline_keyboard: [[
                            { text: 'ðŸ“º Ø¯Ø®ÙˆÙ„ Ù„Ù„Ù…Ø´Ø§Ù‡Ø¯Ø©', url: WEBAPP_URL }
                        ]]
                    }
                });
                sentCount++;
            } catch (err) {
                console.warn(`âš ï¸ Telegram send failed for ${chatId}: ${err.message}`);
            }
        }

        state.sent[key] = now;
    }

    await writeJsonFile(STATE_PATH, state);
    console.log(`ðŸ“± Telegram reminders sent: ${sentCount}`);
}

export { notifyTelegram };

notifyTelegram();
