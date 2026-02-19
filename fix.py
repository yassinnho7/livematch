import os

filepath = 'public/js/tma-v2.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')

lines[149] = '            renderError("تعذر تحميل المباريات حاليا");'
lines[151] = '        showNote("فشل التحديث. سيتم المحاولة تلقائيا.");'

lines[166] = '        leagueName: safeString(raw.league && raw.league.name, "بطولة"),'
lines[168] = '        homeName: safeString(raw.home && raw.home.name, "الفريق الأول"),'
lines[170] = '        awayName: safeString(raw.away && raw.away.name, "الفريق الثاني"),'

lines[195] = '            channel: safeString(s && s.channel, "بث مباشر"),'
lines[223] = '        renderError("لا توجد مباريات متاحة الآن");'

lines[238] = '    if (live.length) els.matches.appendChild(createGroup("مباشر الآن", live));'
lines[239] = '    if (next.length) els.matches.appendChild(createGroup("مباريات قادمة", next));'
lines[240] = '    if (done.length) els.matches.appendChild(createGroup("مباريات منتهية", done));'

lines[278] = '    bottom.appendChild(createEl("span", "servers-count", `📺 ${match.streams.length} سيرفر`));'
lines[279] = '    bottom.appendChild(createEl("button", "watch-pill", "اختيار السيرفر"));'

lines[288] = '    if (match.status === "LIVE") return createEl("span", "status live", "مباشر");'
lines[289] = '    if (match.status === "FT") return createEl("span", "status ft", "انتهت");'

lines[307] = '        center.appendChild(createEl("div", "sub", match.status === "LIVE" ? "جارية الآن" : "بتوقيت GMT"));'
lines[336] = '    els.serversTitle.textContent = `${state.selectedMatch.homeName} × ${state.selectedMatch.awayName}`;'

lines[346] = '                "اعد المحاولة لاحقا، السيرفر غير متوفر حاليا. قد يظهر بعد التحديث التالي خلال 7 دقائق.",'

lines[355] = '            const icon = createEl("span", "server-icon", "📺");'
lines[357] = '            text.appendChild(createEl("b", "", `سيرفر ${idx + 1}`));'

lines[377] = '        showNote("رابط البث غير صالح.");'
lines[380] = '        showNote("اعد المحاولة لاحقا، السيرفر غير متوفر حاليا.");'

lines[414] = '            el.textContent = `⏳ ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;'

lines[469] = '        tg.showConfirm("هل تريد الخروج من التطبيق؟", (ok) => {'
lines[475] = '    const ok = window.confirm("هل تريد الخروج من التطبيق؟");'

lines[590] = '    showNote("تم تفعيل وضع مشاهدة أفقي بديل.");'

lines[59:74] = [
'function initTelegram() {',
'    if (!tg) return;',
'',
'    try {',
'        tg.ready();',
'        tg.expand();',
'        if (typeof tg.disableVerticalSwipes === "function") {',
'            tg.disableVerticalSwipes();',
'        }',
'        if (tg.BackButton && typeof tg.BackButton.onClick === "function") {',
'            tg.BackButton.onClick(handleBack);',
'        }',
'',
'        if (tg.colorScheme === "dark" || tg.colorScheme === "light") {',
'            document.documentElement.setAttribute("data-theme", tg.colorScheme);',
'        }',
'    } catch (e) {',
'        console.error("Telegram initialization error:", e);',
'    }',
'}'
]

with open(filepath, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
print("Fixed successfully")
