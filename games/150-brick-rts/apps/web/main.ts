import {mountFogDebugger} from './fog-debug.ts';
import type {MapLayout} from '../../packages/sim/terrain.ts';
import {rules,validateRules} from '../../packages/content/rules.ts';
import {createScene} from './scene.ts';
import {SimulationClient} from './worker-client.ts';
import type {View} from '../../packages/sim/protocol.ts';
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
let state:View={seed:rules.settings.seed,layout:'meadow',terrain:[],tick:0,units:[],fog:[],known:[],resources:[],stateHash:'—'};
let scene:Awaited<ReturnType<typeof createScene>>|null=null,graphicsFailed=false;
let selected=new Set<number>([1]),running=false,last=0,accumulator=0,advancing=false,connected=false;
const notice=(s:string)=>{el('notice').textContent=s;};
const canvas=el<HTMLCanvasElement>('map');
const fogDebugger=mountFogDebugger(el<HTMLDetailsElement>('fog-debug'),()=>state);
function render(){
 fogDebugger.update();
 if(!graphicsFailed){try{scene?.update(state,selected);}catch(error){graphicsError(`3D 場景更新失敗：${(error as Error).message}`);}}
 el('fog-status').textContent=`可見 ${state.fog.filter(v=>v===2).length} 格 · 已探索舊視野 ${state.fog.filter(v=>v===1).length} 格 · 未探索 ${state.fog.filter(v=>v===0).length} 格`;
 el('world-label').textContent=({meadow:'草甸試驗場',coast:'海岸試驗場',acceptance:'高地與淺灘驗收場'})[state.layout];
 el('tick').textContent=String(state.tick);el('hash').textContent=state.stateHash;
 const chosen=state.units.filter(u=>selected.has(u.id)).sort((a,b)=>a.id-b.id);
 el('selection-list').textContent=chosen.length>1?chosen.map(u=>`村民 ${u.id} (${(u.x/100).toFixed(1)}, ${(u.y/100).toFixed(1)})：${statusLabel[u.navigation]}`).join('　'):'';
 const u=chosen[0];if(!u){el('position').textContent='未選取村民';return;}
 el('position').textContent=`${chosen.length>1?`${chosen.length} 名選取 · `:''}村民 ${u.id} · (${(u.x/100).toFixed(1)}, ${(u.y/100).toFixed(1)}) · ${statusLabel[u.navigation]}`;
}
const statusLabel:Record<string,string>={idle:'待命',searching:'尋路中',moving:'移動中',waiting:'等待讓路',unreachable:'無法到達，停在最近點',stuck:'受阻停止'};
function setRunning(v:boolean){running=v;accumulator=0;last=0;el('pause').textContent=v?'暫停模擬':'開始模擬';el('pause').setAttribute('aria-pressed',String(v));el('run-state').textContent=v?'模擬運行中 · 20 Hz':'已暫停 · 等待指令';el<HTMLButtonElement>('step').disabled=!connected||graphicsFailed||v;}
// Selection is UI state only; the Worker never sees it. Only own (blue) units can be selected.
function select(ids:Iterable<number>){const own=new Set(state.units.filter(u=>u.player===0).map(u=>u.id));selected=new Set([...ids].filter(id=>own.size===0||own.has(id)));
 document.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach(b=>b.setAttribute('aria-pressed',String(selected.has(Number(b.dataset.unit)))));
 const ids2=[...selected].sort((a,b)=>a-b);el('selected').textContent=ids2.length?ids2.map(id=>`#${String(id).padStart(2,'0')}`).join(' '):'未選取';render();}
