const axios = require('axios');
const cheerio = require('cheerio');

async function checkPath() {
    const url = 'https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1/?style=list';
    const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(res.data);

    let path = [];
    $('*').each((i, el) => {
        const text = $(el).text();
        if (text.includes('Nam lẩm bẩm trong miệng') && $(el).children().length === 0) {
            let current = $(el);
            while (current.length && current[0].name !== 'body') {
                const name = current[0].name;
                const id = current.attr('id') ? '#' + current.attr('id') : '';
                const cls = current.attr('class') ? '.' + current.attr('class').split(' ').join('.') : '';
                path.unshift({ name: `${name}${id}${cls}`, html: current.html().substring(0, 100) });
                current = current.parent();
            }
        }
    });

    console.log('DOM Path for text:');
    path.forEach(p => console.log(' ->', p.name));

    if (path.length > 0) {
        // Let's print the HTML of the immediate container
        const containerHtml = path[path.length - 2] ? path[path.length - 2].html : path[path.length - 1].html;
        console.log('\nContainer HTML Start:', containerHtml);
    }
}
checkPath();
