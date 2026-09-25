import {mountFogDebugger} from './fog-debug.ts';
import type {MapLayout} from '../../packages/sim/terrain.ts';
import {rules,validateRules} from '../../packages/content/rules.ts';
import {createScene} from './scene.ts';
import {SimulationClient} from './worker-client.ts';
import type {View} from '../../packages/sim/protocol.ts';
import {obstacleBounds} from '../../packages/content/footprints.ts';
import type {ObstacleKind} from '../../packages/content/footprints.ts';
import {placementProblem,buildKinds,buildingRules} from '../../packages/sim/buildings.ts';
import {trainBlocker} from '../../packages/sim/production.ts';
import type {BuildKind} from '../../packages/sim/buildings.ts';
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
let state:View={seed:rules.settings.seed,layout:'meadow',terrain:[],tick:0,units:[],corpses:[],outcome:null,economy:{stock:{food:0,wood:0,gold:0,stone:0},populationUsed:0,populationReserved:0,populationCap:0,age:1},buildings:[],transactions:[],fog:[],known:[],resources:[],stateHash:'—'};
const resourceNames:Record<string,string>={food:'食物',wood:'木材',gold:'黃金',stone:'石頭'};
const workLabel:Record<string,string>={toSource:'前往採集',gathering:'採集中',toDropoff:'送返城鎮中心',toSite:'前往工地',building:'施工中'};
const buildingNames:Record<string,string>={house:'住宅',barracks:'兵營','town-center':'城鎮中心'};
let placing:BuildKind|null=null,selectedBuilding:string|null=null,lastTransaction=0,preview:{x:number;y:number;problem:string|null}|null=null;
let scene:Awaited<ReturnType<typeof createScene>>|null=null,graphicsFailed=false;
// speed: sim ticks per 50 ms of wall time; every tick still runs, in order.
let speed=1,selected=new Set<number>([1]),running=false,last=0,accumulator=0,advancing=false,connected=false;
const notice=(s:string)=>{el('notice').textContent=s;};
const canvas=el<HTMLCanvasElement>('map');
const fogDebugger=mountFogDebugger(el<HTMLDetailsElement>('fog-debug'),()=>state);
function render(){
 fogDebugger.update();
 if(!graphicsFailed){try{scene?.update(state,selected);}catch(error){graphicsError(`3D 場景更新失敗：${(error as Error).message}`);}}
 el('fog-status').textContent=`可見 ${state.fog.filter(v=>v===2).length} 格 · 已探索舊視野 ${state.fog.filter(v=>v===1).length} 格 · 未探索 ${state.fog.filter(v=>v===0).length} 格`;
 el('world-label').textContent=({meadow:'草甸試驗場',coast:'海岸試驗場',acceptance:'高地與淺灘驗收場'})[state.layout];
 el('tick').textContent=String(state.tick);el('hash').textContent=state.stateHash;
 // HUD numbers come straight from the Worker's account projection; nothing is counted in the page.
 const e=state.economy;el('stock').textContent=state.stateHash==='—'?'資源載入中…':`${ageNames[e.age]} · 食物 ${e.stock.food} · 木材 ${e.stock.wood} · 黃金 ${e.stock.gold} · 石頭 ${e.stock.stone} · 人口 ${e.populationUsed}/${e.populationCap}`;
 renderBuild();renderBuilding();reportTransactions();renderOutcome();
 const chosen=state.units.filter(u=>selected.has(u.id)).sort((a,b)=>a.id-b.id);
 el('selection-list').textContent=chosen.length>1?chosen.map(u=>`${unitNames[u.kind]} ${u.id} (${(u.x/100).toFixed(1)}, ${(u.y/100).toFixed(1)})：${activity(u)}`).join('　'):'';
 const u=chosen[0];if(!u){el('position').textContent='未選取村民';return;}
 el('position').textContent=`${chosen.length>1?`${chosen.length} 名選取 · `:''}${unitNames[u.kind]} ${u.id} · (${(u.x/100).toFixed(1)}, ${(u.y/100).toFixed(1)}) · ${activity(u)}`;
}
function activity(u:View['units'][number]){const doing=u.action===1?'攻擊中':u.work&&u.navigation!=='waiting'&&u.navigation!=='stuck'?workLabel[u.work]:statusLabel[u.navigation];const life=u.hp<u.maxHp?` · 生命 ${u.hp}/${u.maxHp}`:'';return (u.cargo?`${doing} · 攜帶${resourceNames[u.cargo.resource]} ${u.cargo.amount}`:doing)+life;}
async function attack(target:{kind:'unit';id:number}|{kind:'building';id:string},label:string){const unitIds=[...selected].sort((a,b)=>a-b);if(!unitIds.length){notice('請先選取單位。');return;}
 try{await client.request({kind:'attack',unitIds,target});notice(`${names(unitIds)} 攻擊${label}。${running?'':'按「開始模擬」執行。'}`);}catch(e){notice((e as Error).message);}}
