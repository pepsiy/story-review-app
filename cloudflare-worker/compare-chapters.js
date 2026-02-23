// Test chapter 1707 selector vs chapter 1
const https = require('https');
const cheerio = require('cheerio');
const fs = require('fs');
const SECRET = '9a811f49407448828e14679bb9b15dcd';

async function fetchViaWorker(url) {
    const body = JSON.stringify({ url, secret: SECRET });
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'xtruyen-proxy.dung-young.workers.dev',
            path: '/', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.write(body); req.end();
    });
}

async function inspectChapter(url, name) {
    console.log(`\n====== ${name} ======`);
    console.log('URL:', url);
    const { html, status } = await fetchViaWorker(url);
    console.log('Status:', status, '| HTML length:', html.length);
    if (!html) return;

    fs.writeFileSync(`chapter-${name}.html`, html);
    const $ = cheerio.load(html);

    // Check key selectors
    const toTest = [
        '#chapter-reading-content',
        '.text-left #chapter-reading-content',
        '.reading-content-wrap .content-area',
        '.entry-content',
        '.chapter-content',
        'div.text-left',
    ];

    for (const sel of toTest) {
        const el = $(sel);
        if (el.length > 0) {
            const text = el.text().trim();
            // Check if contains navigation noise
            const hasNav = text.includes('Chọn chương') || text.includes('Chương 1 ~');
            const first100 = text.replace(/\s+/g, ' ').substring(0, 100);
            console.log(`  ${sel} [${el.length}] len=${text.length} nav=${hasNav} | "${first100}"`);
        }
    }

    // Find where chapter content starts (look for <p> tags with actual text)
    const pTags = [];
    $('p').each(function (i, el) {
        const t = $(el).text().trim();
        if (t.length > 50 && !t.includes('Chọn chương') && !t.includes('Chương 1 ~')) {
            pTags.push({ len: t.length, text: t.substring(0, 80) });
        }
    });
    console.log(`  First meaningful <p> tags: ${pTags.length}`);
    pTags.slice(0, 3).forEach((p, i) => console.log(`    p[${i}]: len=${p.len} "${p.text}"`));
}

(async () => {
    try {
        await inspectChapter('https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1/', '1');
        await inspectChapter('https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1707/', '1707');
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
