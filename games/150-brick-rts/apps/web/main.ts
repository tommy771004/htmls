import {mountFogDebugger} from './fog-debug.ts';
import {createAudio} from './audio.ts';
import type {MapLayout} from '../../packages/sim/terrain.ts';
import {rules,validateRules,resources} from '../../packages/content/rules.ts';
import {createScene} from './scene.ts';
import {SimulationClient} from './worker-client.ts';
import type {View} from '../../packages/sim/protocol.ts';
import {obstacleBounds} from '../../packages/content/footprints.ts';
import {clearSegment} from '../../packages/sim/navigation.ts';
import type {ObstacleKind} from '../../packages/content/footprints.ts';
import {placementProblem,buildKinds,buildingRules,buildRequirement} from '../../packages/sim/buildings.ts';
import {trainBlocker,ageOf} from '../../packages/sim/production.ts';
import {combatRules} from '../../packages/sim/stats.ts';
import {religionRules} from '../../packages/sim/religion.ts';
import {terrainRules} from '../../packages/sim/terrain.ts';
import {economyRules} from '../../packages/sim/economy.ts';
import type {BuildKind} from '../../packages/sim/buildings.ts';
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
// ?debug=1 shows the engineering drawer (step, hash, coordinates, fog and rules tools) and starts paused;
// a normal visit is only the game screen and the match starts running as soon as the simulation connects.
const debug=new URLSearchParams(location.search).has('debug');el('debug').hidden=!debug;
let state:View={seed:rules.settings.seed,layout:debug?'meadow':'open',size:debug?16:32,opponent:debug?'idle':'ai',terrain:[],tick:0,units:[],corpses:[],outcome:null,economy:{stock:{food:0,wood:0,gold:0,stone:0},populationUsed:0,populationReserved:0,populationCap:0,age:1,techs:[]},buildings:[],transactions:[],fog:[],known:[],resources:[],stateHash:'—',relicSpots:[],relicsHeld:[0,0],relicTotal:0,relicVictory:null};
const resourceNames:Record<string,string>={food:'食物',wood:'木材',gold:'黃金',stone:'石頭'};
const workLabel:Record<string,string>={toSource:'前往採集',gathering:'採集中',toDropoff:'送返城鎮中心',toSite:'前往工地',building:'施工中'};
const buildingNames:Record<string,string>={house:'住宅',barracks:'兵營',farm:'農田','lumber-camp':'伐木場','mining-camp':'採礦場',mill:'磨坊',stable:'馬廄','archery-range':'靶場',monastery:'修道院','town-center':'城鎮中心'};
const homeKinds=new Set(['house','barracks','farm','lumber-camp','mining-camp','mill','stable','archery-range','monastery','town-center']);
const layoutNames:Record<MapLayout,string>={meadow:'草甸',coast:'海岸',acceptance:'高地與淺灘',open:'曠野'};
let placing:BuildKind|null=null,selectedBuilding:string|null=null,lastTransaction=0,preview:{x:number;y:number;problem:string|null}|null=null;
let scene:Awaited<ReturnType<typeof createScene>>|null=null,graphicsFailed=false,icons:Record<string,string>={};
// speed: sim ticks per 50 ms of wall time; every tick still runs, in order.
let speed=1,selected=new Set<number>([1]),running=false,last=0,accumulator=0,advancing=false,connected=false;
let noticeTimer=0;
// Rejections read as plain sentences; the tick/request/entity prefix is engineering detail shown only with ?debug=1.
const reason=(e:unknown)=>{const m=(e as Error).message;return debug?m:m.replace(/^tick \d+ \/ request \d+( \/ entity \d+)?：/,'');};
const notice=(s:string)=>{const n=el('notice');n.textContent=s;n.classList.remove('stale');clearTimeout(noticeTimer);noticeTimer=window.setTimeout(()=>n.classList.add('stale'),6000);};
const canvas=el<HTMLCanvasElement>('map');
// Sound: the audio context starts on the first click or key (autoplay rules); body data attributes record what played.
const audio=createAudio((name,count)=>{document.body.dataset.lastSound=name;document.body.dataset.sounds=String(count);});
for(const type of ['pointerdown','keydown'])document.addEventListener(type,()=>{audio.unlock();document.body.dataset.audio=audio.state();},{capture:true});
// Player settings (graphics quality, volume): a per-browser convenience; unreadable storage just means defaults.
type Settings={quality:'high'|'medium'|'low';volume:number};const settingsKey='brick-rts:settings:1';
function loadSettings():Settings{try{const v=JSON.parse(localStorage.getItem(settingsKey)??'null');if(v&&['high','medium','low'].includes(v.quality)&&Number.isFinite(v.volume))return {quality:v.quality,volume:Math.max(0,Math.min(100,v.volume))};}catch{}return {quality:'high',volume:60};}
const settings=loadSettings();
function saveSettings(){try{localStorage.setItem(settingsKey,JSON.stringify(settings));}catch{}}
function applySettings(){el<HTMLSelectElement>('quality').value=settings.quality;el<HTMLInputElement>('volume').value=String(settings.volume);el('volume-value').textContent=`${settings.volume}%`;audio.setVolume(settings.volume/100);scene?.setQuality(settings.quality);}
el('quality').addEventListener('change',()=>{settings.quality=el<HTMLSelectElement>('quality').value as Settings['quality'];saveSettings();applySettings();notice(`畫質：${({high:'高',medium:'中',low:'低'})[settings.quality]}。`);});
el('volume').addEventListener('input',()=>{settings.volume=Number(el<HTMLInputElement>('volume').value);saveSettings();applySettings();});
el('volume').addEventListener('change',()=>audio.play('order'));
applySettings();
const fogDebugger=mountFogDebugger(el<HTMLDetailsElement>('fog-debug'),()=>state);
// Icons are renders of the game's own brick models; until they exist the image keeps no src at all.
function setImg(img:HTMLImageElement,key:string){const src=icons[key];if(!src){img.removeAttribute('src');return;}if(img.getAttribute('src')!==src)img.src=src;}
function applyIcons(root:ParentNode=document){root.querySelectorAll<HTMLImageElement>('img[data-icon]').forEach(img=>setImg(img,img.dataset.icon!));}
const ownUnits=()=>state.units.filter(u=>u.player===0);
const chosenUnits=()=>state.units.filter(u=>selected.has(u.id)&&u.player===0).sort((a,b)=>a.id-b.id);
function render(){
 fogDebugger.update();
 if(!graphicsFailed){try{scene?.update(state,selected);}catch(error){graphicsError(`3D 場景更新失敗：${(error as Error).message}`);}}
 el('fog-status').textContent=`可見 ${state.fog.filter(v=>v===2).length} 格 · 已探索舊視野 ${state.fog.filter(v=>v===1).length} 格 · 未探索 ${state.fog.filter(v=>v===0).length} 格`;
 el('world-label').textContent=({meadow:'草甸試驗場',coast:'海岸試驗場',acceptance:'高地與淺灘驗收場',open:'曠野對戰圖'} as Record<MapLayout,string>)[state.layout];
 el('tick').textContent=String(state.tick);el('hash').textContent=state.stateHash;
 // HUD numbers come straight from the Worker's account projection; nothing is counted in the page.
 const e=state.economy;el('stock').textContent=state.stateHash==='—'?'資源載入中…':`${ageNames[e.age]} · 食物 ${e.stock.food} · 木材 ${e.stock.wood} · 黃金 ${e.stock.gold} · 石頭 ${e.stock.stone} · 人口 ${e.populationUsed}/${e.populationCap}`;
 renderTop();renderBuild();renderBuilding();renderSelection();renderNote();reportTransactions();reportEvents();renderOutcome();renderIdle();
 const chosen=chosenUnits();
 el('selection-list').textContent=chosen.length>1?chosen.map(u=>`${unitNames[u.kind]} ${u.id} (${(u.x/100).toFixed(1)}, ${(u.y/100).toFixed(1)})：${activity(u)}`).join('　'):'';
 const u=chosen[0];if(!u){el('position').textContent='未選取單位';return;}
 el('position').textContent=`${chosen.length>1?`${chosen.length} 名選取 · `:''}${unitNames[u.kind]} ${u.id} · (${(u.x/100).toFixed(1)}, ${(u.y/100).toFixed(1)}) · ${activity(u)}`;
}
function renderTop(){const e=state.economy;for(const r of resources)el(`res-${r}`).textContent=String(e.stock[r]);
 // Villagers on each resource (walking to it, working it or carrying it home), as the original shows under each icon.
 const crews:Record<string,number>={food:0,wood:0,gold:0,stone:0};for(const u of ownUnits())if(u.workResource&&u.work&&u.work!=='toSite'&&u.work!=='building')crews[u.workResource]++;
 for(const r of resources){const c=el(`crew-${r}`);c.textContent=crews[r]?String(crews[r]):'';c.title=`${crews[r]} 名村民採${resourceNames[r]}`;}
 el('res-pop').textContent=`${e.populationUsed}/${e.populationCap}`;
 // Relics: own and red's count in monasteries out of all on the map, and the relic-victory countdown when one runs.
 {const box=el('relics');box.hidden=!state.relicTotal;if(state.relicTotal){const v=state.relicVictory,left=v?Math.max(0,v.endsTick-state.tick):0,mmss=`${String(Math.floor(left/1200)).padStart(2,'0')}:${String(Math.floor(left/20)%60).padStart(2,'0')}`;
  el('res-relics').textContent=`${state.relicsHeld[0]}·${state.relicsHeld[1]}/${state.relicTotal}${v?` ${mmss}`:''}`;box.classList.toggle('full',!!v&&v.player===1);
  box.title=`聖物：藍方 ${state.relicsHeld[0]}、紅方 ${state.relicsHeld[1]}，共 ${state.relicTotal} 個${v?`；${v.player===0?'藍方':'紅方'}持有全部聖物，${mmss} 後獲勝`:''}`;}}el('pop').classList.toggle('full',e.populationCap>0&&e.populationUsed+e.populationReserved>=e.populationCap);
 el('pop').title=`人口 ${e.populationUsed}／上限 ${e.populationCap}${e.populationReserved?`（佇列保留 ${e.populationReserved}）`:''}`;
 el('age-name').textContent=ageNames[e.age];const t=Math.floor(state.tick/rules.settings.tickHz),mm=Math.floor(t/60),ss=t%60;el('clock').textContent=`${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
 el('sel-empty-title').textContent=`藍方 · ${layoutNames[state.layout]} · 對手：${state.opponent==='ai'?'電腦':'不行動'}`;}
// A monk also shows its faith (conversion needs a full charge).
const doing=(u:View['units'][number])=>u.relic&&!u.rite?'攜帶聖物':u.rite?(u.rite==='convert'?'轉化中':'治療中'):u.faith!==null&&u.faith<100?`信仰恢復中 ${u.faith}%`:u.action===1?'攻擊中':u.work&&u.navigation!=='waiting'&&u.navigation!=='stuck'?workLabel[u.work]:statusLabel[u.navigation];
function activity(u:View['units'][number]){const life=u.hp<u.maxHp?` · 生命 ${u.hp}/${u.maxHp}`:'';return (u.cargo?`${doing(u)} · 攜帶${resourceNames[u.cargo.resource]} ${u.cargo.amount}`:doing(u))+life;}
// Monks: convert an enemy unit, or heal an own one. Other selected units are left to the caller.
async function rite(kind:'convert'|'heal'|'relic',monkIds:number[],targetId:number,label:string){
 try{await client.request(kind==='relic'?{kind,unitIds:monkIds,relicId:targetId}:{kind,unitIds:monkIds,targetId});audio.play(kind==='convert'?'convert':'order');notice(`${names(monkIds)} ${({convert:'轉化',heal:'治療',relic:'前往撿起'} as const)[kind]}${label}。${running?'':resumeHint()}`);}catch(e){notice(reason(e));}}
async function riteOn(monkIds:number[],buildingId:string,label:string){
 try{await client.request({kind:'convert',unitIds:monkIds,buildingId});audio.play('convert');notice(`${names(monkIds)} 轉化${label}。${running?'':resumeHint()}`);}catch(e){notice(reason(e));}}
async function deposit(monkIds:number[],buildingId:string){
 try{await client.request({kind:'deposit',unitIds:monkIds,buildingId});audio.play('order');notice(`${names(monkIds)} 把聖物送進修道院。${running?'':resumeHint()}`);}catch(e){notice(reason(e));}}
async function attack(target:{kind:'unit';id:number}|{kind:'building';id:string},label:string){const unitIds=[...selected].filter(id=>state.units.find(u=>u.id===id)?.kind!=='monk').sort((a,b)=>a-b);if(!unitIds.length){notice(selected.size?'僧侶不能攻擊：右鍵敵方單位改為轉化。':'請先選取單位。');return;}
 try{await client.request({kind:'attack',unitIds,target});audio.play('order-attack');notice(`${names(unitIds)} 攻擊${label}。${running?'':resumeHint()}`);}catch(e){notice(reason(e));}}
function enemyBuildingAt(x:number,y:number,id?:string){if(id){const o=state.known.map(k=>k.obstacle).find(o=>o.id===id&&o.red);if(o)return o;}const p={x:Math.round(x*100),y:Math.round(y*100)};return state.known.map(k=>k.obstacle).find(o=>homeKinds.has(o.kind)&&o.red&&(()=>{const [x0,y0,x1,y1]=obstacleBounds(o);return p.x>=x0&&p.x<=x1&&p.y>=y0&&p.y<=y1;})());}
const statusLabel:Record<string,string>={idle:'待命',searching:'尋路中',moving:'移動中',waiting:'等待讓路',unreachable:'無法到達，停在最近點',stuck:'受阻停止'};
const resumeHint=()=>debug?'按「開始」或「前進 1 tick」執行。':'繼續遊戲（▶）後執行。';
const playIcon='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>',pauseIcon='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z"/></svg>';
function setRunning(v:boolean){running=v;accumulator=0;last=0;const p=el('pause');p.innerHTML=v?pauseIcon:playIcon;p.setAttribute('aria-label',v?'暫停（F3）':'開始（F3）');p.setAttribute('aria-pressed',String(v));
 el('run-state').textContent=v?`運行中 · ${20*speed} ticks／秒`:'已暫停';el<HTMLButtonElement>('step').disabled=!connected||graphicsFailed||v;renderPaused();}
function renderPaused(){el('paused-banner').hidden=running||!connected||!!state.outcome||graphicsFailed;}
// Selection is UI state only; the Worker never sees it. Only own (blue) units can be selected.
function select(ids:Iterable<number>){if(selectedBuilding&&[...ids].length)selectedBuilding=null;const own=new Set(ownUnits().map(u=>u.id)),before=[...selected].sort().join();selected=new Set([...ids].filter(id=>own.size===0||own.has(id)));
 if(selected.size&&[...selected].sort().join()!==before){const first=state.units.find(u=>selected.has(u.id));audio.play(first?.kind==='villager'?'select-villager':'select-soldier');}
 document.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach(b=>b.setAttribute('aria-pressed',String(selected.has(Number(b.dataset.unit)))));
 const ids2=[...selected].sort((a,b)=>a-b);el('selected').textContent=ids2.length?ids2.map(id=>`#${String(id).padStart(2,'0')}`).join(' '):'未選取';render();}
function choose(id:number){select([id]);}
// Construction UI. Costs and names come from the ruleset; the Worker re-validates everything.
const entryOf=(k:string)=>rules.entries.find(e=>e.id===k);
const costOf=(k:string)=>entryOf(k)!.cost;
const costText=(k:string)=>Object.entries(costOf(k)).filter(([,v])=>v>0).map(([r,v])=>`${resourceNames[r]} ${v}`).join('、');
const entryName=(k:string)=>entryOf(k)?.name??k;
const ageNames=['','第一時代',entryName('age-2'),entryName('age-3'),entryName('age-4')];
const unitNames:Record<string,string>={villager:'村民',militia:'近戰民兵',archer:'弓手',scout:'斥候',monk:'僧侶'};
const villagersIn=(ids:Iterable<number>)=>[...ids].filter(id=>state.units.find(u=>u.id===id)?.kind==='villager').sort((a,b)=>a-b);
const leftOut=(ids:number[])=>{const n=selected.size-ids.length;return n>0?`（${n} 名士兵不能採集或建造，未派出）`:'';};
function buildBlocker(k:BuildKind){if(!villagersIn(selected).length)return '先選取村民';const req=buildRequirement(state.economy.age,k,state.buildings);if(req)return req;const st=state.economy.stock,c=costOf(k),short=(Object.keys(c) as (keyof typeof c)[]).filter(r=>st[r]<c[r]);return short.length?short.map(r=>`${resourceNames[r]}不足：需要 ${c[r]}，目前 ${st[r]}`).join('；'):null;}
function renderBuild(){const show=!selectedBuilding&&villagersIn(selected).length>0;
 for(const k of buildKinds){const b=el<HTMLButtonElement>(`build-${k}`),why=buildBlocker(k);b.hidden=!show;b.disabled=!connected||graphicsFailed||!!why;b.setAttribute('aria-label',`${buildingNames[k]}（${costText(k)}）${why?`：${why}`:''}`);b.setAttribute('aria-pressed',String(placing===k));
  const img=b.querySelector('img')!;img.dataset.icon=k==='farm'?'farm':`${k}-${state.economy.age}`;setImg(img,img.dataset.icon);}
 const reasons=buildKinds.map(k=>[k,buildBlocker(k)] as const).filter(([,w])=>w);
 el('build-reason').textContent=placing?(preview?.problem?`不能放在這裡：${preview.problem}`:`左鍵放置${buildingNames[placing]}；Shift＋左鍵連續放置；右鍵或 Esc 取消。`):reasons.length===buildKinds.length&&reasons[0][1]==='先選取村民'?'先選取村民才能建造。':reasons.map(([k,w])=>`${buildingNames[k]}：${w}`).join('　');
 el('stop').hidden=!!selectedBuilding||!chosenUnits().length;}
function renderBuilding(){const panel=el('building-panel'),b=state.buildings.find(b=>b.id===selectedBuilding);panel.hidden=!b;scene?.setRally(b?.rally?{x:b.rally.x/100,z:b.rally.y/100}:null);
 const cancel=el<HTMLButtonElement>('cancel-build');cancel.hidden=!b||b.complete;el('production').hidden=!b;if(!b){el('production-reason').textContent='';return;}
 const builders=state.units.filter(u=>u.work==='building'||u.work==='toSite').length;
 el('building-title').textContent=buildingNames[b.kind]??b.kind;const housing=buildingRules.capacity[b.kind as keyof typeof buildingRules.capacity]??0;
 setImg(el<HTMLImageElement>('building-portrait'),b.kind==='farm'?'farm':`${b.kind}-${state.economy.age}`);
 el('building-hp').textContent=`${b.hp}/${b.maxHp}`;el('building-hp-bar').style.width=`${Math.max(0,b.hp)*100/Math.max(1,b.maxHp)}%`;
 const field=b.kind==='farm'?state.resources.find(r=>r.id===`resource-${b.id}`):undefined;
 el('building-status').textContent=(b.hp<b.maxHp?`生命 ${b.hp}/${b.maxHp} · `:'')+(b.complete?(housing?`已完工 · 提供人口 ${housing}`:field?`剩餘食物 ${field.remaining}/${field.capacity}（右鍵派村民耕作）`:b.kind==='monastery'?`已完工 · 聖物 ${b.relics}/10（每分鐘 +${b.relics*30} 黃金）`:'已完工'):`施工中 ${Math.floor(b.work*100/b.required)}%（全體施工中的村民：${builders} 名）`);
 renderProduction(b);const refund=b.kind in buildingNames&&!b.complete?`取消建造（退回 ${costText(b.kind as BuildKind)}）`:'取消建造';cancel.setAttribute('aria-label',refund);cancel.dataset.tip=refund;}
// Selection panel: one unit gets a portrait and its numbers; a group gets a portrait grid; nothing selected shows the controls.
let groupKey='';
function renderSelection(){const chosen=chosenUnits(),b=state.buildings.find(v=>v.id===selectedBuilding);
 el('sel-empty').hidden=!!b||chosen.length>0;el('sel-unit').hidden=!!b||chosen.length!==1;el('sel-group').hidden=!!b||chosen.length<2;
 if(!b&&chosen.length===1){const u=chosen[0],stats=combatRules.units[u.kind as keyof typeof combatRules.units];
  setImg(el<HTMLImageElement>('unit-portrait'),`${u.kind}-face`);el('unit-name').textContent=unitNames[u.kind];el('unit-owner').textContent=`藍方 · #${u.id}`;
  el('unit-hp').textContent=`${u.hp}/${u.maxHp}`;el('unit-hp-bar').style.width=`${Math.max(0,u.hp)*100/Math.max(1,u.maxHp)}%`;
  const facts=`${u.faith??''}|攻擊 ${stats.damage}|${stats.range<=50?'近戰':`射程 ${stats.range/100} 格`}|${u.cargo?`${u.cargo.resource}:${u.cargo.amount}`:''}`;const box=el('unit-facts');
  if(box.dataset.key!==facts){box.dataset.key=facts;box.replaceChildren();const add=(text:string,icon?:string)=>{const s=document.createElement('span');if(icon){const i=document.createElement('img');i.alt=resourceNames[icon];setImg(i,icon);s.append(i);}s.append(text);box.append(s);return s;};
   if(u.kind==='monk'){add(`轉化射程 ${religionRules.convertRange/100} 格`);add(`信仰 ${u.faith??100}%`);}else{add(`攻擊 ${stats.damage}`);add(stats.range<=50?'近戰':`射程 ${stats.range/100} 格`);}if(u.cargo)add(`${u.cargo.amount}/${economyRules.carryCapacity}`,u.cargo.resource);}
  el('unit-status').textContent=doing(u);}
 if(!b&&chosen.length>1){const counts=new Map<string,number>();for(const u of chosen)counts.set(u.kind,(counts.get(u.kind)??0)+1);
  el('group-summary').textContent=`已選取 ${chosen.length} 名 · `+[...counts].map(([k,n])=>`${unitNames[k]} ×${n}`).join(' · ');
  // Only as many portraits as the panel holds; the rest become one "+N" tile, never a clipped row.
  const grid=el('group-grid'),small=matchMedia('(max-width:760px)').matches,[tw,th]=small?[34,40]:[46,52],cols=Math.max(1,Math.floor((grid.clientWidth+4)/(tw+4))),rows=Math.max(1,Math.floor((grid.clientHeight+4)/(th+4))),room=cols*rows;
  const shown=chosen.length>room?chosen.slice(0,room-1):chosen,key=shown.map(u=>u.id+u.kind).join()+'|'+chosen.length;
  if(key!==groupKey){groupKey=key;const more=chosen.length-shown.length;grid.replaceChildren(...shown.map(u=>{const btn=document.createElement('button');btn.className='mini-unit';btn.dataset.pick=String(u.id);btn.title=`${unitNames[u.kind]} ${u.id}（Shift＋點擊移出選取）`;btn.setAttribute('aria-label',`${unitNames[u.kind]} ${u.id}`);const img=document.createElement('img');img.alt='';setImg(img,`${u.kind}-face`);const bar=document.createElement('i'),fill=document.createElement('i');bar.append(fill);btn.append(img,bar);btn.onclick=e=>{if(e.shiftKey)toggle(u.id);else choose(u.id);};return btn;}));if(more>0){const rest=document.createElement('span');rest.className='mini-more';rest.textContent=`+${more}`;grid.append(rest);}}
  for(const btn of Array.from(grid.querySelectorAll<HTMLElement>('[data-pick]'))){const u=chosen.find(v=>v.id===Number(btn.dataset.pick));if(u)(btn.querySelector('i i') as HTMLElement).style.width=`${Math.max(0,u.hp)*100/Math.max(1,u.maxHp)}%`;}}}
// Conquest result from the Worker; the sim refuses further orders, so the only action offered is a new game.
let outcomeHeard=-1;
function renderOutcome(){const o=state.outcome,box=el('result');box.hidden=!o;if(!o){outcomeHeard=-1;return;}const won=o.winner===0;
 if(outcomeHeard!==o.tick){outcomeHeard=o.tick;audio.play(o.reason==='resign'&&!won?'resign':won?'victory':'defeat');}
 el('result-title').textContent=won?'勝利':o.winner===null?'雙方同歸於盡':'戰敗';
 const why=o.reason==='resign'?(won?'紅方投降。':'你已投降。'):o.reason==='relic'?(won?'藍方持有全部聖物 200 年。':'紅方持有全部聖物 200 年。'):won?'紅方已沒有任何單位與建築。':'藍方已沒有任何單位與建築。';el('result-detail').textContent=`${el('clock').textContent}（tick ${o.tick}）：${why}`;if(running)setRunning(false);renderPaused();}
// Event feed (top left, like the original): what happened to the player's side since the last view.
let previous:View|null=null,lastAlarm=-1e9;
function feed(text:string,kind='info'){const list=el('events'),li=document.createElement('li');li.textContent=text;li.dataset.kind=kind;list.append(li);while(list.children.length>5)list.firstElementChild!.remove();window.setTimeout(()=>li.remove(),12000);}
function reportEvents(){const before=previous;previous=state;if(!before||state.tick<=before.tick||state.seed!==before.seed)return;
 const had=new Set(before.units.map(u=>u.id));for(const u of ownUnits())if(!had.has(u.id)){feed(`${unitNames[u.kind]}已生產`);audio.play('trained');}
 // Relics picked up or stored, technologies researched, the relic countdown starting or stopping.
 const carried=new Set(before.units.filter(u=>u.relic).map(u=>u.id));for(const u of ownUnits())if(u.relic&&!carried.has(u.id)){feed('僧侶撿起了聖物');audio.play('relic');}
 if(state.relicsHeld[0]>before.relicsHeld[0]){feed(`聖物已存入修道院（${state.relicsHeld[0]}/${state.relicTotal}）`);audio.play('relic');}
 for(const t of state.economy.techs)if(!before.economy.techs.includes(t)){feed(`已研究「${entryName(t)}」`);audio.play('age');}
 if(state.relicVictory&&!before.relicVictory)feed(state.relicVictory.player===0?'藍方持有全部聖物：守住 200 年即可獲勝':'紅方持有全部聖物：200 年後紅方獲勝',state.relicVictory.player===0?'info':'alarm');
 if(!state.relicVictory&&before.relicVictory)feed('聖物勝利倒數中止');
 // Conversions: a unit that changed sides between two views.
 const side=new Map(before.units.map(u=>[u.id,u.player]));
 for(const u of state.units){const was=side.get(u.id);if(was===undefined||was===u.player)continue;if(u.player===0){feed(`轉化了紅方${unitNames[u.kind]}`);audio.play('converted');}else{feed(`你的${unitNames[u.kind]}被紅方轉化`,'alarm');audio.play('alarm');}}
 const old=new Map(before.buildings.map(b=>[b.id,b]));
 for(const b of state.buildings){const o=old.get(b.id);if(o&&!o.complete&&b.complete){feed(`${buildingNames[b.kind]??b.kind}已建造`);audio.play('built');}}
 // Foundations that vanish were cancelled or razed before completion: no message (the order's own notice covers a cancel).
 for(const o of before.buildings)if(!state.buildings.some(b=>b.id===o.id)){
  const field=before.resources.find(r=>r.id===`resource-${o.id}`);if(o.kind==='farm'&&field&&field.remaining<=economyRules.carryCapacity)feed('農田耗盡');else if(o.complete){feed(`${buildingNames[o.kind]??o.kind}被摧毀`,'alarm');audio.play('collapse');}}
 if(state.economy.age>before.economy.age){feed(`已升上${ageNames[state.economy.age]}`);audio.play('age');}
 // Any visible unit losing health this view is a hit (the sound spaces itself out).
 const lastHp=new Map(before.units.map(u=>[u.id,u.hp]));if(state.units.some(u=>(lastHp.get(u.id)??u.hp)>u.hp))audio.play('hit');
 // Under attack: any own unit or building lost health; at most one warning every 10 seconds.
 const hp=new Map([...before.units.filter(u=>u.player===0).map(u=>[`u${u.id}`,u.hp] as const),...before.buildings.map(b=>[`b${b.id}`,b.hp] as const)]);
 const hurt=[...ownUnits().filter(u=>(hp.get(`u${u.id}`)??u.hp)>u.hp).map(u=>({x:u.x,y:u.y})),...state.buildings.filter(b=>(hp.get(`b${b.id}`)??b.hp)>b.hp).map(b=>({x:b.x+100,y:b.y+100}))];
 if(hurt.length&&state.tick-lastAlarm>=10*rules.settings.tickHz){lastAlarm=state.tick;feed('警告：你正在被紅方攻擊！','alarm');audio.play('alarm');ping={x:hurt[0].x/100,z:hurt[0].y/100,until:performance.now()+3000};miniKey='';}}
let ping:{x:number;z:number;until:number}|null=null;
function reportTransactions(){for(const t of state.transactions)if(t.sequence>lastTransaction){lastTransaction=t.sequence;if(!t.ok)notice(`指令在 tick ${t.tick} 未執行：${t.error}`);}}
function selectBuilding(id:string|null){if(id&&id!==selectedBuilding)audio.play('order');selectedBuilding=id;if(id)select([]);render();}
function buildingAt(x:number,y:number,id?:string){if(id){const o=state.known.map(k=>k.obstacle).find(o=>o.id===id&&!o.red);if(o)return o;}const p={x:Math.round(x*100),y:Math.round(y*100)};return state.known.map(k=>k.obstacle).find(o=>homeKinds.has(o.kind)&&!o.red&&(()=>{const [x0,y0,x1,y1]=obstacleBounds(o);return p.x>=x0&&p.x<=x1&&p.y>=y0&&p.y<=y1;})());}
function placeAt(k:BuildKind,gx:number,gy:number){const [x0,y0,x1,y1]=obstacleBounds({kind:k,x:0,y:0}),g=buildingRules.grid,x=Math.round((gx*100-(x0+x1)/2)/g)*g,y=Math.round((gy*100-(y0+y1)/2)/g)*g;
 const problem=placementProblem({tiles:state.terrain,obstacles:state.known.map(o=>o.obstacle),units:state.units,explored:t=>(state.fog[t]??0)>0},k,x,y);return {x,y,problem};}
function stopPlacing(message?:string){placing=null;preview=null;scene?.setGhost(null);if(message)notice(message);render();}
async function build(k:BuildKind,x:number,y:number){const unitIds=villagersIn(selected);if(!unitIds.length){notice('所選單位中沒有村民。');return;}
 try{await client.request({kind:'build',unitIds,building:k,x,y});audio.play('place');notice(`${names(unitIds)} 前往建造${buildingNames[k]}；放置時扣除 ${costText(k)}。${leftOut(unitIds)}`);}catch(e){notice(reason(e));}}
async function construct(buildingId:string){const unitIds=villagersIn(selected);if(!unitIds.length){notice('所選單位中沒有村民，不能施工。');return;}try{await client.request({kind:'construct',unitIds,buildingId});notice(`${names(unitIds)} 前往協助施工。${leftOut(unitIds)}`);}catch(e){notice(reason(e));}}
// Production tiles: rebuilt only when the building or its queue changes, so a click is never lost.
let productionKey='',queueKey='';
// What each monastery technology does (reference effects; see aoe2-rules-research.md).
const techEffects:Record<string,string>={redemption:'僧侶可以轉化敵方建築（城鎮中心、修道院、農田除外），必須站在旁邊',atonement:'僧侶可以轉化敵方僧侶',sanctity:'僧侶生命 +15',heresy:'被敵方轉化的己方單位改為死亡',illumination:'轉化後信仰恢復速度加倍',
 'block-printing':'轉化射程 +3（本作 +1.2 格）',theocracy:'一群僧侶轉化成功後，只有一名需要恢復信仰',faith:'己方單位更難被轉化（第 6 次才可能成功，最遲第 14 次）'};
const trainKeys=['Q','W','E','R','T','A','D','Z','X','C'];
// Ages show the town centre of that age; other technologies their own brick emblem (tech-icons.ts).
const entryIcon=(id:string)=>ageOf(id)?`town-center-${ageOf(id)}`:entryOf(id)?.kind==='technology'?`tech-${id}`:`${id}-face`;
function trainInput(b:View['buildings'][number]){const e=state.economy;return {player:0,age:e.age,techs:e.techs,building:b,ownBuildings:state.buildings,stock:e.stock,populationUsed:e.populationUsed,populationReserved:e.populationReserved,populationCap:e.populationCap};}
function renderProduction(b:View['buildings'][number]){
 const entries=Object.entries(rules.production).filter(([,p])=>p===b.kind).map(([id])=>id),box=el('production');
 const key=b.id+':'+entries.join();if(key!==productionKey){productionKey=key;box.replaceChildren(...entries.map((id,i)=>{const btn=document.createElement('button');btn.className='tile';btn.dataset.train=id;btn.dataset.key=trainKeys[i];btn.onclick=()=>void train(b.id,id);
  const img=document.createElement('img');img.alt='';img.dataset.icon=entryIcon(id);setImg(img,img.dataset.icon);const label=document.createElement('span');label.className='label';label.textContent=entryName(id);const kbd=document.createElement('kbd');kbd.textContent=trainKeys[i];btn.append(img,label,kbd);
  if(ageOf(id)){const roman=document.createElement('span');roman.className='roman';roman.textContent=['','I','II','III','IV'][ageOf(id)];btn.append(roman);}return btn;}));}
 const reasons:string[]=[];
 for(const btn of Array.from(box.querySelectorAll<HTMLButtonElement>('button'))){const id=btn.dataset.train!,why=trainBlocker(trainInput(b),id);
  // A researched age leaves the grid, as in the original; its label still says why.
  btn.hidden=!b.complete||why==='已研究';btn.disabled=!connected||graphicsFailed||!!why;btn.setAttribute('aria-label',`${entryName(id)}（${costText(id)}）${why?`：${why}`:''}`);if(why&&why!=='已研究')reasons.push(`${entryName(id)}：${why}`);}
 el('production-reason').textContent=b.complete?reasons.join('　'):'';
 const qkey=b.queue.map(q=>q.id).join();if(qkey!==queueKey){queueKey=qkey;el('queue').replaceChildren(...b.queue.map((q,i)=>{const row=document.createElement('div'),img=document.createElement('img'),label=document.createElement('span'),cancel=document.createElement('button');img.alt='';setImg(img,entryIcon(q.entryId));label.dataset.item=String(q.id);cancel.textContent='×';cancel.setAttribute('aria-label',`取消${entryName(q.entryId)}`);cancel.title='取消並全額退回';cancel.onclick=()=>void cancelTrain(b.id,q.id);row.append(img,label,cancel);
  if(i===0){const bar=document.createElement('div');bar.className='q-bar';bar.append(document.createElement('i'));row.append(bar);}return row;}));}
 for(const label of Array.from(el('queue').querySelectorAll<HTMLElement>('span[data-item]'))){const q=b.queue.find(q=>q.id===Number(label.dataset.item));if(!q)continue;const first=b.queue[0]===q;label.textContent=`${entryName(q.entryId)} · ${first?(q.work>=q.required?'完成，等待出口空位':`${Math.floor(q.work*100/q.required)}%`):'排隊中'}`;
  const fill=label.parentElement!.querySelector<HTMLElement>('.q-bar i');if(fill)fill.style.width=`${Math.min(100,q.work*100/q.required)}%`;}
 el('rally-hint').textContent=b.complete&&entries.some(id=>!/^age-/.test(id))?`集結點：${b.rally?`(${(b.rally.x/100).toFixed(1)}, ${(b.rally.y/100).toFixed(1)})`:'未設定'}（右鍵地面設定）`:'';
}
// Command note over the battlefield's lower-left corner: the hovered tile's card, otherwise why tiles are disabled.
let tipTile:HTMLButtonElement|null=null;
function tileCard(btn:HTMLButtonElement){const card=document.createDocumentFragment(),line=(cls:string,text:string)=>{const p=document.createElement('span');p.className=cls;p.textContent=text;p.style.display='block';card.append(p);};
 const id=btn.dataset.train??btn.dataset.build;const title=document.createElement('strong');card.append(title);
 if(!id){title.textContent=`${btn.dataset.tip}（${btn.dataset.key??(btn.id==='stop'?'S':'Del')}）`;line('meta',btn.id==='stop'?'所選單位在下一個節點停下，並放下目前的工作。':'拆除地基；費用全額退回。');return card;}
 const e=entryOf(id)!,why=btn.dataset.train?trainBlocker(trainInput(state.buildings.find(v=>v.id===selectedBuilding)!),id):buildBlocker(id as BuildKind);
 title.textContent=`${btn.dataset.build?buildingNames[id]:entryName(id)}（${btn.dataset.key}）`;const cost=document.createElement('span');cost.className='cost';
 for(const r of resources)if(e.cost[r]>0){const s=document.createElement('span'),i=document.createElement('img');i.alt=resourceNames[r];setImg(i,r);s.append(i,String(e.cost[r]));if(state.economy.stock[r]<e.cost[r])s.style.color='#f3b19f';cost.append(s);}
 card.append(cost);const housing=buildingRules.capacity[id as keyof typeof buildingRules.capacity];
 line('meta',[`${e.time} 秒`,e.population?`人口 ${e.population}`:'',housing?`提供人口 ${housing}`:'',id==='farm'?`完工後可耕作 ${terrainRules.resourceCapacity.farm} 食物，可以走上去`:'',({'lumber-camp':'村民可在此送交木材','mining-camp':'村民可在此送交黃金與石頭',mill:'村民可在此送交食物',monastery:'訓練僧侶：轉化敵方單位、治療己方單位；存放聖物（每個每分鐘 30 黃金）',...techEffects} as Record<string,string>)[id]??''].filter(Boolean).join(' · '));if(why)line('why',why);return card;}
function renderNote(){const box=el('cmd-note'),tip=el('tip'),build=el('build-reason'),prod=el('production-reason');
 const live=tipTile&&!tipTile.hidden&&tipTile.isConnected?tipTile:null;tip.hidden=!live;if(live)tip.replaceChildren(tileCard(live));
 build.hidden=!!live||!!selectedBuilding||!villagersIn(selected).length||!build.textContent;prod.hidden=!!live||!selectedBuilding||!prod.textContent;box.hidden=tip.hidden&&build.hidden&&prod.hidden;}
function tileAtPoint(x:number,y:number){return Array.from(el('commands').querySelectorAll<HTMLButtonElement>('button.tile')).find(b=>{if(b.hidden)return false;const r=b.getBoundingClientRect();return r.width>0&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;})??null;}
// Disabled buttons do not reliably receive pointer events, so hovering is resolved from the grid's own geometry.
el('commands').addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const t=tileAtPoint(e.clientX,e.clientY);if(t!==tipTile){tipTile=t;renderNote();}});
el('commands').addEventListener('pointerleave',()=>{tipTile=null;renderNote();});
el('commands').addEventListener('focusin',e=>{tipTile=(e.target as HTMLElement).closest('button.tile');renderNote();});el('commands').addEventListener('focusout',()=>{tipTile=null;renderNote();});
async function train(buildingId:string,entryId:string){try{await client.request({kind:'train',buildingId,entryId});audio.play('order');notice(`${entryName(entryId)}將在 tick ${state.tick+1} 加入佇列並扣除 ${costText(entryId)}。${running?'':resumeHint()}`);}catch(e){notice(reason(e));}}
async function cancelTrain(buildingId:string,itemId:number){try{const q=state.buildings.find(b=>b.id===buildingId)?.queue.find(q=>q.id===itemId);await client.request({kind:'cancelTrain',buildingId,itemId});notice(`已取消${q?entryName(q.entryId):'項目'}，全額退回。`);}catch(e){notice(reason(e));}}
async function rally(buildingId:string,x:number,y:number){const to=openPoint(x,y);scene?.setMarker('rally',to.x/100,to.y/100);try{await client.request({kind:'rally',buildingId,x:to.x,y:to.y});notice(`集結點設在 (${(to.x/100).toFixed(1)}, ${(to.y/100).toFixed(1)})。`);}catch(e){notice(reason(e));}}
function toggle(id:number){const next=new Set(selected);if(next.has(id))next.delete(id);else next.add(id);select(next);}
el<HTMLSelectElement>('opponent').value=debug?'idle':'ai';el<HTMLSelectElement>('layout').value=debug?'meadow':'open';
const client=new SimulationClient(rules.settings.seed,debug?'meadow':'open',debug?'idle':'ai',v=>{state=v;render();},reason=>{connected=false;setRunning(false);toggleControls();notice(reason);el('worker-retry').hidden=false;});
function toggleControls(){for(const id of ['zoom-in','zoom-out','rotate-view','reset-view','idle-villager'])el<HTMLButtonElement>(id).disabled=!scene||graphicsFailed;for(const id of ['move','stop','pause','step','restart','save','load','replay','resign'])el<HTMLButtonElement>(id).disabled=!connected||(graphicsFailed&&id!=='save')||(id==='step'&&running);}
// A normal visit plays immediately, like the original; ?debug=1 keeps the deterministic paused start for flows.
function autoStart(){if(debug||!connected||graphicsFailed)return;homeCamera();if(!state.outcome)setRunning(true);}
function homeCamera(){const tc=state.known.find(k=>k.obstacle.kind==='town-center'&&!k.obstacle.red)?.obstacle;if(!tc||!scene)return;const [x0,y0,x1,y1]=obstacleBounds(tc);scene.focusHome((x0+x1)/200,(y0+y1)/200+1);}
async function connect(){el<HTMLButtonElement>('worker-retry').disabled=true;try{await client.connect();connected=true;el('worker-retry').hidden=true;
 notice(debug?`模擬已連線 · tick ${state.tick}。選取村民，再對地面按右鍵下達移動。`:(matchMedia('(pointer:coarse)').matches?'藍方村民已就位。輕觸村民選取，再輕觸資源採集或地面移動；右上「選單」可存讀與開新局。':'藍方村民已就位。選取村民後右鍵資源採集、右鍵地面移動；F10 開啟選單。'));autoStart();}catch{}finally{toggleControls();renderPaused();el<HTMLButtonElement>('worker-retry').disabled=false;}}
