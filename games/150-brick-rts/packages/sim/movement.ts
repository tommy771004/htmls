import {clearSegment,position,nearest,nearestOpen,navigationRules,sideOf,nodeTotal,nodeAt,nodesNear,dirtyLog,searchBudget,blockedFor} from './navigation.ts';
import {obstacleBounds} from '../content/footprints.ts';
export {nodeAt} from './navigation.ts';
import type {MapData,Point} from './navigation.ts';
// Unit movement on the 31x31 node grid. Engineering rules (design_default), not reference-game values.
// A unit always holds one node, and while crossing an edge also reserves the next node, so two
// unit bodies (radius 25, node spacing 50) never overlap. Units never pass through each other.
export type Navigation='idle'|'searching'|'moving'|'waiting'|'unreachable'|'stuck';
export const navigationStates:readonly Navigation[]=['idle','searching','moving','waiting','unreachable','stuck'];
export type UnitKind='villager'|'militia'|'archer'|'scout'|'monk'|'sheep'|'deer'|'boar'|'spearman'|'skirmisher'|'knight'|'ram'|'longbowman'|'woad-raider'|'throwing-axeman'|'huskarl'|'teutonic-knight'|'berserk'|'cataphract'|'war-elephant'|'mameluke'|'janissary'|'chu-ko-nu'|'samurai'|'mangudai'|'cavalry-archer'|'camel'|'mangonel'|'scorpion'|'trebuchet'|'petard'|'hand-cannoneer'|'bombard-cannon'|'fishing-ship'|'transport-ship'|'trade-cog'|'trade-cart'|'galley'|'fire-galley'|'demolition-raft'|'cannon-galleon'|'longboat';
// Appended in order: the Worker's Int32 unit projection encodes the index.
// Append only: the Worker projects a unit's kind as its index here.
export const unitKinds:readonly UnitKind[]=['villager','militia','archer','scout','monk','sheep','deer','boar','spearman','skirmisher','knight','ram','longbowman','woad-raider','throwing-axeman','huskarl','teutonic-knight','berserk','cataphract','war-elephant','mameluke','janissary','chu-ko-nu','samurai','mangudai','cavalry-archer','camel','mangonel','scorpion','trebuchet','petard','hand-cannoneer','bombard-cannon','fishing-ship','transport-ship','trade-cog','trade-cart','galley','fire-galley','demolition-raft','cannon-galleon','longboat'];
import {combatRules,speedOf,statsOf} from './stats.ts';
import {ownerOf} from './civ.ts';
import {isAnimal} from './fauna.ts';
// hp: current hit points (combatRules.units[kind].hp at spawn); hitTick: last tick it took damage.
// stride: distance carried over to the next tick (a fractional speed's remainder, a step cut short on a node mid-walk).
export type Unit={stride?:number;id:number;player:number;kind:UnitKind;hp:number;hitTick:number;x:number;y:number;node:number;next:number|null;path:number[];goal:number|null;target:Point|null;navigation:Navigation;wait:number;detours:number;partial:boolean;order:number;outcome:'stuck'|null};
type Search={frontier:number[];head:number;parent:number[]};
// layer: the graph the search walks (ships: water); player: whose gates open (land).
export type GroupJob=Search&{layer?:'water';player?:number;kind:'group';id:number;unitIds:number[];goal:number;starts:number[];held:number[];slots:number[];status:'searching'|'done'};
// targets: any of these nodes ends the search (work slots, drop-off ring); found is the one reached.
export type UnitJob=Search&{layer?:'water';player?:number;kind:'unit';id:number;unitId:number;start:number;goal:number;excluded:number[];best:number;keep:number[];targets:number[]|null;found:number;status:'searching'|'done'};
export type Job=GroupJob|UnitJob;
// navigationSeen: last map.navigationRevision the movement layer has reconciled paths against.
export type MovementState={map:MapData;units:Unit[];pathJobs:Job[];nextJobId:number;navigationSeen:number};
// Which graph a unit walks: ships (class 'ship') sail the water layer, everything else the land layer.
export type Layer='land'|'water';
export const layerOf=(kind:string):Layer=>kind in combatRules.units&&combatRules.units[kind as keyof typeof combatRules.units].classes.includes('ship')?'water':'land';
// Derived edge tables per layer, rebuilt when navigation changes; never serialized. Each layer catches up on the map's
// dirty-area log from its own cursor; a new map object (or a revision bumped by hand) rebuilds the whole table.
type Graph={revision:number;cursor:number;blocked:Uint8Array;open:Uint8Array};
const graphs=new WeakMap<MapData,Partial<Record<Layer,Graph>>>();
function graph(map:MapData,layer:Layer='land'):Graph{
 const all=graphs.get(map)??graphs.set(map,{}).get(map)!;let g=all[layer];
 if(!g||g.revision!==map.navigationRevision){
  const SIDE=sideOf(map),NODES=nodeTotal(map),blocked=blockedFor(map,layer).slice(),log=dirtyLog(map);
  const areas=g&&g.open.length===NODES*2?log.slice(g.cursor):null,open=areas?g!.open:new Uint8Array(NODES*2);
  const edges=(id:number)=>{open[id*2]=0;open[id*2+1]=0;if(blocked[id])return;const x=id%SIDE,y=Math.floor(id/SIDE);
   if(x<SIDE-1&&!blocked[id+1]&&clearSegment(map,position(map,id),position(map,id+1),layer))open[id*2]=1;
   if(y<SIDE-1&&!blocked[id+SIDE]&&clearSegment(map,position(map,id),position(map,id+SIDE),layer))open[id*2+1]=1;};
  if(areas){const seen=new Set<number>();for(const area of areas)for(const id of nodesNear(map,area,50))if(!seen.has(id)){seen.add(id);edges(id);}}
  else for(let id=0;id<NODES;id++)edges(id);
  g={revision:map.navigationRevision,cursor:log.length,blocked,open};all[layer]=g;
  // The log is only needed until every layer has caught up; trim it when it grows long.
  if(log.length>4096&&Object.values(all).every(v=>v!.cursor===log.length)){log.length=0;for(const v of Object.values(all))v!.cursor=0;}
 }
 return g;
}
// Gates (packages/content/footprints.ts gateKinds) are open ground in the land graph; for the other player they are
// closed: the edges of the nodes inside an enemy gate (radius-expanded) are removed. Cached per revision and player.
export const gateKinds=new Set(['gate','palisade-gate']);
const gateGraphs=new WeakMap<MapData,Record<number,{revision:number;open:Uint8Array;blocked:Uint8Array}>>();
function landFor(map:MapData,player:number){
 const base=graph(map,'land');if(player<0)return base;
 const gates=map.obstacles.filter(o=>gateKinds.has(o.kind)&&o.progress===undefined&&(o.red?1:0)!==player);if(!gates.length)return base;
 const all=gateGraphs.get(map)??gateGraphs.set(map,{}).get(map)!;let g=all[player];
 if(!g||g.revision!==map.navigationRevision){const SIDE=sideOf(map),open=base.open.slice(),blocked=base.blocked.slice();
  for(const o of gates)for(const id of nodesNear(map,obstacleBounds(o,navigationRules.radius),0)){blocked[id]=1;open[id*2]=0;open[id*2+1]=0;if(id%SIDE>0)open[(id-1)*2]=0;if(id>=SIDE)open[(id-SIDE)*2+1]=0;}
  g={revision:map.navigationRevision,open,blocked};all[player]=g;}
 return g;
}
const graphFor=(map:MapData,layer:Layer='land',player=-1)=>layer==='water'?graph(map,'water'):landFor(map,player);
// Test hook: the table a full rebuild would produce, for comparison with the incremental one.
export function fullGraph(map:MapData,layer:Layer='land'){const copy={...map};return graph(copy as MapData,layer).open.slice();}
export function currentGraph(map:MapData,layer:Layer='land'){return graph(map,layer).open.slice();}
// Fixed neighbour order (right, down, left, up) keeps every search deterministic.
export function neighbours(map:MapData,id:number,layer:Layer='land',player=-1):number[]{
 const {open}=graphFor(map,layer,player),SIDE=sideOf(map),x=id%SIDE,out:number[]=[];
 if(open[id*2])out.push(id+1);if(open[id*2+1])out.push(id+SIDE);if(x>0&&open[(id-1)*2])out.push(id-1);if(id>=SIDE&&open[(id-SIDE)*2+1])out.push(id-SIDE);
 return out;
}
// Whether a unit of this layer and player may stand on a node.
export const closedFor=(map:MapData,id:number,layer:Layer='land',player=-1)=>graphFor(map,layer,player).blocked[id]===1;
// The whole table at once (approach rings, work slots): 1 where a unit of this layer and player may not stand.
export const blockedOf=(map:MapData,layer:Layer='land',player=-1)=>graphFor(map,layer,player).blocked;
const unitLayer=(u:{kind:string;player:number})=>({layer:layerOf(u.kind),player:u.player});
export function makeUnit(map:{size:number},id:number,player:number,x:number,y:number,kind:UnitKind='villager'):Unit{const node=nodeAt(map,{x,y});if(node<0)throw Error('單位必須站在導航節點上');return {id,player,kind,hp:combatRules.units[kind].hp,hitTick:-1,x,y,node,next:null,path:[],goal:null,target:null,navigation:'idle',wait:0,detours:0,partial:false,order:0,outcome:null};}
function search(map:{size:number},start:number):Search{const parent=Array(nodeTotal(map)).fill(-2);parent[start]=-1;return {frontier:[start],head:0,parent};}
function held(units:Unit[],except:Set<number>){const nodes=new Set<number>();for(const u of units)if(!except.has(u.id)){nodes.add(u.node);if(u.next!==null)nodes.add(u.next);}return [...nodes].sort((a,b)=>a-b);}
function cancel(s:MovementState,id:number){
 for(const job of s.pathJobs)if(job.kind==='group')job.unitIds=job.unitIds.filter(u=>u!==id);
 s.pathJobs=s.pathJobs.filter(j=>j.kind==='group'?j.unitIds.length>0:j.unitId!==id);
}
export function commandMove(s:MovementState,unitIds:number[],target:Point){
 // Ships and land units of one order travel as separate groups, each on its own layer.
 const all=unitIds.map(id=>s.units.find(u=>u.id===id)!),layers=[...new Set(all.map(u=>layerOf(u.kind)))];
 for(const layer of layers){const units=all.filter(u=>layerOf(u.kind)===layer),ids=units.map(u=>u.id);
  // Nearest node with a clear straight line to the target; for a target inside something solid, the nearest open node.
  const near=nearest(s.map,target,false,layer),goal=near>=0?near:nearestOpen(s.map,target,layer);if(goal<0)throw Error(layer==='water'?'目標附近沒有可航行的水面':'目標附近沒有可站立的節點');
  const group=new Set(ids),player=units[0].player;
  for(const u of units){cancel(s,u.id);Object.assign(u,{path:[],goal:null,target:null,navigation:'searching',wait:0,detours:0,partial:false,order:s.nextJobId,outcome:null});}
  // Stations are chosen from nodes nobody outside the group currently holds.
  s.pathJobs.push({kind:'group',id:s.nextJobId++,...(layer==='water'?{layer}:{}),...(layer==='land'&&gatesExist(s.map)?{player}:{}),unitIds:[...ids],goal,starts:units.map(u=>u.next??u.node),held:held(s.units,group),slots:[],status:'searching',...search(s.map,goal)});}
}
// Gates only matter for searches once a gate stands (older saves and gate-free matches keep their exact jobs).
const gatesExist=(map:MapData)=>map.obstacles.some(o=>gateKinds.has(o.kind));
export function commandStop(s:MovementState,unitIds:number[]){
 for(const id of unitIds){const u=s.units.find(u=>u.id===id)!;cancel(s,id);Object.assign(u,{path:[],goal:null,target:null,wait:0,detours:0,partial:false,outcome:null,navigation:u.next===null?'idle':'moving'});}
}
function advance(s:MovementState,job:Job,budget:number):number{
 let used=0;
 while(job.status==='searching'&&used<budget){
  if(job.kind==='group'&&job.slots.length>=job.unitIds.length&&job.starts.every(n=>job.parent[n]!==-2)){job.status='done';break;}
  if(job.head===job.frontier.length){job.status='done';break;}
  const id=job.frontier[job.head++];used++;
  if(job.kind==='group'){if(job.slots.length<job.unitIds.length&&!job.held.includes(id)&&!closedFor(s.map,id,job.layer??'land',job.player??-1))job.slots.push(id);}
  else{const SIDE=sideOf(s.map),g=job.goal,d=(n:number)=>Math.abs(n%SIDE-g%SIDE)+Math.abs(Math.floor(n/SIDE)-Math.floor(g/SIDE));if(d(id)<d(job.best))job.best=id;if(job.targets?job.targets.includes(id):id===g){job.found=id;job.status='done';break;}}
  for(const next of neighbours(s.map,id,job.layer??'land',job.player??-1))if(job.parent[next]===-2&&!(job.kind==='unit'&&job.excluded.includes(next))){job.parent[next]=id;job.frontier.push(next);}
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
 const cx=reached.reduce((t,u)=>t+position(s.map,start(u)).x,0)/Math.max(1,reached.length),cy=reached.reduce((t,u)=>t+position(s.map,start(u)).y,0)/Math.max(1,reached.length);
 const far=(n:number)=>Math.abs(position(s.map,n).x-cx)+Math.abs(position(s.map,n).y-cy);
 const slots=job.slots.slice(0,reached.length).sort((a,b)=>far(b)-far(a)||order.get(a)!-order.get(b)!);
 reached.forEach((u,i)=>{
  const slot=slots[i];
  if(slot===undefined){Object.assign(u,{navigation:u.next===null?'unreachable':'moving',partial:true});return;}
  const up=chain(job.parent,start(u)),down=chain(job.parent,slot),index=new Map(down.map((n,k)=>[n,k]));
  let i2=0;while(!index.has(up[i2]))i2++;
  u.path=[...up.slice(1,i2+1),...down.slice(0,index.get(up[i2])).reverse()];
  Object.assign(u,{goal:slot,target:position(s.map,slot),partial:false,navigation:u.path.length||u.next!==null?'moving':'idle'});
 });
 // Units outside the goal's component head for the closest node they can reach.
 for(const u of units)if(!order.has(start(u)))s.pathJobs.push(unitJob(s,u,job.goal,[],[]));
}
function unitJob(s:MovementState,u:Unit,goal:number,excluded:number[],keep:number[],targets:number[]|null=null):UnitJob{const start=u.next??u.node,{layer,player}=unitLayer(u);return {...(layer==='water'?{layer}:{}),...(layer==='land'&&gatesExist(s.map)?{player}:{}),kind:'unit',id:s.nextJobId++,unitId:u.id,start,goal,excluded,best:start,keep,targets,found:-1,status:'searching',...search(s.map,start)};}
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
 u.path=path;u.goal=job.targets?end:u.goal??job.goal;u.partial=job.targets?job.found<0:end!==job.goal;u.target=position(s.map,end);
 u.navigation=path.length||u.next!==null?'moving':u.partial?'unreachable':'idle';
}
// A new building (or freed ground) changes the graph: restart searches, and reroute any unit whose
// remaining route crosses an edge that no longer exists. Units never step through a new footprint.
function reconcile(s:MovementState){
 if(s.navigationSeen===s.map.navigationRevision)return;s.navigationSeen=s.map.navigationRevision;
 for(const job of s.pathJobs)if(job.status==='searching'){const fresh=search(s.map,job.kind==='group'?job.goal:job.start);Object.assign(job,fresh);
  // A gate that went up meanwhile: a land search from now on respects who may pass it.
  if(!job.layer&&job.player===undefined&&gatesExist(s.map)){const u=s.units.find(u=>u.id===(job.kind==='group'?job.unitIds[0]:job.unitId));if(u)job.player=u.player;}if(job.kind==='group')job.slots=[];else{job.best=job.start;job.found=-1;}}
 const searching=new Set(s.pathJobs.flatMap(j=>j.kind==='group'?j.unitIds:[j.unitId]));
 for(const u of s.units){if(!u.path.length||searching.has(u.id))continue;
  const route=[u.next??u.node,...u.path];
  const {layer,player}=unitLayer(u);if(route.every((n,i)=>i===0||neighbours(s.map,route[i-1],layer,gatesExist(s.map)?player:-1).includes(n)))continue;
  const goal=u.goal??u.path.at(-1)!;u.path=[];u.navigation='searching';s.pathJobs.push(unitJob(s,u,goal,[],[]));}
}
export function stepMovement(s:MovementState):{expanded:number}{
 reconcile(s);
 // Shared deterministic budget, round-robin in job id order.
 s.pathJobs.sort((a,b)=>a.id-b.id);let budget=searchBudget(s.map),expanded=0;
 while(budget>0&&s.pathJobs.some(j=>j.status==='searching'))for(const job of s.pathJobs){if(budget<=0)break;if(job.status==='searching'){const n=advance(s,job,1);budget-=n;expanded+=n;}}
 for(const job of s.pathJobs.filter(j=>j.status==='done'))job.kind==='group'?finishGroup(s,job):finishUnit(s,job);
 s.pathJobs=s.pathJobs.filter(j=>j.status==='searching');
 const searching=new Set(s.pathJobs.flatMap(j=>j.kind==='group'?j.unitIds:[j.unitId]));
 const owner=new Int32Array(nodeTotal(s.map));for(const u of s.units){owner[u.node]=u.id;if(u.next!==null)owner[u.next]=u.id;}
 const byId=new Map(s.units.map(u=>[u.id,u]));
 function tryReserve(u:Unit){
  if(!u.path.length||searching.has(u.id))return;
  const n=u.path[0],o=owner[n];
  if(o===0||o===u.id){owner[n]=u.id;u.next=n;u.path.shift();u.navigation='moving';u.wait=0;return;}
  // An idle animal (anyone's) steps aside like an idle friendly unit; it never blocks a path for good.
  const b=byId.get(o)!,idleFriend=(b.player===u.player||isAnimal(b.kind))&&b.next===null&&!b.path.length&&!searching.has(b.id);
  const settledMate=idleFriend&&b.order===u.order&&(b.navigation==='idle'||b.navigation==='stuck');
  const toGoal=u.goal===null?Infinity:Math.abs(position(s.map,u.goal).x-position(s.map,u.node).x)+Math.abs(position(s.map,u.goal).y-position(s.map,u.node).y);
  // 1. Arrival radius: close to its station and blocked by a group-mate who has settled, settle here.
  if(settledMate&&toGoal<=navigationRules.arrivalRadius){Object.assign(u,{path:[],goal:null,target:null,navigation:'idle',wait:0});return;}
  // 2. An idle friendly unit steps off the requester's route. In single file (no side step) a settled
  //    group-mate trades stations: it walks on to the requester's station and the requester stops here.
  if(idleFriend){
   const lb=unitLayer(b),free=neighbours(s.map,b.node,lb.layer,gatesExist(s.map)?lb.player:-1).filter(c=>owner[c]===0),step=free.find(c=>!u.path.includes(c));
   if(step!==undefined)b.path=[step];
   else if(settledMate&&u.goal!==null&&u.goal!==n){Object.assign(b,{path:u.path.slice(1),goal:u.goal,target:position(s.map,u.goal),outcome:null});Object.assign(u,{path:[n],goal:n,target:position(s.map,n)});}
   else if(free.length)b.path=[free[0]];
  }
  // 3. Head-on group-mates that each want the other's node swap remaining routes and stations,
  //    so both turn back toward what the other was heading for; nobody passes through anyone.
  //    When each already stands on the other's station, both simply arrive where they are.
  if(b.player===u.player&&b.order===u.order&&b.next===null&&b.path[0]===u.node&&!searching.has(b.id)){
   const mine=u.path.slice(1),theirs=b.path.slice(1),goal=u.goal;
   Object.assign(u,{path:theirs,goal:b.goal,target:b.goal===null?null:position(s.map,b.goal)});Object.assign(b,{path:mine,goal,target:goal===null?null:position(s.map,goal)});
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
 const setups=(s as {setups?:Record<number,{unpacked:boolean;progress:number}>}).setups;
 for(const u of [...s.units].sort((a,b)=>a.id-b.id)){
  // An unpacked trebuchet packs up (its setup time) before it takes its first step.
  const pack=setups?.[u.id];if(pack&&(u.next!==null||u.path.length)){if(pack.unpacked){if(++pack.progress<(statsOf(u.kind,ownerOf(s as {civs?:string[];ages?:number[];techs?:string[][]},u.player)).setup??0))continue;}delete setups![u.id];}
  if(u.next===null)tryReserve(u);
  if(u.next===null)continue;
  // Whatever a tick's speed does not cover carries to the next tick (u.stride, kept to a hundredth): the fraction
  // of a fractional speed, and the part of a step cut short by arriving on a node while the walk goes on. So a walk
  // covers speed x ticks (minus under one step) whatever the speed (Squires' 5.5, Husbandry's 11); speeds that divide
  // the 50-unit node spacing never carry anything and keep no stride. A unit that stops on a node drops its carry.
  const target=position(s.map,u.next),speed=speedOf(u.kind,ownerOf(s as {civs?:string[];ages?:number[];techs?:string[][]},u.player));
  const acc=Math.round(((u.stride??0)+speed)*100),step=Math.min(Math.floor(acc/100),Math.max(Math.abs(target.x-u.x),Math.abs(target.y-u.y))),rest=acc-step*100;
  if(rest)u.stride=rest/100;else delete u.stride;
  const p={x:u.x+Math.sign(target.x-u.x)*Math.min(step,Math.abs(target.x-u.x)),y:u.y+Math.sign(target.y-u.y)*Math.min(step,Math.abs(target.y-u.y))};
  if(!clearSegment(s.map,u,p,layerOf(u.kind)))throw Error(`entity ${u.id}: 非法碰撞路徑`);
  u.x=p.x;u.y=p.y;
  if(u.x===target.x&&u.y===target.y){
   if(owner[u.node]===u.id)owner[u.node]=0;u.node=u.next;u.next=null;
   if(u.path.length)tryReserve(u);
   else if(!searching.has(u.id)){// A stuck unit that stepped aside for someone keeps reporting its failed order.
    u.navigation=u.outcome==='stuck'?'stuck':u.partial?'unreachable':'idle';u.target=null;u.goal=null;u.wait=0;}
   if(u.next===null)delete u.stride;
  }
 }
 return {expanded};
}
