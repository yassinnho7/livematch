const SITE_URL = 'https://livematch-991.pages.dev';

document.addEventListener('DOMContentLoaded', async () => {
    await refreshPosts();
});

async function refreshPosts() {
    const list = document.getElementById('posts-list');
    const countBadge = document.getElementById('pending-count');
    const syncTime = document.getElementById('last-sync');

    try {
        const response = await fetch(`${SITE_URL}/data/pending_posts.json?t=${Date.now()}`);
        if (!response.ok) throw new Error('Failed to fetch');

        const posts = await response.json();

        // Filter out already posted from local storage
        chrome.storage.local.get(['postedIds'], (result) => {
            const postedIds = result.postedIds || [];
            const pending = posts.filter(p => !postedIds.includes(p.id));

            countBadge.textContent = pending.length;
            syncTime.textContent = `آخر تزامن: ${new Date().toLocaleTimeString('ar-EG')}`;

            if (pending.length === 0) {
                list.innerHTML = '<div class="empty-state">✅ كل المقالات تم نشرها!</div>';
                return;
            }

            list.innerHTML = '';
            pending.forEach(post => {
                const card = document.createElement('div');
                card.className = 'post-card';
                card.innerHTML = `
                    <div class="post-title">${post.title}</div>
                    <button class="btn-assist" data-id="${post.id}" data-url="${SITE_URL}/article.html?${post.type}=${post.id}" data-text="${post.summary}">
                        التحضير للنشر 📤
                    </button>
                `;
                list.appendChild(card);
            });

            // Add button listeners
            document.querySelectorAll('.btn-assist').forEach(btn => {
                btn.onclick = (e) => preparePost(e.target.dataset);
            });
        });

    } catch (e) {
        list.innerHTML = '<div class="empty-state">❌ فشل الاتصال بالموقع.</div>';
    }
}

function preparePost(data) {
    const fullText = `${data.text}\n\n(التكملة والرابط في أول تعليق ✨👇)`;
    const commentText = `رابط المقال كاملاً: ${data.url}`;

    // 1. Copy main text to clipboard
    copyToClipboard(fullText);

    // 2. Mark as pending and redirect to FB
    chrome.storage.local.get(['postedIds'], (result) => {
        const postedIds = result.postedIds || [];
        if (!postedIds.includes(data.id)) {
            postedIds.push(data.id);
            chrome.storage.local.set({ postedIds });
        }
    });

    // 3. Store the comment text for the content script to help
    chrome.storage.local.set({
        pendingComment: commentText,
        lastPostTime: Date.now()
    });

    alert('✅ تم نسخ النص الإبداعي للمنشور!\n\nسيتم الآن فتح فيسبوك. الرابط محفوظ لدينا وسأذكرك بوضعه في التعليق الأول بعد قليل.');

    // 4. Open FB (User's specific group)
    window.open('https://www.facebook.com/groups/2464364173789354', '_blank');
}

function copyToClipboard(text) {
    const input = document.createElement('textarea');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
}