el('worker-retry').onclick=()=>void connect();
const kindOf=(id:number)=>unitNames[state.units.find(u=>u.id===id)?.kind??'villager'];
const names=(ids:number[])=>ids.length>3?`${ids.length} 名單位`:ids.map(id=>`${kindOf(id)} ${id}`).join('、');
// A move or rally point inside something solid walks as close as it can, as in the original: the nearest open point
// by what the player knows (seen obstacles and terrain). The Worker still validates the result.
function openPoint(x:number,y:number){const map={obstacles:state.known.map(k=>k.obstacle),tiles:state.terrain.map((t,id)=>({...t,id,resourceRefs:[],obstacleRefs:[]}))} as unknown as Parameters<typeof clearSegment>[0],p0={x:Math.round(x*100),y:Math.round(y*100)};
 const edge=state.size*100-50;for(let r=0;r<=300;r+=25)for(let dy=-r;dy<=r;dy+=25)for(let dx=-r;dx<=r;dx+=25){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const p={x:p0.x+dx,y:p0.y+dy};if(p.x<50||p.y<50||p.x>edge||p.y>edge)continue;if(clearSegment(map,p,p))return p;}
 return p0;}
async function move(x:number,y:number,exact=false){const unitIds=[...selected].sort((a,b)=>a-b);if(!unitIds.length){notice('請先選取單位：左鍵點選或拖曳框選。');return;}
 // The debug coordinate button sends exactly what was typed, so the Worker's own validation stays reachable.
 const to=exact?{x:Math.round(x*100),y:Math.round(y*100)}:openPoint(x,y);scene?.setMarker('move',to.x/100,to.y/100);
 try{await client.request({kind:'move',unitIds,x:to.x,y:to.y});audio.play('order');notice(`${names(unitIds)} 的移動指令已排入 tick ${state.tick+1}。${running?'':resumeHint()}`);}catch(e){notice(reason(e));}}
