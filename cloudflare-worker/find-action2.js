const fs = require('fs');
const html = fs.readFileSync('chapter1.html', 'utf-8');

// Find mangaReadingAjax usage and its action
const maIdx = html.indexOf('mangaReadingAjax');
let cur = maIdx;
while (cur !== -1) {
    const ctx = html.substring(Math.max(0, cur - 50), cur + 200);
    if (ctx.includes('action') || ctx.includes('fetch') || ctx.includes('ajax')) {
        console.log('=== mangaReadingAjax with action/fetch ===');
        console.log(ctx);
        console.log('---');
    }
    cur = html.indexOf('mangaReadingAjax', cur + 1);
}

// Look for external plugin JS that might handle it -> find its src URL
const pluginJs = [...html.matchAll(/src="(https:\/\/xtruyen\.vn\/wp-content\/plugins\/[^"]+\.js[^"]*)"/g)];
console.log('\n=== Plugin JS files ===');
pluginJs.forEach(m => console.log(m[1]));
