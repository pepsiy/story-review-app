const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('chapter1707-list.html', 'utf-8');
const $ = cheerio.load(html);

$('.chapter-nav, .nav-buttons, .ads, .ad-container, .slider-container, ' +
    '[class*="shopee"], [id*="ads"], [id*="Slider"], script, style, ' +
    'select, option, .select-pagination, .c-selectpicker, form, .post-rating, .author-content, .genres-content, .tags-content, #comments, .comments-area').remove();

const ca = $('.reading-content-wrap .content-area');
if (ca.length) {
    const text = ca.text().trim();
    console.log('.content-area length:', text.length);
    console.log('\n--- Text Preview ---');
    console.log(text.substring(0, 500).replace(/\s+/g, ' '));
}
