import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MATCHES_PATH = path.join(__dirname, '..', 'public', 'data', 'matches.json');
const HISTORY_PATH = path.join(__dirname, '..', 'sent_telegram_notifications.json');

if (!TELEGRAM_TOKEN || !CHAT_ID) {
    console.log('⚠️ TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set. Skipping Telegram notification.');
    process.exit(0);
}

async function notifyTelegram() {
    try {
        // التحقق من التوقيت (إيقاف بين 4 صباحاً و 9 صباحاً بتوقيت GMT)
        const gmtHour = new Date().getUTCHours();
        if (gmtHour >= 4 && gmtHour < 9) {
            console.log(`🕒 التوقيت الحالي (${gmtHour} GMT) يقع ضمن فترة الهدوء. تخطي إرسال Telegram.`);
            return;
        }

        if (!fs.existsSync(MATCHES_PATH)) {
            console.log('❌ Matches file not found.');
            return;
        }

        const data = JSON.parse(fs.readFileSync(MATCHES_PATH, 'utf8'));
        const matches = data.matches || [];

        let history = [];
        if (fs.existsSync(HISTORY_PATH)) {
            history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
        }

        const now = Math.floor(Date.now() / 1000);

        const upcomingMatches = matches.filter(m => {
            const timeUntilStart = m.timestamp - now;

            // WIDE WINDOW: -30 mins to +30 mins
            const isSoon = timeUntilStart > -1800 && timeUntilStart < 1800;

            const inHistory = history.includes(m.id);
            const shouldNotify = isSoon && !inHistory;

            if (!shouldNotify) {
                if (inHistory) console.log(`⏩ Skipped ${m.home.name} (Already in history)`);
                else if (!isSoon) console.log(`⏳ Skipped ${m.home.name} (Outside window: starts in ${Math.round(timeUntilStart / 60)}m)`);
            } else {
                console.log(`🎯 Match Targeted: ${m.home.name} vs ${m.away.name} (Starts in ${Math.round(timeUntilStart / 60)} mins)`);
            }

            return shouldNotify;
        });

        if (upcomingMatches.length === 0) {
            console.log('ℹ️ No matches currently in the notification window (-30m to +30m) and not in history.');
            return;
        }

        console.log(`🚀 Sending ${upcomingMatches.length} notifications to Telegram...`);

        const siteUrl = process.env.SITE_URL || 'https://livematch-991.pages.dev';
        console.log('🔗 Site URL being used:', siteUrl);

        for (const match of upcomingMatches) {
            const league = match.league ? match.league.name : 'Unknown League';
            const home = match.home ? match.home.name : 'Home';
            const away = match.away ? match.away.name : 'Away';
            const time = match.time_label || (match.time ? `${match.time} GMT` : 'Soon');
            const link = `${siteUrl}/watch.html?match=${match.id}`;

            console.log(`🛠️ Constructing message for: ${home} vs ${away}`);

            let message = `🌟 <b>مباراة اليوم المباشرة</b>\n\n` +
                `🏟️ <b>${home}</b> 🆚 <b>${away}</b>\n\n` +
                `🏆 <b>البطولة:</b> ${league}\n` +
                `⏰ <b>التوقيت:</b> ${time}\n` +
                `✨ <b>الجودة:</b> Full HD 1080p\n\n` +
                `⚡ <b>شاهد المباراة مجاناً وبدون تقطيع هنا:</b>\n` +
                `👇👇👇\n` +
                `🚀 <a href="${link}">رابط البث المباشر الفوري</a>\n\n` +
                `🔥 <i>نتمنى لكم مشاهدة ممتعة!</i>\n` +
                `✅ لا تنسوا متابعة قناتنا لكل جديد!`;

            // Validate message
            if (!message || message.trim().length === 0) {
                console.error('❌ FATAL: Constructed message is empty! Using fallback.');
                message = `🔥 Match: ${home} vs ${away}\n🔗 Watch: ${link}`;
            }

            console.log(`📝 Message preview: ${message.substring(0, 50)}...`);

            await sendTelegramMessage(message);
            history.push(match.id);
        }

        fs.writeFileSync(HISTORY_PATH, JSON.stringify(history.slice(-100), null, 2));
        console.log('✅ Telegram history updated.');

    } catch (error) {
        console.error('💥 Error in Telegram script:', error.message);
    }
}

// Wrapper to try HTML first, then Plain Text
async function sendTelegramMessage(text) {
    // Attempt 1: HTML
    const success = await sendRequest(text, 'HTML');
    if (success) return;

    console.log('⚠️ HTML message failed. Retrying with PLAIN TEXT...');

    // Attempt 2: Plain Text (Strip HTML tags)
    const plainText = text.replace(/<[^>]*>?/gm, '') // Remove tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&');

    await sendRequest(plainText, undefined); // undefined parse_mode = proper plain text
}

function sendRequest(text, parseMode) {
    return new Promise((resolve) => {
        const payloadData = {
            chat_id: CHAT_ID,
            text: text,
            disable_web_page_preview: false
        };
        if (parseMode) payloadData.parse_mode = parseMode;

        const payload = JSON.stringify(payloadData);

        const options = {
            hostname: 'api.telegram.org',
            path: `/bot${TELEGRAM_TOKEN}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`✅ Telegram message sent (${parseMode || 'Plain'}).`);
                    resolve(true);
                } else {
                    console.error(`❌ Telegram error (${parseMode || 'Plain'}):`, body);
                    resolve(false);
                }
            });
        });

        req.on('error', (e) => {
            console.error('❌ Network error:', e.message);
            resolve(false);
        });

        req.write(payload);
        req.end();
    });
}

notifyTelegram();