async function gather(resourceId:string){const unitIds=villagersIn(selected);if(!unitIds.length){notice(selected.size?'所選單位中沒有村民，不能採集。':'請先選取村民。');return;}
 try{await client.request({kind:'gather',unitIds,resourceId});audio.play('order');notice(`${names(unitIds)} 前往採集。${leftOut(unitIds)}${running?'':resumeHint()}`);}catch(e){notice(reason(e));}}
// A right-click inside a visible resource's footprint is a gather order; ground elsewhere is a move.
function resourceAt(x:number,y:number){const p={x:Math.round(x*100),y:Math.round(y*100)};return state.resources.find(r=>{const kind=(r.kind==='stone'?'rock':r.kind) as ObstacleKind;if(r.kind==='fish')return Math.abs(p.x-r.x)<=50&&Math.abs(p.y-r.y)<=50;const [x0,y0,x1,y1]=obstacleBounds({kind,x:r.x,y:r.y},10);return p.x>=x0&&p.x<=x1&&p.y>=y0&&p.y<=y1;});}
async function stop(){const unitIds=[...selected].sort((a,b)=>a-b);if(!unitIds.length){notice('請先選取要停止的單位。');return;}
 try{await client.request({kind:'stop',unitIds});notice(`${names(unitIds)} 將在下一個節點停下（tick ${state.tick+1}）。`);}catch(e){notice(reason(e));}}
