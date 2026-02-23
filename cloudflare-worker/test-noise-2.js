const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('chapter1707-list.html', 'utf-8');
const $ = cheerio.load(html);

$('.chapter-nav, .nav-buttons, .ads, .ad-container, .slider-container, ' +
    '[class*="shopee"], [id*="ads"], [id*="Slider"], script, style, ' +
    'select, option, .select-pagination, .c-selectpicker, form, .post-rating, .author-content, .genres-content, .tags-content, #comments, .comments-area').remove();

const wrapper = $('.reading-content-wrap .content-area');
wrapper.children().each((i, el) => {
    const $el = $(el);
    const cls = $el.attr('class') || '';
    const id = $el.attr('id') || '';
    const textLen = $el.text().trim().length;
    console.log(`[${i}] <${el.name}> id="${id}" class="${cls}" | TextLength: ${textLen}`);
    if (textLen > 0 && textLen < 200) {
        console.log('   Preview:', $el.text().trim().replace(/\s+/g, ' '));
    }
});

// Remove #settingsPanel 
$('#settingsPanel, #manga-discussion, .c-blog-post, .c-blog__heading, .related-manga').remove();

console.log('\n--- Text after removing #settingsPanel & discussions ---');
const cleanText = wrapper.text().trim().replace(/\s+/g, ' ');
console.log('Length:', cleanText.length);
console.log('Preview:', cleanText.substring(0, 500));
