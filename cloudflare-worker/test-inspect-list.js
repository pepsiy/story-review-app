const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('chapter1707-list.html', 'utf-8');
const $ = cheerio.load(html);

console.log('--- Inspecting chapter1707-list.html ---');

console.log('#chapter-reading-content length:', $('#chapter-reading-content').length);
console.log('.text-left p length:', $('.text-left p').length);
console.log('.reading-content p length:', $('.reading-content p').length);
console.log('.reading-content length:', $('.reading-content').length);

const wrapper = $('.reading-content');
if (wrapper.length) {
    console.log('\nHTML snippet of .reading-content:');
    console.log(wrapper.html().substring(0, 1000));
}