function enemyBuildingAt(x:number,y:number){const p={x:Math.round(x*100),y:Math.round(y*100)};return state.known.map(k=>k.obstacle).find(o=>(o.kind==='house'||o.kind==='barracks'||o.kind==='town-center')&&o.red&&(()=>{const [x0,y0,x1,y1]=obstacleBounds(o);return p.x>=x0&&p.x<=x1&&p.y>=y0&&p.y<=y1;})());}
const statusLabel:Record<string,string>={idle:'待命',searching:'尋路中',moving:'移動中',waiting:'等待讓路',unreachable:'無法到達，停在最近點',stuck:'受阻停止'};
function setRunning(v:boolean){running=v;accumulator=0;last=0;el('pause').textContent=v?'暫停模擬':'開始模擬';el('pause').setAttribute('aria-pressed',String(v));el('run-state').textContent=v?`模擬運行中 · ${20*speed} ticks／秒`:'已暫停 · 等待指令';el<HTMLButtonElement>('step').disabled=!connected||graphicsFailed||v;}
// Selection is UI state only; the Worker never sees it. Only own (blue) units can be selected.
function select(ids:Iterable<number>){if(selectedBuilding&&[...ids].length)selectedBuilding=null;const own=new Set(state.units.filter(u=>u.player===0).map(u=>u.id));selected=new Set([...ids].filter(id=>own.size===0||own.has(id)));
 document.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach(b=>b.setAttribute('aria-pressed',String(selected.has(Number(b.dataset.unit)))));
 const ids2=[...selected].sort((a,b)=>a-b);el('selected').textContent=ids2.length?ids2.map(id=>`#${String(id).padStart(2,'0')}`).join(' '):'未選取';render();}
function choose(id:number){select([id]);}
// Construction UI. Costs and names come from the ruleset; the Worker re-validates everything.
const costOf=(k:string)=>rules.entries.find(e=>e.id===k)!.cost;
const costText=(k:string)=>Object.entries(costOf(k)).filter(([,v])=>v>0).map(([r,v])=>`${resourceNames[r]} ${v}`).join('、');
const entryName=(k:string)=>rules.entries.find(e=>e.id===k)?.name??k;
const ageNames=['','第一時代',entryName('age-2'),entryName('age-3'),entryName('age-4')];
const unitNames:Record<string,string>={villager:'村民',militia:'近戰民兵',archer:'弓手'};
const villagersIn=(ids:Iterable<number>)=>[...ids].filter(id=>state.units.find(u=>u.id===id)?.kind==='villager').sort((a,b)=>a-b);
const leftOut=(ids:number[])=>{const n=selected.size-ids.length;return n>0?`（${n} 名士兵不能採集或建造，未派出）`:'';};
function buildBlocker(k:BuildKind){if(!villagersIn(selected).length)return '先選取村民';const st=state.economy.stock,c=costOf(k),short=(Object.keys(c) as (keyof typeof c)[]).filter(r=>st[r]<c[r]);return short.length?short.map(r=>`${resourceNames[r]}不足：需要 ${c[r]}，目前 ${st[r]}`).join('；'):null;}
function renderBuild(){for(const k of buildKinds){const b=el<HTMLButtonElement>(`build-${k}`),why=buildBlocker(k);b.textContent=`${buildingNames[k]} · ${costText(k)}`;b.disabled=!connected||graphicsFailed||!!why;b.title=why??`放置${buildingNames[k]}`;b.setAttribute('aria-pressed',String(placing===k));}
 const reasons=buildKinds.map(k=>[k,buildBlocker(k)] as const).filter(([,w])=>w);
 el('build-reason').textContent=placing?(preview?.problem?`不能放在這裡：${preview.problem}`:`左鍵放置${buildingNames[placing]}；Shift＋左鍵連續放置；右鍵或 Esc 取消。`):reasons.length===buildKinds.length&&reasons[0][1]==='先選取村民'?'先選取村民才能建造。':reasons.map(([k,w])=>`${buildingNames[k]}：${w}`).join('　');}
