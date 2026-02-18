// AI CONTENT GENERATION - DISABLED
// This file is disabled. To re-enable, remove this comment and the early return.

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DISABLED - Article generation disabled
export async function generateMatchArticle(match, maxAttempts = 12) {
    console.log('🤖 [DISABLED] AI article generation is currently disabled.');
    return null;
}

// DISABLED - Save article disabled
export async function saveArticle(matchId, articleData) {
    console.log('💾 [DISABLED] Save article is currently disabled.');
    return;
}
