import {clearSegment,position,nearest,navigationRules} from './navigation.ts';
import type {MapData,Point} from './navigation.ts';
// Unit movement on the 31x31 node grid. Engineering rules (design_default), not reference-game values.
// A unit always holds one node, and while crossing an edge also reserves the next node, so two
// unit bodies (radius 25, node spacing 50) never overlap. Units never pass through each other.
export type Navigation='idle'|'searching'|'moving'|'waiting'|'unreachable'|'stuck';
export const navigationStates:readonly Navigation[]=['idle','searching','moving','waiting','unreachable','stuck'];
export type UnitKind='villager'|'militia'|'archer';
export const unitKinds:readonly UnitKind[]=['villager','militia','archer'];
export type Unit={id:number;player:number;kind:UnitKind;x:number;y:number;node:number;next:number|null;path:number[];goal:number|null;target:Point|null;navigation:Navigation;wait:number;detours:number;partial:boolean;order:number;outcome:'stuck'|null};
type Search={frontier:number[];head:number;parent:number[]};
export type GroupJob=Search&{kind:'group';id:number;unitIds:number[];goal:number;starts:number[];held:number[];slots:number[];status:'searching'|'done'};
// targets: any of these nodes ends the search (work slots, drop-off ring); found is the one reached.
export type UnitJob=Search&{kind:'unit';id:number;unitId:number;start:number;goal:number;excluded:number[];best:number;keep:number[];targets:number[]|null;found:number;status:'searching'|'done'};
export type Job=GroupJob|UnitJob;
// navigationSeen: last map.navigationRevision the movement layer has reconciled paths against.
export type MovementState={map:MapData;units:Unit[];pathJobs:Job[];nextJobId:number;navigationSeen:number};
const NODES=961,SIDE=31;
// Derived edge table, rebuilt when navigation changes; never serialized.
const graphs=new WeakMap<MapData,{revision:number;blocked:Uint8Array;open:Uint8Array}>();
function graph(map:MapData){
 let g=graphs.get(map);
 if(!g||g.revision!==map.navigationRevision){
  const blocked=new Uint8Array(NODES),open=new Uint8Array(NODES*2);for(const n of map.blocked)blocked[n]=1;
  for(let id=0;id<NODES;id++){if(blocked[id])continue;const x=id%SIDE,y=Math.floor(id/SIDE);
   if(x<SIDE-1&&!blocked[id+1]&&clearSegment(map,position(id),position(id+1)))open[id*2]=1;
   if(y<SIDE-1&&!blocked[id+SIDE]&&clearSegment(map,position(id),position(id+SIDE)))open[id*2+1]=1;}
  g={revision:map.navigationRevision,blocked,open};graphs.set(map,g);
 }
 return g;
}
// Fixed neighbour order (right, down, left, up) keeps every search deterministic.
export function neighbours(map:MapData,id:number):number[]{
 const {open}=graph(map),x=id%SIDE,out:number[]=[];
 if(open[id*2])out.push(id+1);if(open[id*2+1])out.push(id+SIDE);if(x>0&&open[(id-1)*2])out.push(id-1);if(id>=SIDE&&open[(id-SIDE)*2+1])out.push(id-SIDE);
 return out;
}
export function nodeAt(p:Point):number{const x=(p.x-50)/50,y=(p.y-50)/50;return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<SIDE&&y>=0&&y<SIDE?y*SIDE+x:-1;}
export function makeUnit(id:number,player:number,x:number,y:number,kind:UnitKind='villager'):Unit{const node=nodeAt({x,y});if(node<0)throw Error('單位必須站在導航節點上');return {id,player,kind,x,y,node,next:null,path:[],goal:null,target:null,navigation:'idle',wait:0,detours:0,partial:false,order:0,outcome:null};}
function search(start:number):Search{const parent=Array(NODES).fill(-2);parent[start]=-1;return {frontier:[start],head:0,parent};}
function held(units:Unit[],except:Set<number>){const nodes=new Set<number>();for(const u of units)if(!except.has(u.id)){nodes.add(u.node);if(u.next!==null)nodes.add(u.next);}return [...nodes].sort((a,b)=>a-b);}
function cancel(s:MovementState,id:number){
 for(const job of s.pathJobs)if(job.kind==='group')job.unitIds=job.unitIds.filter(u=>u!==id);
 s.pathJobs=s.pathJobs.filter(j=>j.kind==='group'?j.unitIds.length>0:j.unitId!==id);
}
export function commandMove(s:MovementState,unitIds:number[],target:Point){
 const goal=nearest(s.map,target,false);if(goal<0)throw Error('目標附近沒有可站立的節點');
 const group=new Set(unitIds),units=unitIds.map(id=>s.units.find(u=>u.id===id)!);
 for(const u of units){cancel(s,u.id);Object.assign(u,{path:[],goal:null,target:null,navigation:'searching',wait:0,detours:0,partial:false,order:s.nextJobId,outcome:null});}
 // Stations are chosen from nodes nobody outside the group currently holds.
 s.pathJobs.push({kind:'group',id:s.nextJobId++,unitIds:[...unitIds],goal,starts:units.map(u=>u.next??u.node),held:held(s.units,group),slots:[],status:'searching',...search(goal)});
}
export function commandStop(s:MovementState,unitIds:number[]){
 for(const id of unitIds){const u=s.units.find(u=>u.id===id)!;cancel(s,id);Object.assign(u,{path:[],goal:null,target:null,wait:0,detours:0,partial:false,outcome:null,navigation:u.next===null?'idle':'moving'});}
}
function advance(s:MovementState,job:Job,budget:number):number{
 let used=0;
 while(job.status==='searching'&&used<budget){
  if(job.kind==='group'&&job.slots.length>=job.unitIds.length&&job.starts.every(n=>job.parent[n]!==-2)){job.status='done';break;}
  if(job.head===job.frontier.length){job.status='done';break;}
  const id=job.frontier[job.head++];used++;
  if(job.kind==='group'){if(job.slots.length<job.unitIds.length&&!job.held.includes(id)&&!s.map.blocked.includes(id))job.slots.push(id);}
  else{const g=job.goal,d=(n:number)=>Math.abs(n%SIDE-g%SIDE)+Math.abs(Math.floor(n/SIDE)-Math.floor(g/SIDE));if(d(id)<d(job.best))job.best=id;if(job.targets?job.targets.includes(id):id===g){job.found=id;job.status='done';break;}}
  for(const next of neighbours(s.map,id))if(job.parent[next]===-2&&!(job.kind==='unit'&&job.excluded.includes(next))){job.parent[next]=id;job.frontier.push(next);}
 }
 return used;
}
function chain(parent:number[],from:number){const out=[from];while(parent[out.at(-1)!]>=0)out.push(parent[out.at(-1)!]);return out;}
function finishGroup(s:MovementState,job:GroupJob){
 const order=new Map(job.frontier.map((n,i)=>[n,i]));
 const units=job.unitIds.map(id=>s.units.find(u=>u.id===id)!),start=(u:Unit)=>u.next??u.node;
 // First arrivals take the stations farthest from the side the group approaches from, so a
 // parked unit never stands on a follower's route (a single-file hall fills from the far end).
 const reached=units.filter(u=>order.has(start(u))).sort((a,b)=>order.get(start(a))!-order.get(start(b))!||a.id-b.id);
 const cx=reached.reduce((t,u)=>t+position(start(u)).x,0)/Math.max(1,reached.length),cy=reached.reduce((t,u)=>t+position(start(u)).y,0)/Math.max(1,reached.length);
 const far=(n:number)=>Math.abs(position(n).x-cx)+Math.abs(position(n).y-cy);
 const slots=job.slots.slice(0,reached.length).sort((a,b)=>far(b)-far(a)||order.get(a)!-order.get(b)!);
 reached.forEach((u,i)=>{
  const slot=slots[i];
  if(slot===undefined){Object.assign(u,{navigation:u.next===null?'unreachable':'moving',partial:true});return;}
  const up=chain(job.parent,start(u)),down=chain(job.parent,slot),index=new Map(down.map((n,k)=>[n,k]));
  let i2=0;while(!index.has(up[i2]))i2++;
  u.path=[...up.slice(1,i2+1),...down.slice(0,index.get(up[i2])).reverse()];
  Object.assign(u,{goal:slot,target:position(slot),partial:false,navigation:u.path.length||u.next!==null?'moving':'idle'});
 });
 // Units outside the goal's component head for the closest node they can reach.
 for(const u of units)if(!order.has(start(u)))s.pathJobs.push(unitJob(s,u,job.goal,[],[]));
}
function unitJob(s:MovementState,u:Unit,goal:number,excluded:number[],keep:number[],targets:number[]|null=null):UnitJob{const start=u.next??u.node;return {kind:'unit',id:s.nextJobId++,unitId:u.id,start,goal,excluded,best:start,keep,targets,found:-1,status:'searching',...search(start)};}
// Route one unit to the nearest reachable node of a set (used by work legs). Keeps cargo/work; resets movement state.
export function routeTo(s:MovementState,u:Unit,targets:number[]){
 if(!targets.length)throw Error('沒有可用的目標節點');
 cancel(s,u.id);Object.assign(u,{path:[],goal:null,target:null,navigation:'searching',wait:0,detours:0,partial:false,order:s.nextJobId,outcome:null});
 s.pathJobs.push(unitJob(s,u,targets[0],[],[],[...targets].sort((a,b)=>a-b)));
}
export function cancelMovement(s:MovementState,id:number){cancel(s,id);}
function finishUnit(s:MovementState,job:UnitJob){
 const u=s.units.find(u=>u.id===job.unitId)!,end=job.found>=0?job.found:job.parent[job.goal]!==-2&&!job.targets?job.goal:job.best;
 const path=chain(job.parent,end).reverse().slice(1);
 // A replan only replaces the route when it reaches the goal; otherwise the unit keeps waiting.
 if(job.keep.length&&(end!==job.goal||!path.length)){u.path=job.keep;u.navigation='waiting';return;}
 u.path=path;u.goal=job.targets?end:u.goal??job.goal;u.partial=job.targets?job.found<0:end!==job.goal;u.target=position(end);
 u.navigation=path.length||u.next!==null?'moving':u.partial?'unreachable':'idle';
}
// A new building (or freed ground) changes the graph: restart searches, and reroute any unit whose
// remaining route crosses an edge that no longer exists. Units never step through a new footprint.
function reconcile(s:MovementState){
 if(s.navigationSeen===s.map.navigationRevision)return;s.navigationSeen=s.map.navigationRevision;
 for(const job of s.pathJobs)if(job.status==='searching'){const fresh=search(job.kind==='group'?job.goal:job.start);Object.assign(job,fresh);if(job.kind==='group')job.slots=[];else{job.best=job.start;job.found=-1;}}
 const searching=new Set(s.pathJobs.flatMap(j=>j.kind==='group'?j.unitIds:[j.unitId]));
 for(const u of s.units){if(!u.path.length||searching.has(u.id))continue;
  const route=[u.next??u.node,...u.path];
  if(route.every((n,i)=>i===0||neighbours(s.map,route[i-1]).includes(n)))continue;
  const goal=u.goal??u.path.at(-1)!;u.path=[];u.navigation='searching';s.pathJobs.push(unitJob(s,u,goal,[],[]));}
}
export function stepMovement(s:MovementState):{expanded:number}{
 reconcile(s);
 // Shared deterministic budget, round-robin in job id order.
 s.pathJobs.sort((a,b)=>a.id-b.id);let budget=navigationRules.expansionsPerTick,expanded=0;
 while(budget>0&&s.pathJobs.some(j=>j.status==='searching'))for(const job of s.pathJobs){if(budget<=0)break;if(job.status==='searching'){const n=advance(s,job,1);budget-=n;expanded+=n;}}
 for(const job of s.pathJobs.filter(j=>j.status==='done'))job.kind==='group'?finishGroup(s,job):finishUnit(s,job);
 s.pathJobs=s.pathJobs.filter(j=>j.status==='searching');
 const searching=new Set(s.pathJobs.flatMap(j=>j.kind==='group'?j.unitIds:[j.unitId]));
 const owner=new Int32Array(NODES);for(const u of s.units){owner[u.node]=u.id;if(u.next!==null)owner[u.next]=u.id;}
 const byId=new Map(s.units.map(u=>[u.id,u]));
 function tryReserve(u:Unit){
  if(!u.path.length||searching.has(u.id))return;
  const n=u.path[0],o=owner[n];
  if(o===0||o===u.id){owner[n]=u.id;u.next=n;u.path.shift();u.navigation='moving';u.wait=0;return;}
  const b=byId.get(o)!,idleFriend=b.player===u.player&&b.next===null&&!b.path.length&&!searching.has(b.id);
  const settledMate=idleFriend&&b.order===u.order&&(b.navigation==='idle'||b.navigation==='stuck');
  const toGoal=u.goal===null?Infinity:Math.abs(position(u.goal).x-position(u.node).x)+Math.abs(position(u.goal).y-position(u.node).y);
  // 1. Arrival radius: close to its station and blocked by a group-mate who has settled, settle here.
  if(settledMate&&toGoal<=navigationRules.arrivalRadius){Object.assign(u,{path:[],goal:null,target:null,navigation:'idle',wait:0});return;}
  // 2. An idle friendly unit steps off the requester's route. In single file (no side step) a settled
  //    group-mate trades stations: it walks on to the requester's station and the requester stops here.
  if(idleFriend){
   const free=neighbours(s.map,b.node).filter(c=>owner[c]===0),step=free.find(c=>!u.path.includes(c));
   if(step!==undefined)b.path=[step];
   else if(settledMate&&u.goal!==null&&u.goal!==n){Object.assign(b,{path:u.path.slice(1),goal:u.goal,target:position(u.goal),outcome:null});Object.assign(u,{path:[n],goal:n,target:position(n)});}
   else if(free.length)b.path=[free[0]];
  }
  // 3. Head-on group-mates that each want the other's node swap remaining routes and stations,
  //    so both turn back toward what the other was heading for; nobody passes through anyone.
  //    When each already stands on the other's station, both simply arrive where they are.
  if(b.player===u.player&&b.order===u.order&&b.next===null&&b.path[0]===u.node&&!searching.has(b.id)){
   const mine=u.path.slice(1),theirs=b.path.slice(1),goal=u.goal;
   Object.assign(u,{path:theirs,goal:b.goal,target:b.goal===null?null:position(b.goal)});Object.assign(b,{path:mine,goal,target:goal===null?null:position(goal)});
   for(const v of [u,b])if(!v.path.length)Object.assign(v,{goal:null,target:null,navigation:v.partial?'unreachable':'idle',wait:0});
   tryReserve(u);return;
  }
  // 4. Otherwise wait, then replan within the bounded limits below.
  u.wait++;u.navigation='waiting';
  // wait counts ticks since this unit last advanced a node (reset in the reserve branch above).
  if(u.wait>=navigationRules.stuckTicks){Object.assign(u,{path:[],goal:null,target:null,navigation:'stuck',partial:false,outcome:'stuck',wait:0});return;}
  // A blocker that is itself still travelling is a queue, not an obstacle: retry less often.
  // The higher id replans first, so a head-on pair does not reroute simultaneously.
  const queued=b.next!==null||b.path.length>0||searching.has(b.id);
  if(u.wait%(navigationRules.waitLimit*(queued?navigationRules.queueWaitFactor:1)*(u.id<o?2:1))!==0||u.detours>=navigationRules.detourLimit)return;
  u.detours++;
  const excluded=[...new Set([...s.units.filter(v=>v!==u&&v.next===null).map(v=>v.node),b.node,...(b.next===null?[]:[b.next])])].sort((a,b)=>a-b);
  s.pathJobs.push(unitJob(s,u,u.goal??u.path.at(-1)!,excluded,u.path));u.path=[];u.navigation='searching';searching.add(u.id);
 }
 for(const u of [...s.units].sort((a,b)=>a.id-b.id)){
  if(u.next===null)tryReserve(u);
  if(u.next===null)continue;
  const target=position(u.next),step=navigationRules.speedPerTick;
  const p={x:u.x+Math.sign(target.x-u.x)*Math.min(step,Math.abs(target.x-u.x)),y:u.y+Math.sign(target.y-u.y)*Math.min(step,Math.abs(target.y-u.y))};
  if(!clearSegment(s.map,u,p))throw Error(`entity ${u.id}: 非法碰撞路徑`);
  u.x=p.x;u.y=p.y;
  if(u.x===target.x&&u.y===target.y){
   if(owner[u.node]===u.id)owner[u.node]=0;u.node=u.next;u.next=null;
   if(u.path.length)tryReserve(u);
   else if(!searching.has(u.id)){// A stuck unit that stepped aside for someone keeps reporting its failed order.
    u.navigation=u.outcome==='stuck'?'stuck':u.partial?'unreachable':'idle';u.target=null;u.goal=null;u.wait=0;}
  }
 }
 return {expanded};
}
