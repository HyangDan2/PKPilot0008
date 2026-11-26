/* Shared local import contract. */
(function(root){'use strict';
function packageRoot(docPath, fallback='') {
    const parts=String(docPath||'').replace(/\\/g,'/').split('/').filter(Boolean);
    const index=parts.lastIndexOf('posts',parts.length-2);
    return index>=0?parts.slice(0,index).join('/'):fallback;
}
function isZip(file){return !!file&&/\.zip$/i.test(file.name||'')}
async function readPackage(file,JSZip,makeFile=(bytes,name)=>new File([bytes],name)) {
    if(!JSZip||!isZip(file))throw Error('ZIP 파일을 열 수 없습니다.');
    if(file.size>100*1024*1024)throw Error('ZIP 크기는 100MB 이하로 제한됩니다.');
    const zip=await JSZip.loadAsync(await file.arrayBuffer());
    const entries=Object.values(zip.files).filter(e=>!e.dir);
    if(entries.length>2000)throw Error('ZIP 파일 개수 제한을 초과했습니다.');
    const records=[];let total=0;const names=new Set();
    for(const entry of entries){
        const path=entry.name;
        if(entry.unsafeOriginalName&&entry.unsafeOriginalName!==path)throw Error('안전하지 않은 ZIP 경로');
        if(!/^(?:posts|assets)\/[^/]/.test(path)||path.includes('\\')||path.split('/').some(x=>x==='.'||x==='..'||!x))throw Error('표준 ZIP은 posts/와 assets/만 지원합니다: '+path);
        if(names.has(path.toLowerCase()))throw Error('중복 ZIP 경로: '+path);
        names.add(path.toLowerCase());
        if(path.startsWith('posts/')&&!/\.(?:md|markdown|mdown|txt)$/i.test(path))continue;
        const declared=entry._data&&entry._data.uncompressedSize;
        if(Number.isFinite(declared)&&total+declared>100*1024*1024)throw Error('압축 해제 용량 제한 초과');
        const bytes=await entry.async('uint8array');total+=bytes.length;
        if(total>100*1024*1024)throw Error('압축 해제 용량 제한 초과');
        records.push({file:makeFile(bytes,path.split('/').pop()),relative:path});
    }
    if(!records.some(r=>r.relative.startsWith('posts/')))throw Error('ZIP에 posts/ 문서가 없습니다.');
    return records;
}
function fileRecord(item) {
    if(!item)return null;
    if(item.file&&typeof item.file.name==='string')return {file:item.file,relative:String(item.relative||item.file.webkitRelativePath||'')};
    if(typeof item.name==='string')return {file:item,relative:String(item.webkitRelativePath||'')};
    return null;
}
const api={packageRoot,isZip,readPackage,fileRecord};if(typeof module==='object'&&module.exports)module.exports=api;else root.PortableImport=api;
})(typeof window!=='undefined'?window:globalThis);
