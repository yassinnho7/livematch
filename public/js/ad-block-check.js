/**
 * LIVE MATCH - AD-BLOCKER DETECTION
 * =========================================
 * Detects if ads are blocked and shows a subtle toast to the user.
 */

(function initAdBlockCheck() {
    // Wait for everything to load
    window.addEventListener('load', () => {
        // Create a dummy ad element
        const dummyAd = document.createElement('div');
        dummyAd.innerHTML = '&nbsp;';
        dummyAd.className = 'ad-container ad-slot ads-banner pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ad text_ads text-ads';
        dummyAd.setAttribute('style', 'position: absolute; left: -9999px; top: -9999px; width: 1px; height: 1px;');
        document.body.appendChild(dummyAd);

        // Wait a bit and check if it's hidden
        setTimeout(() => {
            const isBlocked = dummyAd.offsetHeight === 0 ||
                dummyAd.style.display === 'none' ||
                dummyAd.style.visibility === 'hidden' ||
                window.getComputedStyle(dummyAd).display === 'none';

            if (isBlocked) {
                showAdBlockToast();
                if (window.trackEvent) {
                    trackEvent('ad_block_detected');
                }
            }

            // Clean up
            document.body.removeChild(dummyAd);
        }, 1000);
    });

    function showAdBlockToast() {
        const toast = document.createElement('div');
        toast.id = 'ad-block-toast';
        toast.innerHTML = `
            <div style="background: #2d3748; color: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border-left: 4px solid #f6ad55; font-family: 'Cairo', sans-serif; font-size: 14px; position: fixed; bottom: 20px; left: 20px; z-index: 10000; animation: slideInLeft 0.5s ease;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 20px;">💡</span>
                    <span>يرجى تعطيل حاجب الإعلانات لدعمنا في استمرار البث المباشر. شكراً لك!</span>
                    <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 0 5px;">&times;</button>
                </div>
            </div>
            <style>
                @keyframes slideInLeft {
                    from { opacity: 0; transform: translateX(-100%); }
                    to { opacity: 1; transform: translateX(0); }
                }
            </style>
        `;
        document.body.appendChild(toast);
    }
})();
