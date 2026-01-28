class FallbackManager {
    constructor() {
        this.streamCache = new Map();
        this.failedStreams = new Set();
        this.successfulStreams = new Map();
    }

    /**
     * إضافة روابط بث لمباراة
     */
    addStreams(matchId, streams) {
        if (!this.streamCache.has(matchId)) {
            this.streamCache.set(matchId, []);
        }

        const existing = this.streamCache.get(matchId);
        const newStreams = streams.filter(s =>
            !existing.some(e => e.url === s.url)
        );

        existing.push(...newStreams);

        // ترتيب حسب الأولوية والنجاح السابق
        existing.sort((a, b) => {
            const aSuccess = this.successfulStreams.get(a.url) || 0;
            const bSuccess = this.successfulStreams.get(b.url) || 0;

            if (aSuccess !== bSuccess) {
                return bSuccess - aSuccess; // الأكثر نجاحاً أولاً
            }

            return (a.priority || 99) - (b.priority || 99);
        });
    }

    /**
     * الحصول على أفضل رابط متاح
     */
    getBestStream(matchId) {
        const streams = this.streamCache.get(matchId) || [];

        // تصفية الروابط الفاشلة
        const available = streams.filter(s => !this.failedStreams.has(s.url));

        return available[0] || null;
    }

    /**
     * الحصول على جميع الروابط المتاحة
     */
    getAllStreams(matchId) {
        const streams = this.streamCache.get(matchId) || [];
        return streams.filter(s => !this.failedStreams.has(s.url));
    }

    /**
     * تسجيل فشل رابط
     */
    markAsFailed(url) {
        this.failedStreams.add(url);
        console.log(`❌ Marked as failed: ${url}`);
    }

    /**
     * تسجيل نجاح رابط
     */
    markAsSuccessful(url) {
        const count = this.successfulStreams.get(url) || 0;
        this.successfulStreams.set(url, count + 1);
        console.log(`✅ Marked as successful: ${url} (${count + 1} times)`);
    }

    /**
     * الحصول على الرابط التالي
     */
    getNextStream(matchId, currentUrl) {
        const streams = this.streamCache.get(matchId) || [];
        const currentIndex = streams.findIndex(s => s.url === currentUrl);

        if (currentIndex === -1) return null;

        // البحث عن الرابط التالي غير الفاشل
        for (let i = currentIndex + 1; i < streams.length; i++) {
            if (!this.failedStreams.has(streams[i].url)) {
                return streams[i];
            }
        }

        return null;
    }

    /**
     * إعادة تعيين الروابط الفاشلة (بعد فترة)
     */
    resetFailedStreams() {
        const count = this.failedStreams.size;
        this.failedStreams.clear();
        console.log(`🔄 Reset ${count} failed streams`);
    }

    /**
     * الحصول على إحصائيات
     */
    getStats() {
        return {
            totalMatches: this.streamCache.size,
            totalStreams: Array.from(this.streamCache.values()).reduce((sum, streams) => sum + streams.length, 0),
            failedStreams: this.failedStreams.size,
            successfulStreams: this.successfulStreams.size
        };
    }
}

module.exports = FallbackManager;