function choose(id:number){select([id]);}
function toggle(id:number){const next=new Set(selected);if(next.has(id))next.delete(id);else next.add(id);select(next);}
const client=new SimulationClient(rules.settings.seed,v=>{state=v;render();},reason=>{connected=false;setRunning(false);toggleControls();notice(reason);el('worker-retry').hidden=false;});
function toggleControls(){for(const id of ['zoom-in','zoom-out','rotate-view','reset-view'])el<HTMLButtonElement>(id).disabled=!scene||graphicsFailed;for(const id of ['move','stop','pause','step','restart','save','load','replay'])el<HTMLButtonElement>(id).disabled=!connected||(graphicsFailed&&id!=='save')||(id==='step'&&running);}
async function connect(){el<HTMLButtonElement>('worker-retry').disabled=true;try{await client.connect();connected=true;el('worker-retry').hidden=true;notice(`模擬已連線 · tick ${state.tick}。選取村民，再對地面按右鍵下達移動。`);}catch{}finally{toggleControls();el<HTMLButtonElement>('worker-retry').disabled=false;}}
el('worker-retry').onclick=()=>void connect();
const names=(ids:number[])=>ids.length>3?`${ids.length} 名村民`:ids.map(id=>`村民 ${id}`).join('、');
async function move(x:number,y:number){const unitIds=[...selected].sort((a,b)=>a-b);if(!unitIds.length){notice('請先選取村民：左鍵點選或拖曳框選。');return;}
 try{await client.request({kind:'move',unitIds,x:Math.round(x*100),y:Math.round(y*100)});notice(`${names(unitIds)} 的移動指令已排入 tick ${state.tick+1}。${running?'':'按「開始模擬」或「前進 1 tick」執行。'}`);}catch(e){notice((e as Error).message);}}
async function stop(){const unitIds=[...selected].sort((a,b)=>a-b);if(!unitIds.length){notice('請先選取要停止的村民。');return;}
 try{await client.request({kind:'stop',unitIds});notice(`${names(unitIds)} 將在下一個節點停下（tick ${state.tick+1}）。`);}catch(e){notice((e as Error).message);}}
// Pointer: left click selects, left drag (4 px or more) box-selects, Shift adds/removes; right click on ground moves.
const box=el('select-box');let drag:{x:number;y:number;id:number;box:boolean}|null=null;
function showBox(x0:number,y0:number,x1:number,y1:number){const r=canvas.getBoundingClientRect();Object.assign(box.style,{left:`${Math.min(x0,x1)-r.left}px`,top:`${Math.min(y0,y1)-r.top}px`,width:`${Math.abs(x1-x0)}px`,height:`${Math.abs(y1-y0)}px`});box.hidden=false;}
function endDrag(){drag=null;box.hidden=true;}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{if(!scene||graphicsFailed)return;
 if(e.button===2){e.preventDefault();endDrag();const hit=scene.pickGround(e.clientX,e.clientY);if(hit.x===undefined||hit.y===undefined||hit.x<.5||hit.x>15.5||hit.y<.5||hit.y>15.5){notice('請在地圖內側的地面按右鍵。');return;}void move(hit.x,hit.y);return;}
 if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,id:e.pointerId,box:false};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;if(!drag.box&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>=4)drag.box=true;if(drag.box)showBox(drag.x,drag.y,e.clientX,e.clientY);});
canvas.addEventListener('pointercancel',endDrag);
canvas.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.id||!scene)return;const d=drag;endDrag();
 if(d.box){const own=new Set(state.units.filter(u=>u.player===0).map(u=>u.id)),ids=scene.unitsInRect(d.x,d.y,e.clientX,e.clientY).filter(id=>own.has(id));
  if(e.shiftKey)select([...selected,...ids]);else select(ids);notice(ids.length?`框選 ${ids.length} 名村民。對地面按右鍵下達移動。`:'框內沒有藍方村民。');return;}
 const hit=scene.pick(e.clientX,e.clientY);
 if(hit.unitId!==undefined){const unit=state.units.find(u=>u.id===hit.unitId);if(unit?.player===0){if(e.shiftKey)toggle(unit.id);else choose(unit.id);}else notice('紅方單位不可由藍方控制。');return;}
 // Touch has no right button: a tap on the ground moves the current selection instead of clearing it.
 if(e.pointerType==='touch'&&selected.size){const g=scene.pickGround(e.clientX,e.clientY);if(g.x!==undefined&&g.y!==undefined&&g.x>=.5&&g.x<=15.5&&g.y>=.5&&g.y<=15.5){void move(g.x,g.y);return;}}
 if(!e.shiftKey&&selected.size){select([]);notice('已取消選取。移動指令請對地面按右鍵（觸控：選取後輕觸地面）。');}});
