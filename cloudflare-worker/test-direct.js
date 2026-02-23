const axios = require('axios');
const cheerio = require('cheerio');

async function testFetch() {
    try {
        const url = 'https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1707/';
        console.log('Fetching', url);

        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5'
            }
        });

        const $ = cheerio.load(res.data);
        const text = $('#chapter-reading-content').text().trim().replace(/\s+/g, ' ');
        console.log('Length:', text.length);
        if (text.length > 50) console.log('Preview:', text.substring(0, 150));
    } catch (err) {
        console.error('Failed:', err.message);
    }
}

testFetch();
