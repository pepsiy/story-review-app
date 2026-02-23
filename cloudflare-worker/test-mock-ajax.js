const fs = require('fs');

const js = fs.readFileSync('madara-script.js', 'utf-8');

// Mock browser environment
const window = {
    location: { href: 'https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1/' }
};
const document = {
    addEventListener: () => { },
    getElementById: () => ({ addEventListener: () => { } }),
    querySelector: () => null
};
const $ = function () {
    return {
        on: () => { },
        click: () => { },
        ready: (fn) => fn && fn()
    };
};
$.ajax = function (opts) {
    console.log('AJAX CALLED!');
    console.log('Action:', opts.data && opts.data.action);
    console.log('Data:', opts.data);
};
const jQuery = $;

// Mock variables from HTML
const madara = {
    ajaxurl: "https://xtruyen.vn/wp-admin/admin-ajax.php"
};
const mangaReadingAjax = {
    isEnable: "1"
};
const mangaReadingAjax_data = {
    manga_id: "9063296",
    chapter_slug: "chuong-1",
    nonce: "c9f52c0b69"
};

// Try to evaluate the script
try {
    eval(js);
    console.log('Script evaluated successfully.');

    // Sometimes the ajax is triggered automatically, sometimes it's bound to an event or function
    // If there's a loadChapter function in the global scope:
    if (typeof loadChapter === 'function') {
        loadChapter();
    }
} catch (e) {
    console.error('Eval error:', e.message);
}

// Let's also do a regex to search for the obfuscated array and strings
const match = js.match(/var\s+(_0x[a-f0-9]+)\s*=\s*\[(.*?)\]/);
if (match) {
    console.log('\nFound obfuscated array:', match[1]);
    try {
        const arr = eval('[' + match[2] + ']');
        const ajaxActions = arr.filter(s => typeof s === 'string' && s.includes('action'));
        console.log('Ajax string candidates:');
        console.dir(ajaxActions);

        const mangaCandidates = arr.filter(s => typeof s === 'string' && s.includes('manga'));
        console.log('Manga string candidates:');
        console.dir(mangaCandidates);
    } catch (err) {
        console.log('Failed to eval array');
    }
}