// Idle villagers: the '.' key and the button next to the minimap cycle through them and centre the camera.
const idleVillagers=()=>ownUnits().filter(u=>u.kind==='villager'&&!u.work&&u.action===0&&u.navigation!=='moving'&&u.navigation!=='searching'&&u.navigation!=='waiting').sort((a,b)=>a.id-b.id);
function renderIdle(){const n=idleVillagers().length;el('idle-count').textContent=n?String(n):'';el('idle-villager').setAttribute('aria-label',`下一名閒置村民（${n} 名閒置）`);}
let idleCursor=0;
function nextIdle(){const idle=idleVillagers();if(!idle.length){notice('沒有閒置的村民。');return;}const u=idle.find(v=>v.id>idleCursor)??idle[0];idleCursor=u.id;choose(u.id);scene?.focusOn(u.x/100,u.y/100);notice(`閒置村民 ${u.id}（共 ${idle.length} 名閒置）。`);}
function homeTownCenter(){const tc=state.buildings.find(b=>b.kind==='town-center');if(!tc){notice('沒有城鎮中心。');return;}const o=state.known.find(k=>k.obstacle.id===tc.id)?.obstacle;selectBuilding(tc.id);if(o&&scene){const [x0,y0,x1,y1]=obstacleBounds(o);scene.focusOn((x0+x1)/200,(y0+y1)/200);}notice('已選取城鎮中心。');}
// Pointer: left click selects, left drag (4 px or more) box-selects, Shift adds/removes; right click on ground moves.
const box=el('select-box');let drag:{x:number;y:number;id:number;box:boolean}|null=null;
function showBox(x0:number,y0:number,x1:number,y1:number){const r=canvas.getBoundingClientRect();Object.assign(box.style,{left:`${Math.min(x0,x1)-r.left}px`,top:`${Math.min(y0,y1)-r.top}px`,width:`${Math.abs(x1-x0)}px`,height:`${Math.abs(y1-y0)}px`});box.hidden=false;}
function endDrag(){drag=null;box.hidden=true;}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointermove',e=>{if(!placing||!scene)return;const g=scene.pickGround(e.clientX,e.clientY);if(g.x===undefined||g.y===undefined){scene.setGhost(null);return;}
 preview=placeAt(placing,g.x,g.y);scene.setGhost({kind:placing,x:preview.x,y:preview.y,ok:!preview.problem});renderBuild();renderNote();});
