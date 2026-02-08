import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to manually load .env
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
                process.env[key.trim()] = value;
            }
        }
    } catch (e) {
        console.warn('⚠️ Could not load .env file manually:', e.message);
    }
}

// Load env before using API keys
await loadEnv();

// Multiple API keys for rotation
const API_KEYS = process.env.GEMINI_API_KEYS?.split(',').filter(k => k.trim()) || [];
let currentKeyIndex = 0;
const failedKeys = new Set(); // Track temporarily failed keys

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
        console.warn('⚠️ GEMINI_API_KEYS missing in .env. Skipping AI article generation.');
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
You are a professional sports journalist and SEO expert. 
Write a compelling, human-like match preview for the following football match:
Match: ${match.home.name} vs ${match.away.name}
League: ${match.league.name}
Time: ${match.time} GMT

Requirements:
1. Language: Arabic (Modern Standard Arabic with a sports-enthusiast tone).
2. Title: Create a catchy, click-worthy title (H1).
3. Introduction: An exciting intro about the importance of the match.
4. Team Form: Discuss the recent performance of both teams (winning streaks, losses, etc.).
5. Key Factors: Mention potential key player absences or returns, and the coach's situation if applicable.
6. History/H2H: Mention typical head-to-head dynamics or historical significance.
7. League Standing: How this match affects their position in the ${match.league.name}.
8. Conclusion: A call to action for fans to watch the match live.
9. SEO: Use keywords naturally, use subheadings (H2, H3).
10. Style: Natural, human-like, NOT robotic. Avoid repetitive phrases.

Format the output ONLY as a valid JSON object with the following fields:
{
    "title": "H1 Title",
    "meta_description": "Short SEO description",
    "content": "HTML formatted content with <h2> and <p> tags",
    "keywords": ["keyword1", "keyword2"]
}
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
