import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to manually load .env (optional - for local development only)
async function loadEnv() {
    try {
        const envPath = path.join(__dirname, '..', '.env');
        const envContent = await fs.readFile(envPath, 'utf8');

        const lines = envContent.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
                const value = valueParts.join('=').trim();
                // Only set if not already in environment (GitHub Actions takes priority)
                if (!process.env[key.trim()]) {
                    process.env[key.trim()] = value;
                }
            }
        }
        console.log('📄 Loaded .env file for local development');
    } catch (e) {
        // Silent fail - this is expected in GitHub Actions
        // console.log('ℹ️ No .env file found (using environment variables)');
    }
}

// Try to load .env if it exists (for local dev), but don't fail if it doesn't
await loadEnv();

// Get API keys from environment (works with both .env and GitHub Actions secrets)
const API_KEYS = process.env.GEMINI_API_KEYS?.split(',').filter(k => k.trim()) || [];
let currentKeyIndex = 0;
const failedKeys = new Set(); // Track temporarily failed keys

// Log API keys status (without exposing the actual keys)
if (API_KEYS.length > 0) {
    console.log(`🔑 Loaded ${API_KEYS.length} API key(s) from environment`);
} else {
    console.log('⚠️ No GEMINI_API_KEYS found in environment variables');
}

// Get next available API key (rotation)
function getNextApiKey() {
    if (API_KEYS.length === 0) return null;

    // Try to find a key that hasn't failed
    for (let i = 0; i < API_KEYS.length; i++) {
        const index = (currentKeyIndex + i) % API_KEYS.length;
        if (!failedKeys.has(index)) {
            currentKeyIndex = index;
            return API_KEYS[index].trim();
        }
    }

    // All keys failed, reset and try first one
    failedKeys.clear();
    currentKeyIndex = 0;
    return API_KEYS[0].trim();
}

// Mark current key as failed and rotate
function rotateToNextKey() {
    failedKeys.add(currentKeyIndex);
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    console.log(`🔄 Rotating to API key ${currentKeyIndex + 1}/${API_KEYS.length}`);
}

// Delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generates an SEO-friendly match preview article using Gemini AI with key rotation.
 * @param {Object} match - The match data object.
 * @param {number} maxAttempts - Maximum total attempts across all keys
 * @returns {Promise<Object>} - The generated article content.
 */
export async function generateMatchArticle(match, maxAttempts = 12) {
    if (API_KEYS.length === 0) {
        console.warn('⚠️ GEMINI_API_KEYS not found in environment variables. Skipping AI article generation.');
        console.warn('💡 Hint: Make sure GEMINI_API_KEYS is set in GitHub Actions secrets or .env file');
        return null;
    }

    console.log(`🤖 Generating article for: ${match.home.name} vs ${match.away.name}`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const apiKey = getNextApiKey();
        if (!apiKey) {
            console.error('❌ No valid API keys available');
            return null;
        }

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

            const prompt = `
أنت خبير في الصحافة الرياضية ومحرك بحث جوجل (SEO).
اكتب مقالاً مفصلاً لمباراة: ${match.home.name} ضد ${match.away.name} في ${match.league.name}.

متطلبات إجبارية للمقال:
1. عنوان احترافي (H1) يحتوي على اسم البطولة والفريقين.
2. مقدمة تحليلية (2-3 فقرات).
3. **إجباري**: جدول HTML للتشكيلة المتوقعة للفريقين (Probable Lineups).
4. **إجباري**: جدول HTML لتاريخ المواجهات المباشرة (Head to Head) آخر 5 مباريات.
5. **إجباري**: جدول HTML لنتائج آخر 5 مباريات لكل فريق (Form).
6. استخدم تنسيق جداول HTML نظيف (<table>, <thead>, <tbody>, <tr>, <th>, <td>).
7. تحليل تقني لنقاط القوة والضعف (استخدم <ul>).
8. خاتمة تحفز القارئ على متابعة البث في موقع "sitefoot".

أجبني بتنسيق JSON حصراً:
{
  "title": "عنوان المقال",
  "content": "محتوى المقال الكامل بتنسيق HTML"،
  "meta_description": "وصف السيو",
  "keywords": ["الكلمات", "الدلالية"]
}

ملاحظة: إذا لم تتوفر لديك بيانات دقيقة، قم بإنشاء إحصائيات وتشكيلات منطقية بناءً على معرفتك الرياضية العامة، المهم هو وجود الجداول وتنسيقها الاحترافي.
            `;

            const requestBody = {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    response_mime_type: "application/json"
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            // Handle rate limiting - rotate to next key
            if (response.status === 429) {
                console.warn(`⏳ Key ${currentKeyIndex + 1} rate limited. Rotating...`);
                rotateToNextKey();
                await delay(2000); // Brief delay before trying next key
                continue;
            }

            if (!response.ok) {
                const error = await response.json();
                const errorMsg = error.error?.message || 'Gemini API Error';

                // Check if quota exceeded - rotate to next key
                if (errorMsg.includes('quota') || errorMsg.includes('exceeded') || errorMsg.includes('rate')) {
                    console.warn(`⏳ Key ${currentKeyIndex + 1} quota exceeded. Rotating...`);
                    rotateToNextKey();
                    await delay(2000);
                    continue;
                }

                throw new Error(errorMsg);
            }

            const result = await response.json();
            const text = result.candidates[0].content.parts[0].text;

            // Clean and parse JSON
            const article = JSON.parse(text.trim());

            console.log(`✅ Article generated successfully using key ${currentKeyIndex + 1}`);
            return article;

        } catch (error) {
            console.warn(`⚠️ Attempt ${attempt}/${maxAttempts} failed: ${error.message}`);

            if (error.message.includes('quota') || error.message.includes('rate')) {
                rotateToNextKey();
                await delay(2000);
            } else {
                await delay(3000);
            }
        }
    }

    console.error(`❌ Failed to generate article after ${maxAttempts} attempts across all keys`);
    return null;
}

/**
 * Saves the generated article to a JSON file.
 */
export async function saveArticle(matchId, articleData) {
    const articlesDir = path.join(__dirname, '..', 'public', 'data', 'articles');

    // Ensure directory exists
    try {
        await fs.access(articlesDir);
    } catch {
        await fs.mkdir(articlesDir, { recursive: true });
    }

    const filePath = path.join(articlesDir, `${matchId}.json`);
    await fs.writeFile(filePath, JSON.stringify(articleData, null, 2), 'utf8');
    console.log(`💾 Saved article: ${matchId}.json`);
}
