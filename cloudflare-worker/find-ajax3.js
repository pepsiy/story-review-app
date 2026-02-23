// Find exact Madara AJAX action and parameters from chapter1.html
const fs = require('fs');
const html = fs.readFileSync('chapter1.html', 'utf-8');

// Find madara_vars object
const madaraVarIdx = html.indexOf('madara_vars');
if (madaraVarIdx >= 0) {
    console.log('=== madara_vars ===');
    console.log(html.substring(madaraVarIdx - 20, madaraVarIdx + 1000));
}

// Find the manga chapter AJAX params
const madaraJsIdx = html.indexOf('madara-js-js-extra');
if (madaraJsIdx >= 0) {
    console.log('\n=== madara-js-js-extra script ===');
    const start = html.lastIndexOf('<script', madaraJsIdx);
    const end = html.indexOf('</script>', madaraJsIdx) + 9;
    console.log(html.substring(start, end).substring(0, 2000));
}

// Find any fetch/AJAX call with admin-ajax
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
scripts.forEach((m, i) => {
    const s = m[1];
    if (s.includes('admin-ajax') && s.includes('action')) {
        console.log(`\n=== Script ${i} with admin-ajax + action ===`);
        s.split('\n').forEach(line => {
            if (/action|chapter|manga|admin-ajax/.test(line)) {
                console.log(' ', line.trim().substring(0, 150));
            }
        });
    }
});

// Find chapter post ID specifically
const chapterDataId = [...html.matchAll(/data-id="(\d+)"/g)];
const postData = [...html.matchAll(/data-post="(\d+)"/g)];
const chapterSlug = [...html.matchAll(/data-chapter="([^"]+)"/g)];
console.log('\n=== Chapter data attributes ===');
chapterDataId.forEach(m => console.log('data-id:', m[1]));
postData.forEach(m => console.log('data-post:', m[1]));
chapterSlug.forEach(m => console.log('data-chapter:', m[1]));
