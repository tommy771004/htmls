import {rules,validateRules} from '../../packages/content/rules.ts';
import {makeMap} from '../../packages/sim/navigation.ts';
import {SimulationClient} from './worker-client.ts';
import type {View} from '../../packages/sim/protocol.ts';
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
let state:View={seed:rules.settings.seed,tick:0,units:[],stateHash:'—'};
let scenery=makeMap(state.seed);
let selected=1,running=false,last=0,accumulator=0,advancing=false,connected=false;
const notice=(s:string)=>{el('notice').textContent=s;};
const canvas=el<HTMLCanvasElement>('map'),ctx=canvas.getContext('2d');
if(!ctx)throw Error('此瀏覽器無法建立 Canvas 2D 畫面');
const g=ctx;
let width=0,height=0,scale=1,ox=0,oy=0;
function point(x:number,y:number,z=0):[number,number]{return [ox+(x-y)*scale,oy+(x+y)*scale*.5-z*scale];}
function polygon(points:[number,number][],fill:string,stroke?:string){g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=.65;g.stroke();}}
function brick(x:number,y:number,z:number,w:number,d:number,h:number,color:string,studs=true){
 const p=(a:number,b:number,c:number)=>point(a,b,c);
 polygon([p(x,y+d,z),p(x+w,y+d,z),p(x+w,y+d,z+h),p(x,y+d,z+h)],color);
 g.fillStyle='#0003';g.beginPath();[p(x,y+d,z),p(x+w,y+d,z),p(x+w,y+d,z+h),p(x,y+d,z+h)].forEach(([a,b],i)=>i?g.lineTo(a,b):g.moveTo(a,b));g.closePath();g.fill();
 polygon([p(x+w,y,z),p(x+w,y+d,z),p(x+w,y+d,z+h),p(x+w,y,z+h)],color);
 polygon([p(x,y,z+h),p(x+w,y,z+h),p(x+w,y+d,z+h),p(x,y+d,z+h)],color,'#34462a22');
 if(studs)for(let a=.25;a<w;a+=.5)for(let b=.25;b<d;b+=.5){const [sx,sy]=p(x+a,y+b,z+h);g.fillStyle='#0002';g.beginPath();g.ellipse(sx,sy,scale*.14,scale*.08,0,0,7);g.fill();g.fillStyle=color;g.beginPath();g.ellipse(sx,sy-scale*.045,scale*.14,scale*.075,0,0,7);g.fill();g.strokeStyle='#fff5';g.lineWidth=.7;g.stroke();}
}
function house(x:number,y:number,red=false){
 const roof=red?'#bd624d':'#466e86';
 brick(x-.15,y-.15,0,2.5,2.3,.18,'#b2ad93');
 for(let level=0;level<4;level++)for(let a=0;a<2;a++)for(let b=0;b<2;b++)brick(x+a,y+b,.18+level*.34,.97,.97,.33,level%2?'#d8c7a7':'#e3d4b6',false);
 // Timber beams, a recessed doorway, window frames, stepped roof tiles, chimney.
 brick(x+.72,y+2,.2,.55,.035,.95,'#514b3e',false);
 brick(x+2,y+.35,.8,.03,.5,.45,'#354c46',false);
 brick(x-.03,y+1.97,1.42,2.09,.08,.13,'#766650',false);
 for(let level=0;level<4;level++)brick(x-.2+level*.23,y-.2,1.6+level*.2,2.4-level*.46,2.4,.18,roof);
 brick(x+1.5,y+.25,2.05,.35,.4,.8,'#b9aa8b');
 const [fx,fy]=point(x+.3,y+.4,3.5);g.strokeStyle='#756b52';g.lineWidth=2;g.beginPath();g.moveTo(fx,fy+scale*.9);g.lineTo(fx,fy);g.stroke();polygon([[fx,fy],[fx+scale*.7,fy+scale*.1],[fx,fy+scale*.38]],roof);
}
function tree(x:number,y:number){brick(x+.15,y+.15,0,.3,.3,.8,'#807057',false);brick(x-.2,y-.2,.7,1,1,.45,'#638360');brick(x-.08,y-.08,1.15,.75,.75,.4,'#779367');brick(x+.06,y+.06,1.55,.48,.48,.3,'#8da777');}
function villager(u:typeof state.units[number]){
 const x=u.x/100,y=u.y/100,blue=u.player===0;
 if(u.id===selected){const p=point(x+.17,y+.17);g.strokeStyle='#fdf9cb';g.lineWidth=2;g.beginPath();g.ellipse(p[0],p[1],scale*.62,scale*.3,0,0,Math.PI*2);g.stroke();}
 brick(x-.1,y,0,.18,.24,.28,'#45514c',false);brick(x+.13,y,0,.18,.24,.28,'#45514c',false);
 brick(x-.12,y-.04,.29,.46,.34,.43,blue?'#47788f':'#b65943',false);
 brick(x-.07,y,.73,.36,.3,.33,'#e6c68c');
 brick(x-.13,y-.06,1.04,.48,.42,.12,blue?'#d9c99e':'#804d3c');
 brick(x-.28,y+.05,.32,.14,.15,.36,'#d2ac75',false);brick(x+.37,y+.05,.32,.14,.15,.36,'#d2ac75',false);
 const p=point(x+.13,y+.1,1.45);g.font=`bold ${Math.max(9,scale*.4)}px system-ui`;g.textAlign='center';g.fillStyle=blue?'#254b62':'#8b3728';g.fillText(blue?String(u.id):'◆',p[0],p[1]);
}
function render(){
 const r=canvas.getBoundingClientRect();if(r.width!==width||r.height!==height){width=r.width;height=r.height;const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*d);canvas.height=Math.round(height*d);g.setTransform(d,0,0,d,0,0);}
 scale=Math.min((width-42)/33,(height-86)/18);ox=width/2;oy=(height-16*scale)/2;
 g.clearRect(0,0,width,height);
 // Seeded presentation stream is separate from authoritative simulation RNG.
 let rng=state.seed||1;const rand=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return (rng>>>0)/4294967296;};
 const objects:{depth:number;draw:()=>void}[]=[];
 for(let x=0;x<16;x++)for(let y=0;y<16;y++){
 const v=rand(),color=v<.15?'#a6b489':v<.4?'#b5c398':'#bfcca1';
 brick(x,y,-.22,1,1,.22,color,false);

 }
 // A small brick path emphasizes scale without promising pathfinding.
 for(let i=6;i<11;i++)brick(i,8,-.015,.9,.9,.05,'#d0c7a3',false);
 for(const o of scenery.obstacles){const x=o.x/100,y=o.y/100;objects.push({depth:x+y+(o.kind==='house'?2:0),draw:()=>{if(o.kind==='house')house(x,y,o.red);else if(o.kind==='tree')tree(x,y);else brick(x,y,0,.65,.7,.35,'#aaa88b');}});}
 for(const u of state.units){if(u.target){const p=point(u.target.x/100,u.target.y/100);g.strokeStyle='#ba633e';g.lineWidth=1.5;g.beginPath();g.ellipse(p[0],p[1],scale*.3,scale*.15,0,0,7);g.stroke();}objects.push({depth:u.x/100+u.y/100,draw:()=>villager(u)});}
 objects.sort((a,b)=>a.depth-b.depth).forEach(o=>o.draw());
 el('tick').textContent=String(state.tick);el('hash').textContent=state.stateHash;
 const u=state.units.find(u=>u.id===selected);if(!u)return;el('position').textContent=`村民 ${selected} · (${(u.x/100).toFixed(1)}, ${(u.y/100).toFixed(1)}) · ${u.navigation==='searching'?'尋路中':u.navigation==='unreachable'?'無可達路徑':u.target?'移動中':'待命'}`;
}
function setRunning(v:boolean){running=v;accumulator=0;last=0;el('pause').textContent=v?'暫停模擬':'開始模擬';el('pause').setAttribute('aria-pressed',String(v));el('run-state').textContent=v?'模擬運行中 · 20 Hz':'已暫停 · 等待指令';el<HTMLButtonElement>('step').disabled=!connected||v;}
function choose(id:number){selected=id;document.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.unit)===id)));el('selected').textContent=`#0${id}`;render();}
const client=new SimulationClient(rules.settings.seed,v=>{if(v.seed!==state.seed)scenery=makeMap(v.seed);state=v;render();},reason=>{connected=false;setRunning(false);toggleControls();notice(reason);el('worker-retry').hidden=false;});
function toggleControls(){for(const id of ['move','pause','step','restart','save','load','replay'])el<HTMLButtonElement>(id).disabled=!connected||(id==='step'&&running);}
async function connect(){el<HTMLButtonElement>('worker-retry').disabled=true;try{await client.connect();connected=true;el('worker-retry').hidden=true;notice(`模擬已連線 · tick ${state.tick}。選取村民，再點地面下達指令。`);}catch{}finally{toggleControls();el<HTMLButtonElement>('worker-retry').disabled=false;}}
el('worker-retry').onclick=()=>void connect();
async function move(x:number,y:number){const unitId=selected;try{await client.request({kind:'move',unitId,x:Math.round(x*100),y:Math.round(y*100)});notice(`村民 ${unitId} 的移動指令已排入 tick ${state.tick+1}。${running?'':'按「開始模擬」或「前進 1 tick」執行。'}`);}catch(e){notice((e as Error).message);}}
canvas.addEventListener('click',e=>{const r=canvas.getBoundingClientRect();const px=e.clientX-r.left,py=e.clientY-r.top;
 const unit=state.units.find(u=>{const p=point(u.x/100,u.y/100,.5);return Math.hypot(p[0]-px,p[1]-py)<Math.max(12,scale*.55);});
 if(unit){if(unit.player===0)choose(unit.id);else notice('紅方單位不可由藍方控制。');return;}
 const dx=(px-ox)/scale,dy=(py-oy)/scale;const x=dy+dx/2,y=dy-dx/2;
 if(x<.5||x>15.5||y<.5||y>15.5){notice('請點選地圖內側的地面。');return;}move(x,y);});