function renderBuilding(){const panel=el('building-panel'),b=state.buildings.find(b=>b.id===selectedBuilding);panel.hidden=!b;if(!b)return;
 const builders=state.units.filter(u=>u.work==='building'||u.work==='toSite').length;
 el('building-title').textContent=buildingNames[b.kind]??b.kind;const housing=buildingRules.capacity[b.kind as keyof typeof buildingRules.capacity]??0;
 el('building-status').textContent=(b.hp<b.maxHp?`生命 ${b.hp}/${b.maxHp} · `:'')+(b.complete?(housing?`已完工 · 提供人口 ${housing}`:'已完工'):`施工中 ${Math.floor(b.work*100/b.required)}%（全體施工中的村民：${builders} 名）`);
 renderProduction(b);const cancel=el<HTMLButtonElement>('cancel-build');cancel.hidden=b.complete;cancel.textContent=b.kind in buildingNames&&!b.complete?`取消建造（退回 ${costText(b.kind as BuildKind)}）`:'取消建造';}
// Conquest result from the Worker; the sim refuses further orders, so the only action offered is a new game.
function renderOutcome(){const o=state.outcome,box=el('result');box.hidden=!o;if(!o)return;const won=o.winner===0;
 el('result-title').textContent=won?'勝利':o.winner===null?'雙方同歸於盡':'戰敗';el('result-detail').textContent=`tick ${o.tick}：${won?'紅方已沒有任何單位與建築。':'藍方已沒有任何單位與建築。'}`;if(running)setRunning(false);}
function reportTransactions(){for(const t of state.transactions)if(t.sequence>lastTransaction){lastTransaction=t.sequence;if(!t.ok)notice(`指令在 tick ${t.tick} 未執行：${t.error}`);}}
function selectBuilding(id:string|null){selectedBuilding=id;if(id)select([]);render();}
function buildingAt(x:number,y:number){const p={x:Math.round(x*100),y:Math.round(y*100)};return state.known.map(k=>k.obstacle).find(o=>(o.kind==='house'||o.kind==='barracks'||o.kind==='town-center')&&!o.red&&(()=>{const [x0,y0,x1,y1]=obstacleBounds(o);return p.x>=x0&&p.x<=x1&&p.y>=y0&&p.y<=y1;})());}
function placeAt(k:BuildKind,gx:number,gy:number){const [x0,y0,x1,y1]=obstacleBounds({kind:k,x:0,y:0}),x=Math.round((gx*100-(x0+x1)/2)/50)*50,y=Math.round((gy*100-(y0+y1)/2)/50)*50;
 const problem=placementProblem({tiles:state.terrain,obstacles:state.known.map(o=>o.obstacle),units:state.units,explored:t=>(state.fog[t]??0)>0},k,x,y);return {x,y,problem};}
function stopPlacing(message?:string){placing=null;preview=null;scene?.setGhost(null);if(message)notice(message);render();}
async function build(k:BuildKind,x:number,y:number){const unitIds=villagersIn(selected);if(!unitIds.length){notice('所選單位中沒有村民。');return;}
 try{await client.request({kind:'build',unitIds,building:k,x,y});notice(`${names(unitIds)} 前往建造${buildingNames[k]}；放置時扣除 ${costText(k)}。${leftOut(unitIds)}`);}catch(e){notice((e as Error).message);}}
