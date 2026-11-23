/* Playwright E2E — folder open/drop and ../assets relative images.
   Run with `npm run test:e2e` (config in playwright.config.cjs). */
'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { test, expect } = require('@playwright/test');

const FIXTURE = path.join(__dirname, '..', 'fixtures', 'folder');
const FIXTURE_URL = '/tests/fixtures/folder';
const DOC_MD = fs.readFileSync(path.join(FIXTURE, 'posts', 'doc.md'), 'utf8');
const IMAGE_FILES = [
    path.join(FIXTURE, 'assets', 'sample.png'),
    path.join(FIXTURE, 'assets', 'second.png'),
    path.join(FIXTURE, 'images', 'local.png'),
    path.join(FIXTURE, 'posts', 'same-folder.png'),
];

function watchErrors(page) {
    const errors = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    return errors;
}

async function imageState(page) {
    return page.$$eval('#article img', (images) => images.map((image) => ({
        src: image.getAttribute('src') || '',
        origin: image.getAttribute('data-origin-src') || '',
        missing: image.getAttribute('data-missing-src') || '',
        loaded: image.complete && image.naturalWidth > 0,
    })));
}

test('the viewer opens with no console errors and its TOC built', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    /* the sample document's own frontmatter title replaces the app name in the document head */
    await expect(page.locator('#docTitle')).toHaveText('HD2Markdown Viewer');
    expect(await page.locator('#tocNav .toc-link').count()).toBeGreaterThan(2);
    expect(errors).toEqual([]);
});

test('폴더 열기 loads posts/doc.md together with ../assets images', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await page.setInputFiles('#folderInput', FIXTURE);

    await expect(page.locator('#fileName')).toHaveText('doc.md');
    /* the folder holds two documents: the first in path order, doc.md, opens */
    await expect(page.locator('#docTitle')).toHaveText('상위 폴더 이미지가 있는 문서');

    const images = await imageState(page);
    expect(images).toHaveLength(4);
    for (const image of images) {
        expect(image.src.startsWith('blob:'), `${image.origin} → ${image.src}`).toBe(true);
        expect(image.loaded, `${image.origin} did not decode`).toBe(true);
    }
    await expect(page.locator('#assetNotice')).toBeHidden();
    expect(errors).toEqual([]);
});

test('a lone document keeps ../assets empty, shows the notice, and never asks the site base', async ({ page }) => {
    const errors = watchErrors(page);
    const wrongRequests = [];
    await page.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith('https://hyangdan2.github.io')) {
            wrongRequests.push(url);
            return route.abort();
        }
        return route.continue();
    });

    await page.goto('/');
    await page.setInputFiles('#fileInput', [{ name: 'doc.md', mimeType: 'text/markdown', buffer: Buffer.from(DOC_MD) }]);

    await expect(page.locator('#fileName')).toHaveText('doc.md');
    await expect(page.locator('#assetNotice')).toBeVisible();
    await expect(page.locator('#assetNoticeTitle')).toHaveText('참조하는 이미지 4장을 아직 찾지 못했습니다');
    await expect(page.locator('#assetNoticeList')).toContainText('../assets/sample.png');

    const images = await imageState(page);
    expect(images).toHaveLength(4);
    for (const image of images) {
        expect(image.src, `${image.origin} kept a src`).toBe('');
        expect(image.missing).toBeTruthy();
    }
    /* ../assets/a.png must not become https://hyangdan2.github.io/assets/a.png */
    expect(wrongRequests).toEqual([]);
    expect(errors).toEqual([]);
});

test('이미지 추가 fills the missing images and hides the notice by itself', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await page.setInputFiles('#fileInput', [{ name: 'doc.md', mimeType: 'text/markdown', buffer: Buffer.from(DOC_MD) }]);
    await expect(page.locator('#assetNotice')).toBeVisible();

    await page.setInputFiles('#imageInput', IMAGE_FILES.map((file) => ({
        name: path.basename(file),
        mimeType: 'image/png',
        buffer: fs.readFileSync(file),
    })));

    await expect(page.locator('#assetNotice')).toBeHidden();
    const images = await imageState(page);
    for (const image of images) {
        expect(image.loaded, `${image.origin} did not decode`).toBe(true);
    }
    expect(errors).toEqual([]);
});

