const https = require('https');
const cheerio = require('cheerio');
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
    const urls = [
        'https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1/',
        'https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-2/',
        'https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-10/',
        'https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1707/',
    ];

    for (const url of urls) {
        console.log(`\nFetching ${url} ...`);
        const html = await fetchWorker(url);
        const $ = cheerio.load(html);

        const wrapper = $('#chapter-reading-content');
        if (wrapper.length > 0) {
            const text = wrapper.text().trim().replace(/\s+/g, ' ');
            console.log(`FOUND #chapter-reading-content length: ${text.length}`);
            if (text.length > 100) {
                console.log(`Sample: ${text.substring(0, 150)}`);
            }
        } else {
            console.log('NO #chapter-reading-content found!');
        }
    }
})();
