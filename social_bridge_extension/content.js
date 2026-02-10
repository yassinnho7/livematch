// This script runs on Facebook pages
let helpBanner = null;

chrome.storage.local.get(['pendingComment', 'lastPostTime'], (data) => {
    // Only show help if we recently came from the popup (within last 30 mins)
    const isRecent = data.lastPostTime && (Date.now() - data.lastPostTime < 30 * 60 * 1000);

    if (data.pendingComment && isRecent) {
        showHelpBanner(data.pendingComment);
    }
});

function showHelpBanner(linkText) {
    if (helpBanner) return;

    helpBanner = document.createElement('div');
    helpBanner.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 99999;
        background: #1e293b;
        color: white;
        padding: 15px;
        border-radius: 10px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.5);
        border: 2px solid #667eea;
        font-family: Arial, sans-serif;
        max-width: 300px;
        direction: rtl;
    `;

    helpBanner.innerHTML = `
        <p style="margin: 0 0 10px 0; font-size: 14px;">🌟 جاهز لوضع الرابط في التعليق الأول؟</p>
        <button id="copy-link-btn" style="
            background: #667eea; 
            color: white; 
            border: none; 
            padding: 8px 12px; 
            border-radius: 5px; 
            cursor: pointer;
            width: 100%;
            font-weight: bold;
        ">نسخ رابط المقال الآن 🔗</button>
        <button id="close-help-btn" style="
            background: transparent; 
            color: #94a3b8; 
            border: none; 
            margin-top: 5px;
            cursor: pointer;
            font-size: 12px;
            width: 100%;
        ">إغلاق</button>
    `;

    document.body.appendChild(helpBanner);

    document.getElementById('copy-link-btn').onclick = () => {
        const el = document.createElement('textarea');
        el.value = linkText;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);

        document.getElementById('copy-link-btn').innerText = '✅ تم النسخ!';
        setTimeout(() => {
            helpBanner.remove();
            chrome.storage.local.remove('pendingComment');
        }, 1500);
    };

    document.getElementById('close-help-btn').onclick = () => {
        helpBanner.remove();
    };
}