function orderAtGround(x:number,y:number){
 if(selectedBuilding&&!selected.size){const b=state.buildings.find(b=>b.id===selectedBuilding);if(b?.complete&&Object.values(rules.production).includes(b.kind))void rally(b.id,x,y);else notice('這棟建築沒有集結點。');return;}
 void move(x,y);}
canvas.addEventListener('pointerdown',e=>{if(!scene||graphicsFailed)return;
 if(placing){e.preventDefault();if(e.button!==0){stopPlacing('已取消放置。');return;}const g=scene.pickGround(e.clientX,e.clientY);if(g.x===undefined||g.y===undefined)return;
  const p=placeAt(placing,g.x,g.y);if(p.problem){notice(`不能放在這裡：${p.problem}`);return;}const k=placing;if(!e.shiftKey)stopPlacing();void build(k,p.x,p.y);return;}
 if(e.button===2&&state.outcome){e.preventDefault();notice('對局已結束：按「再開一局」開始新遊戲。');return;}
 if(e.button===2){e.preventDefault();endDrag();const hit=scene.pickGround(e.clientX,e.clientY);if(hit.x===undefined||hit.y===undefined||hit.x<.5||hit.x>state.size-.5||hit.y<.5||hit.y>state.size-.5){notice('請在地圖內側的地面按右鍵。');return;}
  if(selectedBuilding&&!selected.size){orderAtGround(hit.x,hit.y);return;}// Enemy unit under the cursor, then enemy building: attack orders.
  if(selected.size){const u=scene.pick(e.clientX,e.clientY);const foe=u.unitId!==undefined?state.units.find(v=>v.id===u.unitId&&v.player!==0):undefined;const monks=[...selected].filter(id=>state.units.find(u=>u.id===id)?.kind==='monk').sort((a,b)=>a-b);
    if(foe){scene.setMarker('attack',foe.x/100,foe.y/100);if(monks.length)void rite('convert',monks,foe.id,`紅方${unitNames[foe.kind]}`);if(monks.length<selected.size)void attack({kind:'unit',id:foe.id},`紅方${unitNames[foe.kind]}`);return;}
    // Monks heal a wounded own unit under the cursor (not themselves, not another monk).
    const friend=u.unitId!==undefined?ownUnits().find(v=>v.id===u.unitId):undefined;if(friend&&monks.length&&friend.kind!=='monk'&&friend.hp<friend.maxHp){scene.setMarker('gather',friend.x/100,friend.y/100);void rite('heal',monks,friend.id,`${unitNames[friend.kind]} ${friend.id}`);return;}
   // A relic on the ground: free monks go and pick it up.
   const holy=state.relicSpots.find(r=>Math.max(Math.abs(r.x/100-hit.x!),Math.abs(r.y/100-hit.y!))<=.45),free=monks.filter(id=>!state.units.find(u=>u.id===id)?.relic);
   if(holy&&monks.length){scene.setMarker('gather',holy.x/100,holy.y/100);if(free.length)void rite('relic',free,holy.id,'聖物');else notice('所選僧侶已經攜帶聖物：右鍵己方修道院存放。');return;}
   // Enemy building: monks convert it once Redemption is researched (other soldiers attack it).
   const fort=enemyBuildingAt(hit.x,hit.y,scene.pickBuilding(e.clientX,e.clientY));if(fort){{const [x0,y0,x1,y1]=obstacleBounds(fort);scene.setMarker('attack',(x0+x1)/200,(y0+y1)/200);}const label=`紅方${buildingNames[fort.kind]}`;
    if(monks.length&&state.economy.techs.includes('redemption'))void riteOn(monks,fort.id!,label);if(monks.length<selected.size||!state.economy.techs.includes('redemption'))void attack({kind:'building',id:fort.id!},label);return;}
   // Own monastery: monks carrying relics store them there.
   {const site=buildingAt(hit.x,hit.y,scene.pickBuilding(e.clientX,e.clientY)),carriers=monks.filter(id=>state.units.find(u=>u.id===id)?.relic);
    if(site?.kind==='monastery'&&carriers.length){void deposit(carriers,site.id!);return;}}}
  const site=buildingAt(hit.x,hit.y,scene.pickBuilding(e.clientX,e.clientY)),own=site?state.buildings.find(b=>b.id===site.id):undefined;if(own&&!own.complete&&selected.size){void construct(own.id);return;}
  const r=resourceAt(hit.x,hit.y);if(r){scene.setMarker('gather',hit.x,hit.y);void gather(r.id);return;}void move(hit.x,hit.y);return;}
 if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,id:e.pointerId,box:false};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;if(!drag.box&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>=4)drag.box=true;if(drag.box)showBox(drag.x,drag.y,e.clientX,e.clientY);});
