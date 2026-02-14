/**
 * Cleanup Script - Deletes old files older than 24 hours
 * Run this script before deploying to clean up old images and articles
 * 
 * Usage: node scripts/cleanup.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Constants
const MAX_AGE_HOURS = 24;
const MAX_AGE_MS = MAX_AGE_HOURS * 60 * 60 * 1000;
const now = Date.now();

// Directories to clean
const POSTERS_DIR = path.join(rootDir, 'public', 'posters');
const ARTICLES_DIR = path.join(rootDir, 'public', 'data', 'articles');
const NEWS_DIR = path.join(rootDir, 'public', 'data', 'news');

function getFileAge(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return now - stats.mtimeMs;
    } catch (e) {
        return 0;
    }
}

function deleteOldFiles(dir, extensions = ['.jpg', '.png', '.json']) {
    if (!fs.existsSync(dir)) {
        console.log(`📁 Directory does not exist: ${dir}`);
        return 0;
    }

    const files = fs.readdirSync(dir);
    let deletedCount = 0;

    for (const file of files) {
        const filePath = path.join(dir, file);
        const ext = path.extname(file).toLowerCase();

        // Check if file has allowed extension
        if (!extensions.includes(ext)) continue;

        const age = getFileAge(filePath);

        if (age > MAX_AGE_MS) {
            try {
                fs.unlinkSync(filePath);
                console.log(`🗑️  Deleted (${Math.round(age / (1000 * 60 * 60))}h old): ${file}`);
                deletedCount++;
            } catch (e) {
                console.error(`❌ Error deleting ${file}:`, e.message);
            }
        }
    }

    return deletedCount;
}

function cleanIndexFile(filePath) {
    if (!fs.existsSync(filePath)) return;

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);

        let modified = false;
        const cleaned = data.filter(item => {
            // For news_index.json
            if (item.published_at) {
                const age = now - new Date(item.published_at).getTime();
                if (age > MAX_AGE_MS) {
                    modified = true;
                    return false;
                }
            }
            return true;
        });

        if (modified) {
            fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2));
            console.log(`✅ Cleaned ${path.basename(filePath)}`);
        }
    } catch (e) {
        console.error(`❌ Error cleaning ${filePath}:`, e.message);
    }
}

console.log('🧹 Starting cleanup of old files...\n');
console.log(`⏰ Deleting files older than ${MAX_AGE_HOURS} hours\n`);

let totalDeleted = 0;

// Clean posters
console.log('📸 Cleaning posters...');
totalDeleted += deleteOldFiles(POSTERS_DIR, ['.jpg', '.png']);

// Clean articles
console.log('\n📰 Cleaning articles...');
totalDeleted += deleteOldFiles(ARTICLES_DIR, ['.json']);

// Clean news
console.log('\n📋 Cleaning news...');
totalDeleted += deleteOldFiles(NEWS_DIR, ['.json']);

// Clean index files
console.log('\n📑 Cleaning index files...');
cleanIndexFile(path.join(rootDir, 'public', 'data', 'news_index.json'));
cleanIndexFile(path.join(rootDir, 'public', 'data', 'pending_posts.json'));

console.log(`\n✨ Cleanup complete! Deleted ${totalDeleted} files.`);
