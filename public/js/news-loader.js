/**
 * News Loader - LiveMatch
 * Dynamically loads sports news from our AI news index.
 */

document.addEventListener('DOMContentLoaded', () => {
    const isHomePage = document.getElementById('news-container') !== null;
    const isArticlePage = document.getElementById('related-news') !== null;

    if (isHomePage) {
        initNews('news-container', 12);
    } else if (isArticlePage) {
        initNews('related-news', 6);
    }
});

async function initNews(containerId, limit = 10) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const response = await fetch(`/data/news_index.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Could not load news');

        const news = await response.json();
        if (news.length === 0) {
            container.innerHTML = '<div class="loading">لا توجد أخبار حالياً...</div>';
            return;
        }

        container.innerHTML = '';
        const items = news.slice(0, limit);

        items.forEach(item => {
            const card = document.createElement('a');
            card.href = `/article.html?news=${item.id}`;
            card.className = 'news-card';

            const date = new Date(item.timestamp * 1000).toLocaleDateString('ar-EG', {
                month: 'short',
                day: 'numeric'
            });

            card.innerHTML = `
                <img src="${item.poster}" alt="${item.title}" class="news-poster" loading="lazy" onerror="this.src='/assets/backgrounds/stadium_night.png'">
                <div class="news-info">
                    <h3 class="news-title">${item.title}</h3>
                    <div class="news-meta">
                        <span>📰 أخبار رياضية</span>
                        <span>${date}</span>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (err) {
        console.warn('News loading failed:', err);
        container.innerHTML = '<div class="loading" style="background:transparent; color:#94a3b8;">سيتم توفير الأخبار قريباً... ⏳</div>';
    }
}
