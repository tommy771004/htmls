import {obstacleBounds} from '../content/footprints.ts';
import type {Resource} from '../content/rules.ts';
import {economyRules} from './economy.ts';
import type {Account} from './economy.ts';
import {harvestMapResource,position,blockedTable,nodesNear} from './navigation.ts';
import type {MapData,Obstacle} from './navigation.ts';
import {routeTo,cancelMovement} from './movement.ts';
import type {Unit,Job,MovementState} from './movement.ts';
import {addWork,farmResourceId,placeBuilding} from './buildings.ts';
import {gatherRate,carryOf} from './tech.ts';
import type {Building,BuildingState} from './buildings.ts';
import {resourceDefinitions} from './terrain.ts';
import type {ResourceNode} from './terrain.ts';
import {animalRules,carcassId,isAnimal} from './fauna.ts';
import {approach,reach,strike} from './combat.ts';
import type {CombatState} from './combat.ts';
// Villager work (gather → carry → deposit → resume). Engineering rules are design_default in economyRules.
// hunting: striking a live animal (prey) whose carcass (resourceId) does not exist yet. Appended: index-projected.
export type WorkPhase='toSource'|'gathering'|'toDropoff'|'toSite'|'building'|'hunting';
export const workPhases:readonly (WorkPhase|'none')[]=['none','toSource','gathering','toDropoff','toSite','building','hunting'];
export type GatherWork={kind:'gather';resourceId:string;phase:'toSource'|'gathering'|'toDropoff'|'hunting';progress:number;retries:number;prey?:number};
export type BuildWork={kind:'build';buildingId:string;phase:'toSite'|'building';retries:number};
export type Work=GatherWork|BuildWork;
export type Cargo={resource:Resource;amount:number};
// techs: each player's researched technologies (gather rate, carry); reseed: each player's automatic farm reseeding.
export type WorkState=MovementState&BuildingState&{tick:number;works:Record<number,Work>;cargo:Record<number,Cargo>;techs:string[][];reseed:boolean[]};
const gap=(p:{x:number;y:number},[x0,y0,x1,y1]:number[])=>Math.max(x0-p.x,0,p.x-x1)+Math.max(y0-p.y,0,p.y-y1);
// Nodes just outside an obstacle's radius-expanded footprint (the same rule the map generator uses).
function ring(map:MapData,o:Obstacle,reach:number):number[]{const box=obstacleBounds(o,25),out:number[]=[],closed=blockedTable(map);for(const n of nodesNear(map,box,reach)){if(closed[n])continue;const d=gap(position(map,n),box);if(d>0&&d<=reach)out.push(n);}return out;}
export function workSlots(map:MapData,resourceId:string):number[]{
 const r=map.resources.find(r=>r.id===resourceId),o=r?.obstacleId?map.obstacles.find(o=>o.id===r.obstacleId):undefined;
 // A carcass or a shore fish is a point: villagers stand on the open (land) nodes round it.
 if(r&&!r.obstacleId&&r.status==='available'){const reach=r.kind==='fish'?animalRules.fishReach:animalRules.pointReach,closed=blockedTable(map);return nodesNear(map,[r.x,r.y,r.x,r.y],reach).filter(n=>{if(closed[n])return false;const p=position(map,n),d=Math.max(Math.abs(p.x-r.x),Math.abs(p.y-r.y));return d>0&&d<=reach;});}
 // Farmers stand on the (walkable) field itself.
 if(o?.kind==='farm'){const b=obstacleBounds(o),out:number[]=[],closed=blockedTable(map);for(const n of nodesNear(map,b,0)){const p=position(map,n);if(!closed[n]&&p.x>b[0]&&p.x<b[2]&&p.y>b[1]&&p.y<b[3])out.push(n);}return out;}
 return o?ring(map,o,economyRules.workReach):[];
}
// Where cargo may be delivered (design_default): the town centre takes everything; camps take their own kinds.
export const dropoffRules={provenance:'design_default',accepts:{'town-center':['food','wood','gold','stone'],'lumber-camp':['wood'],'mining-camp':['gold','stone'],mill:['food']}} as const;
// Nodes next to the player's completed drop-offs that accept the resource (all of them when none is given).
export function dropoffNodes(map:MapData,player:number,resource?:Resource):number[]{
 const accepts=dropoffRules.accepts as Record<string,readonly string[]>;
 return [...new Set(map.obstacles.filter(o=>accepts[o.kind]&&o.progress===undefined&&(o.red?1:0)===player&&(!resource||accepts[o.kind].includes(resource))).flatMap(o=>ring(map,o,economyRules.dropoffReach)))].sort((a,b)=>a-b);
}
// Carcasses (hunt, herd) and shore fish are gathered like any other source; live animals take a hunt order.
export function gatherable(map:MapData,resourceId:string):string|null{
 const r=map.resources.find(r=>r.id===resourceId);
 if(!r)return '找不到這個資源';
 if(!r.collectible)return '資源已耗盡';
 if(r.kind==='fish'&&!workSlots(map,r.id).length)return '村民只能從岸邊捕魚：這群魚離岸太遠';
 return null;
}
// Why a player cannot hunt this animal (null when it can): it must be a visible animal, and a sheep must be the player's.
export function huntProblem(s:CombatState,player:number,animalId:number):string|null{
 const a=s.units.find(u=>u.id===animalId);if(!a||!isAnimal(a.kind)||!s.vision[player].visible.includes(Math.floor(a.y/100)*s.map.size+Math.floor(a.x/100)))return '找不到這隻動物';
 if(a.kind==='sheep'&&a.player!==player)return a.player===1-player?'這隻羊屬於對手：讓你的單位靠近牠、對手的單位離開，就能搶過來':'這隻羊還沒有主人：派任何單位走到牠旁邊就能取得';
 return null;
}
// Free slots first (not claimed by another worker's goal, not held by a standing unit); all slots if none are free.
function sourceTargets(s:WorkState,u:Unit,resourceId:string){
 const slots=workSlots(s.map,resourceId),taken=new Set<number>();
 for(const v of s.units)if(v!==u){{const w=s.works[v.id];if(v.goal!==null&&w?.kind==='gather'&&w.resourceId===resourceId)taken.add(v.goal);}if(v.next===null&&!v.path.length)taken.add(v.node);}
 const free=slots.filter(n=>!taken.has(n));return free.length?free:slots;
}
function goToSource(s:WorkState,u:Unit,w:GatherWork){if(w.prey!==undefined&&!s.map.resources.some(r=>r.id===w.resourceId)){w.phase='toSource';return;}const t=sourceTargets(s,u,w.resourceId);if(!t.length)return stopWork(s,u);w.phase='toSource';routeTo(s,u,t);}
const cargoOf=(s:WorkState,w:GatherWork)=>{const r=s.map.resources.find(r=>r.id===w.resourceId);return r?resourceDefinitions[r.kind].yield:w.prey!==undefined?'food' as const:undefined;};
function goToDropoff(s:WorkState,u:Unit,w:GatherWork){const t=dropoffNodes(s.map,u.player,s.cargo[u.id]?.resource??cargoOf(s,w));if(!t.length)return stopWork(s,u);w.phase='toDropoff';routeTo(s,u,t);}
function stopWork(s:WorkState,u:Unit){delete s.works[u.id];if(u.navigation!=='moving')u.navigation=u.partial?'unreachable':'idle';}
export function commandGather(s:WorkState,unitIds:number[],resourceId:string){
 for(const id of unitIds){const u=s.units.find(u=>u.id===id)!;cancelMovement(s,id);
  const w:GatherWork={kind:'gather',resourceId,phase:'toSource',progress:0,retries:0};s.works[id]=w;
  const kind=resourceDefinitions[s.map.resources.find(r=>r.id===resourceId)!.kind].yield,cargo=s.cargo[id];
  // Cargo of another resource is returned first, so no carried amount is ever relabelled.
  if(cargo&&cargo.resource!==kind)goToDropoff(s,u,w);else goToSource(s,u,w);}
}
// Hunting: villagers walk to the animal and strike it until it drops; then they gather its carcass (same work).
// A villager carrying something other than food first takes it home.
export function commandHunt(s:WorkState,unitIds:number[],animalId:number){
 for(const id of unitIds){const u=s.units.find(u=>u.id===id)!;cancelMovement(s,id);
  const w:GatherWork={kind:'gather',resourceId:carcassId(animalId),phase:'toSource',progress:0,retries:0,prey:animalId};s.works[id]=w;
  const cargo=s.cargo[id];if(cargo&&cargo.resource!=='food')goToDropoff(s,u,w);}
}
// Move/stop orders end work but keep cargo; the next gather order returns it.
export function clearWork(s:WorkState,unitIds:number[]){for(const id of unitIds)delete s.works[id];}
function deposit(s:WorkState,u:Unit){
 const c=s.cargo[u.id];if(!c)return;const a=s.accounts[u.player];
 if(!Number.isSafeInteger(a.stock[c.resource]+c.amount))throw Error('資源超過安全整數範圍');
 a.stock[c.resource]+=c.amount;a.ledger.deposited[c.resource]+=c.amount;delete s.cargo[u.id];
}
// Nearest collectible resource of the same yield within 600 units of the exhausted one; lowest id on ties.
// A carcass or a fish is followed by the nearest one of the same kind; a shepherd then takes the next own sheep.
function nextSource(s:WorkState,u:Unit,from:ResourceNode,kind:Resource):{resourceId:string;prey?:number}|null{
 if(resourceDefinitions[from.kind].method!=='gather'){let best:{resourceId:string;prey?:number}|null=null,dist=Infinity;
  for(const r of s.map.resources)if(r.collectible&&r.kind===from.kind&&(r.kind!=='fish'||workSlots(s.map,r.id).length)){const d=Math.abs(r.x-from.x)+Math.abs(r.y-from.y);if(d<=600&&(d<dist||d===dist&&best!==null&&r.id<best.resourceId)){best={resourceId:r.id};dist=d;}}
  if(best||from.kind!=='livestock')return best;
  for(const a of s.units)if(a.kind==='sheep'&&a.player===u.player){const d=Math.abs(a.x-from.x)+Math.abs(a.y-from.y);if(d<=600&&(d<dist||d===dist&&best!==null&&a.id<best.prey!)){best={resourceId:carcassId(a.id),prey:a.id};dist=d;}}
  return best;}
 const id=nearestGather(s,from,kind);return id?{resourceId:id}:null;
}
function nearestGather(s:WorkState,from:{x:number;y:number},kind:Resource):string|null{
 let best:string|null=null,dist=Infinity;
 // Farms are never picked automatically: each belongs to one player and is chosen by an order.
 for(const r of s.map.resources)if(r.collectible&&r.kind!=='farm'&&resourceDefinitions[r.kind].method==='gather'&&resourceDefinitions[r.kind].yield===kind){const d=Math.abs(r.x-from.x)+Math.abs(r.y-from.y);if(d<=600&&(d<dist||d===dist&&best!==null&&r.id<best)){best=r.id;dist=d;}}
 return best;
}
// Builders stand on the ring just outside the foundation, never inside it.
export function buildSlots(map:MapData,b:Building){const o=map.obstacles.find(o=>o.id===b.id);return o?ring(map,o,economyRules.workReach):[];}
// Slots nobody is standing on come first (an animal or a parked unit may hold part of the ring); all of them otherwise.
function goToSite(s:WorkState,u:Unit,w:BuildWork){const b=s.buildings.find(b=>b.id===w.buildingId);const t=b?buildSlots(s.map,b):[];if(!t.length)return stopWork(s,u);
 const held=new Set(s.units.filter(v=>v!==u&&v.next===null&&!v.path.length).map(v=>v.node)),free=t.filter(n=>!held.has(n));w.phase='toSite';routeTo(s,u,free.length?free:t);}
