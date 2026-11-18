/* ==========================================================================
   HD2Lab · PKPilot0008 — Markdown Viewer
   File / paste / URL input · GFM render · TOC · code copy · print · share
   ========================================================================== */
(function () {
    'use strict';

    const SAMPLE_NAME = 'sample-markdown.md';
    const SAMPLE = [
        '---',
        'title: "Markdown Viewer 사용법"',
        'date: 2026-11-17',
        'category: notes',
        'summary: ".md 파일을 열고, 목차로 넘나들고, 코드를 복사하고, 링크 하나로 공유하기까지."',
        'tags: [markdown, viewer, hd2lab]',
        '---',
        '',
        '# 한 파일로 끝내는 기록',
        '',
        'HD2Lab의 문서는 **마크다운 한 파일**입니다. 쓰는 도구는 따로, 읽는 도구는 따로 — 여기서는 읽는 쪽을 맡습니다.',
        '',
        '## 이 뷰어가 하는 일',
        '',
        '- `.md` · `.markdown` · `.txt` 파일 열기와 드래그&드롭',
        '- GFM 표·체크리스트·취소선 렌더링',
        '- 제목 기반 목차와 코드 블록 복사 버튼',
        '- [x] 인쇄 / PDF 저장',
        '- [ ] 아직 안 해 본 것: 이미지 갤러리',
        '',
        '> 읽기 도구는 조용해야 합니다. 문서가 앞에 있고, 기능은 뒤에 있으면 충분합니다.',
        '',
        '### 지원하는 문법',
        '',
        '| 문법 | 결과 | 비고 |',
        '| --- | --- | --- |',
        '| 표 | GFM 파이프 표 | 가로 스크롤 지원 |',
        '| 체크리스트 | `- [x]` | 읽기 전용 |',
        '| 취소선 | ~~지운 문장~~ | `~~` |',
        '',
        '### 코드',
        '',
        '```js',
        "const viewer = new MarkdownViewer({ sanitize: true });",
        "viewer.render('# hello');",
        '```',
        '',
        '```css',
        '.markdown-body { line-height: 1.95; }',
        '```',
        '',
        '## 공유와 인쇄',
        '',
        '`공유 링크 복사`를 누르면 문서가 압축되어 URL에 담깁니다. 같은 링크를 열면 같은 문서가 그대로 복원됩니다. 인쇄는 브라우저의 PDF 저장으로 이어집니다.',
        '',
        '---',
        '',
        '끝.',
    ].join('\n');

    const $ = (id) => document.getElementById(id);
    const el = {
        article: $('article'),
        doc: $('doc'),
        docHead: $('docHead'),
        docTitle: $('docTitle'),
        docEyebrow: $('docEyebrow'),
        docSummary: $('docSummary'),
        docTags: $('docTags'),
        fmCard: $('fmCard'),
        fmList: $('fmList'),
        fmHint: $('fmHint'),
        fileName: $('fileName'),
        docSource: $('docSource'),
        statWords: $('statWords'),
        statChars: $('statChars'),
        statRead: $('statRead'),
        tocPanel: $('tocPanel'),
        tocNav: $('tocNav'),
        btnToc: $('btnToc'),
        btnTocClose: $('btnTocClose'),
        fileInput: $('fileInput'),
        urlInput: $('urlInput'),
        dropHint: $('dropHint'),
        pasteDialog: $('pasteDialog'),
        pasteArea: $('pasteArea'),
        toast: $('toast'),
        srStatus: $('srStatus'),
    };

    const state = {
        name: SAMPLE_NAME,
        source: '',
        sourceUrl: '',
        markdown: '',
        observer: null,
        localImages: new Map(),
    };

    /* ---------------------------------------------------------------- markdown */
    const md = window.markdownit({
        html: true,
        linkify: true,
        typographer: true,
        highlight(code, language) {
            const lang = String(language || '').trim().toLowerCase();
            if (lang && window.hljs && window.hljs.getLanguage(lang)) {
                try {
                    return wrapCode(window.hljs.highlight(code, { language: lang, ignoreIllegals: true }).value, lang);
                } catch (error) { /* fall through */ }
            }
            return wrapCode(md.utils.escapeHtml(code), lang || 'text');
        },
    });

    function wrapCode(inner, lang) {
        const label = md.utils.escapeHtml(lang || 'text');
        return `<pre class="code-block" data-lang="${label}"><code class="hljs language-${label}">${inner}</code></pre>`;
    }

    function taskLists(instance) {
        instance.core.ruler.after('inline', 'gfm-task-lists', (mdState) => {
            const tokens = mdState.tokens;
            for (let i = 2; i < tokens.length; i += 1) {
                const token = tokens[i];
                if (token.type !== 'inline') continue;
                if (!tokens[i - 1] || tokens[i - 1].type !== 'paragraph_open') continue;
                if (!tokens[i - 2] || tokens[i - 2].type !== 'list_item_open') continue;
                const match = /^\[([ xX])\][ \t]+/.exec(token.content);
                if (!match) continue;
                const checked = match[1].toLowerCase() === 'x';
                token.content = token.content.slice(match[0].length);
                const parsed = instance.parseInline(token.content, mdState.env);
                token.children = parsed[0] ? parsed[0].children : [];
                const box = new mdState.Token('html_inline', '', 0);
                box.content = `<input type="checkbox" disabled${checked ? ' checked' : ''}> `;
                token.children.unshift(box);
                tokens[i - 2].attrJoin('class', 'task-item');
                for (let j = i - 3; j >= 0; j -= 1) {
                    if (tokens[j].type === 'bullet_list_open') { tokens[j].attrJoin('class', 'task-list'); break; }
                }
            }
        });
    }
    md.use(taskLists);
    md.renderer.rules.table_open = () => '<div class="table-wrap"><table>';
    md.renderer.rules.table_close = () => '</table></div>';
    const linkOpen = md.renderer.rules.link_open;
    md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
        const href = tokens[idx].attrGet('href') || '';
        if (/^https?:/i.test(href)) {
            tokens[idx].attrSet('target', '_blank');
            tokens[idx].attrSet('rel', 'noopener noreferrer');
        }
        return linkOpen ? linkOpen(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
    };

    function sanitize(html) {
        if (!window.DOMPurify) return html;
        return window.DOMPurify.sanitize(html, {
            ADD_ATTR: ['target', 'checked', 'disabled'],
            FORBID_TAGS: ['style', 'form', 'iframe', 'object', 'embed', 'base', 'link', 'meta'],
            FORBID_ATTR: ['onerror', 'onload', 'onclick', 'style'],
        });
    }

    /* ---------------------------------------------------------------- frontmatter */
    function parseFrontmatter(text) {
        const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
        if (!match) return { data: null, body: text };
        const data = {};
        match[1].split(/\r?\n/).forEach((line) => {
            const hit = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
            if (!hit) return;
            let value = hit[2].trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (/^\[.*\]$/.test(value)) {
                value = value.slice(1, -1).split(',').map((item) => item.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
            }
            data[hit[1]] = value;
        });
        return { data, body: text.slice(match[0].length) };
    }

    /* ---------------------------------------------------------------- utils */
    function slug(text) {
        return String(text || '')
            .toLowerCase()
            .trim()
            .replace(/[^\w가-힣\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-{2,}/g, '-')
            .slice(0, 60) || 'section';
    }

    function toast(message, kind) {
        el.toast.innerHTML = message;
        el.toast.className = 'toast' + (kind === 'err' ? ' is-err' : kind === 'ok' ? ' is-ok' : kind === 'warn' ? ' is-warn' : '');
        el.toast.hidden = false;
        window.clearTimeout(toast._timer);
        toast._timer = window.setTimeout(() => { el.toast.hidden = true; }, 4200);
    }

    function announce(message) {
        el.srStatus.textContent = message;
    }

    async function copyText(text, message) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                const helper = document.createElement('textarea');
                helper.value = text;
                helper.setAttribute('readonly', '');
                helper.style.position = 'fixed';
                helper.style.top = '-1000px';
                document.body.appendChild(helper);
                helper.select();
                document.execCommand('copy');
                helper.remove();
            }
            toast(message, 'ok');
        } catch (error) {
            toast('복사에 실패했습니다. 브라우저 권한을 확인해 주세요.', 'err');
        }
    }

    function downloadBlob(name, blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    }

    function download(name, content, type) {
        downloadBlob(name, new Blob([content], { type: type || 'text/plain;charset=utf-8' }));
    }

    /* ---------------------------------------------------------------- local images */
    function normalizePath(value) {
        let out = String(value == null ? '' : value).trim();
        if (!out) return '';
        try { out = decodeURIComponent(out); } catch (error) { /* keep the raw string */ }
        return out
            .replace(/\\/g, '/')
            .split('?')[0]
            .split('#')[0]
            .replace(/^\.\//, '')
            .replace(/^\/+/, '')
            .toLowerCase();
    }

    const IMAGE_NAME_RE = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico|tiff?|heic|heif)$/i;

    function isImageFile(file) {
        if (!file) return false;
        return /^image\//i.test(file.type || '') || IMAGE_NAME_RE.test(file.name || '');
    }

    function isMarkdownFile(file) {
        if (!file) return false;
        if (/\.(md|markdown|mdown|txt)$/i.test(file.name || '')) return true;
        return /^text\//i.test(file.type || '') && !/^text\/html/i.test(file.type || '');
    }

    /* local files are kept by file name and relative path so the document can find them */
    function rememberLocalImages(files) {
        const added = [];
        files.forEach((file) => {
            if (!isImageFile(file)) return;
            const entry = {
                file,
                name: file.name,
                relative: file.webkitRelativePath || '',
                url: URL.createObjectURL(file),
            };
            const keys = [normalizePath(entry.relative), normalizePath(entry.name)].filter(Boolean);
            if (!keys.length) return;
            keys.forEach((key) => state.localImages.set(key, entry));
            added.push(entry);
        });
        return added;
    }

    function findLocalImage(value) {
        const key = normalizePath(value);
        if (!key) return null;
        const direct = state.localImages.get(key);
        if (direct) return direct;
        const base = key.split('/').pop();
        const byBase = state.localImages.get(base);
        if (byBase) return byBase;
        let hit = null;
        state.localImages.forEach((entry, mapKey) => {
            if (hit) return;
            if (mapKey.endsWith('/' + key) || key.endsWith('/' + mapKey)) hit = entry;
        });
        return hit;
    }

    /* raw.githubusercontent.com/{owner}/{repo}/{branch}/… — the repo root is where a leading /… starts */
    function rawRepoRoot(sourceUrl) {
        const hit = /^(https?:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/(?:refs\/(?:heads|tags)\/)?[^/]+\/)/i.exec(String(sourceUrl || ''));
        return hit ? hit[1] : '';
    }

    function absoluteImageUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (/^https?:\/\//i.test(raw)) return raw;
        if (/^\/\//.test(raw)) return `${location.protocol}${raw}`;
        const base = state.sourceUrl || document.baseURI || location.href;
        if (raw.startsWith('/')) {
            const root = rawRepoRoot(state.sourceUrl);
            if (root) {
                try { return new URL(raw.replace(/^\/+/, ''), root).href; } catch (error) { /* fall through */ }
            }
        }
        try { return new URL(raw, base).href; } catch (error) { return ''; }
    }

    /* relative images follow the document: local file map first, then the URL the doc came from */
    function previewImageSrc(raw) {
        const value = String(raw || '').trim();
        if (!value) return '';
        if (/^(?:data:|blob:)/i.test(value)) return value;
        const local = findLocalImage(value);
        if (local) return local.url;
        if (/^https?:\/\//i.test(value)) return value;
        const absolute = absoluteImageUrl(value);
        return absolute || value;
    }

    function refreshImageSources() {
        el.article.querySelectorAll('img').forEach((image) => {
            const raw = image.getAttribute('src');
            if (!raw) return;
            const next = previewImageSrc(raw);
            if (next && next !== raw) {
                image.setAttribute('data-origin-src', raw);
                image.setAttribute('src', next);
            }
        });
    }

    /* the HTML file keeps a path that still works where it lands: local names as typed, remote ones absolute */
    function htmlExportSrc(raw) {
        const value = String(raw || '');
        if (!value) return '';
        if (/^(?:data:|https?:)/i.test(value)) return value;
        if (findLocalImage(value)) return value;
        return absoluteImageUrl(value) || value;
    }

    /* ---------------------------------------------------------------- render */
    function renderDocument(text, name, source) {
        const parsed = parseFrontmatter(String(text || ''));
        const data = parsed.data || {};
        const html = sanitize(md.render(parsed.body));

        el.article.innerHTML = html;
        state.markdown = text;
        state.name = name || SAMPLE_NAME;
        state.source = source || '';
        state.sourceUrl = /^https?:\/\//i.test(state.source) ? state.source : '';

        /* first h1 becomes the document title */
        const firstHeading = el.article.querySelector('h1');
        let bodyTitle = '';
        if (firstHeading) {
            bodyTitle = firstHeading.textContent.trim();
            firstHeading.remove();
        }

        const title = (typeof data.title === 'string' && data.title.trim()) || bodyTitle || state.name;
        el.docTitle.textContent = title;
        document.title = `${title} · HD2Lab Markdown Viewer`;

        const eyebrowParts = [];
        if (data.category) eyebrowParts.push(String(data.category).toUpperCase());
        if (data.date) eyebrowParts.push(String(data.date));
        if (!eyebrowParts.length) eyebrowParts.push('MARKDOWN');
        el.docEyebrow.textContent = eyebrowParts.join(' · ');

        const summary = typeof data.summary === 'string' ? data.summary : '';
        el.docSummary.textContent = summary;
        el.docSummary.hidden = !summary;

        const tags = Array.isArray(data.tags) ? data.tags : (data.tags ? String(data.tags).split(',').map((t) => t.trim()) : []);
        el.docTags.innerHTML = tags.filter(Boolean).map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join('');

        paintFrontmatterCard(data);

        el.fileName.textContent = state.name;
        el.docSource.textContent = state.source ? sourceLabel(state.source) : '';

        /* code blocks → header bar with language + copy */
        el.article.querySelectorAll('pre.code-block').forEach((pre) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'md-code';
            const head = document.createElement('div');
            head.className = 'md-code-head';
            const lang = pre.getAttribute('data-lang') || 'text';
            head.innerHTML = `<span class="md-code-lang">${escapeHtml(lang)}</span><button type="button" class="md-copy" data-copy="${escapeHtml(pre.textContent)}">복사</button>`;
            pre.removeAttribute('data-lang');
            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(head);
            wrapper.appendChild(pre);
        });
        el.article.querySelectorAll('.md-copy').forEach((button) => {
            button.addEventListener('click', async () => {
                await copyText(button.dataset.copy || '', '코드를 복사했습니다.');
                button.textContent = '복사됨';
                button.classList.add('is-done');
                window.setTimeout(() => { button.textContent = '복사'; button.classList.remove('is-done'); }, 1800);
            });
        });

        buildToc();
        paintStats(parsed.body);
        highlightActive();
        refreshImageSources();

        /* a new document replaces whatever the share link pointed to */
        if (location.hash.indexOf('#md=') === 0 && source !== '공유 링크') {
            try { history.replaceState(null, '', location.pathname + location.search); } catch (error) { /* ignore */ }
        }
    }

    function paintFrontmatterCard(data) {
        const keys = Object.keys(data || {}).filter((key) => {
            const value = data[key];
            return value !== '' && value != null && !(Array.isArray(value) && value.length === 0);
        });
        if (!keys.length) {
            el.fmCard.hidden = true;
            el.fmList.innerHTML = '';
            el.fmHint.textContent = '';
            return;
        }
        el.fmList.innerHTML = keys.map((key) => {
            const value = data[key];
            const text = Array.isArray(value) ? value.join(', ') : String(value);
            return `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(text)}</dd>`;
        }).join('');
        el.fmHint.textContent = `${keys.length} field${keys.length === 1 ? '' : 's'}`;
        el.fmCard.hidden = false;
        el.fmCard.open = false;
    }

    function sourceLabel(source) {
        try {
            const url = new URL(source);
            return url.hostname + url.pathname.slice(0, 40);
        } catch (error) {
            return source;
        }
    }

    function escapeHtml(value) {
        return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function paintStats(body) {
        const text = String(body || '');
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        el.statWords.textContent = words.toLocaleString('ko-KR');
        el.statChars.textContent = text.length.toLocaleString('ko-KR');
        el.statRead.textContent = String(Math.max(1, Math.round(words / 350)));
    }

    /* ---------------------------------------------------------------- toc */
    function buildToc() {
        if (state.observer) state.observer.disconnect();
        const headings = Array.from(el.article.querySelectorAll('h1, h2, h3, h4'));
        if (!headings.length) {
            el.tocNav.innerHTML = '<p class="toc-empty">제목이 없어 목차가 비어 있습니다.</p>';
            return;
        }
        const used = new Set();
        const items = headings.map((heading) => {
            let id = slug(heading.textContent);
            let candidate = id;
            let index = 2;
            while (used.has(candidate)) { candidate = `${id}-${index}`; index += 1; }
            used.add(candidate);
            heading.id = candidate;
            return { id: candidate, level: Number(heading.tagName.slice(1)), text: heading.textContent.trim() };
        });

        const list = document.createElement('ul');
        list.className = 'toc-list';
        const stack = [{ level: 0, list }];
        items.forEach((item) => {
            while (stack.length > 1 && item.level < stack[stack.length - 1].level) stack.pop();
            if (item.level > stack[stack.length - 1].level && stack[stack.length - 1].list.lastElementChild) {
                const sub = document.createElement('ul');
                sub.className = 'toc-list';
                stack[stack.length - 1].list.lastElementChild.appendChild(sub);
                stack.push({ level: item.level, list: sub });
            }
            const li = document.createElement('li');
            const link = document.createElement('a');
            link.className = 'toc-link';
            link.href = `#${item.id}`;
            link.dataset.level = String(item.level);
            link.dataset.target = item.id;
            link.textContent = item.text;
            link.addEventListener('click', () => {
                if (window.matchMedia('(max-width: 1000px)').matches) el.tocPanel.classList.remove('is-open');
            });
            li.appendChild(link);
            stack[stack.length - 1].list.appendChild(li);
        });
        el.tocNav.innerHTML = '';
        el.tocNav.appendChild(list);

        if ('IntersectionObserver' in window) {
            state.observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    document.querySelectorAll('.toc-link').forEach((link) => {
                        link.classList.toggle('is-active', link.dataset.target === entry.target.id);
                    });
                });
            }, { rootMargin: '-96px 0px -70% 0px', threshold: 0 });
            headings.forEach((heading) => state.observer.observe(heading));
        }
    }

    function highlightActive() {
        const first = document.querySelector('.toc-link');
        if (first) first.classList.add('is-active');
    }

    /* ---------------------------------------------------------------- inputs */
    function readFile(file) {
        if (!file) return;
        if (!isMarkdownFile(file)) {
            toast('.md · .markdown · .txt 문서나 이미지 파일을 열어 주세요.', 'err');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            renderDocument(String(reader.result || ''), file.name, '');
            announce(`${file.name} 문서를 열었습니다.`);
            toast(`${file.name} 열기 완료`, 'ok');
        };
        reader.onerror = () => toast('파일을 읽지 못했습니다.', 'err');
        reader.readAsText(file, 'utf-8');
    }

    /* the file picker and the drop zone both hand over a FileList: one document plus any images */
    function handleFiles(fileList) {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        const images = files.filter(isImageFile);
        const docs = files.filter(isMarkdownFile);
        if (images.length) rememberLocalImages(images);

        if (docs.length) {
            readFile(docs[0]);
            if (images.length) {
                toast(`이미지 ${images.length}장을 함께 열었습니다. ZIP 저장 시 assets/에 담깁니다.`, 'ok');
            }
            return;
        }
        if (images.length) {
            if (state.markdown && state.markdown.trim()) {
                renderDocument(state.markdown, state.name, state.source);
                refreshImageSources();
            }
            toast(`이미지 ${images.length}장을 열었습니다. ZIP 저장 시 assets/에 담깁니다.`, 'ok');
            return;
        }
        toast('.md · .markdown · .txt 문서나 이미지 파일을 열어 주세요.', 'err');
    }

    /* github.com/{owner}/{repo}/blob|raw/{branch}/{path} reads through to the raw file */
    function normalizeDocumentUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const hit = /^https?:\/\/(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+)\/(?:blob|raw)\/([^\s]+)$/i.exec(raw);
        if (!hit) return raw;
        return `https://raw.githubusercontent.com/${hit[1]}/${hit[2]}/${hit[3]}`;
    }

    async function loadFromUrl(rawUrl) {
        const input = String(rawUrl || '').trim();
        if (!input) { toast('불러올 URL을 입력해 주세요.', 'err'); return; }
        if (!/^https?:\/\//i.test(input)) { toast('http(s) URL만 불러올 수 있습니다.', 'err'); return; }
        const value = normalizeDocumentUrl(input);
        const converted = value !== input;
        toast('불러오는 중…');
        try {
            const response = await fetch(value, { mode: 'cors' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            const name = decodeURIComponent((new URL(value).pathname.split('/').pop() || 'remote.md'));
            renderDocument(text, name, value);
            el.urlInput.value = value;
            toast(converted ? 'GitHub 원문(raw) 주소로 바꾸어 불러왔습니다.' : 'URL 문서를 열었습니다.', 'ok');
            announce(converted ? 'GitHub 원문 문서를 열었습니다.' : 'URL 문서를 열었습니다.');
        } catch (error) {
            toast(`불러오지 못했습니다 (${escapeHtml(error.message)}). 이 사이트가 CORS를 허용하지 않으면 파일로 내려받아 열거나 본문을 붙여넣어 주세요.`, 'err');
        }
    }

    /* ---------------------------------------------------------------- share */
    function buildShareLink() {
        if (!window.LZString) return null;
        const packed = window.LZString.compressToEncodedURIComponent(state.markdown || '');
        return { url: `${location.origin}${location.pathname}#md=${packed}`, length: packed.length };
    }

    async function shareLink() {
        const link = buildShareLink();
        if (!link) { toast('공유 링크를 만들 수 없습니다 (압축 라이브러리 없음).', 'err'); return; }
        if (link.length > 12000) {
            toast('문서가 너무 커서 URL에 담기 어렵습니다. 파일이나 .md로 공유해 주세요.', 'err');
            return;
        }
        try {
            history.replaceState(null, '', link.url);
        } catch (error) { /* ignore */ }
        await copyText(link.url, '공유 링크를 복사했습니다.');
        announce('공유 링크를 복사했습니다.');
    }

    function readShareParams() {
        const hash = location.hash || '';
        if (hash.startsWith('#md=')) {
            const packed = hash.slice(4);
            if (window.LZString) {
                const text = window.LZString.decompressFromEncodedURIComponent(packed);
                if (text) return { text, name: 'shared-document.md', source: '공유 링크' };
            }
        }
        const params = new URLSearchParams(location.search);
        if (params.get('md') && window.LZString) {
            const text = window.LZString.decompressFromEncodedURIComponent(params.get('md'));
            if (text) return { text, name: 'shared-document.md', source: '공유 링크' };
        }
        if (params.get('url')) return { url: params.get('url') };
        return null;
    }

    /* ---------------------------------------------------------------- sha256 */
    /* crypto.subtle is missing on plain-http origins and file://, so the export keeps a pure JS copy */
    const SHA256_K = new Uint32Array([
        0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5, 0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
        0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3, 0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
        0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC, 0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
        0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7, 0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
        0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13, 0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
        0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3, 0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
        0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5, 0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
        0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208, 0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2,
    ]);

    function rotateRight(value, bits) {
        return ((value >>> bits) | (value << (32 - bits))) >>> 0;
    }

    function sha256Fallback(bytes) {
        const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
        const padded = new Uint8Array(paddedLength);
        padded.set(input);
        padded[input.length] = 0x80;
        const view = new DataView(padded.buffer);
        const bitLength = input.length * 8;
        view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
        view.setUint32(paddedLength - 4, bitLength >>> 0);

        let h0 = 0x6A09E667, h1 = 0xBB67AE85, h2 = 0x3C6EF372, h3 = 0xA54FF53A;
        let h4 = 0x510E527F, h5 = 0x9B05688C, h6 = 0x1F83D9AB, h7 = 0x5BE0CD19;
        const w = new Uint32Array(64);

        for (let offset = 0; offset < paddedLength; offset += 64) {
            for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4);
            for (let i = 16; i < 64; i += 1) {
                const s0 = rotateRight(w[i - 15], 7) ^ rotateRight(w[i - 15], 18) ^ (w[i - 15] >>> 3);
                const s1 = rotateRight(w[i - 2], 17) ^ rotateRight(w[i - 2], 19) ^ (w[i - 2] >>> 10);
                w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
            }
            let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
            for (let i = 0; i < 64; i += 1) {
                const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
                const choice = (e & f) ^ (~e & g);
                const temp1 = (h + s1 + choice + SHA256_K[i] + w[i]) >>> 0;
                const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
                const majority = (a & b) ^ (a & c) ^ (b & c);
                const temp2 = (s0 + majority) >>> 0;
                h = g;
                g = f;
                f = e;
                e = (d + temp1) >>> 0;
                d = c;
                c = b;
                b = a;
                a = (temp1 + temp2) >>> 0;
            }
            h0 = (h0 + a) >>> 0;
            h1 = (h1 + b) >>> 0;
            h2 = (h2 + c) >>> 0;
            h3 = (h3 + d) >>> 0;
            h4 = (h4 + e) >>> 0;
            h5 = (h5 + f) >>> 0;
            h6 = (h6 + g) >>> 0;
            h7 = (h7 + h) >>> 0;
        }

        const digest = new Uint8Array(32);
        const outView = new DataView(digest.buffer);
        [h0, h1, h2, h3, h4, h5, h6, h7].forEach((word, index) => outView.setUint32(index * 4, word));
        return digest;
    }

    function toHex(bytes) {
        let out = '';
        for (let i = 0; i < bytes.length; i += 1) out += bytes[i].toString(16).padStart(2, '0');
        return out;
    }

    async function sha256Hex(bytes) {
        const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        const subtle = window.crypto && window.crypto.subtle;
        if (subtle && typeof subtle.digest === 'function') {
            try {
                const digest = await subtle.digest('SHA-256', data);
                return toHex(new Uint8Array(digest));
            } catch (error) { /* not a secure context → pure JS below */ }
        }
        return toHex(sha256Fallback(data));
    }

    /* ---------------------------------------------------------------- image refs */
    /* code fences and inline code are reported as ranges so image syntax inside them is left alone */
    function codeRanges(src) {
        const text = String(src || '');
        const fenced = [];
        const fence = /^ {0,3}(`{3,}|~{3,})[^\n]*$/gm;
        let match;
        while ((match = fence.exec(text))) {
            const marker = match[1][0];
            const size = match[1].length;
            const start = match.index;
            const closeRe = new RegExp('^ {0,3}' + (marker === '`' ? '`' : '~') + '{' + size + ',}[ \\t]*$', 'gm');
            closeRe.lastIndex = fence.lastIndex;
            const close = closeRe.exec(text);
            const end = close ? close.index + close[0].length : text.length;
            fenced.push([start, end]);
            fence.lastIndex = end;
        }

        const ranges = fenced.slice();
        const segments = [];
        let cursor = 0;
        fenced.forEach(([start, end]) => {
            if (start > cursor) segments.push([cursor, start]);
            cursor = Math.max(cursor, end);
        });
        if (cursor < text.length) segments.push([cursor, text.length]);

        segments.forEach(([start, end]) => {
            const chunk = text.slice(start, end);
            const inline = /(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g;
            let hit;
            while ((hit = inline.exec(chunk))) {
                const spanStart = start + hit.index;
                ranges.push([spanStart, spanStart + hit[0].length]);
            }
        });

        return ranges.sort((a, b) => a[0] - b[0]);
    }

    function inRanges(index, ranges) {
        for (let i = 0; i < ranges.length; i += 1) {
            if (index < ranges[i][0]) return false;
            if (index < ranges[i][1]) return true;
        }
        return false;
    }

    function cleanImageUrl(value) {
        return String(value || '')
            .replace(/&amp;/g, '&')
            .replace(/&#38;/g, '&')
            .trim();
    }

    /* every markdown image and <img src> outside code, as exact [start, end) of the url text */
    function collectImageRefs(src) {
        const text = String(src || '');
        const ranges = codeRanges(text);
        const refs = [];
        let hit;

        const markdownImage = /!\[[^\]]*\]\(\s*(<[^>]*>|(?:[^\s()]|\([^\s()]*\))+)(?:\s+(?:"[^"]*"|'[^']*'|\([^\s()]*\)))?\s*\)/g;
        while ((hit = markdownImage.exec(text))) {
            if (inRanges(hit.index, ranges)) continue;
            const raw = hit[1];
            const open = hit[0].indexOf('](');
            if (open < 0) continue;
            let start = hit.index + hit[0].indexOf(raw, open + 2);
            if (start < hit.index) continue;
            let end = start + raw.length;
            let url = raw;
            if (raw.startsWith('<') && raw.endsWith('>')) {
                url = raw.slice(1, -1);
                start += 1;
                end -= 1;
            }
            const value = cleanImageUrl(url);
            if (!value) continue;
            refs.push({ url: value, start, end });
        }

        const htmlImage = /<img\b[^>]*>/gi;
        while ((hit = htmlImage.exec(text))) {
            if (inRanges(hit.index, ranges)) continue;
            const tag = hit[0];
            const attr = /(\bsrc\s*=\s*)("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(tag);
            if (!attr) continue;
            const value = attr[3] !== undefined ? attr[3] : (attr[4] !== undefined ? attr[4] : attr[5]);
            if (!value) continue;
            const quoted = /^["']/.test(attr[2]) ? 1 : 0;
            const valueIndex = tag.indexOf(attr[0]) + attr[1].length + quoted;
            refs.push({
                url: cleanImageUrl(value),
                start: hit.index + valueIndex,
                end: hit.index + valueIndex + value.length,
            });
        }

        return refs;
    }

    /* ---------------------------------------------------------------- image bytes */
    const MIME_EXT = {
        'image/png': 'png', 'image/apng': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
        'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif', 'image/svg+xml': 'svg',
        'image/bmp': 'bmp', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico',
        'image/tiff': 'tif', 'image/heic': 'heic', 'image/heif': 'heif',
    };

    function extensionFromMime(mime) {
        return MIME_EXT[String(mime || '').toLowerCase().split(';')[0].trim()] || '';
    }

    function extensionFromName(name) {
        const hit = /\.([a-z0-9]{1,5})$/i.exec(String(name || '').split(/[?#]/)[0]);
        if (!hit) return '';
        const ext = hit[1].toLowerCase();
        return ext === 'jpeg' ? 'jpg' : ext === 'tiff' ? 'tif' : ext;
    }

    function sniffExtension(bytes) {
        if (!bytes || bytes.length < 4) return '';
        if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'png';
        if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'jpg';
        if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'gif';
        if (bytes[0] === 0x42 && bytes[1] === 0x4D) return 'bmp';
        if (bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
            && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'webp';
        return '';
    }

    function looksLikeSvg(bytes) {
        if (!bytes || !bytes.length) return false;
        const head = String.fromCharCode.apply(null, Array.prototype.slice.call(bytes, 0, Math.min(bytes.length, 256)));
        return /^\s*(?:<\?xml|<!--|<svg)/i.test(head);
    }

    function decodeDataImage(value) {
        const hit = /^data:(image\/[a-z0-9.+-]+)((?:;[^,;]*)*),([\s\S]*)$/i.exec(String(value || ''));
        if (!hit) return null;
        const mime = hit[1].toLowerCase();
        const params = hit[2] || '';
        const payload = hit[3] || '';
        try {
            if (/;base64/i.test(params)) {
                const binary = window.atob(payload.replace(/[\s\r\n]+/g, ''));
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
                return bytes.length ? { bytes, ext: extensionFromMime(mime) || 'png' } : null;
            }
            const bytes = new TextEncoder().encode(decodeURIComponent(payload));
            return bytes.length ? { bytes, ext: extensionFromMime(mime) || 'svg' } : null;
        } catch (error) {
            return null;
        }
    }

    function bytesFrom(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(new Uint8Array(reader.result));
            reader.onerror = () => reject(reader.error || new Error('read error'));
            reader.readAsArrayBuffer(file);
        });
    }

    /* one image url → bytes, from an inline data uri, a file the user opened, or the network */
    async function collectImage(url) {
        const value = String(url || '').trim();
        if (!value) return null;
        if (/^data:/i.test(value)) return decodeDataImage(value);

        if (!/^(?:https?:)?\/\//i.test(value)) {
            const local = findLocalImage(value);
            if (local) {
                try {
                    const bytes = await bytesFrom(local.file);
                    if (bytes.length) {
                        const ext = extensionFromMime(local.file.type)
                            || extensionFromName(local.file.name)
                            || sniffExtension(bytes)
                            || (looksLikeSvg(bytes) ? 'svg' : 'png');
                        return { bytes, ext, origin: 'local' };
                    }
                } catch (error) { /* fall through to fetch */ }
            }
        }

        const absolute = absoluteImageUrl(value);
        if (!absolute || !/^https?:\/\//i.test(absolute)) return null;
        try {
            const response = await fetch(absolute, { mode: 'cors', credentials: 'omit' });
            if (!response.ok) return null;
            const blob = await response.blob();
            const bytes = new Uint8Array(await blob.arrayBuffer());
            if (!bytes.length) return null;
            const ext = extensionFromMime(blob.type)
                || extensionFromName(absolute)
                || sniffExtension(bytes)
                || (looksLikeSvg(bytes) ? 'svg' : 'png');
            return { bytes, ext, origin: 'remote' };
        } catch (error) {
            return null;
        }
    }

    /* ---------------------------------------------------------------- zip bundle */
    const GENERIC_SLUGS = ['pasted', 'shared-document', 'sample-markdown', 'document', 'section'];

    function documentSlug() {
        const name = String(state.name || '').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
        const fromName = slug(name);
        if (fromName && !GENERIC_SLUGS.includes(fromName)) return fromName;
        const fromTitle = slug(el.docTitle.textContent || '');
        if (fromTitle && !GENERIC_SLUGS.includes(fromTitle)) return fromTitle;
        return 'document';
    }

    async function buildZipBundle(markdown) {
        const text = String(markdown || '');
        const refs = collectImageRefs(text);
        const pending = [];
        refs.forEach((ref) => { if (!pending.includes(ref.url)) pending.push(ref.url); });

        const resolved = new Map();
        const assets = [];
        const hashToPath = new Map();

        for (let i = 0; i < pending.length; i += 1) {
            const url = pending[i];
            const image = await collectImage(url);
            if (!image) continue;
            const hex = await sha256Hex(image.bytes);
            const hash12 = hex.slice(0, 12);
            const ext = image.ext || 'png';
            let path = hashToPath.get(hash12);
            if (!path) {
                path = `assets/${hash12}.${ext}`;
                hashToPath.set(hash12, path);
                assets.push({ path, bytes: image.bytes });
            }
            /* the zip entry is assets/…, the body points at the site root: /assets/… */
            resolved.set(url, `/${path}`);
        }

        let output = text;
        let replaced = 0;
        refs.slice().sort((a, b) => b.start - a.start).forEach((ref) => {
            const path = resolved.get(ref.url);
            if (!path) return;
            output = output.slice(0, ref.start) + path + output.slice(ref.end);
            replaced += 1;
        });

        const hash8 = (await sha256Hex(new TextEncoder().encode(output))).slice(0, 8);
        return {
            markdown: output,
            assets,
            replaced,
            missed: pending.filter((url) => !resolved.has(url)).length,
            images: assets.length,
            duplicates: Math.max(0, replaced - assets.length),
            hash8,
            slug: documentSlug(),
        };
    }

    async function exportZip() {
        const button = $('btnExportZip');
        if (!window.JSZip) {
            toast('ZIP 라이브러리를 불러오지 못했습니다. 새로고침한 뒤 다시 시도해 주세요.', 'err');
            return;
        }
        if (!state.markdown || !state.markdown.trim()) {
            toast('먼저 문서를 열어 주세요. ZIP으로 저장할 내용이 없습니다.', 'err');
            return;
        }
        if (button && button.disabled) return;

        const label = button ? button.textContent : '';
        if (button) {
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
            button.textContent = '만드는 중…';
        }
        try {
            const bundle = await buildZipBundle(state.markdown);
            const base = `${bundle.slug}-${bundle.hash8}`;
            const zip = new window.JSZip();
            zip.file(`posts/${base}.md`, bundle.markdown, { createFolders: false });
            bundle.assets.forEach((asset) => zip.file(asset.path, asset.bytes, { binary: true, createFolders: false }));
            const blob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 },
                mimeType: 'application/zip',
            });
            downloadBlob(`${base}.zip`, blob);

            const notes = [`ZIP 파일을 내려받았습니다. 문서는 posts/${base}.md로 담았습니다.`];
            if (bundle.images) notes.push(`이미지 ${bundle.images}장을 assets/에 담았습니다.`);
            if (bundle.duplicates) notes.push(`같은 이미지 ${bundle.duplicates}건은 한 번만 저장했습니다.`);
            if (bundle.missed) notes.push(`이미지 ${bundle.missed}장은 담지 못해 원본 주소를 그대로 두었습니다.`);
            toast(notes.join(' '), bundle.missed ? 'warn' : 'ok');
            announce('ZIP 파일을 내려받았습니다.');
        } catch (error) {
            toast(`ZIP 파일을 만들지 못했습니다 (${escapeHtml(error && error.message ? error.message : '알 수 없는 오류')}). 잠시 뒤 다시 시도해 주세요.`, 'err');
        } finally {
            if (button) {
                button.disabled = false;
                button.removeAttribute('aria-busy');
                button.textContent = label || 'ZIP 저장';
            }
        }
    }

    /* ---------------------------------------------------------------- export */
    function exportHtml() {
        const clone = el.article.cloneNode(true);
        clone.querySelectorAll('.md-code-head').forEach((node) => node.remove());
        clone.querySelectorAll('img').forEach((image) => {
            const raw = image.getAttribute('data-origin-src');
            if (!raw) return;
            image.setAttribute('src', htmlExportSrc(raw));
            image.removeAttribute('data-origin-src');
        });
        const title = el.docTitle.textContent || 'HD2Lab Document';
        const html = standalone(title, clone.innerHTML);
        download(`${slug(title) || 'document'}.html`, html, 'text/html;charset=utf-8');
        toast('HTML 파일을 내려받았습니다.', 'ok');
    }

    function standalone(title, bodyHtml) {
        const safeTitle = escapeHtml(title);
        return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<style>
:root{color-scheme:light dark;--bg:#FAFAFD;--fg:#1D192B;--body:#3F3950;--accent:#8B6CE8;--line:#E8E4F2;--soft:#F7F5FE}
@media (prefers-color-scheme:dark){:root{--bg:#0B1020;--fg:#EEF2FF;--body:#C6D0E9;--accent:#A78BFA;--line:#253154;--soft:#1A2340}}
*{box-sizing:border-box}
body{margin:0;padding:48px 20px 72px;background:var(--bg);color:var(--body);font:16px/1.9 system-ui,-apple-system,"Pretendard","Segoe UI","Apple SD Gothic Neo",sans-serif}
main{max-width:760px;margin:0 auto}
h1,h2,h3,h4{color:var(--fg);line-height:1.3;letter-spacing:-.03em;margin:34px 0 12px}
h1{font-size:30px}h2{font-size:23px;padding-top:16px;border-top:1px solid var(--line)}h3{font-size:19px}
p{margin:0 0 15px}a{color:var(--accent)}
ul,ol{padding-left:22px}li{margin-bottom:6px}
blockquote{margin:20px 0;padding:4px 0 4px 16px;border-left:3px solid var(--accent);color:var(--fg)}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.86em;padding:2px 6px;border:1px solid var(--line);border-radius:4px;background:var(--soft)}
pre{margin:20px 0;padding:16px;border:1px solid var(--line);border-radius:6px;background:var(--soft);overflow-x:auto;font-size:12.5px;line-height:1.7}
pre code{padding:0;border:none;background:none}
.md-code{margin:20px 0;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.md-code .code-block{margin:0;border:none;border-radius:0}
img{max-width:100%;height:auto;border:1px solid var(--line);border-radius:6px}
table{width:100%;border-collapse:collapse;font-size:13px;margin:20px 0}
th,td{padding:9px 12px;border-bottom:1px solid var(--line);text-align:left}
th{color:var(--accent);font-size:11px;letter-spacing:.08em;text-transform:uppercase}
.table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:6px}
hr{border:0;height:1px;background:var(--line);margin:28px 0}
input[type=checkbox]{accent-color:var(--accent)}
footer{margin:56px auto 0;max-width:760px;color:#8B8598;font-size:11px;letter-spacing:.14em;text-transform:uppercase;border-top:1px solid var(--line);padding-top:18px}
@media print{body{padding:0;background:#fff;color:#000}footer{display:none}pre,table{break-inside:avoid}}
</style>
</head>
<body>
<main>
${bodyHtml}
</main>
<footer>HD2Lab · Markdown Viewer</footer>
</body>
</html>
`;
    }

    /* ---------------------------------------------------------------- view controls */
    function clearDocument() {
        state.markdown = '';
        state.name = '문서 없음';
        state.source = '';
        el.article.innerHTML = '<p class="toc-empty" style="color:var(--text-secondary);font-size:13px">열린 문서가 없습니다. <strong>파일 열기</strong>로 .md를 고르거나, <strong>텍스트 붙여넣기</strong>로 본문을 넣어 주세요.</p>';
        el.docTitle.textContent = '문서 없음';
        el.docEyebrow.textContent = 'MARKDOWN';
        el.docSummary.hidden = true;
        el.docTags.innerHTML = '';
        el.fmCard.hidden = true;
        el.fmList.innerHTML = '';
        el.fmHint.textContent = '';
        el.fileName.textContent = '문서 없음';
        el.docSource.textContent = '';
        el.tocNav.innerHTML = '<p class="toc-empty">제목이 있는 문서를 열면 목차가 만들어집니다.</p>';
        el.statWords.textContent = '0';
        el.statChars.textContent = '0';
        el.statRead.textContent = '0';
        document.title = 'HD2Lab | Markdown Viewer';
        try { history.replaceState(null, '', location.pathname); } catch (error) { /* ignore */ }
        toast('문서를 닫았습니다.');
    }

    function wireEvents() {
        $('btnOpenFile').addEventListener('click', () => el.fileInput.click());
        el.fileInput.addEventListener('change', (event) => {
            handleFiles(event.target.files);
            event.target.value = '';
        });
        $('btnSample').addEventListener('click', () => {
            renderDocument(SAMPLE, SAMPLE_NAME, '');
            toast('샘플 문서를 열었습니다.', 'ok');
        });
        $('btnPaste').addEventListener('click', () => {
            if (typeof el.pasteDialog.showModal === 'function') el.pasteDialog.showModal();
            else el.pasteDialog.setAttribute('open', '');
            el.pasteArea.focus();
        });
        $('btnPasteRender').addEventListener('click', () => {
            const text = el.pasteArea.value;
            if (!text.trim()) { toast('붙여넣은 내용이 없습니다.', 'err'); return; }
            renderDocument(text, 'pasted.md', '');
            if (el.pasteDialog.open) el.pasteDialog.close();
            toast('붙여넣은 문서를 읽었습니다.', 'ok');
        });
        el.pasteArea.addEventListener('keydown', (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                $('btnPasteRender').click();
            }
        });
        $('btnLoadUrl').addEventListener('click', () => loadFromUrl(el.urlInput.value));
        el.urlInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') { event.preventDefault(); loadFromUrl(el.urlInput.value); }
        });
        $('btnShare').addEventListener('click', shareLink);
        $('btnPrint').addEventListener('click', () => window.print());
        $('btnExport').addEventListener('click', exportHtml);
        $('btnExportZip').addEventListener('click', exportZip);
        $('btnClear').addEventListener('click', clearDocument);
        el.btnToc.addEventListener('click', () => {
            const open = el.tocPanel.classList.toggle('is-open');
            el.btnToc.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (open) el.tocPanel.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
        el.btnTocClose.addEventListener('click', () => el.tocPanel.classList.remove('is-open'));

        /* drag & drop anywhere */
        let depth = 0;
        window.addEventListener('dragenter', (event) => {
            if (!event.dataTransfer || !Array.from(event.dataTransfer.types || []).includes('Files')) return;
            depth += 1;
            el.dropHint.hidden = false;
        });
        window.addEventListener('dragover', (event) => {
            if (event.dataTransfer) event.preventDefault();
        });
        window.addEventListener('dragleave', () => {
            depth = Math.max(0, depth - 1);
            if (!depth) el.dropHint.hidden = true;
        });
        window.addEventListener('drop', (event) => {
            if (!event.dataTransfer) return;
            event.preventDefault();
            depth = 0;
            el.dropHint.hidden = true;
            handleFiles(event.dataTransfer.files);
        });
    }

    function boot() {
        if (!window.markdownit) {
            el.article.innerHTML = '<p>렌더러를 불러오지 못했습니다. 새로고침해 주세요.</p>';
            return;
        }
        wireEvents();
        const shared = readShareParams();
        if (shared && shared.text) {
            renderDocument(shared.text, shared.name, shared.source);
            toast('공유 링크의 문서를 복원했습니다.', 'ok');
        } else if (shared && shared.url) {
            el.urlInput.value = shared.url;
            loadFromUrl(shared.url);
        } else {
            renderDocument(SAMPLE, SAMPLE_NAME, '');
        }
        el.btnToc.setAttribute('aria-expanded', 'false');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    /* exposed for tests */
    window.HD2Viewer = {
        renderDocument,
        parseFrontmatter,
        buildShareLink,
        sanitize,
        readFile,
        handleFiles,
        loadFromUrl,
        clearDocument,
        exportZip,
        buildZipBundle,
        collectImageRefs,
        collectImage,
        codeRanges,
        sha256Hex,
        sha256Fallback,
        toHex,
        normalizeDocumentUrl,
        normalizePath,
        rememberLocalImages,
        findLocalImage,
        previewImageSrc,
        documentSlug,
        state,
    };
})();
