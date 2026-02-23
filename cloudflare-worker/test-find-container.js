const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('chapter1707-list.html', 'utf-8');
const $ = cheerio.load(html);

// Remove the known junk first
$('.chapter-nav, .nav-buttons, .ads, .ad-container, .slider-container, ' +
    '[class*="shopee"], [id*="ads"], [id*="Slider"], script, style, ' +
    'select, option, .select-pagination, .c-selectpicker, form, .post-rating, .author-content, .genres-content, .tags-content, #comments, .comments-area').remove();

// The text must be somewhere. Let's find all divs with a lot of text and print their classes
const results = [];
$('div').each((i, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text.length > 500 && !$(el).find('div').length) {
        // leaf div or div without other div children
        results.push({
            class: $(el).attr('class') || '',
            id: $(el).attr('id') || '',
            length: text.length,
            sample: text.substring(0, 100)
        });
    }
});

if (results.length === 0) {
    // try any element
    $('*').each((i, el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text.length > 500 && !$(el).find('*').length) {
            console.log('<' + el.name + '> length:', text.length, 'sample:', text.substring(0, 50));
        }
    });

    // Let's also check .content-area again
    const ca = $('.reading-content-wrap .content-area');
    console.log('\n.content-area length:', ca.text().trim().replace(/\s+/g, ' ').length);
    console.log('Sample from .content-area:', ca.text().trim().replace(/\s+/g, ' ').substring(0, 100));
} else {
    console.log('Found these text containers:');
    console.dir(results);
}
