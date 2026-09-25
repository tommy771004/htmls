import {mountFogDebugger} from './fog-debug.ts';
import type {MapLayout} from '../../packages/sim/terrain.ts';
import {rules,validateRules} from '../../packages/content/rules.ts';
import {createScene} from './scene.ts';
import {SimulationClient} from './worker-client.ts';
import type {View} from '../../packages/sim/protocol.ts';
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
let state:View={seed:rules.settings.seed,layout:'meadow',terrain:[],tick:0,units:[],fog:[],known:[],resources:[],stateHash:'—'};
let scene:Awaited<ReturnType<typeof createScene>>|null=null,graphicsFailed=false;
let selected=1,running=false,last=0,accumulator=0,advancing=false,connected=false;
const notice=(s:string)=>{el('notice').textContent=s;};
const canvas=el<HTMLCanvasElement>('map');
const fogDebugger=mountFogDebugger(el<HTMLDetailsElement>('fog-debug'),()=>state);
function render(){
 fogDebugger.update();
 if(!graphicsFailed){try{scene?.update(state,selected);}catch(error){graphicsError(`3D 場景更新失敗：${(error as Error).message}`);}}
 el('fog-status').textContent=`可見 ${state.fog.filter(v=>v===2).length} 格 · 已探索舊視野 ${state.fog.filter(v=>v===1).length} 格 · 未探索 ${state.fog.filter(v=>v===0).length} 格`;
 el('world-label').textContent=({meadow:'草甸試驗場',coast:'海岸試驗場',acceptance:'高地與淺灘驗收場'})[state.layout];
 el('tick').textContent=String(state.tick);el('hash').textContent=state.stateHash;
 const u=state.units.find(u=>u.id===selected);if(!u)return;el('position').textContent=`村民 ${selected} · (${(u.x/100).toFixed(1)}, ${(u.y/100).toFixed(1)}) · ${u.navigation==='searching'?'尋路中':u.navigation==='unreachable'?'無可達路徑':u.target?'移動中':'待命'}`;
}
function setRunning(v:boolean){running=v;accumulator=0;last=0;el('pause').textContent=v?'暫停模擬':'開始模擬';el('pause').setAttribute('aria-pressed',String(v));el('run-state').textContent=v?'模擬運行中 · 20 Hz':'已暫停 · 等待指令';el<HTMLButtonElement>('step').disabled=!connected||graphicsFailed||v;}
function choose(id:number){selected=id;document.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.unit)===id)));el('selected').textContent=`#0${id}`;render();}
const client=new SimulationClient(rules.settings.seed,v=>{state=v;render();},reason=>{connected=false;setRunning(false);toggleControls();notice(reason);el('worker-retry').hidden=false;});
function toggleControls(){for(const id of ['zoom-in','zoom-out','rotate-view','reset-view'])el<HTMLButtonElement>(id).disabled=!scene||graphicsFailed;for(const id of ['move','pause','step','restart','save','load','replay'])el<HTMLButtonElement>(id).disabled=!connected||(graphicsFailed&&id!=='save')||(id==='step'&&running);}
async function connect(){el<HTMLButtonElement>('worker-retry').disabled=true;try{await client.connect();connected=true;el('worker-retry').hidden=true;notice(`模擬已連線 · tick ${state.tick}。選取村民，再點地面下達指令。`);}catch{}finally{toggleControls();el<HTMLButtonElement>('worker-retry').disabled=false;}}
el('worker-retry').onclick=()=>void connect();
async function move(x:number,y:number){const unitId=selected;try{await client.request({kind:'move',unitIds:[unitId],x:Math.round(x*100),y:Math.round(y*100)});notice(`村民 ${unitId} 的移動指令已排入 tick ${state.tick+1}。${running?'':'按「開始模擬」或「前進 1 tick」執行。'}`);}catch(e){notice((e as Error).message);}}
canvas.addEventListener('click',e=>{if(!scene||graphicsFailed)return;const hit=scene.pick(e.clientX,e.clientY);
 if(hit.unitId!==undefined){const unit=state.units.find(u=>u.id===hit.unitId);if(unit?.player===0)choose(unit.id);else notice('紅方單位不可由藍方控制。');return;}
 if(hit.x===undefined||hit.y===undefined||hit.x<.5||hit.x>15.5||hit.y<.5||hit.y>15.5){notice('請點選地圖內側的地面。');return;}void move(hit.x,hit.y);});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(!graphicsFailed)scene?.zoom(e.deltaY<0?.1:-.1);},{passive:false});
el('zoom-in').onclick=()=>scene?.zoom(.2);el('zoom-out').onclick=()=>scene?.zoom(-.2);el('rotate-view').onclick=()=>scene?.rotate();el('reset-view').onclick=()=>scene?.resetCamera();
document.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach(b=>b.onclick=()=>choose(Number(b.dataset.unit)));
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
