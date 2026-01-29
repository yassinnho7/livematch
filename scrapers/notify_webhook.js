import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
const MATCHES_PATH = path.join(__dirname, '..', 'public', 'data', 'matches.json');
const HISTORY_PATH = path.join(__dirname, '..', 'sent_notifications.json');

if (!WEBHOOK_URL) {
    console.log('⚠️ MAKE_WEBHOOK_URL not set. Skipping notification.');
    process.exit(0);
}

async function notify() {
    try {
        // التحقق من التوقيت لتوفير موارد Make.com (إيقاف بين 4 صباحاً و 9 صباحاً بتوقيت GMT)
        const gmtHour = new Date().getUTCHours();
        if (gmtHour >= 4 && gmtHour < 9) {
            console.log(`🕒 التوقيت الحالي (${gmtHour} GMT) يقع ضمن فترة الهدوء. تخطي إرسال Webhook.`);
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
        console.log(`🕒 Current Time (UTC): ${new Date().toISOString()}`);

        const upcomingMatches = matches.filter(m => {
            const timeUntilStart = m.timestamp - now;
            // Notify if match starts in next 35 minutes (buffer for 30min target)
            // OR if it just started (LIVE)
            const isSoon = timeUntilStart > 0 && timeUntilStart < 2100; // 35 minutes window
            const isLive = m.status === 'LIVE';

            const shouldNotify = (isSoon || isLive) && !history.includes(m.id);

            if (shouldNotify) {
                console.log(`🎯 Match Targeted: ${m.home.name} vs ${m.away.name} (Starts in ${Math.round(timeUntilStart / 60)} mins)`);
            }
            return shouldNotify;
        });

        if (upcomingMatches.length === 0) {
            console.log('ℹ️ No matches currently in the 30-minute notification window.');
            return;
        }

        console.log(`🚀 Notifying ${upcomingMatches.length} matches...`);

        for (const match of upcomingMatches) {
            const message = `🌟 <b>مباراة اليوم المباشرة</b>\n\n` +
                `🆚 <b>${match.home.name}</b> ضد <b>${match.away.name}</b>\n\n` +
                `🚩 <b>البطولة:</b> ${match.league.name}\n` +
                `⏳ <b>التوقيت:</b> ${match.time}\n` +
                `🖥️ <b>الجودة:</b> متعددة (HD, SD)\n\n` +
                `📺 <b>شاهد المباراة الآن مجاناً عبر الرابط التالي:</b>\n` +
                `🔗 <a href="https://livematch-991.pages.dev/watch.html?match=${match.id}">رابط البث المباشر الرسمي</a>\n\n` +
                `⚽ <i>لا تفوت الإثارة، تابع الصفحة لمباريات الغد!</i>\n` +
                `🛡️ تمت الترقية بنظام الحماية الجديد.`;

            const payload = {
                id: match.id,
                title: `🔥 مباراة حاسمة: ${match.home.name} 🆚 ${match.away.name}`,
                league: match.league.name,
                time: match.time,
                link: `https://livematch-991.pages.dev/watch.html?match=${match.id}`,
                message: message
            };

            await sendWebhook(payload);
            history.push(match.id);
        }

        // Save history (keep only last 100 to avoid file growth)
        fs.writeFileSync(HISTORY_PATH, JSON.stringify(history.slice(-100), null, 2));
        console.log('✅ Notification history updated.');

    } catch (error) {
        console.error('💥 Error in notification script:', error.message);
    }
}

function sendWebhook(payload) {
    return new Promise((resolve, reject) => {
        const url = new URL(WEBHOOK_URL);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                console.log(`✅ Webhook accepted (${res.statusCode})`);
                resolve();
            } else {
                reject(new Error(`Webhook failed with status ${res.statusCode}`));
            }
        });

        req.on('error', reject);
        req.write(JSON.stringify(payload));
        req.end();
    });
}

notify();
