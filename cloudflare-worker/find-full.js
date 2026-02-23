const fs = require('fs');
const html = fs.readFileSync('chapter1.html', 'utf-8');

// Find reading content load pattern
const idx = html.indexOf('chapter-reading-content');
console.log('=== Full reading-content div context ===');
console.log(html.substring(Math.max(0, idx - 300), idx + 200));

// Find all manga_ variables in madara object
const madaraStart = html.indexOf('var madara = ');
if (madaraStart > -1) {
    // Get until end of the object
    let braceCount = 0;
    let i = html.indexOf('{', madaraStart);
    const start = i;
    while (i < html.length) {
        if (html[i] === '{') braceCount++;
        else if (html[i] === '}') { braceCount--; if (braceCount === 0) break; }
        i++;
    }
    const madaraObj = html.substring(start, i + 1);
    console.log('\n=== madara object (full) ===');
    console.log(madaraObj.substring(0, 3000));
}

// Find where content is loaded 
// Look for fetch( patterns
const fetches = [...html.matchAll(/fetch\s*\(\s*["']([^"']+)["']/g)];
console.log('\n=== fetch() calls ===');
fetches.forEach(m => console.log(' ', m[1]));

// Find XMLHttpRequest
const xhrs = html.indexOf('XMLHttpRequest');
if (xhrs > -1) console.log('\nXHR found at:', xhrs);

// Check <option> tags for chapter list
const options = [...html.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]+)<\/option>/g)];
const chapterOptions = options.filter(m => /C\d/.test(m[2]));
console.log(`\n=== Chapter <option> elements: ${chapterOptions.length} found ===`);
chapterOptions.slice(0, 5).forEach(m => console.log(' value:', JSON.stringify(m[1]), 'text:', m[2].trim()));
if (chapterOptions.length > 5) {
    chapterOptions.slice(-3).forEach(m => console.log(' value:', JSON.stringify(m[1]), 'text:', m[2].trim()));
}
