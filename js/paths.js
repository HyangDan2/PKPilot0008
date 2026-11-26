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

    /* Resolve next to the document first. Folder-based ../ paths must not
       silently pick a same-named image from an unrelated folder. */
    function findInLocalMap(map, value, docPath, rootPrefix) {
        if (!map || typeof map.get !== 'function') return null;
        var key = normalizePath(value);
        if (!key || isRemotePath(value)) return null;

        // Infer the actual package root from the selected post, not from the
        // outer folder chosen by the file picker (e.g. Downloads/export/posts).
        var parts = normalizePath(docPath || '').split('/');
        var postIndex = parts.lastIndexOf('posts', parts.length - 2);
        var packageDir = postIndex >= 0 ? parts.slice(0, postIndex).join('/') : null;
        var canonicalAsset = /^\/?assets\//i.test(String(value || ''));
        if (packageDir !== null && canonicalAsset) {
            var target = collapsePath((packageDir ? packageDir + '/' : '') + key);
            var packaged = map.get(target);
            if (packaged) return packaged;
            var added = map.get(key.split('/').pop());
            return added && !added.relative ? added : null;
        }
        var resolved = resolveRelativePath(docPath || '', value, rootPrefix || '');
        if (resolved) {
            var exact = map.get(resolved);
            if (exact) return exact;
        }
        if (key.indexOf('/') >= 0) {
            var direct = map.get(key);
            if (direct) return direct;
        }

        var name = key.split('/').pop();

        /* If the opened folder gives us a definite parent directory, do not
           fall back to some other folder's assets/. A separately chosen image
           (stored under its bare name) can still fill the missing reference. */
        if (rootPrefix && /(^|\/)\.\.(?:\/|$)/.test(String(value).replace(/\\/g, '/'))) {
            var manuallyAdded = map.get(name);
            return manuallyAdded && !manuallyAdded.relative ? manuallyAdded : null;
        }

        /* Loose matching is useful when only a single .md was opened, but
           only a UNIQUE candidate may be used. */
        var wanted = [resolved, key].filter(Boolean);
        var suffix = null;
        var ambiguous = false;
        map.forEach(function (entry, mapKey) {
            if (typeof mapKey !== 'string' || mapKey.indexOf('/') < 0) return;
            for (var i = 0; i < wanted.length; i += 1) {
                var want = wanted[i];
                if (mapKey === want
                    || mapKey.slice(-(want.length + 1)) === '/' + want
                    || want.slice(-(mapKey.length + 1)) === '/' + mapKey) {
                    if (suffix && suffix !== entry) ambiguous = true;
                    else suffix = entry;
                    break;
                }
            }
        });
        if (ambiguous) return null;
        if (suffix) return suffix;
        return name ? (map.get(name) || null) : null;
    }

    /* GitHub Pages project-root references may include the repository prefix.
       Keep the raw branch pinned; also retain the literal repository path as a fallback. */
    function rawAssetCandidates(sourceUrl, value) {
        var hit = /^(https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/(?:refs\/(?:heads|tags)\/)?[^/]+\/)/i.exec(String(sourceUrl || ''));
        var raw = String(value || '').trim();
        if (!hit || !raw || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) return [];
        var root = hit[1], repo = hit[3], tail = raw.replace(/^\/+/, '');
        if (raw.charAt(0) === '/') {
            var prefix = tail.split('/')[0];
            if (prefix.toLowerCase() === repo.toLowerCase() && tail.indexOf('/') >= 0) {
                return [root + tail.slice(prefix.length + 1), root + tail];
            }
            return [root + tail];
        }
        if (/^(?:\.\/)?assets\//i.test(raw)) return [root + raw.replace(/^\.\//, '')];
        return [];
    }

    return {
        rawAssetCandidates: rawAssetCandidates,
        normalizePath: normalizePath,
        dirnameOf: dirnameOf,
        basenameOf: basenameOf,
        isRemotePath: isRemotePath,
        collapsePath: collapsePath,
        resolveRelativePath: resolveRelativePath,
        findInLocalMap: findInLocalMap,
    };
});
