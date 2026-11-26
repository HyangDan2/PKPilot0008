const {test}=require('node:test');const assert=require('node:assert/strict');
global.window={crypto:require('node:crypto').webcrypto};
const {collectImageRefs,buildBundle}=require('../../js/portable-export.js');
const md='---\ntitle: unchanged\nimage: "/diary/assets/cover.png"\nthumbnail: ../assets/thumb.png\ncover:\n  url: /diary/assets/cover.png\n  alt: keep\n---\n![body](/diary/assets/cover.png)\n![ref][pic]\n[pic]: ../assets/thumb.png\n<img src="/diary/assets/cover.png" srcset="../assets/thumb.png 2x">\n`![code](ignored.png)`';
test('metadata and body share same archive entries; original unchanged',async()=>{
 const bundle=await buildBundle(md,async url=>({bytes:new Uint8Array([url.includes('thumb')?2:1]),ext:'png'}),'post');
 assert.equal(bundle.images,2);
 assert.equal(bundle.replaced,7);
 assert.match(bundle.markdown,/title: unchanged/);
 assert.match(bundle.markdown,/alt: keep/);
 assert.match(bundle.markdown,/ignored.png/);
 for(const ref of collectImageRefs(bundle.markdown))assert.ok(bundle.assets.some(a=>'/'+a.path===ref.url),ref.url);
 assert.ok(md.includes('/diary/assets/cover.png'));
});
test('missing metadata image blocks export',async()=>assert.rejects(buildBundle('---\nimage: missing.png\n---\ntext',async()=>null,'post'),/missing.png/));
test('CRLF quoted metadata positions preserve comments',()=>{const s='---\r\nimage: "/assets/a.png" # note\r\n---\r\n';const refs=collectImageRefs(s);assert.equal(refs.length,1);assert.equal(s.slice(refs[0].start,refs[0].end),'/assets/a.png');});