async function construct(buildingId:string){const unitIds=villagersIn(selected);if(!unitIds.length){notice('所選單位中沒有村民，不能施工。');return;}try{await client.request({kind:'construct',unitIds,buildingId});notice(`${names(unitIds)} 前往協助施工。${leftOut(unitIds)}`);}catch(e){notice((e as Error).message);}}
// Production panel: buttons are rebuilt only when the building or its queue changes, so a click is never lost.
let productionKey='',queueKey='';
function renderProduction(b:View['buildings'][number]){
 const entries=Object.entries(rules.production).filter(([,p])=>p===b.kind).map(([id])=>id),box=el('production');
 const key=b.id+':'+entries.join();if(key!==productionKey){productionKey=key;box.replaceChildren(...entries.map(id=>{const btn=document.createElement('button');btn.dataset.train=id;btn.onclick=()=>void train(b.id,id);return btn;}));}
 const e=state.economy,own=state.buildings,reasons:string[]=[];
 for(const btn of Array.from(box.querySelectorAll<HTMLButtonElement>('button'))){const id=btn.dataset.train!,why=trainBlocker({player:0,age:e.age,building:b,ownBuildings:own,stock:e.stock,populationUsed:e.populationUsed,populationReserved:e.populationReserved,populationCap:e.populationCap},id);
  const [name,cost]=btn.children.length?Array.from(btn.children) as HTMLElement[]:[document.createElement('span'),document.createElement('span')];if(!btn.children.length)btn.append(name,cost);name.textContent=entryName(id);cost.textContent=costText(id);btn.disabled=!connected||graphicsFailed||!!why;btn.title=why??`加入${entryName(id)}`;if(why&&why!=='已研究')reasons.push(`${entryName(id)}：${why}`);}
 el('production-reason').textContent=b.complete?reasons.join('　'):'';
 const qkey=b.queue.map(q=>q.id).join();if(qkey!==queueKey){queueKey=qkey;el('queue').replaceChildren(...b.queue.map((q,i)=>{const row=document.createElement('div'),label=document.createElement('span'),cancel=document.createElement('button');label.dataset.item=String(q.id);cancel.textContent='取消';cancel.onclick=()=>void cancelTrain(b.id,q.id);row.append(label,cancel);return row;}));}
 for(const label of Array.from(el('queue').querySelectorAll<HTMLElement>('span[data-item]'))){const q=b.queue.find(q=>q.id===Number(label.dataset.item));if(!q)continue;const first=b.queue[0]===q;label.textContent=`${entryName(q.entryId)} · ${first?(q.work>=q.required?'完成，等待出口空位':`${Math.floor(q.work*100/q.required)}%`):'排隊中'}`;}
 el('rally-hint').textContent=b.complete&&entries.some(id=>!/^age-/.test(id))?`集結點：${b.rally?`(${(b.rally.x/100).toFixed(1)}, ${(b.rally.y/100).toFixed(1)})`:'未設定'}（選取此建築時對地面按右鍵設定）`:'';
}
async function train(buildingId:string,entryId:string){try{await client.request({kind:'train',buildingId,entryId});notice(`${entryName(entryId)}將在 tick ${state.tick+1} 加入佇列並扣除 ${costText(entryId)}。${running?'':'按「開始模擬」或「前進 1 tick」執行。'}`);}catch(e){notice((e as Error).message);}}
async function cancelTrain(buildingId:string,itemId:number){try{const q=state.buildings.find(b=>b.id===buildingId)?.queue.find(q=>q.id===itemId);await client.request({kind:'cancelTrain',buildingId,itemId});notice(`已取消${q?entryName(q.entryId):'項目'}，全額退回。`);}catch(e){notice((e as Error).message);}}
async function rally(buildingId:string,x:number,y:number){try{await client.request({kind:'rally',buildingId,x:Math.round(x*100),y:Math.round(y*100)});notice(`集結點設在 (${x.toFixed(1)}, ${y.toFixed(1)})。`);}catch(e){notice((e as Error).message);}}
function toggle(id:number){const next=new Set(selected);if(next.has(id))next.delete(id);else next.add(id);select(next);}
const client=new SimulationClient(rules.settings.seed,v=>{state=v;render();},reason=>{connected=false;setRunning(false);toggleControls();notice(reason);el('worker-retry').hidden=false;});
function toggleControls(){for(const id of ['zoom-in','zoom-out','rotate-view','reset-view'])el<HTMLButtonElement>(id).disabled=!scene||graphicsFailed;for(const id of ['move','stop','pause','step','restart','save','load','replay'])el<HTMLButtonElement>(id).disabled=!connected||(graphicsFailed&&id!=='save')||(id==='step'&&running);}
async function connect(){el<HTMLButtonElement>('worker-retry').disabled=true;try{await client.connect();connected=true;el('worker-retry').hidden=true;notice(`模擬已連線 · tick ${state.tick}。選取村民，再對地面按右鍵下達移動。`);}catch{}finally{toggleControls();el<HTMLButtonElement>('worker-retry').disabled=false;}}
el('worker-retry').onclick=()=>void connect();
const kindOf=(id:number)=>unitNames[state.units.find(u=>u.id===id)?.kind??'villager'];
const names=(ids:number[])=>ids.length>3?`${ids.length} 名單位`:ids.map(id=>`${kindOf(id)} ${id}`).join('、');
async function move(x:number,y:number){const unitIds=[...selected].sort((a,b)=>a-b);if(!unitIds.length){notice('請先選取村民：左鍵點選或拖曳框選。');return;}
 try{await client.request({kind:'move',unitIds,x:Math.round(x*100),y:Math.round(y*100)});notice(`${names(unitIds)} 的移動指令已排入 tick ${state.tick+1}。${running?'':'按「開始模擬」或「前進 1 tick」執行。'}`);}catch(e){notice((e as Error).message);}}
