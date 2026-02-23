const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
    // Changes the cache location for Puppeteer to a directory inside the project workspace
    // so that Render preserves the downloaded Chrome browser across the build and start phases.
    cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
