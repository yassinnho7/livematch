// WEBHOOK NOTIFICATIONS (Facebook/Make.com) - DISABLED
// This file is disabled. To re-enable, remove this comment and the early exit.

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;

async function notify() {
    console.log('🌐 [DISABLED] Webhook/Facebook notifications are currently disabled.');
    console.log('🌐 To re-enable, edit this file and remove the early return.');
    return;
}

// Export for compatibility
export { notify };

notify();
