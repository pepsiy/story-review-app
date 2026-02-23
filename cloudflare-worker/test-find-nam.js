const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('chapter1707-list.html', 'utf-8');
const $ = cheerio.load(html);

// Find elements containing "Nam " or "Lạc Nam"
let targetText = "Lạc Nam";
let foundElements = [];

$('*').each((i, el) => {
    const $el = $(el);
    const text = $el.text();
    // Only looking at text nodes directly inside or small wrappers to find the exact paragraph
    if (text.includes(targetText) && $el.children().length === 0) {
        foundElements.push(el);
    }
});

if (foundElements.length > 0) {
    const el = foundElements[0];
    console.log(`Found text in <${el.name}>`);

    // Trace parents
    let current = $(el);
    let path = [];
    while (current.length && current[0].name !== 'body') {
        const name = current[0].name;
        const id = current.attr('id') ? '#' + current.attr('id') : '';
        const cls = current.attr('class') ? '.' + current.attr('class').split(' ').join('.') : '';
        path.unshift(`${name}${id}${cls}`);
        current = current.parent();
    }

    console.log('\nDOM Path:');
    console.log(path.join(' >\n  '));

    // Also check if any component of the path would be hit by our .remove() filter
    const removeSelectors = [
        '.chapter-nav', '.nav-buttons', '.ads', '.ad-container', '.slider-container',
        '[class*="shopee"]', '[id*="ads"]', '[id*="Slider"]', 'script', 'style',
        'select', 'option', '.select-pagination', '.c-selectpicker', 'form',
        '.post-rating', '.author-content', '.genres-content', '.tags-content',
        '#comments', '.comments-area', '#settingsPanel', '#manga-discussion',
        '.c-blog-post', '.c-blog__heading', '.related-manga'
    ];

    console.log('\nChecking if path is matched by ANY remove selector:');
    for (const sel of removeSelectors) {
        if ($(el).closest(sel).length > 0) {
            console.log(`⚠️ WARNING: ${sel} MATCHES THE CONTENT PARENT!`);
        }
    }
} else {
    console.log(`Text "${targetText}" not found in any leaf node!`);
}
