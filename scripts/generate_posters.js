
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { fileURLToPath } from 'url';

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = path.join(__dirname, '../public/data/matches.json');
const OUTPUT_DIR = path.join(__dirname, '../public/posters');
const ASSETS_DIR = path.join(__dirname, '../public/assets');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Register Font (Try to load Cairo, fallback to system)
try {
    const fontPath = path.join(ASSETS_DIR, 'fonts/Cairo-Bold.ttf');
    if (fs.existsSync(fontPath)) {
        registerFont(fontPath, { family: 'Cairo' });
        console.log('✅ Font loaded: Cairo');
    } else {
        console.warn('⚠️ Font file not found, using system default.');
    }
} catch (e) {
    console.error('⚠️ Error loading font:', e.message);
}

async function generatePosters() {
    // Clean old posters first
    await cleanOldPosters();

    console.log('🎨 Starting poster generation...');

    // Load Data
    if (!fs.existsSync(DATA_PATH)) {
        console.error('❌ Data file not found!');
        return;
    }
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

    // Load Background
    let bgImage;
    try {
        bgImage = await loadImage(path.join(ASSETS_DIR, 'backgrounds/stadium_night.png'));
    } catch (e) {
        console.error('❌ Could not load background image:', e.message);
        return; // Cannot proceed without background
    }

    // Process each match
    for (const match of data.matches) {
        const fileName = `${match.id}.jpg`;
        const filePath = path.join(OUTPUT_DIR, fileName);

        // Skip if poster already exists
        if (fs.existsSync(filePath)) {
            console.log(`ℹ️ Poster for match ${match.id} already exists. Skipping.`);
            match.poster_url = `/posters/${fileName}`;
            continue;
        }

        console.log(`🎨 Generating poster for: ${match.home.name} vs ${match.away.name}`);
        const canvas = createCanvas(1080, 1080);
        const ctx = canvas.getContext('2d');

        // 1. Draw Background
        ctx.drawImage(bgImage, 0, 0, 1080, 1080);

        // Dark Overlay for text readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, 1080, 1080);

        // Gradient from bottom
        const gradient = ctx.createLinearGradient(0, 700, 0, 1080);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.9)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 700, 1080, 380);

        // 2. Top Banner "بث مباشر"
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff4757'; // Red LIVE color
        ctx.font = 'bold 60px "Cairo", sans-serif';
        // Add glow
        ctx.shadowColor = '#ff4757';
        ctx.shadowBlur = 20;
        ctx.fillText('🔴 بث مباشر', 540, 100);
        ctx.shadowBlur = 0; // Reset glow

        // 3. Center - Team Logos
        const homeLogoUrl = match.home.logo;
        const awayLogoUrl = match.away.logo;

        // Draw VS
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 120px "Cairo", sans-serif';
        ctx.fillText('VS', 540, 500);

        try {
            // Helper to draw circular image
            const drawTeamLogo = async (url, x, y) => {
                const img = await loadImage(url);
                ctx.save();
                ctx.beginPath();
                ctx.arc(x, y, 140, 0, Math.PI * 2, true); // Circle
                ctx.closePath();
                ctx.clip();

                // Draw white background behind logo
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(x - 140, y - 140, 280, 280);

                ctx.drawImage(img, x - 140, y - 140, 280, 280);
                ctx.restore();

                // Add border/ring
                ctx.beginPath();
                ctx.arc(x, y, 140, 0, Math.PI * 2, true);
                ctx.lineWidth = 8;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();
            };

            // Draw Left (Home)
            await drawTeamLogo(homeLogoUrl, 250, 480);

            // Draw Right (Away)
            await drawTeamLogo(awayLogoUrl, 830, 480);

        } catch (e) {
            console.error('⚠️ Failed to load team logos:', e.message);
        }

        // 4. Bottom Info
        // Time
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 90px "Cairo", sans-serif';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 10;
        ctx.fillText(match.time || 'TBD', 540, 830); // Moved up slightly

        // GMT Label
        ctx.font = 'bold 40px "Cairo", sans-serif';
        ctx.fillStyle = '#dfe6e9';
        ctx.fillText('GMT', 540, 880);

        // League
        ctx.fillStyle = '#dfe6e9';
        ctx.font = 'bold 50px "Cairo", sans-serif';
        ctx.fillText(match.league.name, 540, 950);

        // 5. Save Image
        const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
        fs.writeFileSync(filePath, buffer);
        console.log(`✅ Generated: ${fileName}`);

        // Update Match Data with Poster URL (Local or Absolute)
        // Ideally, this should be the public URL after deployment
        // For now, we store relative path
        match.poster_url = `/posters/${fileName}`;
    }

    // Save updated JSON
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    console.log('💾 Updated matches.json with poster URLs');
}


async function cleanOldPosters() {
    console.log('🧹 Cleaning old posters...');
    if (!fs.existsSync(OUTPUT_DIR)) return;

    const files = fs.readdirSync(OUTPUT_DIR);
    const now = Date.now();
    const expiry = 24 * 60 * 60 * 1000; // 24 hours

    files.forEach(file => {
        const filePath = path.join(OUTPUT_DIR, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > expiry) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Deleted old poster: ${file}`);
        }
    });
}


// Execute the poster generation
generatePosters().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
