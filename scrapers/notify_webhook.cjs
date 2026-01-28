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
            console.log('ℹ️ No matches.json found.');
            return;
        }

        const matches = JSON.parse(fs.readFileSync(MATCHES_PATH, 'utf8'));
        let history = [];
        if (fs.existsSync(HISTORY_PATH)) {
            history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
        }

        const newMatches = matches.filter(m => !history.some(h => h.id === m.id));

        if (newMatches.length === 0) {
            console.log('ℹ️ No new matches to notify.');
            return;
        }

        for (const match of newMatches) {
            console.log(`🚀 Notifying match: ${match.title}`);
            await sendWebhook(match);
            history.push({ id: match.id, time: new Date().toISOString() });
        }

        fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));

    } catch (error) {
        console.error('❌ Error in notify script:', error);
    }
}

function sendWebhook(data) {
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
                reject(new Error(`Status: ${res.statusCode}`));
            }
        });

        req.on('error', reject);
        req.write(JSON.stringify(data));
        req.end();
    });
}

notify();
