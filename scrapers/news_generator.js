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
                if (!process.env[key.trim()]) process.env[key.trim()] = value;
            }
        }
    } catch (e) { }
}

await loadEnv();

const API_KEYS = process.env.GEMINI_API_KEYS?.split(',').filter(k => k.trim()) || [];
let currentKeyIndex = 0;
const failedKeys = new Set();

function getNextApiKey() {
    if (API_KEYS.length === 0) return null;
    for (let i = 0; i < API_KEYS.length; i++) {
        const index = (currentKeyIndex + i) % API_KEYS.length;
        if (!failedKeys.has(index)) {
            currentKeyIndex = index;
            return API_KEYS[index].trim();
        }
    }
    failedKeys.clear();
    currentKeyIndex = 0;
    return API_KEYS[0].trim();
}

function rotateToNextKey() {
    failedKeys.add(currentKeyIndex);
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function generateNewsBatch() {
    console.log('📰 Starting News Generation Batch...');

    const topics = [
        "أحدث أخبار سوق الانتقالات العالمية (حصري وتوقعات)",
        "تصريحات مثيرة لمدربين أو لاعبين بعد مباريات الأمس",
        "قصة تاريخية 'من الذاكرة' عن نهائي أو مواجهة كلاسيكية",
        "معلومات سريعة وحقائق لا تعرفها عن نجم عالمي حالي",
        "تحليل تكتيكي أو 'ميمز' رياضي ساخر عن حالة نادٍ يعاني"
    ];

    const newsDir = path.join(__dirname, '..', 'public', 'data', 'news');
    const indexPath = path.join(__dirname, '..', 'public', 'data', 'news_index.json');

    try {
        await fs.access(newsDir);
    } catch {
        await fs.mkdir(newsDir, { recursive: true });
    }

    let existingIndex = [];
    try {
        const indexData = await fs.readFile(indexPath, 'utf8');
        existingIndex = JSON.parse(indexData);
    } catch (e) { }

    const newArticles = [];

    for (let i = 0; i < topics.length; i++) {
        const topic = topics[i];
        console.log(`🤖 Generating news item for topic: ${topic}`);

        const article = await callGemini(topic);
        if (article) {
            const id = `news_${Date.now()}_${i}`;
            const articleData = {
                id,
                ...article,
                timestamp: Math.floor(Date.now() / 1000),
                type: 'news'
            };

            await fs.writeFile(path.join(newsDir, `${id}.json`), JSON.stringify(articleData, null, 2));
            newArticles.push({
                id,
                title: article.title,
                summary: article.meta_description,
                timestamp: articleData.timestamp,
                poster: article.poster_url || '/assets/backgrounds/stadium_night.png'
            });
        }
    }

    // Keep only last 50 news items in index
    const fullIndex = [...newArticles, ...existingIndex].slice(0, 50);
    await fs.writeFile(indexPath, JSON.stringify(fullIndex, null, 2), 'utf8');

    // Also update a "pending posts" queue for the Extension
    const queuePath = path.join(__dirname, '..', 'public', 'data', 'pending_posts.json');
    let existingQueue = [];
    try {
        existingQueue = JSON.parse(await fs.readFile(queuePath, 'utf8'));
    } catch (e) { }

    const updatedQueue = [...newArticles.map(a => ({ ...a, posted: false })), ...existingQueue].slice(0, 20);
    await fs.writeFile(queuePath, JSON.stringify(updatedQueue, null, 2), 'utf8');

    console.log(`✅ Batch complete! Generated ${newArticles.length} new articles.`);
}

async function callGemini(topic, maxAttempts = 10) {
    const prompt = `
أنت صحفي رياضي خبير متخصص في كتابة المقالات التريند (Viral) وجذب الجمهور على فيسبوك وجوجل.
اكتب مقالاً شيقاً عن الموضوع التالي: ${topic}

متطلبات إجبارية:
1. عنوان "كليك بيت" احترافي ومثير جداً.
2. محتوى غني بالمعلومات (4-5 فقرات).
3. استخدم لغة عربية سليمة ولكن بأسلوب مشوق (Storytelling).
4. استخدم تنسيق HTML بسيط للمحتوى (p, h2, ul, li, strong).
5. خاتمة تتضمن سؤالاً تفاعلياً للجمهور لزيادة التعليقات.

أجبني بتنسيق JSON حصراً:
{
  "title": "عنوان المقال المثير",
  "content": "محتوى المقال بتنسيق HTML",
  "meta_description": "وصف جذاب للمقال ليظهر في فيسبوك وجوجل",
  "keywords": ["الكلمات", "الدلالية"],
  "poster_url": "/assets/backgrounds/stadium_night.png"
}
`;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const apiKey = getNextApiKey();
        if (!apiKey) return null;

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { response_mime_type: "application/json" }
                })
            });

            if (response.status === 429) {
                rotateToNextKey();
                await delay(2000);
                continue;
            }

            if (!response.ok) {
                rotateToNextKey();
                continue;
            }

            const result = await response.json();
            return JSON.parse(result.candidates[0].content.parts[0].text.trim());

        } catch (error) {
            rotateToNextKey();
            await delay(2000);
        }
    }
    return null;
}

generateNewsBatch();
