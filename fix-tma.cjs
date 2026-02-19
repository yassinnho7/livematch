const fs = require('fs');
const filepath = 'public/js/tma-v2.js';
let content = fs.readFileSync(filepath, 'utf8');

const replacements = {
    // 1
    'renderError("ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ù…Ø¨Ø§Ø±ÙŠØ§Øª Ø­Ø§Ù„ÙŠØ§")': 'renderError("تعذر تحميل المباريات حاليا")',
    'showNote("Ù Ø´Ù„ Ø§Ù„ØªØ­Ø¯ÙŠØ«. Ø³ÙŠØªÙ… Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© ØªÙ„Ù‚Ø§Ø¦ÙŠØ§.")': 'showNote("فشل التحديث. سيتم المحاولة تلقائيا.")',

    // 2
    'safeString(raw.league && raw.league.name, "Ø¨Ø·ÙˆÙ„Ø©")': 'safeString(raw.league && raw.league.name, "بطولة")',
    'safeString(raw.home && raw.home.name, "Ø§Ù„Ù Ø±ÙŠÙ‚ Ø§Ù„Ø£ÙˆÙ„")': 'safeString(raw.home && raw.home.name, "الفريق الأول")',
    'safeString(raw.away && raw.away.name, "Ø§Ù„Ù Ø±ÙŠÙ‚ Ø§Ù„Ø«Ø§Ù†ÙŠ")': 'safeString(raw.away && raw.away.name, "الفريق الثاني")',

    // 3
    'safeString(s && s.channel, "Ø¨Ø« Ù…Ø¨Ø§Ø´Ø±")': 'safeString(s && s.channel, "بث مباشر")',

    // 4
    'renderError("Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…Ø¨Ø§Ø±ÙŠØ§Øª Ù…ØªØ§Ø­Ø© Ø§Ù„Ø¢Ù†")': 'renderError("لا توجد مباريات متاحة الآن")',

    // 5
    'createGroup("Ù…Ø¨Ø§Ø´Ø± Ø§Ù„Ø¢Ù†", live)': 'createGroup("مباشر الآن", live)',
    'createGroup("Ù…Ø¨Ø§Ø±ÙŠØ§Øª Ù‚Ø§Ø¯Ù…Ø©", next)': 'createGroup("مباريات قادمة", next)',
    'createGroup("Ù…Ø¨Ø§Ø±ÙŠØ§Øª Ù…Ù†ØªÙ‡ÙŠØ©", done)': 'createGroup("مباريات منتهية", done)',

    // 6
    '`ðŸ“º ${match.streams.length} Ø³ÙŠØ±Ù Ø±`': '`📺 ${match.streams.length} سيرفر`',
    'createEl("button", "watch-pill", "Ø§Ø®ØªÙŠØ§Ø± Ø§Ù„Ø³ÙŠØ±Ù Ø±")': 'createEl("button", "watch-pill", "اختيار السيرفر")',

    // 7
    'createEl("span", "status live", "Ù…Ø¨Ø§Ø´Ø±")': 'createEl("span", "status live", "مباشر")',
    'createEl("span", "status ft", "Ø§Ù†ØªÙ‡Øª")': 'createEl("span", "status ft", "انتهت")',

    // 8
    'match.status === "LIVE" ? "Ø¬Ø§Ø±ÙŠØ© Ø§Ù„Ø¢Ù†" : "Ø¨ØªÙˆÙ‚ÙŠØª GMT"': 'match.status === "LIVE" ? "جارية الآن" : "بتوقيت GMT"',

    // 9
    '`${state.selectedMatch.homeName} Ã— ${state.selectedMatch.awayName}`': '`${state.selectedMatch.homeName} × ${state.selectedMatch.awayName}`',

    // 10
    '"Ø§Ø¹Ø¯ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù„Ø§Ø­Ù‚Ø§ØŒ Ø§Ù„Ø³ÙŠØ±Ù Ø± ØºÙŠØ± Ù…ØªÙˆÙ Ø± Ø­Ø§Ù„ÙŠØ§. Ù‚Ø¯ ÙŠØ¸Ù‡Ø± Ø¨Ø¹Ø¯ Ø§Ù„ØªØ­Ø¯ÙŠØ« Ø§Ù„ØªØ§Ù„ÙŠ Ø®Ù„Ø§Ù„ 7 Ø¯Ù‚Ø§Ø¦Ù‚."': '"اعد المحاولة لاحقا، السيرفر غير متوفر حاليا. قد يظهر بعد التحديث التالي خلال 7 دقائق."',

    // 11
    'createEl("span", "server-icon", "ðŸ“º")': 'createEl("span", "server-icon", "📺")',
    '`Ø³ÙŠØ±Ù Ø± ${idx + 1}`': '`سيرفر ${idx + 1}`',

    // 12
    'showNote("Ø±Ø§Ø¨Ø· Ø§Ù„Ø¨Ø« ØºÙŠØ± ØµØ§Ù„Ø­.")': 'showNote("رابط البث غير صالح.")',
    'showNote("Ø§Ø¹Ø¯ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù„Ø§Ø­Ù‚Ø§ØŒ Ø§Ù„Ø³ÙŠØ±Ù Ø± ØºÙŠØ± Ù…ØªÙˆÙ Ø± Ø­Ø§Ù„ÙŠØ§.")': 'showNote("اعد المحاولة لاحقا، السيرفر غير متوفر حاليا.")',

    // 13
    '`â ± ': '`⏳ ',

    // 14
    'tg.showConfirm("Ù‡Ù„ ØªØ±ÙŠØ¯ Ø§Ù„Ø®Ø±ÙˆØ¬ Ù…Ù† Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ØŸ"': 'tg.showConfirm("هل تريد الخروج من التطبيق؟"',
    'window.confirm("Ù‡Ù„ ØªØ±ÙŠØ¯ Ø§Ù„Ø®Ø±ÙˆØ¬ Ù…Ù† Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ØŸ")': 'window.confirm("هل تريد الخروج من التطبيق؟")',

    // 15
    'showNote("ØªÙ… ØªÙ Ø¹ÙŠÙ„ ÙˆØ¶Ø¹ Ù…Ø´Ø§Ù‡Ø¯Ø© Ø£Ù Ù‚ÙŠ Ø¨Ø¯ÙŠÙ„.")': 'showNote("تم تفعيل وضع مشاهدة أفقي بديل.")'
};

