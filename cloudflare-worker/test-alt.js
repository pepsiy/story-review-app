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
        req.on('error', e => resolve(''));
        req.write(body); req.end();
    });
}

(async () => {
    // Try style=list
    console.log('Testing ?style=list ...');
    let html = await fetchWorker('https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1707/?style=list');
    console.log('Length:', html.length, '| Has Nam?', html.includes('Nam'));

    // Try WP REST API
    console.log('\nTesting WP REST API /wp-json/wp/v2/posts/26270 ...');
    // Need to find the correct POST ID for chapter 1707 first. We know manga is 9063296.

    // Actually, Madara chapter endpoint is sometimes /ajax/chapter-archive
    // Or maybe there's an RSS feed /feed/
    console.log('\nTesting /feed/ ...');
    html = await fetchWorker('https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1707/feed/');
    console.log('Length:', html.length, '| Has Nam?', html.includes('Nam'));

    // Try m.xtruyen.vn or amp
    console.log('\nTesting /amp/ ...');
    html = await fetchWorker('https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1707/amp/');
    console.log('Length:', html.length, '| Has Nam?', html.includes('Nam'));
})();