export function commandBuild(s:WorkState,unitIds:number[],buildingId:string){
 for(const id of unitIds){const u=s.units.find(u=>u.id===id)!;cancelMovement(s,id);const w:BuildWork={kind:'build',buildingId,phase:'toSite',retries:0};s.works[id]=w;goToSite(s,u,w);}
}
function stepBuilder(s:WorkState,u:Unit,w:BuildWork){
 const b=s.buildings.find(b=>b.id===w.buildingId);
 // Whoever builds a farm starts farming it (as in the reference), unless another villager already does.
 if(b?.complete&&b.kind==='farm'&&s.map.resources.some(r=>r.id===farmResourceId(b.id)&&r.collectible)&&!s.units.some(v=>v!==u&&(s.works[v.id] as GatherWork|undefined)?.resourceId===farmResourceId(b.id))){const g:GatherWork={kind:'gather',resourceId:farmResourceId(b.id),phase:'toSource',progress:0,retries:0};s.works[u.id]=g;return goToSource(s,u,g);}
 if(!b||b.complete)return stopWork(s,u);
 if(!buildSlots(s.map,b).includes(u.node)){if(++w.retries>3)return stopWork(s,u);return goToSite(s,u,w);}
 w.phase='building';w.retries=0;u.navigation='idle';addWork(s,b);
}
// Rate: one unit per gatherTicks of the yield, or per sourceTicks of the source kind (hunting, herding, fishing).
const ticksFor=(r:ResourceNode,kind:Resource)=>(economyRules.sourceTicks as Record<string,number>)[r.kind]??economyRules.gatherTicks[kind];
// One tick of a hunt: walk within reach of the animal and strike it every cooldown until it drops (its carcass then
// exists and the same work gathers it). A sheep that changes hands ends the hunt.
function stepHunt(s:CombatState,u:Unit,w:GatherWork){
 const prey=s.units.find(a=>a.id===w.prey);
 if(!prey){if(s.map.resources.some(r=>r.id===w.resourceId)){delete w.prey;w.progress=0;goToSource(s,u,w);}else stopWork(s,u);return;}
 if(huntProblem(s,u.player,prey.id)||!isAnimal(prey.kind)){stopWork(s,u);return;}
 const range=animalRules.hunt.range[prey.kind];
 if(reach(u,prey)<=range){w.phase='hunting';w.retries=0;u.navigation='idle';if(w.progress>0){w.progress--;return;}
  strike(s,{kind:'unit',id:prey.id},animalRules.hunt.damage,u.id);w.progress=animalRules.hunt.cooldown;
  if(!s.units.includes(prey)){delete w.prey;w.progress=0;goToSource(s,u,w);}return;}
 const nodes=approach(s,u,{x:prey.x,y:prey.y},range);if(!nodes.length){if(++w.retries>3)stopWork(s,u);return;}
 w.phase='toSource';routeTo(s,u,nodes);
}
export function stepWork(s:CombatState){
 const busy=new Set(s.pathJobs.flatMap(j=>j.kind==='group'?j.unitIds:[j.unitId]));
 for(const u of [...s.units].sort((a,b)=>a.id-b.id)){
  const w=s.works[u.id];if(!w||busy.has(u.id)||u.next!==null||u.path.length)continue;
  if(w.kind==='build'){stepBuilder(s,u,w);continue;}
  if(w.prey!==undefined&&w.phase!=='toDropoff'){stepHunt(s,u,w);continue;}
  const resource=s.map.resources.find(r=>r.id===w.resourceId);
  // Carrying home from a hunt that has not dropped anything yet: deposit, then the hunt resumes.
  if(!resource){if(w.phase==='toDropoff'&&w.prey!==undefined){if(!dropoffNodes(s.map,u.player,s.cargo[u.id]?.resource??'food').includes(u.node)){if(++w.retries>3){stopWork(s,u);continue;}goToDropoff(s,u,w);continue;}deposit(s,u);w.retries=0;w.phase='toSource';continue;}stopWork(s,u);continue;}
  const kind=resourceDefinitions[resource.kind].yield;
  const follow=(next:{resourceId:string;prey?:number})=>{w.resourceId=next.resourceId;if(next.prey!==undefined)w.prey=next.prey;else delete w.prey;w.progress=0;};
  if(w.phase==='toDropoff'){
   if(!dropoffNodes(s.map,u.player,s.cargo[u.id]?.resource??kind).includes(u.node)){if(++w.retries>3){stopWork(s,u);continue;}goToDropoff(s,u,w);continue;}
   deposit(s,u);w.retries=0;
   if(!resource.collectible){const next=nextSource(s,u,resource,kind);if(!next){stopWork(s,u);continue;}follow(next);if(w.prey!==undefined){w.phase='toSource';continue;}}
   goToSource(s,u,w);continue;
  }
  if(!resource.collectible){
   // Exhausted: carry what we have home, or switch to a neighbouring source.
   if(s.cargo[u.id]){goToDropoff(s,u,w);continue;}
   const next=nextSource(s,u,resource,kind);if(!next){stopWork(s,u);continue;}follow(next);if(w.prey!==undefined){w.phase='toSource';continue;}goToSource(s,u,w);continue;
  }
  if(!workSlots(s.map,w.resourceId).includes(u.node)){if(++w.retries>3){stopWork(s,u);continue;}goToSource(s,u,w);continue;}
  w.phase='gathering';w.retries=0;u.navigation='idle';
  // Progress counts in hundredths of a tick's work, so a technology's +20% is exact over time (the remainder carries).
  w.progress+=gatherRate(s.techs[u.player],kind);if(w.progress<ticksFor(resource,kind)*100)continue;
  w.progress-=ticksFor(resource,kind)*100;
  const got=harvestMapResource(s.map,w.resourceId,1,s.tick).amount;
  // A worked-out farm leaves the field: its building record goes with the obstacle. With automatic reseeding on (the
  // default) and wood enough, its farmer lays a new field on the same spot at once and builds it (then farms it).
  let reseeded:string|null=null;
  if(resource.kind==='farm'&&resource.status==='depleted'){const old=s.buildings.find(b=>farmResourceId(b.id)===resource.id);s.buildings=s.buildings.filter(b=>b!==old);
   if(old&&s.reseed[u.player]){try{reseeded=placeBuilding(s,u.player,'farm',old.x,old.y,`${u.player}:reseed:${s.nextBuildingId}`).id;}catch{}}}
  if(got>0){const c=s.cargo[u.id]??(s.cargo[u.id]={resource:kind,amount:0});c.amount+=got;s.accounts[u.player].ledger.extracted[kind]+=got;}
  if(reseeded){const b:BuildWork={kind:'build',buildingId:reseeded,phase:'toSite',retries:0};s.works[u.id]=b;goToSite(s,u,b);continue;}
  if((s.cargo[u.id]?.amount??0)>=carryOf(s.techs[u.player],economyRules.carryCapacity,resource.kind==='farm'))goToDropoff(s,u,w);
 }
}