for (const [bad, good] of Object.entries(replacements)) {
    if (content.includes(bad)) {
        content = content.replaceAll(bad, good);
    } else {
        console.warn('Could not find string:', bad);
    }
}

const oldInit = `function initTelegram() {
    if (!tg) return;

    tg.ready();
    tg.expand();
    if (typeof tg.disableVerticalSwipes === "function") {
        tg.disableVerticalSwipes();
    }
    tg.BackButton.onClick(handleBack);

    if (tg.colorScheme === "dark" || tg.colorScheme === "light") {
        document.documentElement.setAttribute("data-theme", tg.colorScheme);
    }
}`;
const newInit = `function initTelegram() {
    if (!tg) return;

    try {
        tg.ready();
        tg.expand();
        if (typeof tg.disableVerticalSwipes === "function") {
            tg.disableVerticalSwipes();
        }
        if (tg.BackButton && typeof tg.BackButton.onClick === "function") {
            tg.BackButton.onClick(handleBack);
        }

        if (tg.colorScheme === "dark" || tg.colorScheme === "light") {
            document.documentElement.setAttribute("data-theme", tg.colorScheme);
        }
    } catch (e) {
        console.error("Telegram initialization error:", e);
    }
}`;

if (content.includes(oldInit)) {
    content = content.replace(oldInit, newInit);
} else {
    console.warn("Could not find initTelegram block");
}

fs.writeFileSync(filepath, content, 'utf8');
console.log('Fixed encoding and bugs in tma-v2.js');
