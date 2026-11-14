
const LOCAL_DB327='royal-local-materials327';
let local327,localTask327;
function db327(){return new Promise((resolve,reject)=>{const request=indexedDB.open(LOCAL_DB327,1);request.onupgradeneeded=()=>request.result.createObjectStore('packs');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function read327(){if(local327!==undefined)return local327;if(localTask327)return localTask327;localTask327=(async()=>{const db=await db327();try{return await new Promise((resolve,reject)=>{const req=db.transaction('packs').objectStore('packs').get('active');req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});}finally{db.close();}})();try{local327=await localTask327;if(local327)local327.map=new Map(local327.header.assets.map(row=>[row[0],row]));return local327;}finally{localTask327=null;}}
async function localResponse327(path){const pack=await read327();if(!pack)return null;let target=path;
 if(path.startsWith('/lineage163/')){const direct='/original163'+path;if(pack.map.has(direct))target=direct;
 const ui=path.match(/^\/lineage163\/(?:ui-redraw-v\d+|ui-windows-v\d+)\/(\d+c?)\.(?:webp|png)$/);if(ui)target='/original163/lineage163/ui/'+ui[1]+'.png';
 if(path==='/lineage163/potion-status-v3/haste.png')target='/original163/lineage163/item-icons/481.png';
 if(path==='/lineage163/potion-status-v3/brave.png')target='/original163/lineage163/item-icons/486.png';
 }
 const row=pack.map.get(target);if(!row)return null;return new Response(pack.file.slice(pack.start+row[3],pack.start+row[3]+row[2]),{headers:{'Content-Type':mime(target),'Cache-Control':'no-store','X-Royal-Material':pack.header.id}});
}
self.addEventListener('message',event=>{if(event.data?.type!=='local327')return;const port=event.ports[0];event.waitUntil((async()=>{try{local327=undefined;const pack=await read327();port?.postMessage({ok:true,active:pack?{id:pack.header.id,label:pack.header.label,count:pack.header.assets.length}:null});}catch{port?.postMessage({ok:false,error:'無法讀取本機素材，請檢查瀏覽器儲存設定。'});}})());});
