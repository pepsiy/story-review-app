/**
 * Test script: verify CF Worker can bypass xtruyen.vn block
 * Usage: WORKER_URL=https://xtruyen-proxy.YOURNAME.workers.dev node test-worker.js
 */
const https = require('https');
const http = require('http');

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';
const SECRET = process.env.PROXY_SECRET || 'test-secret-123';
const TEST_URL = 'https://xtruyen.vn/truyen/con-duong-ba-chu/';

function post(url, body) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const isHttps = u.protocol === 'https:';
        const lib = isHttps ? https : http;
        const data = JSON.stringify(body);
        const req = lib.request({
            hostname: u.hostname,
            port: u.port || (isHttps ? 443 : 80),
            path: u.pathname + u.search,
            method: 'POST',
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
            },
        }, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve({ status: res.statusCode, body: d }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(data);
        req.end();
    });
}

async function main() {
    console.log(`\n=== Cloudflare Worker Proxy Test ===`);
    console.log(`Worker URL: ${WORKER_URL}`);
    console.log(`Target: ${TEST_URL}`);
    console.log('');

    // Test 1: Valid request
    console.log('[1] Testing valid request...');
    try {
        const r = await post(WORKER_URL, { url: TEST_URL, secret: SECRET });
        console.log(`    Status: ${r.status}`);
        if (r.status === 200) {
            const j = JSON.parse(r.body);
            console.log(`    ✅ SUCCESS! HTML length: ${j.html?.length} bytes`);
            console.log(`    Has <h1>: ${j.html?.includes('<h1')}`);
            console.log(`    Title tag: ${j.html?.match(/<title>([^<]+)<\/title>/)?.[1]?.substring(0, 80)}`);
        } else {
            console.log(`    ❌ Failed: ${r.body}`);
        }
    } catch (err) {
        console.log(`    ❌ Error: ${err.message}`);
    }

    // Test 2: Wrong secret (security test)
    console.log('\n[2] Testing wrong secret (should reject)...');
    try {
        const r = await post(WORKER_URL, { url: TEST_URL, secret: 'wrong-secret' });
        console.log(`    Status: ${r.status} ${r.status === 401 ? '✅ Correctly rejected' : '❌ Should be 401'}`);
    } catch (err) {
        console.log(`    Error: ${err.message}`);
    }

    // Test 3: Blocked domain (security test)
    console.log('\n[3] Testing blocked domain (should reject)...');
    try {
        const r = await post(WORKER_URL, { url: 'https://google.com/', secret: SECRET });
        console.log(`    Status: ${r.status} ${r.status === 403 ? '✅ Correctly blocked' : '❌ Should be 403'}`);
    } catch (err) {
        console.log(`    Error: ${err.message}`);
    }

    console.log('\n=== Done ===\n');
}

main().catch(console.error);
