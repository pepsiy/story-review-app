// Verify which selector has actual chapter text
const https = require('https');
const SECRET = '9a811f49407448828e14679bb9b15dcd';
const cheerio = require('cheerio');

const body = JSON.stringify({ url: 'https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1/', secret: SECRET });
const req = https.request({
    hostname: 'xtruyen-proxy.dung-young.workers.dev',
    path: '/', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        const { html } = JSON.parse(d);
        const $ = cheerio.load(html);
        const toCheck = ['.reading-content', '.text-chapter', '.chapter-reading', '.entry-content', '#chapter-content', '.chapter-c', 'div[id*="chapter"]'];
        toCheck.forEach(sel => {
            const text = $(sel).text().trim().substring(0, 120).replace(/\s+/g, ' ');
            if (text.length > 20) console.log(`✅ ${sel} (${$(sel).text().trim().length} chars): "${text}"`);
            else console.log(`❌ ${sel}: empty/short`);
        });
    });
});
req.on('error', e => console.error(e.message));
req.write(body); req.end();
