import type {View} from '../../packages/sim/protocol.ts';
import {tileAt} from '../../packages/sim/terrain.ts';
const labels=['未探索','已探索／目前不可見','目前可見'];
export function fogCellSummary(view:Pick<View,'fog'|'known'|'tick'>,x:number,y:number){
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>15||y<0||y>15)return '請輸入 0–15 的整數格座標。';
 const id=y*16+x,state=view.fog[id];if(state===undefined)return '等待視野資料。';
 const memories=state===0?[]:view.known.filter(k=>tileAt(k.obstacle.x,k.obstacle.y)===id&&k.obstacle.kind==='house');
 return `格 (${x}, ${y}) · ${labels[state]} · 投影 tick ${view.tick}`+memories.map(k=>`；${k.obstacle.red?'紅方':'藍方'}住宅：最後看見 tick ${k.lastSeenTick}（${view.tick-k.lastSeenTick} ticks 前）`).join('');
}
export function mountFogDebugger(root:HTMLDetailsElement,getView:()=>View){
 const grid=root.querySelector<HTMLElement>('.fog-grid')!,info=root.querySelector<HTMLElement>('.fog-cell-info')!,memories=root.querySelector<HTMLElement>('.fog-memories')!;
 const x=root.querySelector<HTMLInputElement>('[name="fog-x"]')!,y=root.querySelector<HTMLInputElement>('[name="fog-y"]')!;
 const cells=Array.from({length:256},(_,id)=>{const cell=document.createElement('span');cell.setAttribute('aria-hidden','true');cell.title=`(${id%16}, ${Math.floor(id/16)})`;grid.append(cell);return cell;});
 function update(){if(!root.open)return;const view=getView();
  cells.forEach((cell,id)=>{const value=view.fog[id];cell.dataset.fog=String(value??-1);cell.textContent=value===2?'●':value===1?'·':' ';});
  grid.setAttribute('aria-label',`藍方 16×16 視野：未探索 ${view.fog.filter(v=>v===0).length} 格，舊視野 ${view.fog.filter(v=>v===1).length} 格，目前可見 ${view.fog.filter(v=>v===2).length} 格。`);
  info.textContent=fogCellSummary(view,x.value===''?NaN:Number(x.value),y.value===''?NaN:Number(y.value));
  const houses=view.known.filter(k=>k.obstacle.kind==='house'&&view.fog[tileAt(k.obstacle.x,k.obstacle.y)]>0);
  memories.textContent=houses.length?houses.map(k=>`${k.obstacle.red?'紅方':'藍方'}住宅 (${Math.floor(k.obstacle.x/100)}, ${Math.floor(k.obstacle.y/100)})：最後看見 tick ${k.lastSeenTick}`).join('；'):'尚無已知住宅。';
 }
 root.addEventListener('toggle',update);x.addEventListener('input',update);y.addEventListener('input',update);return {update};
}
