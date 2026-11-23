/* A dependency-free static server for the E2E tests: `node tests/serve.cjs` (PORT, default 8123). */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8123);

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    let file = decodeURIComponent(url.pathname);
    if (file.endsWith('/')) file += 'index.html';
    const target = path.join(ROOT, path.normalize(file).replace(/^([/\\])+/, ''));
    if (!target.startsWith(ROOT)) {
        response.writeHead(403).end('forbidden');
        return;
    }
    fs.readFile(target, (error, buffer) => {
        if (error) {
            response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
            return;
        }
        response.writeHead(200, { 'content-type': TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream' });
        response.end(buffer);
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`serving ${ROOT} at http://127.0.0.1:${PORT}/`);
});
