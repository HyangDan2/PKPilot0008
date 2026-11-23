/* ==========================================================================
   HD2Markdown Viewer · path helpers
   Pure functions shared by the viewer (browser) and the unit tests (Node).
   No DOM, no globals beyond the export below.
   ========================================================================== */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.HD2Paths = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    /* a comparable key: decoded, forward slashes, no query/hash, no leading ./ or / */
    function normalizePath(value) {
        var out = String(value == null ? '' : value).trim();
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

    function dirnameOf(value) {
        var path = String(value == null ? '' : value).replace(/\\/g, '/');
        var cut = path.lastIndexOf('/');
        return cut < 0 ? '' : path.slice(0, cut);
    }

    function basenameOf(value) {
        var path = String(value == null ? '' : value).replace(/\\/g, '/').split(/[?#]/)[0];
        var cut = path.lastIndexOf('/');
        return cut < 0 ? path : path.slice(cut + 1);
    }

    /* https://…, //host/…, data:, blob:, mailto: — anything with its own origin */
    function isRemotePath(value) {
        var raw = String(value == null ? '' : value).trim();
        return /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.indexOf('//') === 0;
    }

    /* collapse . and .. segments; a .. that climbs above the root is dropped */
    function collapsePath(value) {
        var out = [];
        String(value == null ? '' : value).split('/').forEach(function (segment) {
            if (!segment || segment === '.') return;
            if (segment === '..') { if (out.length) out.pop(); return; }
            out.push(segment);
        });
        return out.join('/');
    }

    /* the file an <img src> points at, resolved against the document that carries it:
       posts/doc.md + ../assets/a.png → assets/a.png (in a folder: root/posts/doc.md → root/assets/a.png).
       A leading / means the opened folder root (rootPrefix) or the repo root for a URL document. */
    function resolveRelativePath(docPath, imageSrc, rootPrefix) {
        var raw = String(imageSrc == null ? '' : imageSrc).trim();
        if (!raw) return '';
        if (isRemotePath(raw)) return '';
        var src = raw;
        try { src = decodeURIComponent(src); } catch (error) { /* keep the raw string */ }
        src = src.replace(/\\/g, '/').split('?')[0].split('#')[0];
        if (!src) return '';

        var docDir = dirnameOf(normalizePath(docPath || ''));
        var rootDir = collapsePath(normalizePath(rootPrefix || ''));
        var absolute = src.charAt(0) === '/';
        var base = absolute ? rootDir : docDir;
        var tail = absolute ? src.replace(/^\/+/, '') : src;
        return collapsePath(base ? base + '/' + tail : tail);
    }

    /* look a relative image up in the opened files:
       exact path first (resolved against the document), then any path ending in it, then the bare name */
    function findInLocalMap(map, value, docPath, rootPrefix) {
        if (!map || typeof map.get !== 'function') return null;
        var key = normalizePath(value);
        if (!key) return null;

        /* the path next to the document comes first, so two files with one name do not swap */
        var resolved = resolveRelativePath(docPath || '', value, rootPrefix || '');
        if (resolved) {
            var byResolved = map.get(resolved);
            if (byResolved) return byResolved;
        }
        if (key.indexOf('/') >= 0) {
            var direct = map.get(key);
            if (direct) return direct;
        }

        var wanted = [resolved, key].filter(Boolean);
        var suffix = null;
        map.forEach(function (entry, mapKey) {
            if (suffix) return;
            if (typeof mapKey !== 'string' || mapKey.indexOf('/') < 0) return;
            for (var i = 0; i < wanted.length; i += 1) {
                var want = wanted[i];
                if (!want) continue;
                if (mapKey === want || mapKey.slice(-(want.length + 1)) === '/' + want) { suffix = entry; return; }
                if (want.slice(-(mapKey.length + 1)) === '/' + mapKey) { suffix = entry; return; }
            }
        });
        if (suffix) return suffix;

        var name = key.split('/').pop();
        return name ? (map.get(name) || null) : null;
    }

    return {
        normalizePath: normalizePath,
        dirnameOf: dirnameOf,
        basenameOf: basenameOf,
        isRemotePath: isRemotePath,
        collapsePath: collapsePath,
        resolveRelativePath: resolveRelativePath,
        findInLocalMap: findInLocalMap,
    };
});
