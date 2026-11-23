'use strict';

const { defineConfig } = require('@playwright/test');

/* PW_CHROMIUM lets a machine that keeps its browser outside Playwright's cache
   point at the binary directly (the sandbox here does). */
const launchOptions = Object.assign(
    {
        /* a small box: fewer renderer processes and threads keep the browser inside the process limit */
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions'],
    },
    process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);

module.exports = defineConfig({
    testDir: './tests/e2e',
    timeout: 40000,
    fullyParallel: false,
    workers: 1,
    reporter: [['list']],
    use: {
        baseURL: 'http://127.0.0.1:8123',
        viewport: { width: 1440, height: 900 },
        launchOptions,
    },
    webServer: {
        command: 'node tests/serve.cjs',
        url: 'http://127.0.0.1:8123/',
        reuseExistingServer: true,
        timeout: 20000,
    },
});
