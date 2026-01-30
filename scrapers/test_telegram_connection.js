import https from 'https';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = '@live_football_macth'; // Target the channel directly

if (!TELEGRAM_TOKEN || !CHAT_ID) {
    console.error('❌ Error: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set.');
    process.exit(1);
}

const message = `🛠️ <b>Test Notification</b>\n\n` +
    `✅ Telegram Bot is connected successfully!\n` +
    `🕒 Time: ${new Date().toISOString()}\n\n` +
    `If you see this message, the bot token and chat ID are correct.`;

const payload = JSON.stringify({
    chat_id: CHAT_ID,
    text: message,
    parse_mode: 'HTML'
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

console.log('🚀 Sending test message to Telegram...');

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log('✅ Success! Message sent.');
        } else {
            console.error('❌ Failed:', body);
            process.exit(1);
        }
    });
});

req.on('error', (e) => {
    console.error('💥 Error:', e.message);
    process.exit(1);
});

req.write(payload);
req.end();
