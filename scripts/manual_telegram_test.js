import https from 'https';

const token = process.argv[2];
const chatId = process.argv[3];
const message = process.argv[4] || "🚀 This is a test message from LiveMatch Local Environment!";

if (!token || !chatId) {
    console.error("❌ Usage: node scripts/manual_telegram_test.js <BOT_TOKEN> <CHAT_ID> [MESSAGE]");
    process.exit(1);
}

const payload = JSON.stringify({
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML'
});

const options = {
    hostname: 'api.telegram.org',
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
    }
};

console.log(`📨 Sending to Chat ID: ${chatId}...`);

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log("✅ Message sent successfully!");
            console.log("Response:", body);
        } else {
            console.error("❌ Failed to send message.");
            console.error("Response:", body);
        }
    });
});

req.on('error', (e) => {
    console.error("❌ Network error:", e.message);
});

req.write(payload);
req.end();