test('dropping a folder walks its directories and keeps fullPath relative paths', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');

    const walked = await page.evaluate(async (base) => {
        const blobFor = async (name, file = name) => {
            const response = await fetch(`${base}/${name}`);
            return new File([await response.blob()], file, { type: 'image/png' });
        };
        const markdown = await (await fetch(`${base}/posts/doc.md`)).text();

        const fileEntry = (name, fullPath, file) => ({
            isFile: true,
            isDirectory: false,
            name,
            fullPath,
            file: (done, fail) => { try { done(file); } catch (error) { fail && fail(error); } },
        });
        const dirEntry = (name, fullPath, children) => ({
            isFile: false,
            isDirectory: true,
            name,
            fullPath,
            createReader() {
                let served = 0;
                return {
                    readEntries(done) {
                        /* two batches, so the 100-entry loop is exercised */
                        if (served === 0) { served = 1; done(children.slice(0, 1)); return; }
                        if (served === 1) { served = 2; done(children.slice(1)); return; }
                        done([]);
                    },
                };
            },
        });

        const [sample, second, local, same] = await Promise.all([
            blobFor('assets/sample.png'),
            blobFor('assets/second.png'),
            blobFor('images/local.png'),
            blobFor('posts/same-folder.png'),
        ]);
        const tree = dirEntry('project', '/project', [
            dirEntry('assets', '/project/assets', [
                fileEntry('sample.png', '/project/assets/sample.png', sample),
                fileEntry('second.png', '/project/assets/second.png', second),
            ]),
            dirEntry('posts', '/project/posts', [
                fileEntry('doc.md', '/project/posts/doc.md', new File([markdown], 'doc.md', { type: 'text/markdown' })),
                fileEntry('same-folder.png', '/project/posts/same-folder.png', same),
            ]),
            dirEntry('images', '/project/images', [
                fileEntry('local.png', '/project/images/local.png', local),
            ]),
        ]);

        const dataTransfer = { files: [], items: [{ webkitGetAsEntry: () => tree }] };
        const walked = await window.HD2Viewer.readDroppedEntries(dataTransfer);
        const event = new Event('drop', { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
        window.dispatchEvent(event);
        return {
            records: walked.records.map((record) => record.relative).sort(),
            root: walked.folderRoot,
        };
    }, `${FIXTURE_URL}`);

    expect(walked.root).toBe('project');
    expect(walked.records).toEqual([
        'project/assets/sample.png',
        'project/assets/second.png',
        'project/images/local.png',
        'project/posts/doc.md',
        'project/posts/same-folder.png',
    ]);

    await expect(page.locator('#fileName')).toHaveText('doc.md');
    await expect.poll(async () => (await imageState(page)).filter((image) => image.loaded).length).toBe(4);
    await expect(page.locator('#assetNotice')).toBeHidden();
    expect(await page.evaluate(() => window.HD2Viewer.state.docPath)).toBe('project/posts/doc.md');
    expect(await page.evaluate(() => window.HD2Viewer.state.folderRoot)).toBe('project');
    expect(errors).toEqual([]);
});

test('HTML export carries the local ../assets image inside the file', async ({ page }) => {
    await page.goto('/');
    await page.setInputFiles('#folderInput', FIXTURE);
    await expect(page.locator('#fileName')).toHaveText('doc.md');

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.evaluate(() => window.HD2Viewer.exportHtml()),
    ]);
    const saved = await download.path();
    const html = fs.readFileSync(saved, 'utf8');
    expect(html).toContain('data:image/png;base64,');
    expect(html).not.toContain('data-origin-src');
    expect((html.match(/data:image\/png;base64,/g) || []).length).toBe(4);
});

