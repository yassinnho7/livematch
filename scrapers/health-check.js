// scrapers/health-check.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'public', 'data', 'matches.json');

export async function healthCheck() {
    const report = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        checks: {}
    };

    // 1. هل الملف موجود؟
    try {
        const stats = await fs.stat(DATA_PATH);
        const ageMinutes = Math.round((Date.now() - stats.mtimeMs) / 60000);
        report.checks.dataFile = {
            status: ageMinutes < 15 ? 'fresh' : ageMinutes < 60 ? 'stale' : 'old',
            ageMinutes
        };
        if (ageMinutes >= 60) report.status = 'degraded';
    } catch {
        report.checks.dataFile = { status: 'missing' };
        report.status = 'critical';
    }

    // 2. عدد المباريات
    try {
        const raw = await fs.readFile(DATA_PATH, 'utf8');
        const data = JSON.parse(raw);
        const count = data.matches?.length ?? 0;
        report.checks.matchCount = {
            status: count > 0 ? 'ok' : 'empty',
            count
        };
        if (count === 0) report.status = 'degraded';
    } catch (e) {
        report.checks.matchCount = { status: 'parse_error', error: e.message };
        report.status = 'critical';
    }

    // 3. هل توجد مباريات بدون streams؟
    try {
        const raw = await fs.readFile(DATA_PATH, 'utf8');
        const data = JSON.parse(raw);
        const noStream = data.matches?.filter(m => !m.streams || m.streams.length === 0).length ?? 0;
        report.checks.streamsPresence = {
            status: noStream === 0 ? 'ok' : 'partial',
            matchesWithoutStream: noStream
        };
    } catch { }

    console.log('🏥 Health Check:', JSON.stringify(report, null, 2));
    return report;
}

// تشغيل مستقل: node scrapers/health-check.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    healthCheck().then(r => {
        process.exit(r.status === 'critical' ? 1 : 0);
    });
}
