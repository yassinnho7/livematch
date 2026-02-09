export async function onRequest(context) {
    // Read environment variables from Cloudflare Pages context
    const env = context.env;

    const config = {
        adIds: {
            ogadsLockerUrl: env.VITE_OGADS_LOCKER_ID || '',
            adsterraBanner: env.VITE_ADSTERRA_BANNER_KEY || '',
            adsterraSocial: env.VITE_ADSTERRA_SOCIAL_BAR_KEY || '',
            adsterraErrorBanner: env.VITE_ADSTERRA_BANNER728_KEY || '',
            monetagDirectLink: env.VITE_MONETAG_ZONE_ID || '',
            ggAgencyLink: env.VITE_GGAGENCY_LINK_ID || ''
        }
    };

    return new Response(JSON.stringify(config), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', // CORS just in case
            'Cache-Control': 'no-store' // Don't cache secrets on client browser too aggressively if they change
        }
    });
}
