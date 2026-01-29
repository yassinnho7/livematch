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
            // Notify if match starts in next 35 minutes
            const isSoon = timeUntilStart > 0 && timeUntilStart < 2100;
            const isLive = m.status === 'LIVE';

            return (isSoon || isLive) && !history.includes(m.id);
        });

        if (upcomingMatches.length === 0) {
            console.log('ℹ️ No new matches for Telegram notification.');
            return;
        }

        console.log(`🚀 Sending ${upcomingMatches.length} notifications to Telegram...`);

        for (const match of upcomingMatches) {
            const message = `📢 *مباراة اليوم المباشرة*
            
🏁 *${match.home.name}* 🆚 *${match.away.name}*
🏆 البطولة: ${match.league.name}
⏰ التوقيت: ${match.time} (كمت)

🔗 شاهد المباراة بدون تقطيع هنا:
👇👇👇
https://livematch-991.pages.dev/watch.html?match=${match.id}`;

            // استخدام صورة الدوري أو شعار الفريق المضيف كصورة للمنشور
            const photoUrl = match.home.logo || match.league.logo || 'https://livematch-991.pages.dev/og-image.jpg';

            await sendTelegramPhoto(photoUrl, message);
            history.push(match.id);
        }

        // Save history (last 100)
        fs.writeFileSync(HISTORY_PATH, JSON.stringify(history.slice(-100), null, 2));
        console.log('✅ Telegram history updated.');

    } catch (error) {
        console.error('💥 Error in Telegram script:', error.message);
    }
}

function sendTelegramPhoto(photoUrl, caption) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            chat_id: CHAT_ID,
            photo: photoUrl,
            caption: caption,
            parse_mode: 'Markdown'
        });

        const options = {
            hostname: 'api.telegram.org',
            path: `/bot${TELEGRAM_TOKEN}/sendPhoto`,
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
                    console.log('✅ Telegram post sent successfully');
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
