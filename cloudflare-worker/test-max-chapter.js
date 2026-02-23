const https = require('https');
const cheerio = require('cheerio');
const SECRET = '9a811f49407448828e14679bb9b15dcd';

const body = JSON.stringify({ url: 'https://xtruyen.vn/truyen/con-duong-ba-chu/', secret: SECRET });
const req = https.request({
    hostname: 'xtruyen-proxy.dung-young.workers.dev',
    path: '/', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        const { html } = JSON.parse(d);
        require('fs').writeFileSync('story.html', html);
        const $ = cheerio.load(html);

        // Look for all chapter links
        const chapterNumbers = [];
        $('a[href*="/chuong-"]').each((i, el) => {
            const text = $(el).text().trim();
            const href = $(el).attr('href') || '';
            console.log('Found link:', href, 'Text:', text);
            const urlMatch = href.match(/\/chuong-(\d+)\/?$/);
            if (urlMatch) chapterNumbers.push(parseInt(urlMatch[1], 10));

            const textMatch = text.match(/Chương\s+(\d+)/i);
            if (textMatch) chapterNumbers.push(parseInt(textMatch[1], 10));
        });

        // Also look around for any text like "Chương 3750" in case it's not a link
        $('*').each((i, el) => {
            const t = $(el).text();
            if (t && t.length < 100) {
                const m = t.match(/Chương\s+(\d+)/i);
                if (m) chapterNumbers.push(parseInt(m[1], 10));
            }
        });

        if (chapterNumbers.length > 0) {
            const maxChapter = Math.max(...chapterNumbers);
            console.log('\nMax chapter found:', maxChapter);
        } else {
            console.log('\nNo chapters found');
        }
    });
});
req.on('error', e => console.error(e.message));
req.write(body); req.end();