canvas.addEventListener('pointercancel',endDrag);
canvas.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.id||!scene)return;const d=drag;endDrag();
 if(d.box){const own=new Set(ownUnits().map(u=>u.id)),ids=scene.unitsInRect(d.x,d.y,e.clientX,e.clientY).filter(id=>own.has(id));
  if(e.shiftKey)select([...selected,...ids]);else select(ids);notice(ids.length?`框選 ${ids.length} 名單位。對地面按右鍵下達移動。`:'框內沒有藍方單位。');return;}
 const hit=scene.pick(e.clientX,e.clientY);
 if(hit.unitId!==undefined){const unit=state.units.find(u=>u.id===hit.unitId);if(unit?.player===0){if(e.shiftKey)toggle(unit.id);else choose(unit.id);}else notice('紅方單位不可由藍方控制。');return;}
 // Touch has no right button: a tap on the ground moves the current selection instead of clearing it.
 if(e.pointerType==='touch'&&selected.size){const g=scene.pickGround(e.clientX,e.clientY);if(g.x!==undefined&&g.y!==undefined&&g.x>=.5&&g.x<=state.size-.5&&g.y>=.5&&g.y<=state.size-.5){const r=resourceAt(g.x,g.y);if(r)void gather(r.id);else void move(g.x,g.y);return;}}
 {const g=scene.pickGround(e.clientX,e.clientY),roof=scene.pickBuilding(e.clientX,e.clientY);const site=g.x!==undefined&&g.y!==undefined?buildingAt(g.x,g.y,roof):roof?buildingAt(-1,-1,roof):undefined;if(site&&!e.shiftKey&&e.pointerType!=='touch'){selectBuilding(site.id!);notice(`已選取${buildingNames[site.kind]}。`);return;}}
 if(!e.shiftKey&&selected.size){select([]);notice('已取消選取。移動指令請對地面按右鍵（觸控：選取後輕觸地面）。');}
 else if(!e.shiftKey&&selectedBuilding)selectBuilding(null);});