async function gather(resourceId:string){const unitIds=villagersIn(selected);if(!unitIds.length){notice(selected.size?'所選單位中沒有村民，不能採集。':'請先選取村民。');return;}
 try{await client.request({kind:'gather',unitIds,resourceId});notice(`${names(unitIds)} 前往採集。${leftOut(unitIds)}${running?'':'按「開始模擬」執行。'}`);}catch(e){notice((e as Error).message);}}
// A right-click inside a visible resource's footprint is a gather order; ground elsewhere is a move.
function resourceAt(x:number,y:number){const p={x:Math.round(x*100),y:Math.round(y*100)};return state.resources.find(r=>{const kind=(r.kind==='stone'?'rock':r.kind) as ObstacleKind;if(r.kind==='fish')return Math.abs(p.x-r.x)<=50&&Math.abs(p.y-r.y)<=50;const [x0,y0,x1,y1]=obstacleBounds({kind,x:r.x,y:r.y},10);return p.x>=x0&&p.x<=x1&&p.y>=y0&&p.y<=y1;});}
async function stop(){const unitIds=[...selected].sort((a,b)=>a-b);if(!unitIds.length){notice('請先選取要停止的村民。');return;}
 try{await client.request({kind:'stop',unitIds});notice(`${names(unitIds)} 將在下一個節點停下（tick ${state.tick+1}）。`);}catch(e){notice((e as Error).message);}}
// Pointer: left click selects, left drag (4 px or more) box-selects, Shift adds/removes; right click on ground moves.
const box=el('select-box');let drag:{x:number;y:number;id:number;box:boolean}|null=null;
function showBox(x0:number,y0:number,x1:number,y1:number){const r=canvas.getBoundingClientRect();Object.assign(box.style,{left:`${Math.min(x0,x1)-r.left}px`,top:`${Math.min(y0,y1)-r.top}px`,width:`${Math.abs(x1-x0)}px`,height:`${Math.abs(y1-y0)}px`});box.hidden=false;}
function endDrag(){drag=null;box.hidden=true;}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
// Arrow keys pan only while the scene is the last thing clicked; elsewhere they keep scrolling the page.
let sceneActive=false;document.addEventListener('pointerdown',e=>{sceneActive=e.target===canvas;},true);
canvas.addEventListener('pointermove',e=>{if(!placing||!scene)return;const g=scene.pickGround(e.clientX,e.clientY);if(g.x===undefined||g.y===undefined){scene.setGhost(null);return;}
 preview=placeAt(placing,g.x,g.y);scene.setGhost({kind:placing,x:preview.x,y:preview.y,ok:!preview.problem});renderBuild();});
