import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITE_URL = process.env.SITE_URL || 'https://livematch-991.pages.dev';
const MATCHES_PATH = path.join(__dirname, '..', 'public', 'data', 'matches.json');
const SITEMAP_PATH = path.join(__dirname, '..', 'public', 'sitemap.xml');

async function generateSitemap() {
    try {
        console.log('🗺️ Generating Sitemap...');

        if (!fs.existsSync(MATCHES_PATH)) {
            console.error('❌ Matches file not found. Skipping sitemap generation.');
            return;
        }

        const data = JSON.parse(fs.readFileSync(MATCHES_PATH, 'utf8'));
        const matches = data.matches || [];

        let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <!-- Static Pages -->
    <url>
        <loc>${SITE_URL}/</loc>
        <changefreq>always</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>${SITE_URL}/index.html</loc>
        <changefreq>always</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>${SITE_URL}/watch.html</loc>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
    </url>

    <!-- Dynamic Match Articles -->`;

        matches.forEach(match => {
            sitemap += `
    <url>
        <loc>${SITE_URL}/article.html?match=${match.id}</loc>
        <lastmod>${new Date().toISOString()}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.9</priority>
    </url>`;
        });

        sitemap += `
</urlset>`;

        fs.writeFileSync(SITEMAP_PATH, sitemap, 'utf8');
        console.log(`✅ Sitemap generated with ${matches.length} matches at ${SITEMAP_PATH}`);

    } catch (error) {
        console.error('💥 Error generating sitemap:', error.message);
    }
}

generateSitemap();
