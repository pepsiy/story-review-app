// Dig deeper into Script 44 and admin-ajax params
const fs = require('fs');
const html = fs.readFileSync('chapter1.html', 'utf-8');

// Extract all script contents
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
const ch44 = scripts[44]?.[1] || '';

if (ch44) {
    console.log('=== Script 44 ===');
    console.log(ch44.substring(0, 2000));
}

// Also look for pattern around "chapter":"
const chIdx = html.indexOf('"chapter":"');
if (chIdx >= 0) {
    console.log('\n=== Context around "chapter": ===');
    console.log(html.substring(chIdx - 100, chIdx + 300));
}

// Find all data passed to admin-ajax
const ajaxIdx = html.indexOf('admin-ajax');
if (ajaxIdx >= 0) {
    console.log('\n=== Context around admin-ajax ===');
    // Look 500 chars before and after
    console.log(html.substring(Math.max(0, ajaxIdx - 200), ajaxIdx + 500));
}

// Find chapter data attributes
const dataMatches = [...html.matchAll(/data-(?:chapter|manga|post|id)="([^"]+)"/g)];
console.log('\n=== data-* attributes ===');
dataMatches.slice(0, 15).forEach(m => console.log(' ', m[0]));
