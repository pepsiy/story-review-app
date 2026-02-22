/**
 * Cloudflare Worker: Proxy for xtruyen.vn
 * 
 * This Worker runs on Cloudflare's edge network (AS13335).
 * Cloudflare does not block its own Workers from accessing CF-protected sites.
 * 
 * Env vars (set in Cloudflare dashboard):
 *   PROXY_SECRET - shared secret between Render and this Worker
 */

const ALLOWED_DOMAINS = ['xtruyen.vn'];

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'max-age=0',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
};

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...CORS },
    });
}

export default {
    async fetch(request, env) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS });
        }

        if (request.method !== 'POST') {
            return json({ error: 'Method Not Allowed' }, 405);
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return json({ error: 'Invalid JSON body' }, 400);
        }

        const { url, secret } = body;

        // Security: validate secret
        const expectedSecret = env.PROXY_SECRET;
        if (!expectedSecret || secret !== expectedSecret) {
            return json({ error: 'Unauthorized' }, 401);
        }

        // Security: validate URL and domain whitelist
        let hostname;
        try {
            hostname = new URL(url).hostname;
        } catch {
            return json({ error: 'Invalid URL' }, 400);
        }

        if (!ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) {
            return json({ error: `Domain not allowed: ${hostname}` }, 403);
        }

        // Fetch via Cloudflare edge (bypasses IP block affecting datacenter IPs)
        let res;
        try {
            res = await fetch(url, {
                method: 'GET',
                headers: BROWSER_HEADERS,
                redirect: 'follow',
            });
        } catch (err) {
            return json({ error: `Fetch failed: ${err.message}` }, 502);
        }

        if (!res.ok) {
            return json({ error: `Upstream returned ${res.status}` }, res.status);
        }

        const html = await res.text();
        console.log(`[proxy] ${url} → ${res.status} (${html.length} bytes)`);

        return json({ html, status: res.status });
    },
};
