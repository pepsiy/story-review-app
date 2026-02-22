// Dump raw HTML sections to find where chapter content might be
const https = require('https');
const SECRET = '9a811f49407448828e14679bb9b15dcd';

const body = JSON.stringify({ url: 'https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1/', secret: SECRET });
const req = https.request({
    hostname: 'xtruyen-proxy.dung-young.workers.dev',
    path: '/', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        const { html } = JSON.parse(d);
        // Look for Vietnamese text (chapter content)
        // Search for common Vietnamese characters/words that would appear in chapter text
        const viMatch = html.match(/([A-Za-zÀ-ỹ\s,\.!?"']{200,})/);
        if (viMatch) {
            console.log('Long text block found at position', html.indexOf(viMatch[0]));
            console.log('Sample:', viMatch[0].substring(0, 300));
        }

        // Dump the section around reading-content
        const idx = html.indexOf('reading-content');
        if (idx >= 0) {
            console.log('\n--- reading-content context ---');
            console.log(html.substring(idx - 20, idx + 500));
        }

        // Dump section around text-chapter
        const idx2 = html.indexOf('text-chapter');
        if (idx2 >= 0) {
            console.log('\n--- text-chapter context ---');
            console.log(html.substring(idx2 - 20, idx2 + 500));
        }

        // Check if it's a SPA / uses ajax
        if (html.includes('ajax') || html.includes('fetch(') || html.includes('xmlhttp')) {
            console.log('\n⚠️  Page uses AJAX/fetch for content loading');
        }

        // Check for noscript content
        const noScript = html.match(/<noscript>([\s\S]*?)<\/noscript>/i);
        if (noScript) console.log('\nnoscript:', noScript[1].substring(0, 200));

        // Save raw html for analysis
        require('fs').writeFileSync('chapter1.html', html);
        console.log('\nSaved to chapter1.html');
    });
});
req.on('error', e => console.error(e.message));
req.write(body); req.end();