canvas.addEventListener('pointerdown',e=>{if(!scene||graphicsFailed)return;
 if(placing){e.preventDefault();if(e.button!==0){stopPlacing('已取消放置。');return;}const g=scene.pickGround(e.clientX,e.clientY);if(g.x===undefined||g.y===undefined)return;
  const p=placeAt(placing,g.x,g.y);if(p.problem){notice(`不能放在這裡：${p.problem}`);return;}const k=placing;if(!e.shiftKey)stopPlacing();void build(k,p.x,p.y);return;}
 if(e.button===2){e.preventDefault();endDrag();const hit=scene.pickGround(e.clientX,e.clientY);if(hit.x===undefined||hit.y===undefined||hit.x<.5||hit.x>15.5||hit.y<.5||hit.y>15.5){notice('請在地圖內側的地面按右鍵。');return;}
  if(selectedBuilding&&!selected.size){const b=state.buildings.find(b=>b.id===selectedBuilding);if(b?.complete&&Object.values(rules.production).includes(b.kind))void rally(b.id,hit.x,hit.y);else notice('這棟建築沒有集結點。');return;}// Enemy unit under the cursor, then enemy building: attack orders.
  if(selected.size){const u=scene.pick(e.clientX,e.clientY);const foe=u.unitId!==undefined?state.units.find(v=>v.id===u.unitId&&v.player!==0):undefined;if(foe){void attack({kind:'unit',id:foe.id},`紅方${unitNames[foe.kind]}`);return;}
   const fort=enemyBuildingAt(hit.x,hit.y);if(fort){void attack({kind:'building',id:fort.id!},`紅方${buildingNames[fort.kind]}`);return;}}
  const site=buildingAt(hit.x,hit.y),own=site?state.buildings.find(b=>b.id===site.id):undefined;if(own&&!own.complete&&selected.size){void construct(own.id);return;}
  const r=resourceAt(hit.x,hit.y);if(r){void gather(r.id);return;}void move(hit.x,hit.y);return;}
 if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,id:e.pointerId,box:false};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;if(!drag.box&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>=4)drag.box=true;if(drag.box)showBox(drag.x,drag.y,e.clientX,e.clientY);});
canvas.addEventListener('pointercancel',endDrag);
canvas.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.id||!scene)return;const d=drag;endDrag();
 if(d.box){const own=new Set(state.units.filter(u=>u.player===0).map(u=>u.id)),ids=scene.unitsInRect(d.x,d.y,e.clientX,e.clientY).filter(id=>own.has(id));
  if(e.shiftKey)select([...selected,...ids]);else select(ids);notice(ids.length?`框選 ${ids.length} 名村民。對地面按右鍵下達移動。`:'框內沒有藍方村民。');return;}
 const hit=scene.pick(e.clientX,e.clientY);
 if(hit.unitId!==undefined){const unit=state.units.find(u=>u.id===hit.unitId);if(unit?.player===0){if(e.shiftKey)toggle(unit.id);else choose(unit.id);}else notice('紅方單位不可由藍方控制。');return;}
 // Touch has no right button: a tap on the ground moves the current selection instead of clearing it.
 if(e.pointerType==='touch'&&selected.size){const g=scene.pickGround(e.clientX,e.clientY);if(g.x!==undefined&&g.y!==undefined&&g.x>=.5&&g.x<=15.5&&g.y>=.5&&g.y<=15.5){const r=resourceAt(g.x,g.y);if(r)void gather(r.id);else void move(g.x,g.y);return;}}
 {const g=scene.pickGround(e.clientX,e.clientY);const site=g.x!==undefined&&g.y!==undefined?buildingAt(g.x,g.y):undefined;if(site&&!e.shiftKey&&e.pointerType!=='touch'){selectBuilding(site.id!);notice(`已選取${buildingNames[site.kind]}。`);return;}}
 if(!e.shiftKey&&selected.size){select([]);notice('已取消選取。移動指令請對地面按右鍵（觸控：選取後輕觸地面）。');}
 else if(!e.shiftKey&&selectedBuilding)selectBuilding(null);});