document.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach(b=>b.onclick=()=>choose(Number(b.dataset.unit)));
el('move').onclick=()=>{const x=el<HTMLInputElement>('target-x'),y=el<HTMLInputElement>('target-y');if(x.reportValidity()&&y.reportValidity()&&x.value!==''&&y.value!=='')move(Number(x.value),Number(y.value));else notice('請輸入 0.5 到 15.5 之間的座標。');};
el('pause').onclick=()=>setRunning(!running);
el('step').onclick=async()=>{try{await client.request({kind:'advance',count:1});}catch(e){setRunning(false);notice((e as Error).message);}};
el('restart').onclick=async()=>{setRunning(false);try{const input=el<HTMLInputElement>('seed');if(input.value==='')throw Error('請輸入種子');await client.request({kind:'reset',seed:Number(input.value)});choose(1);notice('已建立新沙盒。先前的手動存檔仍然保留。');}catch(e){notice((e as Error).message);}};
el('save').onclick=async()=>{try{const result=await client.request({kind:'snapshot'});localStorage.setItem('brick-rts:sandbox:1',result.snapshot!);notice(`已儲存 tick ${result.tick} 的沙盒。`);}catch(e){notice(`儲存失敗：${(e as Error).message}。先前存檔保留。`);}};
el('load').onclick=async()=>{setRunning(false);try{const raw=localStorage.getItem('brick-rts:sandbox:1');if(!raw)throw Error('尚無手動存檔。');await client.request({kind:'restore',snapshot:raw});el<HTMLInputElement>('seed').value=String(state.seed);choose(1);notice(`已恢復 tick ${state.tick}；按開始模擬繼續。`);}catch(e){notice(`讀取失敗：${(e as Error).message}。目前沙盒保留。`);}};
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
 requestAnimationFrame(frame);
}
toggleControls();render();void connect();requestAnimationFrame(frame);
