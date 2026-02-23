const https = require('https');
const cheerio = require('cheerio');
const SECRET = '9a811f49407448828e14679bb9b15dcd';

const url = 'https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1/?style=list';
const body = JSON.stringify({ url, secret: SECRET });

const req = https.request({
    hostname: 'xtruyen-proxy.dung-young.workers.dev',
    path: '/', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        const { html } = JSON.parse(d);

        if (html.includes('Nam lẩm bẩm')) {
            console.log('✅ FOUND "Nam lẩm bẩm" via Worker!');

            const $ = cheerio.load(html);
            const path = [];
            $('*').each((i, el) => {
                const text = $(el).text();
                if (text.includes('Nam lẩm bẩm trong miệng') && $(el).children().length === 0) {
                    let current = $(el);
                    while (current.length && current[0].name !== 'body') {
                        const name = current[0].name;
                        const id = current.attr('id') ? '#' + current.attr('id') : '';
                        const cls = current.attr('class') ? '.' + current.attr('class').split(' ').join('.') : '';
                        path.unshift(`${name}${id}${cls}`);
                        current = current.parent();
                    }
                }
            });
            console.log('DOM Path:');
            console.log(path.join(' > '));
        } else {
            console.log('❌ NOT FOUND via Worker');
            console.log('Length:', html.length);
            console.log('Preview:', html.substring(0, 300));
        }
    });
});
req.write(body); req.end();
