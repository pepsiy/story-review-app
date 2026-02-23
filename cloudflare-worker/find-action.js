const fs = require('fs');
const html = fs.readFileSync('chapter1.html', 'utf-8');

// Find manga_ actions
const mangaActions = new Set();
const re1 = /manga_\w+/g;
let m;
while ((m = re1.exec(html)) !== null) mangaActions.add(m[0]);
console.log('manga_ patterns:', [...mangaActions]);

// Find action: "..." patterns in JSON/JS
const actionRe = /"action"\s*:\s*"([^"]+)"/g;
while ((m = actionRe.exec(html)) !== null) console.log('action:', m[1]);

// Find the chapter reading div and nearby JS
const readingIdx = html.indexOf('chapter-reading-content');
if (readingIdx >= 0) {
    console.log('\nContext around chapter-reading-content:');
    console.log(html.substring(readingIdx - 200, readingIdx + 400));
}