// Keyboard shortcuts are ignored while typing in fields (the rules JSON editor is on this page).
const groups=new Map<number,number[]>();
function renderGroups(){el('groups').textContent=groups.size?'編組 '+[...groups].sort((a,b)=>a[0]-b[0]).map(([n,ids])=>`${n}＝${ids.join('、')}`).join('；'):'尚未編組（Ctrl＋數字）。';}
document.addEventListener('keydown',e=>{const t=e.target as HTMLElement;if(t.closest('input,textarea,select,[contenteditable]')||e.altKey||e.metaKey)return;
 if(e.key==='Escape'){if(placing){stopPlacing('已取消放置。');return;}if(drag){endDrag();return;}if(selectedBuilding){selectBuilding(null);return;}if(selected.size){select([]);notice('已取消選取。');}return;}
 if((e.key==='s'||e.key==='S')&&!e.ctrlKey){e.preventDefault();void stop();return;}
 const arrows:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};
 if(arrows[e.key]&&sceneActive&&scene&&!graphicsFailed){e.preventDefault();scene.pan(...arrows[e.key]);return;}
 if((e.key==='f'||e.key==='F')&&!e.ctrlKey&&scene){const chosen=state.units.filter(u=>selected.has(u.id));if(chosen.length){scene.focusOn(chosen.reduce((t,u)=>t+u.x,0)/chosen.length/100,chosen.reduce((t,u)=>t+u.y,0)/chosen.length/100);notice('鏡頭已對準選取的村民。');}return;}
 const digit=/^Digit([1-9])$/.exec(e.code);if(!digit)return;const n=Number(digit[1]);e.preventDefault();
 if(e.ctrlKey){const ids=[...selected].sort((a,b)=>a-b);if(!ids.length){notice('請先選取村民再編組。');return;}groups.set(n,ids);renderGroups();notice(`編組 ${n}：${names(ids)}。按 ${n} 叫回。`);return;}
 const ids=groups.get(n);if(!ids){notice(`編組 ${n} 尚未建立：選取後按 Ctrl＋${n}。`);return;}select(ids);notice(`已叫回編組 ${n}：${names(ids)}。`);});
