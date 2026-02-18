// NEWS GENERATOR - DISABLED
// This file is disabled. To re-enable, remove this comment and the early exit.

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateNewsBatch(count = 6) {
    console.log('📰 [DISABLED] News Generation is currently disabled.');
    console.log('📰 To re-enable, edit this file and remove the early return.');
    return;
}

// Export for compatibility
export { generateNewsBatch };

// If running directly
const countParam = parseInt(process.argv[2]) || 6;
generateNewsBatch(countParam);
