const https = require('https');

const MANGA_ID = '9063296';
const CHAPTER_ID = '8182243';
const CHAPTER_SLUG = 'chuong-1';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

async function fetchAjaxContent() {
    console.log('1. Fetching chapter html to get Nonce & Cookies...');

    const getOpts = {
        hostname: 'xtruyen.vn',
        path: `/truyen/con-duong-ba-chu/${CHAPTER_SLUG}/`,
        method: 'GET',
        headers: { 'User-Agent': UA }
    };

    const getRes = await new Promise(resolve => {
        let d = '';
        const req = https.request(getOpts, res => {
            res.on('data', c => d += c);
            res.on('end', () => resolve({ body: d, headers: res.headers }));
        });
        req.end();
    });

    const cookies = getRes.headers['set-cookie'] || [];
    const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');
    console.log('Got cookies:', cookieStr);

    const html = getRes.body;
    const nonceMatch = html.match(/"nonce"\s*:\s*"([^"]+)"/);
    const mangaNonceMatch = html.match(/"manga_nonce"\s*:\s*"([^"]+)"/);

    const nonce = nonceMatch ? nonceMatch[1] : '';
    const mangaNonce = mangaNonceMatch ? mangaNonceMatch[1] : '';
    console.log(`Nonces: ${nonce} | ${mangaNonce}`);

    // Now, what is the action name? Let's try the most common WP Manga actions with these credentials
    const actions = [
        'manga_get_reading',
        'manga_get_reading_content',
        'wp_manga_chapter_content',
        'manga_reading_ajax'
    ];

    for (const action of actions) {
        const payload = new URLSearchParams({
            action,
            manga_id: MANGA_ID,
            chapter_id: CHAPTER_ID,
            chapter_slug: CHAPTER_SLUG,
            chapter: CHAPTER_SLUG,
            manga_nonce: mangaNonce,
            _wpnonce: nonce
        });

        const bodyStr = payload.toString();
        console.log(`\n2. POSTing to admin-ajax with action=${action}`);

        const postOpts = {
            hostname: 'xtruyen.vn',
            path: '/wp-admin/admin-ajax.php',
            method: 'POST',
            headers: {
                'User-Agent': UA,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': `https://xtruyen.vn/truyen/con-duong-ba-chu/${CHAPTER_SLUG}/`,
                'Cookie': cookieStr,
                'Content-Length': Buffer.byteLength(bodyStr)
            }
        };

        const postRes = await new Promise(resolve => {
            let d = '';
            const r = https.request(postOpts, res => {
                res.on('data', c => d += c);
                res.on('end', () => resolve({ status: res.statusCode, body: d }));
            });
            r.write(bodyStr);
            r.end();
        });

        console.log(`Status: ${postRes.status}`);
        console.log(`Body(100): ${postRes.body.substring(0, 100).replace(/\s+/g, ' ')}`);
        if (postRes.body.includes('Nam') || postRes.body.includes('chapter')) {
            console.log('✅ CONTENT FOUND!');
        }
    }
}

fetchAjaxContent();
