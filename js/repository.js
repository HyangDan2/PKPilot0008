/* Public GitHub Markdown repository helpers (no token, no write API). */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.HD2Repository = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const defaults = { repo: 'HyangDan2/diary', branch: 'main', path: 'diary-src/posts/' };
    const ownKey = 'hd2_md_viewer_repository_v1';
    const editorKey = 'hd2_md_github_v1';
    function normalize(input) {
        const v = input || {};
        return {
            repo: typeof v.repo === 'string' ? v.repo.trim() : defaults.repo,
            branch: typeof v.branch === 'string' ? v.branch.trim() || 'main' : defaults.branch,
            path: typeof v.path === 'string' ? v.path.trim().replace(/^\/+|\/+$/g, '') : defaults.path.replace(/\/$/, '')
        };
    }
    function valid(s) {
        return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(s.repo)
            && !s.repo.split('/').some(p => p === '.' || p === '..')
            && !s.path.split('/').some(p => p === '.' || p === '..')
            && !s.branch.split('/').some(p => p === '.' || p === '..' || !p)
            && !/[\s?#\\]/.test(s.branch);
    }
    function read(storage) {
        for (const key of [ownKey, editorKey]) {
            try {
                const value = JSON.parse(storage.getItem(key) || 'null');
                if (value && typeof value === 'object') {
                    const s = normalize(value);
                    if (valid(s)) return s;
                }
            } catch (error) { /* ignore malformed or unavailable storage */ }
        }
        return normalize(defaults);
    }
    function encodePath(path) { return path.split('/').filter(Boolean).map(encodeURIComponent).join('/'); }
    function listUrl(s) {
        if (!valid(s)) throw new Error('저장소 설정을 확인해 주세요.');
        return 'https://api.github.com/repos/' + encodePath(s.repo) + '/contents/' + encodePath(s.path) + '?ref=' + encodeURIComponent(s.branch);
    }
    function posts(items) {
        if (!Array.isArray(items)) throw new Error('폴더 경로를 입력해 주세요.');
        return items.filter(i => i && i.type === 'file' && /\.(md|markdown|mdown)$/i.test(i.name || '') && typeof i.path === 'string')
            .sort((a,b) => b.name.localeCompare(a.name));
    }
    function rawUrl(s, item) {
        if (!valid(s) || !item || typeof item.path !== 'string' || item.path.split('/').some(p => p === '.' || p === '..')) throw new Error('문서 경로를 확인해 주세요.');
        return 'https://raw.githubusercontent.com/' + encodePath(s.repo) + '/' + encodeURIComponent(s.branch) + '/' + encodePath(item.path);
    }
    return { defaults, ownKey, normalize, valid, read, listUrl, posts, rawUrl };
});
