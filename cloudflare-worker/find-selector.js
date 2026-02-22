const https = require('https');
const SECRET = '9a811f49407448828e14679bb9b15dcd';
const CHAPTER_URL = 'https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1/';

const body = JSON.stringify({ url: CHAPTER_URL, secret: SECRET });
const req = https.request({
    hostname: 'xtruyen-proxy.dung-young.workers.dev',
    path: '/', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        const { html } = JSON.parse(d);
        console.log('HTML length:', html.length);

        // Check for known content selectors
        const selectors = [
            'entry-content', 'chapter-content', 'reading-content', 'text-chapter',
            'box-content', 'chapter-reading', 'chapter_reading', 'manga-reading',
            'reading-container', 'chapter-c', 'chap-content', 'read-content',
            'chapter_body', 'chapter-body', 'post-page-numbers',
        ];
        console.log('\nContent selector hits:');
        selectors.forEach(s => {
            if (html.includes(s)) console.log('  FOUND: ' + s);
        });

        // Extract class/id attributes containing "chapter" or "content"
        const classHits = new Set();
        const idHits = new Set();
        let m;
        const classRe = /class="([^"]+)"/g;
        while ((m = classRe.exec(html)) !== null) {
            const parts = m[1].split(/\s+/);
            parts.forEach(p => { if (/content|chapter|read|text/i.test(p)) classHits.add(p); });
        }
        const idRe = /id="([^"]+)"/g;
        while ((m = idRe.exec(html)) !== null) {
            if (/content|chapter|read|text/i.test(m[1])) idHits.add(m[1]);
        }
        console.log('\nRelevant classes:', [...classHits].slice(0, 20));
        console.log('Relevant IDs:', [...idHits]);

        // Dump a 500 char snippet around first "chapter" occurrence for context
        const idx = html.toLowerCase().indexOf('chapter');
        if (idx > -1) {
            console.log('\nContext around "chapter":', html.substring(Math.max(0, idx - 50), idx + 200));
        }
    });
});
req.on('error', e => console.error('Error:', e.message));
req.write(body);
req.end();
