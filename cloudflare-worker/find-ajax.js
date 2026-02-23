// Analyze chapter1.html to find AJAX endpoint for content loading
const fs = require('fs');
const html = fs.readFileSync('chapter1.html', 'utf-8');

// Look for AJAX URL and action
const ajaxPatterns = [
    /ajaxurl\s*=\s*["']([^"']+)["']/g,
    /admin-ajax\.php/g,
    /action\s*[:=]\s*["']([^"']+chapter[^"']*)["']/gi,
    /wp-manga[^"'\s]*/gi,
    /manga_get/gi,
    /chapter_id\s*[=:]\s*(\d+)/gi,
    /data-id=["'](\d+)["']/g,
    /data-chapter=["']([^"']+)["']/gi,
    /"chapter"\s*:\s*(\d+)/g,
    /"manga_id"\s*:\s*(\d+)/g,
    /post_id\s*[=:]\s*(\d+)/gi,
];

ajaxPatterns.forEach(re => {
    const matches = [...html.matchAll(re)];
    if (matches.length > 0) {
        console.log(`Pattern ${re.source}:`);
        matches.slice(0, 3).forEach(m => console.log('  ', JSON.stringify(m[0])));
    }
});

// Look for <script> tags with chapter-related data
const scriptTags = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
scriptTags.forEach((m, i) => {
    const content = m[1];
    if (/chapter|manga|ajax/i.test(content)) {
        console.log(`\nScript ${i} (contains manga/chapter/ajax):`);
        // Find relevant lines
        content.split('\n').forEach(line => {
            if (/chapter|manga|ajax|post_id|action/i.test(line)) {
                console.log(' ', line.trim().substring(0, 120));
            }
        });
    }
});

// Look for fetch/AJAX calls to get content
if (html.includes('admin-ajax')) {
    console.log('\n✅ Found admin-ajax.php references');
} else {
    console.log('\n❌ No admin-ajax.php found. Content might use REST API.');
}

// Check for REST API calls
const restApiCalls = [...html.matchAll(/wp-json[^"'\s]*/g)];
if (restApiCalls.length > 0) {
    console.log('\nREST API calls:', [...new Set(restApiCalls.map(m => m[0]))]);
}
