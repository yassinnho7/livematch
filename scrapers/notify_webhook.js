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
            // WIDE WINDOW: -40 mins to +40 mins
            // Requested by user to handle GitHub Actions delays
            const isSoon = timeUntilStart > -2400 && timeUntilStart < 2400;

            const shouldNotify = isSoon && !history.includes(m.id);

            if (shouldNotify) {
                console.log(`🎯 Match Targeted: ${m.home.name} vs ${m.away.name} (Starts in ${Math.round(timeUntilStart / 60)} mins)`);
            }
            return shouldNotify;
        });

        if (upcomingMatches.length === 0) {
            console.log('ℹ️ No matches currently in the 40-minute notification window.');
            return;
        }

        console.log(`🚀 Notifying ${upcomingMatches.length} matches...`);

        for (const match of upcomingMatches) {
            const siteUrl = process.env.SITE_URL || 'https://livematch-991.pages.dev';
            const githubBaseUrl = 'https://raw.githubusercontent.com/yassinnho7/livematch/main/public';
            const fallbackPoster = `${githubBaseUrl}/assets/backgrounds/stadium_night.png`;

            const posterUrl = match.poster_url
                ? `${githubBaseUrl}${match.poster_url}`
                : fallbackPoster;

            // Direct to server page for countdown and ads
            const link = `${siteUrl}/server.html?match=${match.id}`;

            const message = `🌟 مباراة اليوم المباشرة\n\n` +
                `🏟️ ${match.home.name} 🆚 ${match.away.name}\n\n` +
                `🏆 البطولة: ${match.league.name}\n` +
                `⏰ التوقيت: ${match.time_label || (match.time ? match.time + ' GMT' : 'Soon')}\n` +
                `✨ الجودة: Full HD 1080p\n\n` +
                `⚡ شاهد المباراة مجاناً وبدون تقطيع هنا:\n` +
                `👇👇👇\n` +
                `🚀 ${link}\n\n` +
                `🔥 نتمنى لكم مشاهدة ممتعة!\n` +
                `✅ لا تنسوا متابعة صفحتنا لكل جديد!`;

            const payload = {
                id: match.id,
                title: `🔥 مباراة حاسمة: ${match.home.name} 🆚 ${match.away.name}`,
                league: match.league.name,
                time: match.time,
                link: "", // Empty to prevent duplicate link (Link is already in message)
                message: message,
                photo: posterUrl
            };

            console.log(`📤 Sending Webhook for: ${match.home.name} vs ${match.away.name}`);
            console.log(`🖼️ Photo URL: ${posterUrl}`);

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

function sendWebhook(payloadData) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(payloadData);
        const url = new URL(WEBHOOK_URL);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log(`✅ Webhook accepted (${res.statusCode})`);
                    resolve();
                } else {
                    console.error(`❌ Webhook failed (${res.statusCode}):`, responseBody);
                    reject(new Error(`Webhook failed with status ${res.statusCode}`));
                }
            });
        });

        req.on('error', (e) => {
            console.error('❌ Webhook Network error:', e.message);
            reject(e);
        });

        req.write(payload);
        req.end();
    });
}

notify();
