export async function onRequest(context) {
    // Read environment variables from Cloudflare Pages context
    const env = context.env;

    const config = {
        adIds: {
            // VITE_OGADS_LOCKER_ID now contains the FULL URL (e.g., https://lockedapp.space/cl/i/l776rj)
            ogadsLockerUrl: env.VITE_OGADS_LOCKER_ID || '',
            monetagZoneId: env.VITE_MONETAG_ZONE_ID || '',
            adsterraSocial: env.VITE_ADSTERRA_SOCIAL_BAR_KEY || '',
            adsterraPop: env.VITE_ADSTERRA_POPUNDER_KEY || ''
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
