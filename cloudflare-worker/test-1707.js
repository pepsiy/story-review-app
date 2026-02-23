// Test scraping actual text directly from chapter HTML
const https = require('https');
const cheerio = require('cheerio');
const SECRET = '9a811f49407448828e14679bb9b15dcd';

const body = JSON.stringify({ url: 'https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1707/', secret: SECRET });
const req = https.request({
    hostname: 'xtruyen-proxy.dung-young.workers.dev',
    path: '/', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        const { html } = JSON.parse(d);
        require('fs').writeFileSync('chapter1707.html', html);
        const $ = cheerio.load(html);

        // Test known selectors
        const selectors = ['#chapter-reading-content', '.text-left', '.reading-content-wrap'];
        selectors.forEach(sel => {
            const el = $(sel);
            console.log(sel, ':', el.length ? el.text().trim().substring(0, 150).replace(/\s+/g, ' ') : 'NOT FOUND');
        });

        console.log('\n--- p tags in text-left ---');
        $('.text-left p').each((i, el) => {
            if (i < 5) console.log(`[${i}]`, $(el).text().substring(0, 100));
        });

        console.log('\n--- Any long text blocks? ---');
        $('div').each((i, el) => {
            const txt = $(el).text().trim();
            // If it's a long text but doesn't have too many links
            if (txt.length > 500 && $(el).find('a').length < 10) {
                console.log('Found block of length', txt.length, 'class:', $(el).attr('class'), 'id:', $(el).attr('id'));
                console.log('Sample:', txt.substring(0, 150).replace(/\s+/g, ' '));
            }
        });

    });
});
req.on('error', e => console.error(e.message));
req.write(body); req.end();
