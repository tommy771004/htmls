import {obstacleBounds} from '../content/footprints.ts';
import type {Resource} from '../content/rules.ts';
import {economyRules} from './economy.ts';
import type {Account} from './economy.ts';
import {harvestMapResource,position} from './navigation.ts';
import type {MapData,Obstacle} from './navigation.ts';
import {routeTo,cancelMovement} from './movement.ts';
import type {Unit,Job,MovementState} from './movement.ts';
import {addWork} from './buildings.ts';
import type {Building,BuildingState} from './buildings.ts';
import {resourceDefinitions} from './terrain.ts';
// Villager work (gather → carry → deposit → resume). Engineering rules are design_default in economyRules.
export type WorkPhase='toSource'|'gathering'|'toDropoff'|'toSite'|'building';
export const workPhases:readonly (WorkPhase|'none')[]=['none','toSource','gathering','toDropoff','toSite','building'];
export type GatherWork={kind:'gather';resourceId:string;phase:'toSource'|'gathering'|'toDropoff';progress:number;retries:number};
export type BuildWork={kind:'build';buildingId:string;phase:'toSite'|'building';retries:number};
export type Work=GatherWork|BuildWork;
export type Cargo={resource:Resource;amount:number};
export type WorkState=MovementState&BuildingState&{tick:number;works:Record<number,Work>;cargo:Record<number,Cargo>};
const NODES=961;
const gap=(p:{x:number;y:number},[x0,y0,x1,y1]:number[])=>Math.max(x0-p.x,0,p.x-x1)+Math.max(y0-p.y,0,p.y-y1);
// Nodes just outside an obstacle's radius-expanded footprint (the same rule the map generator uses).
function ring(map:MapData,o:Obstacle,reach:number):number[]{const box=obstacleBounds(o,25),out:number[]=[];for(let n=0;n<NODES;n++){if(map.blocked.includes(n))continue;const d=gap(position(n),box);if(d>0&&d<=reach)out.push(n);}return out;}
export function workSlots(map:MapData,resourceId:string):number[]{
 const r=map.resources.find(r=>r.id===resourceId),o=r?.obstacleId?map.obstacles.find(o=>o.id===r.obstacleId):undefined;
 return o?ring(map,o,economyRules.workReach):[];
}
export function dropoffNodes(map:MapData,player:number):number[]{
 return [...new Set(map.obstacles.filter(o=>o.kind==='town-center'&&(o.red?1:0)===player).flatMap(o=>ring(map,o,economyRules.dropoffReach)))].sort((a,b)=>a-b);
}
export function gatherable(map:MapData,resourceId:string):string|null{
 const r=map.resources.find(r=>r.id===resourceId);
 if(!r)return '找不到這個資源';
 if(resourceDefinitions[r.kind].method!=='gather')return ({hunt:'狩獵',herd:'放牧',fish:'捕魚'} as Record<string,string>)[resourceDefinitions[r.kind].method]+'尚未實作';
 if(!r.collectible)return '資源已耗盡';
 return null;
}
// Free slots first (not claimed by another worker's goal, not held by a standing unit); all slots if none are free.
function sourceTargets(s:WorkState,u:Unit,resourceId:string){
 const slots=workSlots(s.map,resourceId),taken=new Set<number>();
 for(const v of s.units)if(v!==u){{const w=s.works[v.id];if(v.goal!==null&&w?.kind==='gather'&&w.resourceId===resourceId)taken.add(v.goal);}if(v.next===null&&!v.path.length)taken.add(v.node);}
 const free=slots.filter(n=>!taken.has(n));return free.length?free:slots;
}
function goToSource(s:WorkState,u:Unit,w:GatherWork){const t=sourceTargets(s,u,w.resourceId);if(!t.length)return stopWork(s,u);w.phase='toSource';routeTo(s,u,t);}
function goToDropoff(s:WorkState,u:Unit,w:GatherWork){const t=dropoffNodes(s.map,u.player);if(!t.length)return stopWork(s,u);w.phase='toDropoff';routeTo(s,u,t);}
function stopWork(s:WorkState,u:Unit){delete s.works[u.id];if(u.navigation!=='moving')u.navigation=u.partial?'unreachable':'idle';}
export function commandGather(s:WorkState,unitIds:number[],resourceId:string){
 for(const id of unitIds){const u=s.units.find(u=>u.id===id)!;cancelMovement(s,id);
  const w:GatherWork={kind:'gather',resourceId,phase:'toSource',progress:0,retries:0};s.works[id]=w;
  const kind=resourceDefinitions[s.map.resources.find(r=>r.id===resourceId)!.kind].yield,cargo=s.cargo[id];
  // Cargo of another resource is returned first, so no carried amount is ever relabelled.
  if(cargo&&cargo.resource!==kind)goToDropoff(s,u,w);else goToSource(s,u,w);}
}
// Move/stop orders end work but keep cargo; the next gather order returns it.
export function clearWork(s:WorkState,unitIds:number[]){for(const id of unitIds)delete s.works[id];}
function deposit(s:WorkState,u:Unit){
 const c=s.cargo[u.id];if(!c)return;const a=s.accounts[u.player];
 if(!Number.isSafeInteger(a.stock[c.resource]+c.amount))throw Error('資源超過安全整數範圍');
 a.stock[c.resource]+=c.amount;a.ledger.deposited[c.resource]+=c.amount;delete s.cargo[u.id];
}
// Nearest collectible resource of the same yield within 600 units of the exhausted one; lowest id on ties.
function nextSource(s:WorkState,from:{x:number;y:number},kind:Resource):string|null{
 let best:string|null=null,dist=Infinity;
 for(const r of s.map.resources)if(r.collectible&&resourceDefinitions[r.kind].method==='gather'&&resourceDefinitions[r.kind].yield===kind){const d=Math.abs(r.x-from.x)+Math.abs(r.y-from.y);if(d<=600&&(d<dist||d===dist&&best!==null&&r.id<best)){best=r.id;dist=d;}}
 return best;
}
// Builders stand on the ring just outside the foundation, never inside it.
export function buildSlots(map:MapData,b:Building){const o=map.obstacles.find(o=>o.id===b.id);return o?ring(map,o,economyRules.workReach):[];}
function goToSite(s:WorkState,u:Unit,w:BuildWork){const b=s.buildings.find(b=>b.id===w.buildingId);const t=b?buildSlots(s.map,b):[];if(!t.length)return stopWork(s,u);w.phase='toSite';routeTo(s,u,t);}
export function commandBuild(s:WorkState,unitIds:number[],buildingId:string){
 for(const id of unitIds){const u=s.units.find(u=>u.id===id)!;cancelMovement(s,id);const w:BuildWork={kind:'build',buildingId,phase:'toSite',retries:0};s.works[id]=w;goToSite(s,u,w);}
}
function stepBuilder(s:WorkState,u:Unit,w:BuildWork){
 const b=s.buildings.find(b=>b.id===w.buildingId);
 if(!b||b.complete)return stopWork(s,u);
 if(!buildSlots(s.map,b).includes(u.node)){if(++w.retries>3)return stopWork(s,u);return goToSite(s,u,w);}
 w.phase='building';w.retries=0;u.navigation='idle';addWork(s,b);
}
export function stepWork(s:WorkState){
 const busy=new Set(s.pathJobs.flatMap(j=>j.kind==='group'?j.unitIds:[j.unitId]));
 for(const u of [...s.units].sort((a,b)=>a.id-b.id)){
  const w=s.works[u.id];if(!w||busy.has(u.id)||u.next!==null||u.path.length)continue;
  if(w.kind==='build'){stepBuilder(s,u,w);continue;}
  const resource=s.map.resources.find(r=>r.id===w.resourceId)!,kind=resourceDefinitions[resource.kind].yield;
  if(w.phase==='toDropoff'){
   if(!dropoffNodes(s.map,u.player).includes(u.node)){if(++w.retries>3){stopWork(s,u);continue;}goToDropoff(s,u,w);continue;}
   deposit(s,u);w.retries=0;
   if(!resource.collectible){const next=nextSource(s,resource,kind);if(!next){stopWork(s,u);continue;}w.resourceId=next;}
   goToSource(s,u,w);continue;
  }
  if(!resource.collectible){
   // Exhausted: carry what we have home, or switch to a neighbouring source.
   if(s.cargo[u.id]){goToDropoff(s,u,w);continue;}
   const next=nextSource(s,resource,kind);if(!next){stopWork(s,u);continue;}w.resourceId=next;goToSource(s,u,w);continue;
  }
  if(!workSlots(s.map,w.resourceId).includes(u.node)){if(++w.retries>3){stopWork(s,u);continue;}goToSource(s,u,w);continue;}
  w.phase='gathering';w.retries=0;u.navigation='idle';
  if(++w.progress<economyRules.gatherTicks[kind])continue;
  w.progress=0;
  const got=harvestMapResource(s.map,w.resourceId,1,s.tick).amount;
  if(got>0){const c=s.cargo[u.id]??(s.cargo[u.id]={resource:kind,amount:0});c.amount+=got;s.accounts[u.player].ledger.extracted[kind]+=got;}
  if((s.cargo[u.id]?.amount??0)>=economyRules.carryCapacity)goToDropoff(s,u,w);
 }
}
