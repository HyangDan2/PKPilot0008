# Tests — HD2Markdown Viewer

The page is static and has no build step; the tests run against the files as they are served.

## Unit — `tests/unit/`

```
npm test        # node --test tests/unit/*.test.cjs
```

`paths.test.cjs` loads `js/paths.js` directly (it exports through `module.exports` for Node and
`window.HD2Paths` for the page), so no browser or dependency is involved. It covers
`normalizePath`, `dirnameOf`/`basenameOf`, `resolveRelativePath` (`../`, `./`, leading `/`, too many
`..`, remote and inline sources, percent-encoding) and `findInLocalMap` (path before suffix, suffix
before the bare file name).

## E2E — `tests/e2e/`

```
npm install
npm run test:e2e
```

`playwright.config.cjs` starts `tests/serve.cjs` (a dependency-free static server on :8123) and runs
`assets.spec.cjs` in Chromium. `PW_CHROMIUM` points the run at a browser outside Playwright's cache.

| spec | what it holds |
| --- | --- |
| viewer boots | sample document renders, TOC built, no console errors |
| folder open | `webkitdirectory` input loads `folder/posts/doc.md` and its `../assets`, `../images`, `./`, `/assets` images; two documents → the first in path order opens |
| lone document | `doc.md` alone shows the notice for 4 missing images, keeps `src` empty, never requests `https://hyangdan2.github.io/...` |
| add images later | adding the images fills them in and hides the notice |
| folder drop | a synthetic `DataTransfer` with `webkitGetAsEntry()` directory entries is walked in batches; `fullPath` becomes `docPath`/`folderRoot`, images resolve, notice hidden |
| HTML export | saved HTML carries the local images as `data:image/png;base64` |
| ZIP export | `buildZipBundle` packages `../assets` images into `assets/` and rewrites the body |
| `?url=` document | a URL document still resolves `./img/dot.png` against its own address |
| 320px layout | the folder button stays visible with no horizontal overflow at 390px and 320px |

Fixtures:

```
fixtures/relative-doc.md          ?url= document with ./img/dot.png
fixtures/img/dot.png
fixtures/folder/posts/doc.md      ../assets, ../images, ./ and /assets references
fixtures/folder/posts/zz-another.md
fixtures/folder/posts/same-folder.png
fixtures/folder/assets/sample.png
fixtures/folder/assets/second.png
fixtures/folder/images/local.png
```
