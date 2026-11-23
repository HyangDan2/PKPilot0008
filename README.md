# PKPilot0008 — HD2Markdown Viewer

Live: <https://hyangdan2.github.io/PKPilot0008/>

A read-only Markdown viewer that runs entirely in the browser. No backend, no build step.

## Layout

The page is an app shell pinned to the viewport — `100vw × 100dvh`, the window itself never
scrolls. A slim 52px header sits on top, then the toolbars (`io-bar`, `url-bar`, `doc-bar`), and
`.doc-layout` takes every remaining pixel as a two-column grid: the TOC on the left and the
document on the right, each with its own `overflow-y: auto` scroll area. The document frame runs to
the viewport edge while the running text keeps a ~960px measure. `app.js` measures scrolling
against the document pane (TOC jumps, IntersectionObserver root, the *back to top* button), not the window.

The top bars carry icons only — every control in the header, io-bar, url-bar and doc-bar is an SVG
button with an `aria-label` and a `title` tooltip, so the chrome holds one row down to 320px. What
used to sit above and below the viewer — the intro block and the URL/ZIP/share notes — is in the
header `?` dialog, so it never pushes the viewer down. `@media print` unpins the shell
(`height: auto; overflow: visible`) so the whole document prints or saves as PDF.

## Input

- `.md` / `.markdown` / `.txt` file picker, and drag & drop anywhere on the page. The picker is
  `multiple` and also takes images, so a document and the images it uses can be opened in one go:
  the files stay in memory by file name / relative path, preview them in place (`blob:`), and ride
  along into the ZIP export.
- **Folder open** (`폴더 열기`, `<input type="file" webkitdirectory multiple hidden>`), and dropping a
  folder anywhere on the page. A dropped directory is walked recursively through
  `DataTransferItem.webkitGetAsEntry()` → `createReader()` in 100-entry batches, so `posts/*.md` and
  `assets/`, `images/` come in together and keep their path (`webkitRelativePath` / `entry.fullPath`).
  When a folder holds several documents the shallowest opens (README/index before the rest, then path
  order) and the toast says how many were found.
- **Relative images follow the document.** `../assets/a.png` inside `posts/doc.md` resolves against
  that document's folder (`js/paths.js` · `resolveRelativePath`), a leading `/assets/a.png` against the
  opened folder root (the repo root for a URL document), and matching prefers the exact path over any
  suffix and the bare file name. A local document is never given a host URL for a relative path, so
  `../assets/a.png` can no longer turn into `https://hyangdan2.github.io/assets/a.png`.
- When a local document points at images that are not open yet, a notice above the document lists them
  and offers **폴더 열기** / **이미지 추가**; it disappears on its own once every image resolves.
- Paste text into the paste dialog (also `Ctrl/⌘ + Enter` to render).
- `?url=https://…` — fetches the file and renders it. When the host does not send CORS headers the
  page explains the failure instead of silently doing nothing. A GitHub page URL
  (`github.com/{owner}/{repo}/blob/{branch}/{path}`, also `/raw/…`) is rewritten to
  `raw.githubusercontent.com` before fetching, so any public repository's markdown opens by URL.
  Relative images (`./a.png`, `assets/b.png`) and root-relative ones (`/diary/assets/c.png`) resolve
  against that raw URL — the repo root for a leading `/` — both in the preview and in the ZIP export.
- `#md=…` / `?md=…` — content share links. The document is compressed with lz-string and encoded for a
  URL; opening the link restores the same document. Kept for documents that have no address of their
own (local files, pasted text) and for pinning a snapshot of what the page showed.

## Share

The share control is a split button in the io-bar: the icon on the left says what a press does, the
caret opens the named actions (`원본 링크 복사`, `본문을 링크에 담기`, `.md 파일로 내려받기`).

| document came from | default press | what it gives |
| --- | --- | --- |
| `?url=` / URL bar | copy the original link | `?url=<encoded original URL>` — the viewer address reassembled with `URL` + `URLSearchParams`; opening it fetches the original again, so the link follows the source |
| local file | `.md` download | the markdown body as UTF-8, named after the file that was opened |
| pasted text | `.md` download | `document.md` |
| `#md=` / `?md=` link | `.md` download | `document.md` — a share link has no file name of its own |

