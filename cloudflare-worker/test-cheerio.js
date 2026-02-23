const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('chapter1.html', 'utf-8');
const $ = cheerio.load(html);

console.log('--- Before removal ---');
console.log('#chapter-reading-content exists?', $('#chapter-reading-content').length);
const beforeText = $('#chapter-reading-content').text().trim();
console.log('Text length before:', beforeText.length);
if (beforeText.length > 50) console.log('Sample:', beforeText.substring(0, 100).replace(/\s+/g, ' '));

// Remove navigation, ads, and unwanted elements (including inline ads in content)
$('.chapter-nav, .nav-buttons, .ads, .ad-container, .slider-container, ' +
    '[class*="shopee"], [id*="ads"], [id*="Slider"], script, style').remove();

console.log('\n--- After removal ---');
console.log('#chapter-reading-content exists?', $('#chapter-reading-content').length);
const afterText = $('#chapter-reading-content').text().trim();
console.log('Text length after:', afterText.length);
if (afterText.length > 50) console.log('Sample:', afterText.substring(0, 100).replace(/\s+/g, ' '));
