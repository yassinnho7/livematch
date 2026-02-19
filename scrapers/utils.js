// scrapers/utils.js
// ============================================================
// الوحدة المشتركة — تُستخدم من جميع Scrapers
// ============================================================

/**
 * تحويل وقت محلي إلى Unix timestamp بتوقيت GMT
 * @param {string} timeStr - الوقت كنص ("19:30" أو "7:30 PM")
 * @param {number} offsetHours - فارق توقيت المصدر عن GMT (إيجابي)
 *   livekora  → offsetHours = 1   (GMT+1)
 *   korah     → offsetHours = 3   (GMT+3, توقيت السعودية)
 *   koraplus  → offsetHours = 2   (GMT+2)
 * @returns {number} Unix timestamp بتوقيت GMT
 */
export function toGMTTimestamp(timeStr, offsetHours) {
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) {
        return Math.floor(Date.now() / 1000);
    }
    try {
        let hours = null, minutes = null;

        // صيغة 12 ساعة: "7:30 PM" أو "07:30 PM"
        const twelveH = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (twelveH) {
            hours = parseInt(twelveH[1], 10);
            minutes = parseInt(twelveH[2], 10);
            const ampm = twelveH[3].toUpperCase();
            if (ampm === 'PM' && hours < 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0;
        } else {
            // صيغة 24 ساعة: "19:30"
            const twentyFourH = timeStr.match(/(\d{1,2}):(\d{2})/);
            if (twentyFourH) {
                hours = parseInt(twentyFourH[1], 10);
                minutes = parseInt(twentyFourH[2], 10);
            }
        }

        if (hours === null) return Math.floor(Date.now() / 1000);

        const date = new Date();
        // الطرح من الساعة للوصول لـ GMT
        const gmtHours = hours - offsetHours;
        date.setUTCHours(gmtHours, minutes, 0, 0);

        // تصحيح حالة منتصف الليل: لو الوقت المحلي > 21 والـ GMT < 3
        // فالمباراة في نفس اليوم وليس اليوم القادم
        if (hours >= 21 && gmtHours < 0) {
            date.setUTCDate(date.getUTCDate() - 1);
        }

        return Math.floor(date.getTime() / 1000);
    } catch (e) {
        return Math.floor(Date.now() / 1000);
    }
}

/**
 * توليد ID ثابت للمباراة بناءً على الفريقين والتاريخ
 * يمنع تضاعف الإشعارات ويضمن نفس الـ ID من مصادر مختلفة
 */
export function generateMatchHash(homeTeam, awayTeam) {
    const dateStr = new Date().toISOString().split('T')[0];
    const str = `${dateStr}-${String(homeTeam).toLowerCase().trim()}-${String(awayTeam).toLowerCase().trim()}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // تحويل لـ 32-bit
    }
    return Math.abs(hash);
}

/**
 * استخراج بلد锦标赛 من اسمها بالعربية
 */
export function getCountryFromLeague(league) {
    if (!league) return 'International';
    const l = String(league);
    if (l.includes('الإسباني') || l.includes('إسبانيا')) return 'Spain';
    if (l.includes('الإنجليزي') || l.includes('إنجلترا')) return 'England';
    if (l.includes('الإيطالي') || l.includes('إيطاليا')) return 'Italy';
    if (l.includes('الألماني') || l.includes('ألمانيا')) return 'Germany';
    if (l.includes('الفرنسي') || l.includes('فرنسا')) return 'France';
    if (l.includes('السعودي') || l.includes('السعودية')) return 'Saudi Arabia';
    if (l.includes('المصري') || l.includes('مصر')) return 'Egypt';
    if (l.includes('المغربي') || l.includes('المغرب')) return 'Morocco';
    if (l.includes('التونسي') || l.includes('تونس')) return 'Tunisia';
    if (l.includes('الجزائري') || l.includes('الجزائر')) return 'Algeria';
    if (l.includes('أبطال أوروبا') || l.includes('اوروبا')) return 'Europe';
    if (l.includes('أفريقيا') || l.includes('أبطال أفريقيا')) return 'Africa';
    if (l.includes('آسيا') || l.includes('الخليج') || l.includes('أبطال آسيا')) return 'Asia';
    if (l.includes('عالم') || l.includes('مونديال')) return 'World';
    return 'International';
}

/**
 * استخراج شعار锦标赛 من اسمها
 */
export function getLeagueLogo(league) {
    if (!league) return 'https://cdn-icons-png.flaticon.com/512/1378/1378598.png';
    const logos = {
        'إسباني': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/15.png&h=40&w=40',
        'إنجليزي': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/23.png&h=40&w=40',
        'إيطالي': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/12.png&h=40&w=40',
        'ألماني': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/10.png&h=40&w=40',
        'فرنسي': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/9.png&h=40&w=40',
        'سعودي': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/3007.png&h=40&w=40',
        'مصري': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/1237.png&h=40&w=40',
        'تونسي': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/1247.png&h=40&w=40',
        'مغربي': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/1039.png&h=40&w=40',
        'أبطال أوروبا': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/2.png&h=40&w=40',
        'اوروبا': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/2.png&h=40&w=40',
        'أبطال أفريقيا': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/1257.png&h=40&w=40',
        'أبطال آسيا': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/209.png&h=40&w=40',
        'الخليج': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/209.png&h=40&w=40',
        'عالم': 'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/4.png&h=40&w=40'
    };
    for (const [key, logo] of Object.entries(logos)) {
        if (league.includes(key)) return logo;
    }
    return 'https://cdn-icons-png.flaticon.com/512/1378/1378598.png';
}

/**
 * تنسيق وقت GMT للعرض
 */
export function formatGMTTime(timestamp) {
    const d = new Date(timestamp * 1000);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}
