const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('chapter1707-list.html', 'utf-8');
const $ = cheerio.load(html);

// Find the "Màu nền" block
const block = $('*:contains("Màu nền")').last().parent();
console.log('Class of "Màu nền" block:', block.attr('class'), 'id:', block.attr('id'));
// Also find "VIP" or other links list
const block2 = $('*:contains("Mau xuyên nữ phụ")').last().parent();
console.log('Class of related links block:', block2.attr('class'), 'id:', block2.attr('id'));

// What about "CẢM NGHĨ CỦA BẠN"?
const block3 = $('*:contains("CẢM NGHĨ CỦA BẠN")').last().parent();
console.log('Class of comments block:', block3.attr('class'), 'id:', block3.attr('id'));

// Look at the direct children of .content-area
console.log('\n--- .content-area children ---');
$('.reading-content-wrap .content-area').children().each((i, el) => {
    console.log(i, el.name, $(el).attr('class') || '', $(el).attr('id') || '');
});