// Minimap: the board drawn with the camera's heading and foreshortening, so the view outline is a plain rectangle.
const mini=el<HTMLCanvasElement>('minimap'),mctx=mini.getContext('2d');let miniKey='';
const terrainColor:Record<string,string>={cliff:'#8a8065',stone:'#a1a28e',highland:'#879d69',water:'#4b8291',shallow:'#86b7b8',sand:'#d5c598',road:'#c4b18a'};
const obstacleColor:Record<string,string>={tree:'#4c6b43',gold:'#e2c35e',rock:'#d9d6c6',berries:'#b85a66',hunt:'#9b7552',livestock:'#e7e2cc'};
const shade=(hex:string,f:number)=>{const n=parseInt(hex.slice(1),16);return `rgb(${Math.round((n>>16&255)*f)},${Math.round((n>>8&255)*f)},${Math.round((n&255)*f)})`;};
function miniGeometry(){const r=mini.getBoundingClientRect(),v=scene!.cameraView(),K=Math.SQRT1_2,n=state.size,h=n/2,s=Math.min(r.width/(n*Math.SQRT2),r.height/(n*Math.SQRT2*K))*.96,c=Math.cos(v.angle),sn=Math.sin(v.angle);
 return {r,v,K,s,c,sn,h,P:(x:number,z:number):[number,number]=>{const dx=x-h,dz=z-h;return [r.width/2+(dx*c-dz*sn)*s,r.height/2+(dx*sn+dz*c)*K*s];}};}
function miniWorld(clientX:number,clientY:number){const g=miniGeometry(),u=(clientX-g.r.left-g.r.width/2)/g.s,w=(clientY-g.r.top-g.r.height/2)/(g.K*g.s);return {x:g.h+u*g.c+w*g.sn,z:g.h-u*g.sn+w*g.c};}
function drawMinimap(){if(!scene||graphicsFailed||!mctx)return;const g=miniGeometry();if(g.r.width<2||g.r.height<2)return;
 const key=[state.stateHash,state.tick,g.v.x,g.v.z,g.v.angle,g.v.halfW,g.v.halfH,g.r.width,g.r.height,[...selected].join()].join('|');if(key===miniKey)return;miniKey=key;
 const dpr=Math.min(devicePixelRatio,2),W=Math.round(g.r.width*dpr),H=Math.round(g.r.height*dpr);if(mini.width!==W||mini.height!==H){mini.width=W;mini.height=H;}
 const ctx=mctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,g.r.width,g.r.height);
 const quad=(x0:number,z0:number,x1:number,z1:number)=>{ctx.beginPath();for(const [i,[x,z]] of ([[x0,z0],[x1,z0],[x1,z1],[x0,z1]] as const).entries()){const [px,py]=g.P(x,z);if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);}ctx.closePath();ctx.fill();};
 // Each tile overlaps its neighbours by a hair so antialiased seams do not show.
 state.terrain.forEach((t,id)=>{const f=state.fog[id]??0,x=id%state.size,z=Math.floor(id/state.size),base=terrainColor[t.terrainType]??'#b5c493';ctx.fillStyle=f===0?'#1c2622':f===1?shade(base,.52):base;quad(x-.02,z-.02,x+1.02,z+1.02);});
 for(const k of state.known){const o=k.obstacle,[x0,y0,x1,y1]=obstacleBounds(o),home=homeKinds.has(o.kind);
  ctx.fillStyle=o.kind==='farm'?(o.red?'#b58a62':'#a99a5e'):home?(o.red?'#d0664c':'#5d93b6'):obstacleColor[o.kind]??'#c8c2a8';if((state.fog[Math.floor(o.y/100)*state.size+Math.floor(o.x/100)]??0)<2&&!home)ctx.fillStyle=shade(ctx.fillStyle as string,.6);quad(x0/100,y0/100,x1/100,y1/100);}
 for(const u of state.units){const [px,py]=g.P(u.x/100,u.y/100);ctx.fillStyle=u.player===0?(selected.has(u.id)?'#fff4c4':'#7fb6dc'):'#ee7b5f';ctx.strokeStyle='#15201b';ctx.lineWidth=1;ctx.beginPath();ctx.rect(px-2.2,py-2.2,4.4,4.4);ctx.fill();ctx.stroke();}
 for(const r of state.relicSpots){const [px,py]=g.P(r.x/100,r.y/100);ctx.fillStyle='#f2d66b';ctx.strokeStyle='#15201b';ctx.lineWidth=1;ctx.beginPath();ctx.arc(px,py,3,0,Math.PI*2);ctx.fill();ctx.stroke();}
 // Attack ping: a red ring where the warning came from, shrinking over three seconds.
 if(ping){const left=ping.until-performance.now();if(left<=0)ping=null;else{const [px,py]=g.P(ping.x,ping.z);ctx.strokeStyle='#ff6a4d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px,py,4+10*left/3000,0,Math.PI*2);ctx.stroke();miniKey='';}}
 const [cx,cy]=g.P(g.v.x,g.v.z);ctx.strokeStyle='#f3ead0';ctx.lineWidth=1.5;ctx.strokeRect(cx-g.v.halfW*g.s,cy-g.v.halfH*g.s,2*g.v.halfW*g.s,2*g.v.halfH*g.s);}
let miniDrag=-1;
mini.addEventListener('contextmenu',e=>e.preventDefault());
mini.addEventListener('pointerdown',e=>{if(!scene||graphicsFailed)return;e.preventDefault();const w=miniWorld(e.clientX,e.clientY);
 if(e.button===2&&state.outcome){notice('對局已結束：按「再開一局」開始新遊戲。');return;}
 if(e.button===2){if(w.x<.5||w.x>state.size-.5||w.z<.5||w.z>state.size-.5){notice('請在小地圖的地圖範圍內按右鍵。');return;}if(!selected.size&&!selectedBuilding){notice('請先選取單位。');return;}orderAtGround(w.x,w.z);return;}
 if(e.button!==0)return;miniDrag=e.pointerId;mini.setPointerCapture(e.pointerId);scene.focusOn(w.x,w.z);});
mini.addEventListener('pointermove',e=>{if(e.pointerId!==miniDrag||!scene)return;const w=miniWorld(e.clientX,e.clientY);scene.focusOn(w.x,w.z);});
mini.addEventListener('pointerup',()=>{miniDrag=-1;});mini.addEventListener('pointercancel',()=>{miniDrag=-1;});
// Menu: opening it pauses the match; closing it resumes only if the match was running before.
let menuResume=false;
function openMenu(){if(!el('menu').hidden)return;menuResume=running;if(running)setRunning(false);endDrag();el('menu').hidden=false;el('menu-close').focus();}
function closeMenu(resume=true){if(el('menu').hidden)return;el('menu').hidden=true;if(resume&&menuResume&&connected&&!state.outcome&&!graphicsFailed)setRunning(true);menuResume=false;el('menu-open').focus();}
el('menu-open').onclick=openMenu;el('menu-close').onclick=()=>closeMenu();el('menu').addEventListener('pointerdown',e=>{if(e.target===el('menu'))closeMenu();});
// Keyboard shortcuts are ignored while typing in fields; with the menu open only Esc and F10 work.
const groups=new Map<number,number[]>();
function renderGroups(){el('groups').textContent=groups.size?'編組 '+[...groups].sort((a,b)=>a[0]-b[0]).map(([n,ids])=>`${n}＝${ids.join('、')}`).join('；'):'尚未編組（Ctrl＋數字）。';}
function commandKey(letter:string){const tile=Array.from(el('commands').querySelectorAll<HTMLButtonElement>('button.tile')).find(b=>!b.hidden&&b.dataset.key===letter);if(!tile)return false;
 if(tile.disabled){const why=tile.getAttribute('aria-label')?.split('：').slice(1).join('：');notice(why?`${tile.getAttribute('aria-label')!.split('（')[0]}：${why}`:'這個指令目前不能使用。');}else tile.click();return true;}
document.addEventListener('keydown',e=>{const t=e.target as HTMLElement;
 if(e.key==='F10'){e.preventDefault();if(el('menu').hidden)openMenu();else closeMenu();return;}
 if(!el('menu').hidden){if(e.key==='Escape'){e.preventDefault();closeMenu();}return;}
 if(t.closest('input,textarea,select,[contenteditable]')||e.altKey||e.metaKey)return;
 if(e.key==='F3'||e.key==='Pause'){e.preventDefault();if(connected&&!graphicsFailed&&!state.outcome)setRunning(!running);return;}
 if(e.key==='Escape'){if(placing){stopPlacing('已取消放置。');return;}if(drag){endDrag();return;}if(selectedBuilding){selectBuilding(null);return;}if(selected.size){select([]);notice('已取消選取。');}return;}
 if((e.key==='s'||e.key==='S')&&!e.ctrlKey){e.preventDefault();void stop();return;}
 if(e.key==='Delete'&&!el('cancel-build').hidden){e.preventDefault();el('cancel-build').click();return;}
 const arrows:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};
 if(arrows[e.key]&&scene&&!graphicsFailed){e.preventDefault();scene.pan(...arrows[e.key]);return;}
 if((e.key==='f'||e.key==='F')&&!e.ctrlKey&&scene){const chosen=chosenUnits();if(chosen.length){scene.focusOn(chosen.reduce((t,u)=>t+u.x,0)/chosen.length/100,chosen.reduce((t,u)=>t+u.y,0)/chosen.length/100);notice('鏡頭已對準選取的單位。');}return;}
 if((e.key==='h'||e.key==='H')&&!e.ctrlKey){homeTownCenter();return;}
 if(e.key==='.'){nextIdle();return;}
 // ',' selects every own soldier (militia and archers; the scout scouts and villagers work).
 if(e.key===','){const army=ownUnits().filter(u=>u.kind==='militia'||u.kind==='archer').map(u=>u.id);if(!army.length){notice('沒有軍隊。');return;}select(army);notice(`已選取全部軍隊：${army.length} 名。`);return;}
 const letter=/^Key([QWERTADZXC])$/.exec(e.code);if(letter&&!e.ctrlKey){if(commandKey(letter[1]))e.preventDefault();return;}
 const digit=/^Digit([1-9])$/.exec(e.code);if(!digit)return;const n=Number(digit[1]);e.preventDefault();
 if(e.ctrlKey){const ids=[...selected].sort((a,b)=>a-b);if(!ids.length){notice('請先選取單位再編組。');return;}groups.set(n,ids);renderGroups();notice(`編組 ${n}：${names(ids)}。按 ${n} 叫回。`);return;}
 const ids=groups.get(n);if(!ids){notice(`編組 ${n} 尚未建立：選取後按 Ctrl＋${n}。`);return;}select(ids);notice(`已叫回編組 ${n}：${names(ids)}。`);});
