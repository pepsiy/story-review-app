const axios = require('axios');
const cheerio = require('cheerio');

async function testFetch() {
    try {
        const url = 'https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1/?style=list';
        console.log('Fetching', url);

        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(res.data);
        const html = res.data;

        // Remove known noise
        $('.chapter-nav, .nav-buttons, .ads, .ad-container, .slider-container, ' +
            '[class*="shopee"], [id*="ads"], [id*="Slider"], script, style, ' +
            'select, option, .select-pagination, .c-selectpicker, form, .post-rating, .author-content, .genres-content, .tags-content, #comments, .comments-area, #settingsPanel, #manga-discussion, .c-blog-post, .c-blog__heading, .related-manga').remove();

        const ca = $('.reading-content-wrap .content-area');
        const text = ca.text().trim().replace(/\s+/g, ' ');

        console.log('--- .content-area Text ---');
        console.log('Length:', text.length);
        console.log('Preview:', text.substring(0, 150));

        console.log('Includes Nam lẩm bẩm?:', text.includes('Nam lẩm bẩm trong miệng'));

    } catch (err) {
        console.error('Failed:', err.message);
    }
}

testFetch();
