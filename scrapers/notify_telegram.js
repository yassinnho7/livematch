// TELEGRAM NOTIFICATIONS - DISABLED
// This file is disabled. To re-enable, remove this comment and the early exit.

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function notifyTelegram() {
    console.log('📱 [DISABLED] Telegram notifications are currently disabled.');
    console.log('📱 To re-enable, edit this file and remove the early return.');
    return;
}

// Export for compatibility
export { notifyTelegram };

notifyTelegram();
