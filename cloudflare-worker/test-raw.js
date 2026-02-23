const https = require('https');

async function testFetch() {
    try {
        const url = 'https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1/';
        console.log('Fetching raw HTML of', url);

        const res = await new Promise((resolve, reject) => {
            const req = https.request(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5'
                }
            }, res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            });
            req.on('error', reject);
            req.end();
        });

        // Search for the story text
        if (res.includes('Nam vừa mới tỉnh')) {
            console.log('✅ FOUND "Nam vừa mới tỉnh" in raw HTML!');

            // Where is it?
            const idx = res.indexOf('Nam vừa mới tỉnh');
            console.log('Context:', res.substring(Math.max(0, idx - 100), idx + 200).replace(/\s+/g, ' '));
        } else {
            console.log('❌ Text "Nam vừa mới tỉnh" NOT found in raw HTML!');
        }

    } catch (err) {
        console.error('Failed:', err.message);
    }
}

testFetch();
