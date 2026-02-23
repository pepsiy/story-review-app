const fs = require('fs');
const html = fs.readFileSync('chapter1.html', 'utf-8');

// Find the fetch() to admin-ajax and get surrounding context (the POST body)
let idx = -1;
while (true) {
    idx = html.indexOf('admin-ajax.php', idx + 1);
    if (idx === -1) break;
    const context = html.substring(Math.max(0, idx - 400), idx + 600);
    if (context.includes('fetch') || context.includes('action') || context.includes('body')) {
        console.log('=== admin-ajax context ===');
        console.log(context);
        console.log('---');
    }
}

// Also check option values to understand chapter URL structure
const chapterOpts = [...html.matchAll(/<option[^>]*value="(chuong-[^"]+)"[^>]*>([^<]+)/g)];
console.log(`\n=== Chapter options (total ${chapterOpts.length}) ===`);
chapterOpts.slice(0, 5).forEach(m => console.log('value:', m[1], '| text:', m[2].trim()));
chapterOpts.slice(-3).forEach(m => console.log('value:', m[1], '| text:', m[2].trim()));

// Test URL construction
const storyUrl = 'https://xtruyen.vn/truyen/con-duong-ba-chu/';
if (chapterOpts.length > 0) {
    const [, slug] = chapterOpts[0];
    const normalizedSlug = slug.replace(/\/$/, '');
    console.log('\nURL construction test:', storyUrl + normalizedSlug + '/');
}