// Keyboard shortcuts are ignored while typing in fields (the rules JSON editor is on this page).
const groups=new Map<number,number[]>();
function renderGroups(){el('groups').textContent=groups.size?'編組 '+[...groups].sort((a,b)=>a[0]-b[0]).map(([n,ids])=>`${n}＝${ids.join('、')}`).join('；'):'尚未編組（Ctrl＋數字）。';}
document.addEventListener('keydown',e=>{const t=e.target as HTMLElement;if(t.closest('input,textarea,select,[contenteditable]')||e.altKey||e.metaKey)return;
 if(e.key==='Escape'){if(drag){endDrag();return;}if(selected.size){select([]);notice('已取消選取。');}return;}
 if((e.key==='s'||e.key==='S')&&!e.ctrlKey){e.preventDefault();void stop();return;}
 const digit=/^Digit([1-9])$/.exec(e.code);if(!digit)return;const n=Number(digit[1]);e.preventDefault();
 if(e.ctrlKey){const ids=[...selected].sort((a,b)=>a-b);if(!ids.length){notice('請先選取村民再編組。');return;}groups.set(n,ids);renderGroups();notice(`編組 ${n}：${names(ids)}。按 ${n} 叫回。`);return;}
 const ids=groups.get(n);if(!ids){notice(`編組 ${n} 尚未建立：選取後按 Ctrl＋${n}。`);return;}select(ids);notice(`已叫回編組 ${n}：${names(ids)}。`);});
window.addEventListener('blur',endDrag);
canvas.addEventListener('wheel',e=>{e.preventDefault();if(!graphicsFailed)scene?.zoom(e.deltaY<0?.1:-.1);},{passive:false});
el('zoom-in').onclick=()=>scene?.zoom(.2);el('zoom-out').onclick=()=>scene?.zoom(-.2);el('rotate-view').onclick=()=>scene?.rotate();el('reset-view').onclick=()=>scene?.resetCamera();
document.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach(b=>b.onclick=e=>{const id=Number(b.dataset.unit);if(e.shiftKey)toggle(id);else choose(id);});
el('stop').onclick=()=>void stop();renderGroups();
el('move').onclick=()=>{const x=el<HTMLInputElement>('target-x'),y=el<HTMLInputElement>('target-y');if(x.reportValidity()&&y.reportValidity()&&x.value!==''&&y.value!=='')move(Number(x.value),Number(y.value));else notice('請輸入 0.5 到 15.5 之間的座標。');};
el('pause').onclick=()=>setRunning(!running);
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
  else if(!advancing&&accumulator>=50){const count=Math.floor(accumulator/50);accumulator-=count*50;advancing=true;
   void client.request({kind:'advance',count}).catch(e=>{setRunning(false);notice((e as Error).message);}).finally(()=>{advancing=false;});}
 }
 if(!graphicsFailed){try{scene?.draw(time);}catch(error){graphicsError(`3D 繪圖失敗：${(error as Error).message}`);}}
 if(!graphicsFailed)requestAnimationFrame(frame);
}
function graphicsError(message:string){graphicsFailed=true;setRunning(false);toggleControls();const box=el('boot-error');box.hidden=false;box.textContent=message;notice('3D 場景暫不可用。若模擬已連線，可先儲存目前沙盒再重新載入。');}
toggleControls();render();
void createScene(canvas,graphicsError).then(result=>{scene=result;toggleControls();scene.update(state,selected);void connect();requestAnimationFrame(frame);}).catch(error=>graphicsError(`3D 載入失敗：${(error as Error).message}`));
