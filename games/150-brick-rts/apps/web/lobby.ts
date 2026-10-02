// The pre-game lobby (前置開場), after AoE II's single-player setup screen: the two players, the map with a live
// preview of the generated baseplate, and the match rules from packages/sim/settings.ts. The page shows it on load;
// 遊戲開始 sends a reset with these choices, 載入遊戲 lists the saves the page keeps. Only settings that change the real
// match are offered (the game is one against one on a fixed-size map: no teams, positions or extra players).
import {makeMap} from '../../packages/sim/navigation.ts';
import {placeRelics} from '../../packages/sim/religion.ts';
import {obstacleBounds} from '../../packages/content/footprints.ts';
import type {ObstacleKind} from '../../packages/content/footprints.ts';
import {civDefs,civById,neutralCiv} from '../../packages/content/civs.ts';
import {openings,standardOpening,randomOpening} from '../../packages/content/openings.ts';
import {defaultSettings,matchSettings,settingRules} from '../../packages/sim/settings.ts';
import type {MatchSettings} from '../../packages/sim/settings.ts';
import type {MapLayout} from '../../packages/sim/terrain.ts';
export type LobbyPrefs={name:string;blue:string;red:string;opponent:'ai'|'idle';aiOpening:string;layout:MapLayout;seed:string;settings:MatchSettings;record:boolean};
export type LobbyStart={name:string;seed:number;layout:MapLayout;opponent:'ai'|'idle';civs:[string,string];aiOpening:string;settings:MatchSettings;record:boolean};
export type SaveSlot={key:string;label:string;detail:string;raw:string};
export type LobbyDeps={start:(m:LobbyStart)=>Promise<void>;saves:()=>SaveSlot[];load:(slot:SaveSlot)=>Promise<void>;openTree:(civ:string)=>void;onClose:()=>void;
 colors:{terrain:Record<string,string>;obstacle:Record<string,string>;grass:string}};
const key='brick-rts:lobby:1';
const layouts:[MapLayout,string,string][]=[['open','曠野','32×32，隨機出生'],['lakes','湖畔','32×32，中央大湖，可造船'],['meadow','草甸','16×16 練習場'],['coast','海岸','16×16，南邊是海'],['acceptance','高地與淺灘','16×16，坡地與淺灘']];
const options={difficulty:[['easy','簡單'],['standard','標準'],['hard','困難'],['hardest','最難']],resources:[['low','低'],['standard','標準'],['medium','中'],['high','高']],
 reveal:[['normal','標準（戰爭迷霧）'],['explored','已探索'],['all','全部顯示']],startAge:[['1','黑暗時代'],['2','封建時代'],['3','城堡時代'],['4','帝王時代']],victory:[['standard','標準'],['conquest','征服']]} as const;
const hints:Record<string,Record<string,string>>={
 difficulty:{easy:'電腦思考慢一倍、村民少、兵力八名才出擊，第一波最早八分鐘',standard:'原本的電腦',hard:'村民多、四名就出擊，第一波最早三分鐘',hardest:'思考快一倍、村民最多，第一波最早兩分鐘'},
 resources:{},reveal:{normal:'只看得到單位與建築附近',explored:'整張地圖一開始就已探索，仍有戰爭迷霧',all:'雙方一直看得到整張地圖（電腦也是）'},
 startAge:{'1':'','2':'雙方從這個時代開始，時代加成與免費科技照樣生效','3':'雙方從這個時代開始，時代加成與免費科技照樣生效','4':'雙方從這個時代開始，時代加成與免費科技照樣生效'},
 victory:{standard:'消滅對手，或持有全部聖物、奇觀撐過倒數',conquest:'只有消滅對手才算勝利'}};
