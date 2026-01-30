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

            // STRICTER WINDOW: -5 mins to +20 mins
            // Allows notifying for matches starting in next 20 mins
            // Also allows notifying for matches that started 5 mins ago (grace period)
            const isSoon = timeUntilStart > -300 && timeUntilStart < 1200;

            // Check conditions
            const inHistory = history.includes(m.id);
            const shouldNotify = isSoon && !inHistory;

            if (!shouldNotify) {
                // Debug: Why was it skipped?
                if (inHistory) console.log(`⏩ Skipped ${m.home.name} (Already in history)`);
                else if (!isSoon) console.log(`⏳ Skipped ${m.home.name} (Outside window: starts in ${Math.round(timeUntilStart / 60)}m)`);
            } else {
                console.log(`🎯 Match Targeted: ${m.home.name} vs ${m.away.name} (Starts in ${Math.round(timeUntilStart / 60)} mins)`);
            }

            return shouldNotify;
        });

        if (upcomingMatches.length === 0) {
            console.log('ℹ️ No matches currently in the notification window (-5m to +20m) and not in history.');
            return;
        }

        console.log(`🚀 Sending ${upcomingMatches.length} notifications to Telegram...`);

        for (const match of upcomingMatches) {
            const message = `🌟 <b>مباراة اليوم المباشرة</b>\n\n` +
                `🏟️ <b>${match.home.name}</b> 🆚 <b>${match.away.name}</b>\n\n` +
                `🏆 <b>البطولة:</b> ${match.league.name}\n` +
                `⏰ <b>التوقيت:</b> ${match.time_label || match.time + ' GMT'}\n` +
                `✨ <b>الجودة:</b> Full HD 1080p\n\n` +
                `⚡ <b>شاهد المباراة مجاناً وبدون تقطيع هنا:</b>\n` +
                `👇👇👇\n` +
                `🚀 <a href="https://livematch-991.pages.dev/watch.html?match=${match.id}">رابط البث المباشر الفوري</a>\n\n` +
                `🔥 <i>نتمنى لكم مشاهدة ممتعة!</i>\n` +
                `✅ لا تنسوا متابعة قناتنا لكل جديد!`;

            await sendTelegramMessage(message);
            history.push(match.id);
        }

        // Save history (last 100)
        fs.writeFileSync(HISTORY_PATH, JSON.stringify(history.slice(-100), null, 2));
        console.log('✅ Telegram history updated.');

    } catch (error) {
        console.error('💥 Error in Telegram script:', error.message);
    }
}

function sendTelegramMessage(text) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            chat_id: CHAT_ID,
            text: text,
            parse_mode: 'HTML',
            disable_web_page_preview: false
        });

        const options = {
            hostname: 'api.telegram.org',
            path: `/bot${TELEGRAM_TOKEN}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': payload.length
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('✅ Telegram message sent successfully');
                    resolve();
                } else {
                    console.error('❌ Telegram error:', body);
                    reject(new Error(`Telegram failed with status ${res.statusCode}`));
                }
            });
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

notifyTelegram();
