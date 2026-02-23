const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('chapter1707-list.html', 'utf-8');
const $ = cheerio.load(html);

// Remove unwanted stuff first 
$('.chapter-nav, .nav-buttons, .ads, .ad-container, .slider-container, ' +
    '[class*="shopee"], [id*="ads"], [id*="Slider"], script, style, ' +
    'select, option, .select-pagination, .c-selectpicker, .c-selectpicker.selectpicker_chapter, form').remove();

let content = '';
const selectors = [
    '#chapter-reading-content',
    '.text-left #chapter-reading-content',
    '.reading-content-wrap .content-area',
    '.entry-content',
    '.chapter-content',
];

for (const selector of selectors) {
    const el = $(selector);
    if (el.length > 0) {
        // Specifically target paragraphs or text directly inside but NOT in .c-selectpicker
        content = el.text().trim();
        if (content.length > 100) {
            console.log(`✅ FOUND with "${selector}" (${content.length} chars)`);
            const sample = content.substring(0, 300).replace(/\s+/g, ' ');
            console.log('Sample:', sample);
            // Check if it still has "Chọn chương"
            if (sample.includes('Chọn chương')) {
                console.log('⚠️ STiLL HAS "Chọn chương" dropdowns in text!');
            }
            break;
        }
    }
}