The original URL lives only while the document that came from it is on screen: a successful URL load
sets it, and opening a file, pasting, opening a share link or closing the document clears it (a failed
URL load leaves the document and its source untouched). `본문을 링크에 담기` keeps the old `#md=`
behaviour, including the 12,000-character cap, and points at the `.md` download when a document is too
large for a link. No backend and no URL shortener is involved.

## Render

- markdown-it (GFM tables, strikethrough, linkify) + highlight.js, `- [ ]` / `- [x]` checkboxes.
- YAML frontmatter is parsed into the document header (title, category · date, summary, tags) and the
  first `#` heading becomes the document title. A collapsible **frontmatter meta card** lists every
  key/value pair of the block, so custom fields stay visible without entering the source.
- Every code block gets a header with a language badge and a one-click copy button.
- Headings get stable ids and feed the TOC pane (sidebar on desktop, drawer under the doc-bar at
  ≤1000px); clicking an entry scrolls the document pane, and the entry highlight follows the pane's
  scroll position.
- **Every rendered document is sanitized with DOMPurify** (`script`, `style`, `iframe`, `form`,
  `object`, `embed`, inline event handlers and `javascript:` URLs are removed).

## Output

- *Print / PDF* uses `window.print()` with a dedicated `@media print` stylesheet (chrome hidden,
  the app shell unpinned to `height: auto; overflow: visible`, paper colours, page-break hints).
- *Save HTML* exports a standalone HTML file with the rendered document and an embedded stylesheet.
  Local images (`../assets/a.png` included) are written into the file as `data:` URLs, so the saved
  page keeps its pictures wherever it lands; images that were never found keep their original path.
- *Save ZIP* builds a site-ready bundle in the browser with JSZip:

  ```
  posts/{slug}-{hash8}.md     slug from the file name, hash8 = SHA-256 of the exported markdown
  assets/{hash12}.{ext}       hash12 = SHA-256 of the image bytes
  {slug}-{hash8}.zip
  ```

  Images are collected from three places — inline `data:` URIs, `fetch()` for `http(s)` and relative
  URLs, and local files opened with the document — then every collected path in the body becomes
  `/assets/{hash12}.{ext}`. Identical bytes are stored once. Images inside ```` ``` ````/`~~~` fences and
  inline code are left untouched, as are images whose `fetch()` is blocked (CORS): the original URL
  stays and the completion toast reports how many. `crypto.subtle` is used when the page is a secure
  context, with a pure JS SHA-256 fallback for plain-http and `file://`.

## Files

```
index.html          the app shell (52px header, icon toolbars, TOC + document panes, help/paste dialogs)
style.css           Soft Iris / Navy & Lavender tokens + full-viewport shell, document, TOC, print
app.js              parsing, rendering, TOC, share links, export, input handling, folder walk
js/paths.js         path helpers (normalize / resolve ../ / local-image lookup) shared with the unit tests
assets/             shared hd2-theme.css / hd2-theme.js (44px floating toggle)
js/vendor/          markdown-it 14.3.3, highlight.js 11.11.1, DOMPurify 3.2.6, lz-string 1.5.0, JSZip 3.10.1
tests/unit/         node --test over js/paths.js (no dependencies)
tests/e2e/          Playwright specs — folder open/drop, ../ paths, missing-image notice, exports
tests/fixtures/     relative-doc.md + img/dot.png, folder/ (posts/doc.md + assets/ + images/)
```

## Test

```bash
npm install          # @playwright/test only
export PW_CHROMIUM=/path/to/chrome   # optional: use a browser outside Playwright's cache
npm test             # unit: js/paths.js under node --test
npm run test:e2e     # Playwright: serves the repo with tests/serve.cjs on :8123
```

Theme is the shared one: `./assets/hd2-theme.css` + `./assets/hd2-theme.js` (44px floating toggle).
