// Transport ships (the 建築 round, design_default rules after the reference's): land units board a transport from the
// shore next to it and ride inside it (out of the world, like a garrison); an unload order sails it to the water
// nearest the spot and sets them down on the free land nodes round it. A sunk transport takes everyone inside with it
// (combat.ts killUnit). Capacity 5, more with Careening, Dry Dock and the Saracens (civ.ts transportCapacityOf).
import {nodesNear,position} from './navigation.ts';
import {routeTo,cancelMovement,commandMove,blockedOf,layerOf} from './movement.ts';
import type {Unit} from './movement.ts';
import {reach} from './combat.ts';
import type {CombatState} from './combat.ts';
import {ownerOf,transportCapacityOf} from './civ.ts';
import {isAnimal} from './fauna.ts';
import {ramCapacity,ridesRam} from './garrison.ts';
// boardReach: how close (Chebyshev, centre to centre) a unit steps in from; landReach: how far from the transport the
// passengers may be set down; repathTicks: how often a boarding unit re-aims at a transport that moved.
export const navalRules={provenance:'design_default',transportCapacity:5,boardReach:150,landReach:150,repathTicks:20} as const;
// transports: the units inside each transport (by its unit id); boarding: units on their way into one; unloading:
// transports sailing to set their passengers down at a point.
export type NavalState=CombatState&{transports:Record<number,Unit[]>;boarding:Record<number,{transportId:number;repath:number}>;unloading:Record<number,{x:number;y:number}>};
const naval=(s:CombatState)=>{const n=s as NavalState;n.transports??={};n.boarding??={};n.unloading??={};return n;};
// A ram (the 遊戲元素 round, garrison.ts) carries 4/5/6 infantry and foot archers in the same store.
export const capacityOf=(s:CombatState,t:Unit)=>t.kind==='ram'?ramCapacity(s,t.player):transportCapacityOf(ownerOf(s,t.player),navalRules.transportCapacity);
const room=(s:NavalState,t:Unit)=>capacityOf(s,t)-(s.transports[t.id]?.length??0)-Object.values(s.boarding).filter(b=>b.transportId===t.id).length;
// Why these units cannot board this transport (null when they can).
export function loadProblem(s:CombatState,player:number,transportId:number,unitIds:number[]):string|null{
 const n=naval(s),t=s.units.find(u=>u.id===transportId);
 if(t?.kind==='ram'){if(t.player!==player)return '只能進駐己方的衝撞車';}else if(!t||t.player!==player||t.kind!=='transport-ship')return '只能登上己方的運輸船';
 const units=unitIds.map(id=>s.units.find(u=>u.id===id));
 if(t.kind==='ram'&&units.some(u=>!u||!ridesRam(u.kind)))return '只有步兵與徒步弓兵能進駐衝撞車';
 if(units.some(u=>!u||layerOf(u.kind)!=='land'||isAnimal(u.kind)))return '只有陸上單位能登船';
 const relics=(s as {relics?:{carrier:number|null}[]}).relics??[];if(units.some(u=>u&&relics.some(r=>r.carrier===u.id)))return '攜帶聖物的僧侶不能登船';
 const free=room(n,t)+unitIds.filter(id=>n.boarding[id]?.transportId===t.id).length;if(free<unitIds.length)return `空位不足：還能登船 ${Math.max(0,free)} 名`;
 return null;
}
export function commandLoad(s:CombatState,unitIds:number[],transportId:number){
 const n=naval(s),t=s.units.find(u=>u.id===transportId)!;
 for(const id of unitIds){cancelMovement(s,id);delete s.works[id];delete s.attacks[id];n.boarding[id]={transportId,repath:0};}
 // The transport comes to the shore by the first of them (as in the reference, both sides close in).
 // A ram waits where it is.
 const first=s.units.find(u=>u.id===unitIds[0]);if(t.kind!=='ram'&&first&&reach(first,t)>navalRules.boardReach){delete n.unloading[t.id];commandMove(s,[t.id],{x:first.x,y:first.y});}
}
export function unloadProblem(s:CombatState,player:number,transportId:number,x:unknown,y:unknown):string|null{
 const n=naval(s),t=s.units.find(u=>u.id===transportId);if(!t||t.player!==player||t.kind!=='transport-ship')return '找不到這艘己方運輸船';
 if(!n.transports[t.id]?.length)return '運輸船上沒有單位';
 if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||(x as number)<50||(y as number)<50||(x as number)>s.map.size*100-50||(y as number)>s.map.size*100-50)return '目標超出地圖';
 return null;
}
export function commandUnload(s:CombatState,transportId:number,x:number,y:number){
 const n=naval(s);n.unloading[transportId]={x,y};commandMove(s,[transportId],{x,y});
}
// Orders to a unit end its boarding; an order to a transport ends its unloading.
export function clearNaval(s:CombatState,unitIds:number[]){const n=naval(s);for(const id of unitIds){delete n.boarding[id];delete n.unloading[id];}}
// Free land nodes within landReach of the transport, those nearest the aim first (then by id).
function landing(s:NavalState,t:Unit,aim:{x:number;y:number}){
 const closed=blockedOf(s.map,'land',t.player),held=new Set(s.units.flatMap(u=>u.next===null?[u.node]:[u.node,u.next]));
 return nodesNear(s.map,[t.x,t.y,t.x,t.y],navalRules.landReach).filter(id=>!closed[id]&&!held.has(id)&&reach(position(s.map,id),t)<=navalRules.landReach)
  .sort((a,b)=>{const p=position(s.map,a),q=position(s.map,b);return Math.abs(p.x-aim.x)+Math.abs(p.y-aim.y)-(Math.abs(q.x-aim.x)+Math.abs(q.y-aim.y))||a-b;});
}
export function stepNaval(s:CombatState){
 const n=naval(s),busy=new Set(s.pathJobs.flatMap(j=>j.kind==='group'?j.unitIds:[j.unitId]));
 // Boarding: walk to the shore within boardReach of the transport, then step in.
 for(const id of Object.keys(n.boarding).map(Number).sort((a,b)=>a-b)){const b=n.boarding[id],u=s.units.find(u=>u.id===id),t=s.units.find(v=>v.id===b.transportId);
  if(!u||!t||t.player!==u.player||(n.transports[t.id]?.length??0)>=capacityOf(s,t)){delete n.boarding[id];if(u&&!u.path.length&&u.next===null)u.navigation='idle';continue;}
  if(u.next!==null)continue;
  if(reach(u,t)<=navalRules.boardReach){delete n.boarding[id];cancelMovement(s,u.id);Object.assign(u,{path:[],goal:null,target:null,next:null,navigation:'idle',wait:0});delete u.stride;
   s.units=s.units.filter(v=>v!==u);(n.transports[t.id]??=[]).push(u);continue;}
  if(b.repath>0&&(u.path.length||busy.has(u.id))){b.repath--;continue;}
  const closed=blockedOf(s.map,'land',u.player),nodes=nodesNear(s.map,[t.x,t.y,t.x,t.y],navalRules.boardReach).filter(id=>!closed[id]&&reach(position(s.map,id),t)<=navalRules.boardReach);
  // No shore by the transport yet (it is still sailing in): wait for it.
  if(!nodes.length){b.repath=navalRules.repathTicks;continue;}
  routeTo(s,u,nodes);b.repath=navalRules.repathTicks;}
 // Unloading: once the transport has stopped, its passengers step onto the land round it, nearest the aim first.
 for(const id of Object.keys(n.unloading).map(Number).sort((a,b)=>a-b)){const t=s.units.find(u=>u.id===id),aim=n.unloading[id];
  if(!t||!n.transports[id]?.length){delete n.unloading[id];continue;}
  if(t.next!==null||t.path.length||busy.has(t.id))continue;
  delete n.unloading[id];const spots=landing(n,t,aim),out:Unit[]=[];
  for(const u of n.transports[id]){const node=spots.shift();if(node===undefined)break;const p=position(s.map,node);
   Object.assign(u,{x:p.x,y:p.y,node,next:null,path:[],goal:null,target:null,navigation:'idle',wait:0});s.units.push(u);out.push(u);}
  n.transports[id]=n.transports[id].filter(u=>!out.includes(u));if(!n.transports[id].length)delete n.transports[id];
  if(out.length)s.units.sort((a,b)=>a.id-b.id);}
}
// Lets everyone the carrier can set down out onto the free land round it now (the ungarrison order for a ram or a
// beached transport, and a ram that falls: its passengers survive). Returns those left inside (no free ground).
export function releaseCarried(s:CombatState,carrierId:number,at?:{x:number;y:number;player:number}){
 const n=naval(s),t=s.units.find(u=>u.id===carrierId),from=t??(at?{...at,id:carrierId} as unknown as Unit:undefined),list=n.transports[carrierId];
 if(!from||!list?.length)return 0;
 delete n.unloading[carrierId];const spots=landing(n,from,{x:from.x,y:from.y}),out:Unit[]=[];
 for(const u of list){const node=spots.shift();if(node===undefined)break;const p=position(s.map,node);
  Object.assign(u,{x:p.x,y:p.y,node,next:null,path:[],goal:null,target:null,navigation:'idle',wait:0});s.units.push(u);out.push(u);}
 n.transports[carrierId]=list.filter(u=>!out.includes(u));if(!n.transports[carrierId].length)delete n.transports[carrierId];
 if(out.length)s.units.sort((a,b)=>a.id-b.id);return n.transports[carrierId]?.length??0;
}
// Everyone inside a transport (conquest counts them; the page shows the load).
export const passengers=(s:CombatState,transportId:number)=>(s as Partial<NavalState>).transports?.[transportId]??[];