test('ZIP export packages the ../assets images as assets/ entries', async ({ page }) => {
    await page.goto('/');
    await page.setInputFiles('#folderInput', FIXTURE);
    await expect(page.locator('#fileName')).toHaveText('doc.md');

    const bundle = await page.evaluate(async () => {
        const result = await window.HD2Viewer.buildZipBundle(window.HD2Viewer.state.markdown);
        return {
            images: result.images,
            missed: result.missed,
            replaced: result.replaced,
            assets: result.assets.map((asset) => asset.path),
            markdown: result.markdown,
        };
    });

    expect(bundle.missed).toBe(0);
    expect(bundle.images).toBe(4);
    expect(bundle.replaced).toBe(4);
    expect(bundle.assets.every((entry) => entry.startsWith('assets/'))).toBe(true);
    expect(bundle.markdown).toContain('](/assets/');
    /* every image reference in the body points at the packaged assets/ */
    expect(bundle.markdown).not.toContain('](../assets/sample.png)');
    expect(bundle.markdown).not.toContain('](../images/local.png)');
    expect(bundle.markdown).not.toContain('](./same-folder.png)');
    expect(bundle.markdown).not.toContain('](/assets/second.png)');
});

test('a ?url= document still resolves its relative images against its own address', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`/?url=${encodeURIComponent('http://127.0.0.1:8123/tests/fixtures/relative-doc.md')}`);
    await expect(page.locator('#fileName')).toHaveText('relative-doc.md');
    await expect.poll(async () => (await imageState(page)).filter((image) => image.loaded).length).toBe(1);
    const images = await imageState(page);
    expect(images[0].src).toBe('http://127.0.0.1:8123/tests/fixtures/img/dot.png');
    /* a URL document keeps its own base and never needs the folder notice */
    await expect(page.locator('#assetNotice')).toBeHidden();
    expect(errors).toEqual([]);
});

test('icon toolbar stays compact at 390px and 320px, with actions available in menus', async ({ page }) => {
    for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 780 });
        await page.goto('/');
        await expect(page.locator('#btnOpenMenu')).toBeVisible();
        await expect(page.locator('#btnShare')).toBeVisible();
        await expect(page.locator('#btnExportMenu')).toBeVisible();
        await expect(page.locator('#urlBar')).toBeHidden();

        await page.locator('#btnOpenMenu').click();
        await expect(page.locator('#openMenu')).toBeVisible();
        await expect(page.locator('#btnOpenFolder')).toBeVisible();
        await page.locator('#btnOpenUrl').click();
        await expect(page.locator('#openMenu')).toBeHidden();
        await expect(page.locator('#urlBar')).toBeVisible();
        await page.locator('#btnCloseUrl').click();
        await expect(page.locator('#urlBar')).toBeHidden();

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
    }
});

test('share icon only offers original URL and export actions remain separate', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#btnShare')).toBeDisabled();
    await expect(page.locator('#shareMenu')).toHaveCount(0);
    await expect(page.locator('#miContent')).toHaveCount(0);
    await expect(page.locator('script[src*="lz-string"]')).toHaveCount(0);

    await page.locator('#btnExportMenu').click();
    await expect(page.locator('#exportMenu')).toBeVisible();
    await expect(page.locator('#miDownload')).toBeVisible();
    await expect(page.locator('#btnExport')).toBeVisible();
    await expect(page.locator('#btnExportZip')).toBeVisible();
    await expect(page.locator('#btnPrint')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#exportMenu')).toBeHidden();

    await page.locator('#btnOpenMenu').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#openMenu')).toBeVisible();
    await expect(page.locator('#btnOpenFile')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#openMenu')).toBeHidden();
    await expect(page.locator('#btnOpenMenu')).toBeFocused();
});

test('share URLs only reference their original source; legacy inline content links are rejected', async ({ page }) => {
    await page.goto('/?md=non-empty-legacy-data');
    await expect(page.locator('#docTitle')).toHaveText('HD2Markdown Viewer');
    await expect.poll(() => new URL(page.url()).searchParams.has('md')).toBe(false);
    await expect(page.locator('#btnShare')).toBeDisabled();

    const source = 'http://127.0.0.1:8123/tests/fixtures/relative-doc.md';
    await page.goto('/?url=' + encodeURIComponent(source));
    await expect(page.locator('#fileName')).toHaveText('relative-doc.md');
    await expect(page.locator('#btnShare')).toBeEnabled();
    const result = await page.evaluate(() => window.HD2Viewer.buildUrlShareLink());
    expect(new URL(result.url).searchParams.get('url')).toBe(source);
    expect(new URL(result.url).hash).toBe('');
    expect(result.url).not.toContain('#md=');
});
