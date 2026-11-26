/* Portable Export Contract: identical in editor and reader. */
(function(root){
'use strict';
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
    function collectBodyImageRefs(src) {
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


function imageMetadataRefs(text) {
    const fm = /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
    if (!fm) return { refs: [], end: 0 };
    const offset = fm[0].indexOf('\n') + 1;
    const refs = [];
    const keyPattern = /^(?:image|images|cover|coverimage|coverurl|thumbnail|thumbnailimage|thumbnailurl|ogimage|twitterimage|featuredimage|heroimage|banner|bannerimage|socialimage|previewimage|imageurl|imagepath|poster)$/i;
    let active = false, parentIndent = 0, cursor = offset;
    function add(value, start) {
        const leading = value.match(/^\s*/)[0].length;
        let raw = value.slice(leading);
        start += leading;
        if (!raw || /^(?:null|~)(?:\s+#.*)?$/i.test(raw) || raw.startsWith('#')) return;
        let hit;
        if (raw[0] === '"' || raw[0] === "'") {
            const q = raw[0];
            const stop = raw.indexOf(q, 1);
            if (stop < 0 || !/^\s*(?:#.*)?$/.test(raw.slice(stop + 1))) throw new Error('Unsupported quoted image metadata');
            hit = raw.slice(1, stop);
            start++;
        } else {
            if (/^[|>{[\]&*!]/.test(raw)) throw new Error('Unsupported image metadata format; use a scalar path or nested url/path/src.');
            hit = raw.replace(/\s+#.*$/, '').trimEnd();
        }
        if (hit) refs.push({url: hit, start, end: start + hit.length});
    }
    for (const line of fm[1].split(/\r?\n/)) {
        const pair = /^(\s*)([\w-]+)\s*:\s*(.*)$/.exec(line);
        if (pair) {
            const indent = pair[1].length, key = pair[2].replace(/[-_]/g, '');
            if (active && indent <= parentIndent) active = false;
            if (keyPattern.test(key)) {
                active = true; parentIndent = indent;
                add(pair[3], cursor + line.length - pair[3].length);
            } else if (active && /^(?:url|path|src|href)$/i.test(key)) {
                add(pair[3], cursor + line.length - pair[3].length);
            }
        } else if (active) {
            const item = /^(\s*)-\s+(.*)$/.exec(line);
            if (item && item[1].length >= parentIndent) add(item[2], cursor + line.length - item[2].length);
        }
        cursor += line.length + (text.slice(cursor + line.length, cursor + line.length + 2) === '\r\n' ? 2 : 1);
    }
    return {refs, end: fm[0].length};
}
function additionalBodyRefs(text, ranges, inRanges, cleanImageUrl) {
    const refs = [], definitions = new Map(), used = new Set();
    const label = s => s.trim().replace(/\s+/g,' ').toLowerCase();
    let hit;
    const refImage = /!\[([^\]\n]*)\](?:\[([^\]\n]*)\])?(?!\()/g;
    while ((hit = refImage.exec(text))) {
        if (inRanges(hit.index, ranges) || text[hit.index + hit[0].length] === '(') continue;
        used.add(label(hit[2] || hit[1]));
    }
    const definition = /^ {0,3}\[([^\]\n]+)\]:[ \t]*(<[^>\n]+>|[^\s]+)(?:[ \t]+.*)?$/gm;
    while ((hit = definition.exec(text))) {
        if (inRanges(hit.index, ranges) || !used.has(label(hit[1])) || definitions.has(label(hit[1]))) continue;
        const raw = hit[2], wrapped = raw.startsWith('<') && raw.endsWith('>');
        const start = hit.index + hit[0].indexOf(raw, hit[0].indexOf(']:') + 2) + (wrapped ? 1 : 0);
        definitions.set(label(hit[1]), true);
        refs.push({url:cleanImageUrl(wrapped ? raw.slice(1,-1):raw),start,end:start+raw.length-(wrapped?2:0)});
    }
    const tags = /<(?:img|source)\b[^>]*>/gi;
    while ((hit = tags.exec(text))) {
        if (inRanges(hit.index,ranges)) continue;
        const attr = /(?:^|\s)srcset\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(hit[0]);
        if (!attr) continue;
        const raw = attr[1] ?? attr[2] ?? attr[3];
        if (/\bdata:/i.test(raw)) throw new Error('Inline data URI in srcset is unsupported; use an img src.');
        const base = hit.index + attr.index + attr[0].indexOf(raw,attr[0].indexOf('=')+1);
        const candidate = /(?:^|,)\s*([^\s,]+)(?:\s+[^,]+)?/g;
        let m;
        while ((m=candidate.exec(raw))) {
            const start=base+m.index+m[0].indexOf(m[1]);
            refs.push({url:cleanImageUrl(m[1]),start,end:start+m[1].length});
        }
    }
    return refs;
}
function collectImageRefs(input) {
 const text=String(input||''); const fm=imageMetadataRefs(text);
 const body=text.slice(fm.end); const ranges=codeRanges(body);
 const bodyRefs=collectBodyImageRefs(body).concat(additionalBodyRefs(body,ranges,inRanges,cleanImageUrl));
 const refs=fm.refs.concat(bodyRefs.map(r=>({...r,start:r.start+fm.end,end:r.end+fm.end})));
 return Array.from(new Map(refs.filter(r=>r.url).map(r=>[r.start+':'+r.end,r])).values());
}
async function buildBundle(markdown, collectImage, slug) {
 const text=String(markdown||''); const refs=collectImageRefs(text);
 const pending=Array.from(new Set(refs.map(r=>r.url)));
 const resolved=new Map(), assets=[], hashes=new Map(), missing=[];
 for(const url of pending) {
   const image=await collectImage(url);
   if(!image || !image.bytes || !image.bytes.length) { missing.push(url); continue; }
   const hash=await sha256Hex(image.bytes);
   let path=hashes.get(hash);
   if(!path) {
     const ext=/^[a-z0-9]{1,8}$/i.test(image.ext||'')?image.ext.toLowerCase():'png';
     path='assets/'+hash+'.'+ext; hashes.set(hash,path); assets.push({path,bytes:image.bytes});
   }
   resolved.set(url,'/'+path);
 }
 if(missing.length) throw new Error('이미지 '+missing.length+'개 누락: '+missing.map(x=>x.slice(0,160)).join(', '));
 let output=text;
 for(const ref of refs.slice().sort((a,b)=>b.start-a.start)) output=output.slice(0,ref.start)+resolved.get(ref.url)+output.slice(ref.end);
 const hash8=(await sha256Hex(new TextEncoder().encode(output))).slice(0,8);
 return {markdown:output,assets,replaced:refs.length,missed:0,images:assets.length,duplicates:Math.max(0,refs.length-assets.length),hash8,slug};
}
const api={collectImageRefs,buildBundle,imageMetadataRefs};
if(typeof module==='object'&&module.exports)module.exports=api; else root.PortableExport=api;
})(typeof window!=='undefined'?window:globalThis);
