// Test common Madara AJAX action names for chapter content
const https = require('https');

const MANGA_ID = '9063296';
const CHAPTER_SLUG = 'chuong-1';

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
            res.on('end', () => resolve({ status: res.status, body: d.substring(0, 300) }));
        });
        req.on('error', e => resolve({ status: 0, body: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'TIMEOUT' }); });
        req.write(body); req.end();
    });
}

const actions = [
    'manga-reading-content',
    'manga_reading_ajax',
    'manga_get_reading_content',
    'manga_get_chapter_content',
    'madara_load_chapters',
    'manga_ajax',
    'wp_manga_chapter_content',
];

(async () => {
    for (const action of actions) {
        const res = await postAjax(action);
        const hasContent = res.body.includes('Nam') || res.body.includes('chapter');
        console.log(`Action: ${action.padEnd(35)} | Status: ${res.status} | Body: ${res.body.substring(0, 80).replace(/\s+/g, ' ')}`);
        if (hasContent) console.log('  *** CONTENT FOUND! ***');
    }
})();