const stock=(r:keyof typeof settingRules.resources)=>{const s=settingRules.resources[r];return `食物 ${s.food}・木材 ${s.wood}・黃金 ${s.gold}・石頭 ${s.stone}`;};
for(const [v] of options.resources)hints.resources[v]=stock(v);
const playable=civDefs.filter(c=>c.id!==neutralCiv);
// Random civs are resolved here from the seed (a fixed integer mix, a different one per side), so the match, its log and
// its replay name real civilizations.
const randomCiv=(seed:number,salt:number)=>playable[(Math.imul((seed>>>0)^salt,0x85ebca6b)>>>0)%playable.length].id;
export const resolveCivs=(blue:string,red:string,seed:number):[string,string]=>[blue==='random'?randomCiv(seed,0x5bd1e995):blue,red==='random'?randomCiv(seed,0x9e3779b9):red];
export function defaultPrefs():LobbyPrefs{return {name:'藍方',blue:'britons',red:'franks',opponent:'ai',aiOpening:standardOpening,layout:'open',seed:'260925',settings:{...defaultSettings},record:false};}
export function loadPrefs():LobbyPrefs{const d=defaultPrefs();try{const v=JSON.parse(localStorage.getItem(key)??'null');if(!v||typeof v!=='object')return d;
 const civOk=(c:unknown)=>c==='random'||typeof c==='string'&&!!civById(c);let settings=d.settings;try{settings=matchSettings(v.settings??{});}catch{}
 return {name:typeof v.name==='string'&&v.name.trim()?v.name.trim().slice(0,16):d.name,blue:civOk(v.blue)?v.blue:d.blue,red:civOk(v.red)?v.red:d.red,opponent:v.opponent==='idle'?'idle':'ai',
  aiOpening:[standardOpening,randomOpening,...openings.map(o=>o.id)].includes(v.aiOpening)?v.aiOpening:d.aiOpening,layout:layouts.some(([l])=>l===v.layout)?v.layout:d.layout,
  seed:typeof v.seed==='string'&&/^\d{0,10}$/.test(v.seed)?v.seed:d.seed,settings,record:v.record===true};}catch{return d;}}
