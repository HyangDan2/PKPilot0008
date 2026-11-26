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

test('inline image arrays and quoted social image keys are remapped',async()=>{const input='---\nimages: ["/diary/assets/a.png", "../assets/b.png"] # keep\n"og:image": /diary/assets/a.png\n---\n![a](/diary/assets/a.png)';const result=await buildBundle(input,async url=>({bytes:Uint8Array.of(url.includes('b.png')?2:1),ext:'png'}),'post');assert.equal(result.replaced,4);assert.equal(result.images,2);assert.ok(!result.markdown.includes('/diary/assets/'));assert.ok(result.markdown.includes('# keep'));});

test('asset link label and destination use the same packaged path',async()=>{
 const input='---\nimage: /diary/assets/images/a.png\n---\n[/assets/images/a.png](/diary/assets/images/a.png)\n[download](/diary/assets/images/a.png)\n![picture](/diary/assets/images/a.png)\n[ref][a]\n[a]: /diary/assets/images/a.png\n<a href="/diary/assets/images/a.png">view</a>\n[external](https://example.com/docs)\n`[code](/diary/assets/images/a.png)`';
 const result=await buildBundle(input,async()=>({bytes:Uint8Array.of(1),ext:'png'}),'post');
 const path='/'+result.assets[0].path;
 assert.equal(result.images,1);
 assert.ok(result.markdown.includes('['+path+']('+path+')'));
 assert.ok(result.markdown.includes('[download]('+path+')'));
 assert.ok(result.markdown.includes('image: '+path));
 assert.ok(result.markdown.includes('[a]: '+path));
 assert.ok(result.markdown.includes('href="'+path+'"'));
 assert.ok(result.markdown.includes('[external](https://example.com/docs)'));
 assert.ok(result.markdown.includes('`[code](/diary/assets/images/a.png)`'));
 assert.ok(collectImageRefs(result.markdown).every(ref=>ref.url===path));
});
