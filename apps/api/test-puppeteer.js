const puppeteer = require('puppeteer');

async function testFetch() {
    const url = 'https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1/';
    console.log('Launching Puppeteer for', url);

    // Launch browser
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('Navigating and waiting for network idle...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for the chapter content to not be empty/loading
    // The loading spinner usually is just empty text or has a specific class. 
    // We'll wait for the text length of #chapter-reading-content to be > 100
    console.log('Waiting for content to populate...');
    try {
        await page.waitForFunction(() => {
            const el = document.querySelector('#chapter-reading-content');
            return el && el.innerText.trim().length > 100;
        }, { timeout: 15000 });
        console.log('Content populated!');
    } catch (e) {
        console.log('Timeout waiting for content. Proceeding anyway to see what we got.');
    }

    const text = await page.evaluate(() => {
        const el = document.querySelector('#chapter-reading-content');
        return el ? el.innerText : '';
    });

    console.log('\n--- Extracted Text ---');
    console.log('Length:', text.length);
    console.log('Preview:', text.substring(0, 300).replace(/\s+/g, ' '));

    await browser.close();
}

testFetch();
