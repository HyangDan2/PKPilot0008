# PKPilot0008 — HD2Lab Markdown Viewer

Live: <https://hyangdan2.github.io/PKPilot0008/>

A read-only Markdown viewer that runs entirely in the browser. No backend, no build step.

## Layout

The page is an app shell pinned to the viewport — `100vw × 100dvh`, the window itself never
scrolls. A slim 52px header sits on top, then the toolbars (`io-bar`, `url-bar`, `doc-bar`), and
`.doc-layout` takes every remaining pixel as a two-column grid: the TOC on the left and the
document on the right, each with its own `overflow-y: auto` scroll area. The document frame runs to
the viewport edge while the running text keeps a ~960px measure. `app.js` measures scrolling
against the document pane (TOC jumps, IntersectionObserver root, “맨 위로”), not the window.

What used to sit above and below the viewer — the intro block and the URL/ZIP/share notes — is in
the header `?` dialog, so it never pushes the viewer down. `@media print` unpins the shell
(`height: auto; overflow: visible`) so the whole document prints or saves as PDF.

## Input

- `.md` / `.markdown` / `.txt` file picker, and drag & drop anywhere on the page. The picker is
  `multiple` and also takes images, so a document and the images it uses can be opened in one go:
  the files stay in memory by file name / relative path, preview them in place (`blob:`), and ride
  along into the ZIP export.
- Paste text into the paste dialog (also `Ctrl/⌘ + Enter` to render).
- `?url=https://…` — fetches the file and renders it. When the host does not send CORS headers the
  page explains the failure instead of silently doing nothing. A GitHub page URL
  (`github.com/{owner}/{repo}/blob/{branch}/{path}`, also `/raw/…`) is rewritten to
  `raw.githubusercontent.com` before fetching, so any public repository's markdown opens by URL.
  Relative images (`./a.png`, `assets/b.png`) and root-relative ones (`/diary/assets/c.png`) resolve
  against that raw URL — the repo root for a leading `/` — both in the preview and in the ZIP export.
- `#md=…` / `?md=…` — share links. The document is compressed with lz-string and encoded for a URL;
  opening the link restores the same document. `공유 링크 복사` writes the link to the clipboard and
  updates the address bar with `history.replaceState`.

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

- `인쇄 / PDF` uses `window.print()` with a dedicated `@media print` stylesheet (chrome hidden,
  the app shell unpinned to `height: auto; overflow: visible`, paper colours, page-break hints).
- `HTML 저장` exports a standalone HTML file with the rendered document and an embedded stylesheet.
- `ZIP 저장` builds a site-ready bundle in the browser with JSZip:

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
index.html          the app shell (52px header, toolbars, TOC + document panes, help/paste dialogs)
style.css           Soft Iris / Navy & Lavender tokens + full-viewport shell, document, TOC, print
app.js              parsing, rendering, TOC, share links, export, input handling
js/vendor/          markdown-it 14.3.3, highlight.js 11.11.1, DOMPurify 3.2.6, lz-string 1.5.0, JSZip 3.10.1
```

Theme is the shared one: `./assets/hd2-theme.css` + `./assets/hd2-theme.js` (44px floating toggle).
