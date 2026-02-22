const fs = require('fs');
const html = fs.readFileSync('chapter1.html', 'utf-8');
const cheerio = require('cheerio');
const $ = cheerio.load(html);

// Test reading-content-wrap
const wrap = $('.reading-content-wrap');
console.log('reading-content-wrap found:', wrap.length);
console.log('text (200 chars):', wrap.text().trim().substring(0, 200));

// Check p tags
const ps = wrap.find('p');
console.log('p count:', ps.length, '| first p text:', ps.first().text().substring(0, 150));

// Check all children
wrap.children().each(function (i, el) {
    const tag = el.name;
    const cls = $(el).attr('class') || '';
    const id = $(el).attr('id') || '';
    const txt = $(el).text().trim().substring(0, 80);
    console.log('child[' + i + ']: <' + tag + '> class="' + cls + '" id="' + id + '" text="' + txt + '"');
});

// Also try common WP manga selectors
const tests = ['.reading-content-wrap p', '.reading-content-wrap', '.chapter-content', 'div.text-left'];
tests.forEach(function (sel) {
    const el = $(sel);
    const len = el.text().trim().length;
    if (len > 50) console.log('MATCH ' + sel + ': ' + len + ' chars | sample: ' + el.text().trim().substring(0, 100));
});
