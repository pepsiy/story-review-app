const fs = require('fs');
const html = fs.readFileSync('chapter1.html', 'utf-8');

// Find nonces embedded in HTML
const noncePatterns = [
    /"nonce"\s*:\s*"([^"]+)"/g,
    /nonce\s*=\s*["']([^"']+)["']/g,
    /_wpnonce['":\s=]+([^"'\s,;}{]+)/g,
    /wp_nonce['":\s=]+([^"'\s,;}{]+)/g,
];

noncePatterns.forEach(re => {
    const matches = [...html.matchAll(re)];
    if (matches.length > 0) {
        console.log(`Pattern: ${re.source}`);
        matches.slice(0, 3).forEach(m => console.log(' ', m[0].substring(0, 100)));
    }
});

// Find the reading content nonce specifically in mangaReadingAjax context  
const mangaIdx = html.indexOf('mangaReadingAjax');
while (mangaIdx !== -1) {
    const block = html.substring(mangaIdx - 200, mangaIdx + 200);
    if (block.includes('nonce')) {
        console.log('\nNonce near mangaReadingAjax:', block);
        break;
    }
}

// Also search for all security/nonce fields 
const securityFields = [...html.matchAll(/"security"\s*:\s*"([^"]+)"/g)];
const mangaNonce = [...html.matchAll(/"manga_nonce"\s*:\s*"([^"]+)"/g)];
console.log('\nsecurity fields:', securityFields.map(m => m[0]));
console.log('manga_nonce:', mangaNonce.map(m => m[0]));

// Look at full mangaReadingAjax_data
const mrd = html.match(/mangaReadingAjax_data\s*=\s*({[^}]+})/);
if (mrd) console.log('\nmangaReadingAjax_data:', mrd[1]);

// Check if there's a special header in the reading area
const dataChapterDiv = [...html.matchAll(/data-chapter="([^"]+)"/g)];
console.log('\ndata-chapter attributes:', dataChapterDiv.map(m => m[0]));
