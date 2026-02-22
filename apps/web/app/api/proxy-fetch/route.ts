import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_DOMAINS = ['xtruyen.vn'];
const PROXY_SECRET = process.env.PROXY_FETCH_SECRET || '';

/**
 * Internal proxy endpoint for fetching Cloudflare-protected pages.
 * Called by the Render API server (which gets IP-blocked by Cloudflare).
 * Vercel serverless runs from IPs that Cloudflare allows.
 *
 * POST /api/proxy-fetch
 * Body: { url: string, secret: string }
 * Returns: { html: string }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { url, secret } = body;

        // Security: check secret key
        if (!PROXY_SECRET || secret !== PROXY_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Security: only allow whitelisted domains
        let hostname: string;
        try {
            hostname = new URL(url).hostname;
        } catch {
            return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
        }

        if (!ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) {
            return NextResponse.json({ error: `Domain not allowed: ${hostname}` }, { status: 403 });
        }

        // Fetch with browser-like headers
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'max-age=0',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
            },
            redirect: 'follow',
        });

        if (!res.ok) {
            return NextResponse.json(
                { error: `Upstream returned ${res.status}` },
                { status: res.status }
            );
        }

        const html = await res.text();
        return NextResponse.json({ html }, { status: 200 });

    } catch (err: any) {
        console.error('[proxy-fetch] Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
