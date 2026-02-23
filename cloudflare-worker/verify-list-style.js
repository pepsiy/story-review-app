const https = require('https');
const cheerio = require('cheerio');
const SECRET = '9a811f49407448828e14679bb9b15dcd';

const body = JSON.stringify({ url: 'https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1707/?style=list', secret: SECRET });
const req = https.request({
    hostname: 'xtruyen-proxy.dung-young.workers.dev',
    path: '/', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        const { html } = JSON.parse(d);
        require('fs').writeFileSync('chapter1707-list.html', html);
        const $ = cheerio.load(html);

        // Test current selectors
        let content = '';
        const selectors = [
            '#chapter-reading-content',
            '.text-left #chapter-reading-content',
            '.reading-content-wrap .content-area',
            '.entry-content',
            '.chapter-content',
            '.text-left'
        ];

        for (const selector of selectors) {
            const el = $(selector);
            if (el.length > 0) {
                content = el.text().trim();
                if (content.length > 100) {
                    console.log(`✅ FOUND with "${selector}" (${content.length} chars)`);
                    console.log('Sample:', content.substring(0, 150).replace(/\s+/g, ' '));
                    break;
                }
            }
        }
    });
});
req.on('error', e => console.error(e.message));
req.write(body); req.end();
