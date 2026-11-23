/* Unit tests for js/paths.js — run with `npm test` (node --test tests/unit). */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const paths = require('../../js/paths.js');

test('normalizePath makes a comparable key', () => {
    assert.equal(paths.normalizePath('./A/B.PNG'), 'a/b.png');
    assert.equal(paths.normalizePath('assets\\img\\dot.png'), 'assets/img/dot.png');
    assert.equal(paths.normalizePath('  Assets/X.PNG?raw=1#top  '), 'assets/x.png');
    assert.equal(paths.normalizePath('/assets/a.png'), 'assets/a.png');
    assert.equal(paths.normalizePath('%ED%95%9C%EA%B8%80.png'), '한글.png');
    assert.equal(paths.normalizePath(null), '');
});

test('dirnameOf and basenameOf split a relative path', () => {
    assert.equal(paths.dirnameOf('root/posts/doc.md'), 'root/posts');
    assert.equal(paths.dirnameOf('doc.md'), '');
    assert.equal(paths.basenameOf('root/posts/doc.md'), 'doc.md');
    assert.equal(paths.basenameOf('C:\\docs\\a.md'.replace(/\\/g, '/')), 'a.md');
});

test('resolveRelativePath reads ../ against the document folder', () => {
    assert.equal(paths.resolveRelativePath('posts/doc.md', '../assets/sample.png'), 'assets/sample.png');
    assert.equal(paths.resolveRelativePath('root/posts/doc.md', '../assets/sample.png'), 'root/assets/sample.png');
    assert.equal(paths.resolveRelativePath('assets/doc.md', 'img/dot.png'), 'assets/img/dot.png');
    assert.equal(paths.resolveRelativePath('posts/doc.md', './same-folder.png'), 'posts/same-folder.png');
    /* a document opened by name alone has no folder: ../ climbs to the same root */
    assert.equal(paths.resolveRelativePath('doc.md', '../assets/x.png'), 'assets/x.png');
    assert.equal(paths.resolveRelativePath('', '../assets/x.png'), 'assets/x.png');
    /* too many .. stops at the root instead of escaping it */
    assert.equal(paths.resolveRelativePath('root/posts/doc.md', '../a.png'), 'root/a.png');
    assert.equal(paths.resolveRelativePath('root/posts/doc.md', '../../a.png'), 'a.png');
    assert.equal(paths.resolveRelativePath('posts/doc.md', '../../../../a.png'), 'a.png');
});

test('resolveRelativePath starts a leading / at the opened folder root', () => {
    assert.equal(paths.resolveRelativePath('root/posts/doc.md', '/assets/second.png', 'root'), 'root/assets/second.png');
    assert.equal(paths.resolveRelativePath('root/posts/doc.md', '/assets/second.png', 'root/'), 'root/assets/second.png');
    /* without a folder root the leading / is the repo root */
    assert.equal(paths.resolveRelativePath('root/posts/doc.md', '/assets/second.png'), 'assets/second.png');
});

test('resolveRelativePath leaves remote and inline sources alone', () => {
    assert.equal(paths.resolveRelativePath('posts/doc.md', 'https://example.com/a.png'), '');
    assert.equal(paths.resolveRelativePath('posts/doc.md', '//example.com/a.png'), '');
    assert.equal(paths.resolveRelativePath('posts/doc.md', 'data:image/png;base64,AAAA'), '');
    assert.equal(paths.resolveRelativePath('posts/doc.md', 'blob:http://localhost/abc'), '');
    assert.equal(paths.resolveRelativePath('posts/doc.md', ''), '');
});

test('resolveRelativePath decodes and drops query and hash', () => {
    assert.equal(paths.resolveRelativePath('posts/doc.md', '../assets/%ED%95%9C%EA%B8%80.png'), 'assets/한글.png');
    assert.equal(paths.resolveRelativePath('posts/doc.md', '../assets/a.png?v=2'), 'assets/a.png');
});

test('findInLocalMap prefers the path resolved against the document', () => {
    const map = new Map();
    const rootSample = { name: 'sample.png', relative: 'root/assets/sample.png' };
    const otherSample = { name: 'sample.png', relative: 'root/old/sample.png' };
    map.set('root/assets/sample.png', rootSample);
    map.set('root/old/sample.png', otherSample);
    map.set('sample.png', otherSample);

    assert.equal(
        paths.findInLocalMap(map, '../assets/sample.png', 'root/posts/doc.md', 'root'),
        rootSample,
        'the path next to the document wins over a bare file name',
    );
    assert.equal(paths.findInLocalMap(map, './sample.png', 'root/assets/doc.md', 'root'), rootSample);
    assert.equal(paths.findInLocalMap(map, 'old/sample.png', 'root/posts/doc.md', 'root'), otherSample);
});

test('findInLocalMap falls back to a suffix then the bare name', () => {
    const map = new Map();
    const only = { name: 'dot.png', relative: 'project/assets/img/dot.png' };
    map.set('project/assets/img/dot.png', only);
    map.set('dot.png', only);

    assert.equal(paths.findInLocalMap(map, '../assets/img/dot.png', 'project/posts/doc.md', 'project'), only);
    /* a document opened by name alone still finds it by the trailing path */
    assert.equal(paths.findInLocalMap(map, '../assets/img/dot.png', 'doc.md', ''), only);
    assert.equal(paths.findInLocalMap(map, 'dot.png', 'doc.md', ''), only);
    assert.equal(paths.findInLocalMap(map, 'nope.png', 'doc.md', ''), null);
});

test('findInLocalMap handles an empty map and empty values', () => {
    assert.equal(paths.findInLocalMap(new Map(), '../a.png', 'doc.md', ''), null);
    assert.equal(paths.findInLocalMap(null, '../a.png', 'doc.md', ''), null);
    assert.equal(paths.findInLocalMap(new Map(), '', 'doc.md', ''), null);
});

test('folder ../ assets do not fall back to unrelated same-named paths', () => {
    const map = new Map();
    const unrelated = { name: 'same.png', relative: 'root/old/assets/same.png' };
    map.set('root/old/assets/same.png', unrelated);
    assert.equal(paths.findInLocalMap(map, '../assets/same.png', 'root/posts/doc.md', 'root'), null);

    /* Files chosen with "이미지 추가" have no folder-relative path. */
    const manuallyAdded = { name: 'same.png', relative: '' };
    map.set('same.png', manuallyAdded);
    assert.equal(paths.findInLocalMap(map, '../assets/same.png', 'root/posts/doc.md', 'root'), manuallyAdded);
});

test('ambiguous folder suffixes are not resolved by iteration order', () => {
    const map = new Map();
    const a = { name: 'same.png', relative: 'first/assets/same.png' };
    const b = { name: 'same.png', relative: 'second/assets/same.png' };
    map.set(a.relative, a);
    map.set(b.relative, b);
    assert.equal(paths.findInLocalMap(map, '../assets/same.png', 'doc.md', ''), null);
});
