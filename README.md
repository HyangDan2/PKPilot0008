# PKPilot0008 — HD2Lab Markdown Viewer

Live: <https://hyangdan2.github.io/PKPilot0008/>

A read-only Markdown viewer that runs entirely in the browser. No backend, no build step.

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
- Headings get stable ids and feed the sticky TOC (sidebar on desktop, toggle panel on mobile).
- **Every rendered document is sanitized with DOMPurify** (`script`, `style`, `iframe`, `form`,
  `object`, `embed`, inline event handlers and `javascript:` URLs are removed).

## Output

- `인쇄 / PDF` uses `window.print()` with a dedicated `@media print` stylesheet (chrome hidden,
  paper colours, page-break hints).
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
index.html          the page (HD2Lab header, input bar, doc layout, dialogs)
style.css           Soft Iris / Navy & Lavender tokens + document, TOC and print styles
app.js              parsing, rendering, TOC, share links, export, input handling
js/vendor/          markdown-it 14.3.3, highlight.js 11.11.1, DOMPurify 3.2.6, lz-string 1.5.0, JSZip 3.10.1
```

Theme is the shared one: `./assets/hd2-theme.css` + `./assets/hd2-theme.js` (44px floating toggle).
