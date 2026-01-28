const fs = require('fs');
const path = require('path');
const https = require('https');

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
            // Notify if match starts in next 60 minutes OR is LIVE
            // AND hasn't been notified yet
            const timeUntilStart = m.timestamp - now;
            const isSoon = timeUntilStart > 0 && timeUntilStart < 3600; // 1 hour
            const isLive = m.status === 'LIVE';

            return (isSoon || isLive) && !history.includes(m.id);
        });

        if (upcomingMatches.length === 0) {
            console.log('ℹ️ No new matches to notify.');
            return;
        }

        console.log(`🚀 Notifying ${upcomingMatches.length} matches...`);

        for (const match of upcomingMatches) {
            const payload = {
                id: match.id,
                title: `🔥 مباراة حاسمة: ${match.home.name} 🆚 ${match.away.name}`,
                league: match.league.name,
                time: match.time,
                link: `https://livematch-991.pages.dev/watch.html?match=${match.id}`,
                message: `📢 لا تفوتوا متعة كرة القدم!
🏁 ${match.home.name} ضد ${match.away.name}
🏆 البطولة: ${match.league.name}
⏰ التوقيت: ${match.time}
🔗 شاهد الآن مجاناً وبدون تقطيع هنا:
👇👇👇
https://livematch-991.pages.dev/watch.html?match=${match.id}`
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