window.addEventListener('blur',endDrag);
canvas.addEventListener('wheel',e=>{e.preventDefault();if(!graphicsFailed)scene?.zoom(e.deltaY<0?.1:-.1);},{passive:false});
el('zoom-in').onclick=()=>scene?.zoom(.2);el('zoom-out').onclick=()=>scene?.zoom(-.2);el('rotate-view').onclick=()=>scene?.rotate();el('reset-view').onclick=()=>scene?.resetCamera();
document.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach(b=>b.onclick=e=>{const id=Number(b.dataset.unit);if(e.shiftKey)toggle(id);else choose(id);});
el('stop').onclick=()=>void stop();renderGroups();
el('result-restart').onclick=()=>el('restart').click();
for(const k of buildKinds)el(`build-${k}`).onclick=()=>{if(buildBlocker(k))return;placing=k;preview=null;notice(`在場景中移動滑鼠選擇${buildingNames[k]}的位置。`);render();};
el('cancel-build').onclick=async()=>{const b=state.buildings.find(b=>b.id===selectedBuilding);if(!b)return;try{await client.request({kind:'cancelBuild',buildingId:b.id});notice(`已取消${buildingNames[b.kind]}，退回 ${costText(b.kind as BuildKind)}。`);selectBuilding(null);}catch(e){notice((e as Error).message);}};
el('move').onclick=()=>{const x=el<HTMLInputElement>('target-x'),y=el<HTMLInputElement>('target-y');if(x.reportValidity()&&y.reportValidity()&&x.value!==''&&y.value!=='')move(Number(x.value),Number(y.value));else notice('請輸入 0.5 到 15.5 之間的座標。');};
el('pause').onclick=()=>setRunning(!running);
el<HTMLSelectElement>('speed').onchange=e=>{speed=Number((e.target as HTMLSelectElement).value);accumulator=0;if(running)setRunning(true);notice(`模擬速度 ${speed}×（每秒 ${20*speed} ticks，不跳過任何 tick）。`);};
el('step').onclick=async()=>{try{await client.request({kind:'advance',count:1});}catch(e){setRunning(false);notice((e as Error).message);}};
el('restart').onclick=async()=>{setRunning(false);try{const input=el<HTMLInputElement>('seed');if(input.value==='')throw Error('請輸入種子');await client.request({kind:'reset',seed:Number(input.value),layout:el<HTMLSelectElement>('layout').value as MapLayout});choose(1);notice('已建立新沙盒。先前的手動存檔仍然保留。');}catch(e){notice((e as Error).message);}};
el('save').onclick=async()=>{try{const result=await client.request({kind:'snapshot'});localStorage.setItem('brick-rts:sandbox:1',result.snapshot!);notice(`已儲存 tick ${result.tick} 的沙盒。`);}catch(e){notice(`儲存失敗：${(e as Error).message}。先前存檔保留。`);}};
el('load').onclick=async()=>{setRunning(false);try{const raw=localStorage.getItem('brick-rts:sandbox:1');if(!raw)throw Error('尚無手動存檔。');await client.request({kind:'restore',snapshot:raw});el<HTMLInputElement>('seed').value=String(state.seed);el<HTMLSelectElement>('layout').value=state.layout;choose(1);notice(`已恢復 tick ${state.tick}；按開始模擬繼續。`);}catch(e){notice(`讀取失敗：${(e as Error).message}。目前沙盒保留。`);}};
el('replay').onclick=async()=>{setRunning(false);try{const result=await client.request({kind:'replay'});notice(result.replayMatches?`重播一致：${result.tick} ticks，指紋 ${result.stateHash}。`:'重播不一致，請保留目前狀態回報。');}catch(e){notice(`重播失敗：${(e as Error).message}`);}};
const editor=el<HTMLTextAreaElement>('rules-json');const reset=()=>{editor.value=JSON.stringify(rules,null,2);el('validation').textContent='尚未驗證編輯內容。';};reset();
el('reset-rules').onclick=reset;
el('validate').onclick=()=>{try{const errors=validateRules(JSON.parse(editor.value),el<HTMLInputElement>('exact').checked);el('validation').textContent=errors.length?'驗證未通過：\n'+errors.join('\n'):'驗證通過：自訂規則結構有效。原作版本與覆蓋率仍未確認。';}catch{el('validation').textContent='驗證未通過：JSON 格式錯誤。';}};
el('export').onclick=()=>{try{const data=JSON.parse(editor.value),errors=validateRules(data,el<HTMLInputElement>('exact').checked);if(errors.length){el('validation').textContent='匯出失敗：\n'+errors.join('\n');return;}const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='brick-rts-rules.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);el('validation').textContent='已匯出經結構驗證的自訂規則。';}catch{el('validation').textContent='無法匯出：JSON 格式錯誤。';}};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running){setRunning(false);notice('分頁進入背景，沙盒已自動暫停。');}});
window.addEventListener('blur',()=>{if(running){setRunning(false);notice('視窗失焦，沙盒已自動暫停。');}});
new ResizeObserver(()=>render()).observe(canvas.parentElement!);
function frame(time:number){
 if(running){if(last)accumulator+=time-last;last=time;
  if(accumulator>1000){setRunning(false);notice('模擬落後超過 1 秒，已暫停；未跳過任何 tick。');}
  else if(!advancing&&accumulator>=50/speed){const count=Math.min(20,Math.floor(accumulator*speed/50));accumulator-=count*50/speed;advancing=true;
   void client.request({kind:'advance',count}).catch(e=>{setRunning(false);notice((e as Error).message);}).finally(()=>{advancing=false;});}
 }
 if(!graphicsFailed){try{scene?.draw(time);}catch(error){graphicsError(`3D 繪圖失敗：${(error as Error).message}`);}}
 if(!graphicsFailed)requestAnimationFrame(frame);
}
function graphicsError(message:string){graphicsFailed=true;setRunning(false);toggleControls();const box=el('boot-error');box.hidden=false;box.textContent=message;notice('3D 場景暫不可用。若模擬已連線，可先儲存目前沙盒再重新載入。');}
toggleControls();render();
void createScene(canvas,graphicsError).then(result=>{scene=result;toggleControls();scene.update(state,selected);void connect();requestAnimationFrame(frame);}).catch(error=>graphicsError(`3D 載入失敗：${(error as Error).message}`));
