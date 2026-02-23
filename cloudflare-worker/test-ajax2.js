const https = require('https');

const MANGA_ID = '9063296';
const CHAPTER_SLUG = 'chuong-1';
const NONCE = 'c9f52c0b69'; // from earlier
const NONCE2 = 'd8f62d14af';

async function postAjax(action, extraData = {}) {
    const payload = new URLSearchParams({
        action,
        manga_id: MANGA_ID,
        chapter_slug: CHAPTER_SLUG,
        ...extraData
    });
    const body = payload.toString();

    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'xtruyen.vn',
            path: '/wp-admin/admin-ajax.php',
            method: 'POST',
            timeout: 10000,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1/',
                'X-Requested-With': 'XMLHttpRequest',
            }
        }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve({ status: res.statusCode, body: d }));
        });
        req.on('error', e => resolve({ status: 0, body: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'TIMEOUT' }); });
        req.write(body); req.end();
    });
}

const actions = [
    'manga_get_reading',
    'manga_reading_ajax',
    'manga_get_reading_content',
    'manga_get_chapter_content',
    'wp_manga_chapter_content',
    'manga_get_reading_ajax'
];

(async () => {
    for (const action of actions) {
        const res1 = await postAjax(action);
        console.log(`Action: ${action.padEnd(30)} | Status: ${res1.status} | Body(50): ${res1.body.substring(0, 50).replace(/\s+/g, ' ')}`);
        if (res1.body.includes('Nam') || res1.body.includes('chapter') || res1.body.includes('<p>')) {
            console.log('  *** CONTENT FOUND! ***');
        }
    }
})();
