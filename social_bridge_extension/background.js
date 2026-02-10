const SITE_URL = 'https://livematch-991.pages.dev';

chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create('checkPosts', { periodInMinutes: 15 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkPosts') {
        checkNewPosts();
    }
});

async function checkNewPosts() {
    try {
        const response = await fetch(`${SITE_URL}/data/pending_posts.json?t=${Date.now()}`);
        const posts = await response.json();

        chrome.storage.local.get(['postedIds'], (result) => {
            const postedIds = result.postedIds || [];
            const pending = posts.filter(p => !postedIds.includes(p.id));

            if (pending.length > 0) {
                chrome.action.setBadgeText({ text: pending.length.toString() });
                chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
            } else {
                chrome.action.setBadgeText({ text: '' });
            }
        });
    } catch (e) { }
}
