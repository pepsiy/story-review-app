/**
 * Test all alternative approaches to fetch xtruyen.vn data without direct access
 */
const https = require('https');

const SLUG = 'con-duong-ba-chu';
const BASE = 'xtruyen.vn';

function get(url, headers = {}) {
    return new Promise((resolve) => {
        const u = new URL(url);
        const req = https.request({
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'GET',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json, text/html',
                ...headers,
            },
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
        });
        req.on('error', e => resolve({ status: 0, error: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
        req.end();
    });
}

async function main() {
    console.log('=== Alternative fetch approaches for xtruyen.vn ===\n');

    // 1. WordPress JSON API (most sites use this)
    console.log('[1] WordPress REST API - posts by slug');
    const wp1 = await get(`https://${BASE}/wp-json/wp/v2/posts?slug=${SLUG}&_fields=title,excerpt,author,categories,status,featured_media`);
    console.log(`    Status: ${wp1.status} | Length: ${wp1.data?.length}`);
    if (wp1.status === 200 && wp1.data?.includes('"id"')) {
        console.log('    ✅ WordPress API AVAILABLE!');
        try {
            const json = JSON.parse(wp1.data);
            if (json.length > 0) {
                console.log('    Title:', json[0].title?.rendered);
                console.log('    Excerpt:', json[0].excerpt?.rendered?.substring(0, 100));
            }
        } catch (e) { }
    } else {
        console.log('    ❌ Not available');
    }

    // 2. WP JSON custom post type (truyện)
    console.log('\n[2] WordPress REST API - custom post types');
    const wp2 = await get(`https://${BASE}/wp-json/wp/v2/types`);
    console.log(`    Status: ${wp2.status} | Length: ${wp2.data?.length}`);
    if (wp2.status === 200) {
        console.log('    ✅ WP Types API available - post types:', wp2.data?.substring(0, 200));
    }

    // 3. Sitemap check
    console.log('\n[3] Sitemap');
    const sitemap = await get(`https://${BASE}/sitemap.xml`);
    console.log(`    Status: ${sitemap.status} | Length: ${sitemap.data?.length}`);

    // 4. RSS Feed
    console.log('\n[4] RSS Feed');
    const rss = await get(`https://${BASE}/feed/`);
    console.log(`    Status: ${rss.status} | Length: ${rss.data?.length}`);
    if (rss.status === 200 && rss.data?.includes('<title>')) {
        console.log('    ✅ RSS feed available!');
        const titles = [...rss.data.matchAll(/<title><!\\[CDATA\\[([^\\]]+)\\]\\]><\/title>/g)].slice(0, 5);
        titles.forEach(m => console.log('       -', m[1]));
    }

    // 5. ScraperAPI test (free tier - needs API key from env)
    const scraperKey = process.env.SCRAPERAPI_KEY;
    if (scraperKey) {
        console.log('\n[5] ScraperAPI test');
        const scraperUrl = `https://api.scraperapi.com?api_key=${scraperKey}&url=${encodeURIComponent('https://' + BASE + '/truyen/' + SLUG + '/')}&render=false`;
        const scraper = await get(scraperUrl);
        console.log(`    Status: ${scraper.status} | Length: ${scraper.data?.length}`);
        if (scraper.status === 200 && scraper.data?.includes('<h1')) {
            const h1 = scraper.data.match(/<h1[^>]*>([^<]+)<\/h1>/);
            console.log(`    ✅ ScraperAPI works! Title: ${h1 ? h1[1] : 'could not parse'}`);
        }
    } else {
        console.log('\n[5] ScraperAPI - set SCRAPERAPI_KEY env var to test');
    }
}

main().catch(console.error);