window.addEventListener('blur',endDrag);
canvas.addEventListener('wheel',e=>{e.preventDefault();if(!graphicsFailed)scene?.zoom(e.deltaY<0?.1:-.1);},{passive:false});
el('zoom-in').onclick=()=>scene?.zoom(.2);el('zoom-out').onclick=()=>scene?.zoom(-.2);el('rotate-view').onclick=()=>scene?.rotate();el('reset-view').onclick=()=>scene?.resetCamera();el('idle-villager').onclick=nextIdle;
document.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach(b=>b.onclick=e=>{const id=Number(b.dataset.unit);if(e.shiftKey)toggle(id);else choose(id);});
el('stop').onclick=()=>void stop();renderGroups();
el('result-restart').onclick=()=>el('restart').click();
for(const k of buildKinds)el(`build-${k}`).onclick=()=>{if(buildBlocker(k))return;placing=k;preview=null;notice(`在戰場上移動滑鼠選擇${buildingNames[k]}的位置。`);render();};
el('cancel-build').onclick=async()=>{const b=state.buildings.find(b=>b.id===selectedBuilding);if(!b)return;try{await client.request({kind:'cancelBuild',buildingId:b.id});notice(`已取消${buildingNames[b.kind]}，退回 ${costText(b.kind as BuildKind)}。`);selectBuilding(null);}catch(e){notice(reason(e));}};
el('move').onclick=()=>{const x=el<HTMLInputElement>('target-x'),y=el<HTMLInputElement>('target-y');if(x.reportValidity()&&y.reportValidity()&&x.value!==''&&y.value!=='')move(Number(x.value),Number(y.value),true);else notice('請輸入 0.5 到 15.5 之間的座標。');};
el('pause').onclick=()=>{if(!state.outcome)setRunning(!running);};
el<HTMLSelectElement>('speed').onchange=e=>{speed=Number((e.target as HTMLSelectElement).value);accumulator=0;if(running)setRunning(true);notice(`遊戲速度 ${speed}×（每秒 ${20*speed} ticks，不跳過任何 tick）。`);};
el('step').onclick=async()=>{try{await client.request({kind:'advance',count:1});}catch(e){setRunning(false);notice(reason(e));}};
el('restart').onclick=async()=>{closeMenu(false);setRunning(false);try{const input=el<HTMLInputElement>('seed');if(input.value==='')throw Error('請輸入種子');await client.request({kind:'reset',seed:Number(input.value),layout:el<HTMLSelectElement>('layout').value as MapLayout,opponent:el<HTMLSelectElement>('opponent').value as 'ai'|'idle'});choose(1);lastTransaction=0;previous=null;el('events').replaceChildren();notice('已建立新沙盒：新遊戲開始。先前的手動存檔仍然保留。');autoStart();}catch(e){notice(reason(e));}};
el('save').onclick=async()=>{try{const result=await client.request({kind:'snapshot'});localStorage.setItem('brick-rts:sandbox:1',result.snapshot!);notice(`已儲存 tick ${result.tick} 的遊戲。`);}catch(e){notice(`儲存失敗：${(e as Error).message}。先前存檔保留。`);}closeMenu();};
el('load').onclick=async()=>{closeMenu(false);setRunning(false);try{const raw=localStorage.getItem('brick-rts:sandbox:1');if(!raw)throw Error('尚無手動存檔。');notice('讀取中：依存檔的指令紀錄重新推導對局，長的對局需要幾秒。');await client.request({kind:'restore',snapshot:raw});el<HTMLInputElement>('seed').value=String(state.seed);el<HTMLSelectElement>('layout').value=state.layout;el<HTMLSelectElement>('opponent').value=state.opponent;choose(1);previous=null;el('events').replaceChildren();notice(`已恢復 tick ${state.tick} 的遊戲。`);autoStart();}catch(e){notice(`讀取失敗：${(e as Error).message}。目前遊戲保留。`);}};
// Resign: the first press arms the button for four seconds, the second press concedes (no browser dialog).
let resignTimer=0;
el('resign').onclick=async()=>{const b=el('resign');if(!b.dataset.armed){b.dataset.armed='1';b.textContent='再按一次確認投降';resignTimer=window.setTimeout(()=>{delete b.dataset.armed;b.textContent='投降';},4000);return;}
 clearTimeout(resignTimer);delete b.dataset.armed;b.textContent='投降';closeMenu(false);
 try{await client.request({kind:'resign'});if(!running)await client.request({kind:'advance',count:1});notice('你已投降。');}catch(e){notice(reason(e));}};
el('replay').onclick=async()=>{closeMenu(false);setRunning(false);try{const result=await client.request({kind:'replay'});notice(result.replayMatches?`重播一致：${result.tick} ticks，指紋 ${result.stateHash}。`:'重播不一致，請保留目前狀態回報。');}catch(e){notice(`重播失敗：${(e as Error).message}`);}if(menuResume)autoStart();};
const editor=el<HTMLTextAreaElement>('rules-json');const reset=()=>{editor.value=JSON.stringify(rules,null,2);el('validation').textContent='尚未驗證編輯內容。';};reset();
el('reset-rules').onclick=reset;
el('validate').onclick=()=>{try{const errors=validateRules(JSON.parse(editor.value),el<HTMLInputElement>('exact').checked);el('validation').textContent=errors.length?'驗證未通過：\n'+errors.join('\n'):'驗證通過：自訂規則結構有效。原作版本與覆蓋率仍未確認。';}catch{el('validation').textContent='驗證未通過：JSON 格式錯誤。';}};
el('export').onclick=()=>{try{const data=JSON.parse(editor.value),errors=validateRules(data,el<HTMLInputElement>('exact').checked);if(errors.length){el('validation').textContent='匯出失敗：\n'+errors.join('\n');return;}const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='brick-rts-rules.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);el('validation').textContent='已匯出經結構驗證的自訂規則。';}catch{el('validation').textContent='無法匯出：JSON 格式錯誤。';}};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running){setRunning(false);notice('分頁進入背景，遊戲已自動暫停。');}});
window.addEventListener('blur',()=>{if(running){setRunning(false);notice('視窗失焦，遊戲已自動暫停。按 ▶ 繼續。');}});
new ResizeObserver(()=>{render();miniKey='';}).observe(canvas.parentElement!);
function frame(time:number){
 if(running){if(last)accumulator+=time-last;last=time;
  // After a stall (tab busy, world rebuild) the backlog is dropped rather than replayed at once or paused:
  // the game briefly runs slower than the clock, and still no tick is skipped.
  if(accumulator>1000)accumulator=1000;
  if(!advancing&&accumulator>=50/speed){const count=Math.min(20*speed,Math.floor(accumulator*speed/50));accumulator-=count*50/speed;advancing=true;
   void client.request({kind:'advance',count}).catch(e=>{setRunning(false);notice(reason(e));}).finally(()=>{advancing=false;});}
 }
 if(!graphicsFailed){try{scene?.draw(time);drawMinimap();}catch(error){graphicsError(`3D 繪圖失敗：${(error as Error).message}`);}}
 if(!graphicsFailed)requestAnimationFrame(frame);
}
function graphicsError(message:string){graphicsFailed=true;setRunning(false);toggleControls();const box=el('boot-error');box.hidden=false;box.textContent=message;notice('3D 畫面暫不可用。可從選單儲存目前遊戲，再重新載入頁面。');}
setRunning(false);toggleControls();render();
void createScene(canvas,graphicsError).then(result=>{scene=result;
 try{icons=scene.renderIcons();}catch{document.body.classList.add('no-icons');}applyIcons();applySettings();
 toggleControls();scene.update(state,selected);void connect();requestAnimationFrame(frame);}).catch(error=>graphicsError(`3D 載入失敗：${(error as Error).message}`));
