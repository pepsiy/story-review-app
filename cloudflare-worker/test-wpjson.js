const https = require('https');
const SECRET = '9a811f49407448828e14679bb9b15dcd';

async function fetchWorker(url) {
    const body = JSON.stringify({ url, secret: SECRET });
    return new Promise(resolve => {
        const req = https.request({
            hostname: 'xtruyen-proxy.dung-young.workers.dev',
            path: '/', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve(JSON.parse(d).html || ''));
        });
        req.on('error', e => resolve('error: ' + e.message));
        req.write(body); req.end();
    });
}

(async () => {
    const chapterId = '8182243'; // Chapter 1 of Con Duong Ba Chu
    const endpoints = [
        `https://xtruyen.vn/wp-json/wp/v2/posts/${chapterId}`,
        `https://xtruyen.vn/wp-json/wp/v2/pages/${chapterId}`,
        `https://xtruyen.vn/wp-json/wp/v2/chapter/${chapterId}`,
        `https://xtruyen.vn/wp-json/wp-manga/v1/chapter/${chapterId}`,
        `https://xtruyen.vn/wp-json/madara/v1/chapter/${chapterId}`,
        `https://xtruyen.vn/wp-json/wp/v2/search?search=chuong-1`
    ];

    for (const url of endpoints) {
        console.log(`\nTesting ${url} ...`);
        const resp = await fetchWorker(url);
        if (!resp) {
            console.log('Empty response');
        } else if (resp.includes('rest_no_route') || resp.includes('rest_post_invalid_id')) {
            console.log('Not found / No route');
        } else {
            console.log('Response Length:', resp.length);
            console.log('Sample:', resp.substring(0, 300));
        }
    }
})();
