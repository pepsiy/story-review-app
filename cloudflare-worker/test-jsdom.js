const jsdom = require('jsdom');
const fs = require('fs');
const { JSDOM } = jsdom;

const html = fs.readFileSync('chapter1.html', 'utf-8');

const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on("jsdomError", () => { });
virtualConsole.on("error", () => { });
virtualConsole.on("log", (a) => console.log(a));

const dom = new JSDOM(html, {
    url: 'https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1/',
    runScripts: "dangerously",
    resources: "usable",
    virtualConsole
});

// Intercept fetch
const originalFetch = dom.window.fetch;
dom.window.fetch = async (...args) => {
    console.log('--- FETCH CALLED ---');
    console.log('URL:', args[0]);
    if (args[1] && args[1].body) {
        console.log('BODY:', args[1].body);
    }
    return originalFetch(...args);
};

// Intercept XMLHttpRequest
const XHR = dom.window.XMLHttpRequest;
dom.window.XMLHttpRequest = function () {
    const xhr = new XHR();
    const send = xhr.send;
    xhr.send = function (data) {
        console.log('\n--- XHR SEND CALLED ---');
        console.log('Data:', data);
        // If it's URLSearchParams, we can toString it
        if (data && data.toString) {
            console.log('Parsed:', data.toString());
        }
        return send.apply(this, arguments);
    };
    return xhr;
};

console.log('JSDOM loaded. Waiting for scripts to run...');
setTimeout(() => {
    console.log('Done waiting.');
    process.exit(0);
}, 10000);
