import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8081;

const server = http.createServer((req, res) => {
    // Add CORS headers for everything
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
    }

    if (req.url.startsWith('/api/get-html')) {
        const url = new URL(req.url, `http://localhost:${PORT}`);
        const serv = url.searchParams.get('serv') || '1';

        const targetUrl = `https://aa.yallashoot2026.com/albaplayer/sports-d1/?serv=${serv}`;

        https.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        }, (proxyRes) => {
            let data = '';
            proxyRes.on('data', chunk => data += chunk);
            proxyRes.on('end', () => {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            });
        }).on('error', (err) => {
            res.writeHead(500);
            res.end(`Error: ${err.message}`);
        });
        return;
    }

    if (req.url.startsWith('/proxy/')) {
        const targetUrlStr = req.url.substring(7);
        try {
            const targetUrl = new URL(targetUrlStr);
            const options = {
                hostname: targetUrl.hostname,
                port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
                path: targetUrl.pathname + targetUrl.search,
                method: req.method,
                headers: {
                    'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
                    'Accept': req.headers['accept'] || '*/*',
                    'Accept-Language': req.headers['accept-language'] || '*',
                    'Referer': 'https://aa.yallashoot2026.com/',
                    'Origin': 'https://aa.yallashoot2026.com',
                    'Connection': 'keep-alive'
                }
            };
            const client = targetUrl.protocol === 'https:' ? https : http;

            const proxyReq = client.request(options, (proxyRes) => {
                const headers = { ...proxyRes.headers };

                // Set CORS headers
                headers['access-control-allow-origin'] = '*';
                headers['access-control-allow-methods'] = 'GET, OPTIONS';

                res.writeHead(proxyRes.statusCode, headers);
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (e) => {
                console.error('Proxy Error:', e.message);
                res.writeHead(500);
                res.end(e.message);
            });

            req.pipe(proxyReq);
        } catch (e) {
            console.error('Proxy URL Error:', e.message);
            res.writeHead(400);
            res.end('Invalid URL');
        }
        return;
    }

    // Serve the test HTML file
    if (req.url === '/' || req.url === '/player-test.html') {
        const filePath = path.join(__dirname, 'public', 'player-test.html');
        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading player-test.html');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(content);
            }
        });
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`Server running at: http://localhost:${PORT}/`);
    console.log(`========================================\n`);
});