const savePrefs=(p:LobbyPrefs)=>{try{localStorage.setItem(key,JSON.stringify(p));}catch{}};
export function createLobby(deps:LobbyDeps){
 const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
 const root=el('lobby'),status=el('lobby-status'),canvas=el<HTMLCanvasElement>('lobby-preview'),ctx=canvas.getContext('2d');
 let prefs=loadPrefs(),returnable=false,busy=false,previewKey='',sweep=0;
 const fill=(id:string,list:readonly (readonly [string,string])[],title?:Record<string,string>)=>{const sel=el<HTMLSelectElement>(id);sel.replaceChildren(...list.map(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;if(title?.[v])o.title=title[v];return o;}));};
 const civList=(random:boolean)=>[...(random?[['random','隨機']]:[]),...playable.map(c=>[c.id,c.name]),[neutralCiv,`${civById(neutralCiv)!.name}（無加成）`]] as [string,string][];
 fill('lobby-blue',[['random','隨機'],...civList(false)]);fill('lobby-red',civList(true));
 fill('lobby-opponent',[['ai','電腦'],['idle','不行動（練習）']]);
 fill('lobby-opening',[[standardOpening,'標準'],[randomOpening,'隨機（對局後揭曉）'],...openings.map(o=>[o.id,o.zh] as [string,string])]);
 fill('lobby-layout',layouts.map(([v,t])=>[v,t]),Object.fromEntries(layouts.map(([v,,h])=>[v,h])));
 for(const k of ['difficulty','resources','reveal','startAge','victory'] as const)fill(`lobby-${k}`,options[k],hints[k]);
 fill('lobby-popCap',settingRules.popCaps.map(n=>[String(n),String(n)]));
 const sel=(id:string)=>el<HTMLSelectElement>(id);
 function write(){el<HTMLInputElement>('lobby-name').value=prefs.name;sel('lobby-blue').value=prefs.blue;sel('lobby-red').value=prefs.red;sel('lobby-opponent').value=prefs.opponent;sel('lobby-opening').value=prefs.aiOpening;
  sel('lobby-layout').value=prefs.layout;el<HTMLInputElement>('lobby-seed').value=prefs.seed;const s=prefs.settings;sel('lobby-difficulty').value=s.difficulty;sel('lobby-resources').value=s.resources;
  sel('lobby-popCap').value=String(s.popCap);sel('lobby-reveal').value=s.reveal;sel('lobby-startAge').value=String(s.startAge);sel('lobby-victory').value=s.victory;
  el<HTMLInputElement>('lobby-allTechs').checked=s.allTechs;el<HTMLInputElement>('lobby-record').checked=prefs.record;}
 function read():LobbyPrefs{const n=el<HTMLInputElement>('lobby-name').value.trim().slice(0,16);
  return {name:n||'藍方',blue:sel('lobby-blue').value,red:sel('lobby-red').value,opponent:sel('lobby-opponent').value==='idle'?'idle':'ai',aiOpening:sel('lobby-opening').value,layout:sel('lobby-layout').value as MapLayout,
   seed:el<HTMLInputElement>('lobby-seed').value.trim(),record:el<HTMLInputElement>('lobby-record').checked,
   settings:matchSettings({difficulty:sel('lobby-difficulty').value,resources:sel('lobby-resources').value,popCap:Number(sel('lobby-popCap').value),reveal:sel('lobby-reveal').value,startAge:Number(sel('lobby-startAge').value),victory:sel('lobby-victory').value,allTechs:el<HTMLInputElement>('lobby-allTechs').checked})};}
 const seedOf=(p:LobbyPrefs)=>{const v=p.seed===''?NaN:Number(p.seed);return Number.isSafeInteger(v)&&v>=0&&v<=4294967295?v:null;};
 // Notes under the choices: what each civ is, what random turned into, what each rule does.
 function notes(){const p=read(),seed=seedOf(p),[b,r]=resolveCivs(p.blue,p.red,seed??0),ai=p.opponent==='ai';
  const civ=(id:string,picked:string)=>{const c=civById(id);return `${picked==='random'?(seed===null?'隨機（輸入種子後決定）':`隨機：${c?.name}`):c?.name??id}・${c?.type??''}`;};
  el('lobby-blue-note').textContent=civ(b,p.blue);el('lobby-red-note').textContent=civ(r,p.red);
  for(const id of ['lobby-opening','lobby-difficulty'])sel(id).disabled=!ai;el('lobby-red-row').dataset.idle=String(!ai);
  for(const k of ['difficulty','resources','reveal','startAge','victory'] as const){const v=k==='startAge'?String(p.settings.startAge):p.settings[k];el(`lobby-${k}-note`).textContent=k==='difficulty'&&!ai?'紅方不行動時不適用':hints[k][v]??'';}
  el('lobby-popCap-note').textContent=`人口上限 ${p.settings.popCap}（文明加成另計）`;
  el('lobby-allTechs-note').textContent=p.settings.allTechs?'每個文明都能用所有共用的兵種、建築與科技；特殊單位仍屬各自的文明':'照各文明的科技樹';
  el('lobby-record-note').textContent=p.record?'對局中每一分鐘自動存檔一次（載入遊戲裡的「自動存檔」）':'不自動存檔（選單仍可手動儲存）';
  el<HTMLButtonElement>('lobby-start').disabled=busy||seed===null;el('lobby-seed-note').textContent=seed===null?'種子要是 0～4294967295 的整數':'同一個種子與地圖，每次生成同一張圖';
  drawPreview(p.layout,seed);}
 // The preview: the generated baseplate seen like the minimap (a diamond), one brick a tile with its stud, then the
 // forests, mines, berries, relics and both town centres. A new map sweeps in from the north corner.
 function drawPreview(layout:MapLayout,seed:number|null){if(!ctx)return;const k=`${layout}|${seed}`;if(k===previewKey&&canvas.width)return;previewKey=k;
  if(seed===null){ctx.clearRect(0,0,canvas.width,canvas.height);return;}
  const map=makeMap(seed,layout),relics=layout==='open'||layout==='lakes'?placeRelics(map,seed):[],N=map.size;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches,start=performance.now(),id=++sweep;
  const paint=(now:number)=>{if(id!==sweep||!ctx)return;const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2),W=Math.max(1,Math.round(r.width*dpr)),H=Math.max(1,Math.round(r.height*dpr));
   if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;}ctx.setTransform(dpr,0,0,dpr,0,0);const w=r.width,h=r.height;ctx.clearRect(0,0,w,h);
   const s=Math.min(w/(2*N),h/N)*.96,ox=w/2,oy=(h-N*s)/2,P=(x:number,z:number):[number,number]=>[ox+(x-z)*s,oy+(x+z)*s/2];
   const done=reduce?Infinity:(now-start)/420*2*N;
   const quad=(x0:number,z0:number,x1:number,z1:number)=>{ctx.beginPath();for(const [i,[x,z]] of ([[x0,z0],[x1,z0],[x1,z1],[x0,z1]] as const).entries()){const [px,py]=P(x,z);if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);}ctx.closePath();ctx.fill();};
   const shade=(hex:string,f:number)=>{const n=parseInt(hex.slice(1),16);return `rgb(${Math.min(255,Math.round((n>>16&255)*f))},${Math.min(255,Math.round((n>>8&255)*f))},${Math.min(255,Math.round((n&255)*f))})`;};
   map.tiles.forEach((t,i)=>{const x=i%N,z=Math.floor(i/N);if(x+z>done)return;const base=deps.colors.terrain[t.terrainType]??deps.colors.grass;
    ctx.fillStyle=shade(base,.9);quad(x,z,x+1,z+1);ctx.fillStyle=base;quad(x+.06,z+.06,x+.94,z+.94);
    if(s>=5){const [cx,cy]=P(x+.5,z+.5);ctx.fillStyle=shade(base,1.12);ctx.beginPath();ctx.ellipse(cx,cy-s*.08,s*.28,s*.14,0,0,Math.PI*2);ctx.fill();}});
   for(const o of map.obstacles){const [x0,z0,x1,z1]=obstacleBounds(o as {kind:ObstacleKind;x:number;y:number});if(x0/100+z0/100>done)continue;
    ctx.fillStyle=o.kind==='town-center'?(o.red?'#d0664c':'#5d93b6'):deps.colors.obstacle[o.kind]??'#c8c2a8';quad(x0/100,z0/100,x1/100,z1/100);}
   for(const rel of relics){if(rel.x/100+rel.y/100>done)continue;const [px,py]=P(rel.x/100,rel.y/100);ctx.fillStyle='#f2d66b';ctx.strokeStyle='#15201b';ctx.lineWidth=1;ctx.beginPath();ctx.arc(px,py,Math.max(2.5,s*.4),0,Math.PI*2);ctx.fill();ctx.stroke();}
   if(done<2*N+2)requestAnimationFrame(paint);};
  paint(reduce?start:performance.now());}
 async function begin(){const p=read(),seed=seedOf(p);if(seed===null||busy)return;busy=true;notes();prefs=p;savePrefs(p);status.textContent='建立對局中…';
  try{await deps.start({name:p.name,seed,layout:p.layout,opponent:p.opponent,civs:resolveCivs(p.blue,p.red,seed),aiOpening:p.opponent==='ai'?p.aiOpening:standardOpening,settings:p.settings,record:p.record});status.textContent='';close();}
  catch(e){status.textContent=`無法開始：${(e as Error).message}`;}finally{busy=false;notes();}}
 function listSaves(){const box=el('lobby-saves'),slots=deps.saves();box.hidden=!box.hidden;el('lobby-load').setAttribute('aria-expanded',String(!box.hidden));if(box.hidden)return;
  if(!slots.length){box.replaceChildren(Object.assign(document.createElement('p'),{className:'lobby-empty',textContent:'這個瀏覽器還沒有存檔：對局中從選單「儲存遊戲」，或勾選「記錄遊戲」自動存檔。'}));return;}
  box.replaceChildren(...slots.map(slot=>{const b=document.createElement('button');b.type='button';b.className='lobby-save';const t=document.createElement('b');t.textContent=slot.label;const d=document.createElement('span');d.textContent=slot.detail;b.append(t,d);
   b.onclick=async()=>{if(busy)return;busy=true;status.textContent=`讀取「${slot.label}」：依指令紀錄重新推導對局…`;try{await deps.load(slot);status.textContent='';close();}catch(e){status.textContent=`讀取失敗：${(e as Error).message}`;}finally{busy=false;notes();}};return b;}));}
 function open(canReturn:boolean){returnable=canReturn;prefs=loadPrefs();write();el('lobby-saves').hidden=true;el('lobby-load').setAttribute('aria-expanded','false');el('lobby-cancel').hidden=!returnable;status.textContent='';root.hidden=false;previewKey='';notes();el<HTMLButtonElement>('lobby-start').focus({preventScroll:true,focusVisible:false} as FocusOptions);}
 function close(){root.hidden=true;deps.onClose();}
 for(const id of ['lobby-name','lobby-seed'])el(id).addEventListener('input',notes);
 for(const id of ['lobby-blue','lobby-red','lobby-opponent','lobby-opening','lobby-layout','lobby-difficulty','lobby-resources','lobby-popCap','lobby-reveal','lobby-startAge','lobby-victory','lobby-allTechs','lobby-record'])el(id).addEventListener('change',notes);
 el('lobby-reroll').onclick=()=>{const v=new Uint32Array(1);crypto.getRandomValues(v);el<HTMLInputElement>('lobby-seed').value=String(v[0]);notes();};
 el('lobby-start').onclick=()=>void begin();el('lobby-load').onclick=listSaves;el('lobby-tree').onclick=()=>{const p=read(),[b]=resolveCivs(p.blue,p.red,seedOf(p)??0);deps.openTree(b);};
 el('lobby-cancel').onclick=()=>{if(returnable)close();};
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&returnable){e.preventDefault();close();}else if(e.key==='Enter'&&(e.target as HTMLElement).tagName!=='BUTTON'&&(e.target as HTMLElement).tagName!=='SELECT'){e.preventDefault();void begin();}});
 new ResizeObserver(()=>{if(!root.hidden){previewKey='';const p=read();drawPreview(p.layout,seedOf(p));}}).observe(canvas);
 return {open,close,isOpen:()=>!root.hidden,prefs:()=>prefs};
}
