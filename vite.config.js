import { defineConfig } from 'vite'

export default defineConfig({
    root: 'public',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: 'public/index.html',
                watch: 'public/watch.html'
            }
        }
    },
    define: {
        'import.meta.env.VITE_OGADS_LOCKER_ID': JSON.stringify(process.env.VITE_OGADS_LOCKER_ID || ''),
        'import.meta.env.VITE_ADSTERRA_SOCIAL_BAR_KEY': JSON.stringify(process.env.VITE_ADSTERRA_SOCIAL_BAR_KEY || ''),
        'import.meta.env.VITE_ADSTERRA_POPUNDER_KEY': JSON.stringify(process.env.VITE_ADSTERRA_POPUNDER_KEY || ''),
        'import.meta.env.VITE_MONETAG_ZONE_ID': JSON.stringify(process.env.VITE_MONETAG_ZONE_ID || '')
    }
})
