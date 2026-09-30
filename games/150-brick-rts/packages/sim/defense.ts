import {obstacleBounds} from '../content/footprints.ts';
import {reach,strike,damageOn} from './combat.ts';
import {routeTo,cancelMovement} from './movement.ts';
import type {Unit} from './movement.ts';
import {blockedTable,nodesNear,position,navigationRules} from './navigation.ts';
import {maxHpOf,combatRules} from './stats.ts';
import {ownerOf,garrisonBonus,arrowsOf} from './civ.ts';
import type {UnitStats,CombatUnitKind} from './stats.ts';
import {commandGather,commandHunt,commandBuild} from './work.ts';
import type {Work} from './work.ts';
import type {ReligionState} from './religion.ts';
import {isAnimal} from './fauna.ts';
import {tileAt} from './terrain.ts';
// Town centres and watch towers: garrison and arrows (design_default numbers; the shape follows the reference: a town
// centre and a tower shoot on their own, and each villager or archer inside adds an arrow).
export const defenseRules={provenance:'design_default',
 // The Castle (design_default in this scale: the reference's castle holds 20 and outranges a town centre).
 capacity:{'town-center':15,'watch-tower':5,castle:20} as Record<string,number>,
 arrows:{'town-center':{base:1,range:300,damage:5,cooldown:40},'watch-tower':{base:1,range:350,damage:5,cooldown:40},castle:{base:4,range:400,damage:5,cooldown:40}} as Record<string,{base:number;range:number;damage:number;cooldown:number}>,
 // Who may go inside (foot units: no cavalry, no siege), and who adds an arrow while there.
 canGarrison:['villager','militia','spearman','archer','skirmisher','monk','longbowman','woad-raider','throwing-axeman','huskarl','teutonic-knight','berserk','janissary','chu-ko-nu','samurai'],
 addsArrow:['villager','archer','skirmisher','longbowman','janissary','chu-ko-nu'],
 // Units inside heal one hit point every healTicks; a shot stays drawn for shotTicks.
 healTicks:40,shotTicks:10} as const;
// Inside a building: the unit itself (out of the world) and, when the town bell sent it, the work to go back to.
export type Garrisoned={unit:Unit;work:Work|null;bell:boolean};
export type Garrison={box:number[];units:Garrisoned[]};
export type Shot={player:number;from:{x:number;y:number};to:{x:number;y:number};tick:number};
export type DefenseState=ReligionState&{civs?:string[];garrison:Record<string,Garrison>;entering:Record<number,{buildingId:string;repath:number;work:Work|null;bell:boolean}>;volleys:Record<string,number>;shots:Shot[]};
const boxOf=(s:DefenseState,id:string)=>{const o=s.map.obstacles.find(o=>o.id===id);return o?obstacleBounds(o):null;};
// How many a building holds for its owner (Teuton towers and town centres hold more); 0 for buildings nobody enters.
export function garrisonCapacity(s:{civs?:string[];ages?:number[];techs?:string[][]},b:{kind:string;player:number}){const base=defenseRules.capacity[b.kind]??0;return base?base+garrisonBonus(ownerOf(s,b.player),b.kind):0;}
const room=(s:DefenseState,b:{id:string;kind:string;player:number})=>garrisonCapacity(s,b)-(s.garrison[b.id]?.units.length??0)-Object.values(s.entering).filter(e=>e.buildingId===b.id).length;
// Why these units cannot go into this building (null when they can).
export function garrisonProblem(s:DefenseState,player:number,buildingId:string,unitIds:number[]):string|null{
 const b=s.buildings.find(b=>b.id===buildingId);if(!b||b.player!==player)return '只能進駐己方的城鎮中心、箭塔或城堡';
 if(!(b.kind in defenseRules.capacity))return '只能進駐城鎮中心、箭塔或城堡';if(!b.complete)return '建築尚未完工';
 const units=unitIds.map(id=>s.units.find(u=>u.id===id));
 if(units.some(u=>!u||!(defenseRules.canGarrison as readonly string[]).includes(u.kind)))return '只有村民、步兵、徒步弓兵與僧侶能進駐';
 if(units.some(u=>u&&s.relics.some(r=>r.carrier===u.id)))return '攜帶聖物的僧侶不能進駐';
 if(room(s,b)<unitIds.length)return `空位不足：還能進駐 ${Math.max(0,room(s,b))} 名`;
 return null;
}
export function commandGarrison(s:DefenseState,unitIds:number[],buildingId:string,bell=false){
 for(const id of unitIds){const w=s.works[id];cancelMovement(s,id);delete s.works[id];delete s.attacks[id];delete s.rites[id];
  s.entering[id]={buildingId,repath:0,work:bell?w??null:null,bell};}
}
// Nodes just outside the building (where a unit steps in or out).
function doorNodes(s:DefenseState,box:number[],from=50,to=100){const closed=blockedTable(s.map),r=navigationRules.radius;
 return nodesNear(s.map,box,to+r).filter(n=>{if(closed[n])return false;const d=reach(position(s.map,n),box);return d>r&&d<=r+to&&d>=from-50;});}
function enter(s:DefenseState,u:Unit,id:string,work:Work|null,bell:boolean){const box=boxOf(s,id)!;
 cancelMovement(s,u.id);Object.assign(u,{path:[],goal:null,target:null,next:null,navigation:'idle',wait:0});s.units=s.units.filter(v=>v!==u);
 (s.garrison[id]??={box,units:[]}).units.push({unit:u,work,bell});}
// Out onto the free nodes round the building, nearest first; a unit sent in by the bell goes back to its work.
export function release(s:DefenseState,id:string,which:(g:Garrisoned)=>boolean=()=>true){
 const g=s.garrison[id];if(!g)return;const out=g.units.filter(which);if(!out.length)return;
 const held=new Set(s.units.flatMap(u=>u.next===null?[u.node]:[u.node,u.next]));
 let free:number[]=[];for(let to=100;to<=400&&free.length<out.length;to+=100)free=doorNodes(s,g.box,50,to).filter(n=>!held.has(n));
 const c={x:(g.box[0]+g.box[2])/2,y:g.box[3]+50};free.sort((a,b)=>Math.abs(position(s.map,a).x-c.x)+Math.abs(position(s.map,a).y-c.y)-(Math.abs(position(s.map,b).x-c.x)+Math.abs(position(s.map,b).y-c.y))||a-b);
 const left:Garrisoned[]=[];
 for(const e of g.units){if(!out.includes(e))continue;const n=free.shift();if(n===undefined){left.push(e);continue;}
  const p=position(s.map,n);Object.assign(e.unit,{x:p.x,y:p.y,node:n,next:null,path:[],goal:null,target:null,navigation:'idle'});s.units.push(e.unit);
  const w=e.work;if(w?.kind==='gather'){if(w.prey!==undefined&&s.units.some(a=>a.id===w.prey))commandHunt(s,[e.unit.id],w.prey);else if(s.map.resources.some(r=>r.id===w.resourceId&&r.collectible))commandGather(s,[e.unit.id],w.resourceId);}
  else if(w?.kind==='build'&&s.buildings.some(b=>b.id===w.buildingId&&!b.complete))commandBuild(s,[e.unit.id],w.buildingId);}
 s.units.sort((a,b)=>a.id-b.id);g.units=g.units.filter(e=>!out.includes(e)||left.includes(e));if(!g.units.length)delete s.garrison[id];
}
// The town bell: every villager of the player goes into the nearest own town centre or tower with room, and remembers
// its work; rung again, the belled villagers come out and go back to work.
export function ringBell(s:DefenseState,player:number,ring:boolean){
 if(!ring){for(const id of Object.keys(s.garrison).sort()){const b=s.buildings.find(b=>b.id===id);if(b?.player===player)release(s,id,e=>e.bell);}
  for(const [id,e] of Object.entries(s.entering))if(e.bell&&s.units.find(u=>u.id===Number(id))?.player===player)delete s.entering[Number(id)];return;}
 const shelters=s.buildings.filter(b=>b.player===player&&b.complete&&b.kind in defenseRules.capacity).map(b=>({b,box:boxOf(s,b.id)!})).filter(v=>v.box);
 for(const u of s.units.filter(u=>u.player===player&&u.kind==='villager'&&!s.entering[u.id]).sort((a,b)=>a.id-b.id)){
  const best=shelters.filter(v=>room(s,v.b)>0).sort((p,q)=>reach(u,p.box)-reach(u,q.box)||(p.b.id<q.b.id?-1:1))[0];
  if(best)commandGarrison(s,[u.id],best.b.id,true);}
}
export function stepDefense(s:DefenseState){
 // Going in: walk to a door node, then step inside; an order that no longer holds is dropped.
 const busy=new Set(s.pathJobs.flatMap(j=>j.kind==='group'?j.unitIds:[j.unitId]));
 for(const id of Object.keys(s.entering).map(Number).sort((a,b)=>a-b)){const e=s.entering[id],u=s.units.find(u=>u.id===id),b=s.buildings.find(b=>b.id===e.buildingId),box=b&&boxOf(s,b.id);
  if(!u||!b||!box||b.player!==u.player||!b.complete||(s.garrison[b.id]?.units.length??0)>=garrisonCapacity(s,b)){delete s.entering[id];if(u&&!u.path.length&&u.next===null)u.navigation='idle';continue;}
  if(u.next!==null)continue;
  if(reach(u,box)<=navigationRules.radius+100){delete s.entering[id];enter(s,u,b.id,e.work,e.bell);continue;}
  if(e.repath>0&&(u.path.length||busy.has(u.id))){e.repath--;continue;}
  const doors=doorNodes(s,box);if(!doors.length){delete s.entering[id];continue;}routeTo(s,u,doors);e.repath=20;}
 // A building that fell or changed sides lets everyone out where it stood.
 for(const id of Object.keys(s.garrison).sort()){const g=s.garrison[id],b=s.buildings.find(b=>b.id===id);if(!b||b.player!==g.units[0]?.unit.player)release(s,id);}
 // Inside, units slowly heal.
 if(s.tick%defenseRules.healTicks===0)for(const g of Object.values(s.garrison))for(const e of g.units){const max=maxHpOf(e.unit.kind as CombatUnitKind,ownerOf(s,e.unit.player));if(e.unit.hp<max)e.unit.hp++;}
 // Arrows: at the nearest visible enemy (not animals) in range, one per volley plus one per villager or archer inside.
 s.shots=s.shots.filter(v=>s.tick-v.tick<defenseRules.shotTicks);
 // With the opponent set to 'idle' (practice), red does nothing at all: its buildings do not shoot either.
 const passive=(s as {opponent?:string}).opponent==='idle'?1:-1;
 for(const b of [...s.buildings].sort((a,b)=>a.id<b.id?-1:1)){const def=defenseRules.arrows[b.kind];if(!def||!b.complete||b.player===passive)continue;
  if((s.volleys[b.id]??0)>0){s.volleys[b.id]--;continue;}
  const box=boxOf(s,b.id);if(!box)continue;const seen=new Set(s.vision[b.player].visible);
  // The owner's civilization and unique technologies add arrows, attack, range and fire rate (arrowsOf).
  const mod=arrowsOf(ownerOf(s,b.player),b.kind),range=def.range+mod.range;
  const target=s.units.filter(u=>u.player!==b.player&&!isAnimal(u.kind)&&seen.has(tileAt(u.x,u.y,s.map.size))&&reach(u,box)<=range).sort((p,q)=>reach(p,box)-reach(q,box)||p.id-q.id)[0];
  if(!target)continue;
  const cooldown=Math.max(1,Math.round(def.cooldown*mod.cooldown)),arrow:UnitStats={hp:0,damage:def.damage+mod.damage,range,cooldown,sight:0,attack:'pierce',armor:[0,0],classes:[],bonus:{}};
  // One arrow per volley plus one per villager or foot archer inside (and per unit of a class a technology adds).
  const shooter=(k:string)=>(defenseRules.addsArrow as readonly string[]).includes(k)||(k in combatRules.units&&combatRules.units[k as CombatUnitKind].classes.some(c=>mod.garrisonClasses.includes(c)));
  const count=def.base+mod.extra+(s.garrison[b.id]?.units.filter(e=>shooter(e.unit.kind)).length??0);
  for(let i=0;i<count&&s.units.includes(target);i++)strike(s,{kind:'unit',id:target.id},damageOn(s,arrow,{kind:'unit',id:target.id}),-1);
  s.volleys[b.id]=cooldown;s.shots.push({player:b.player,from:{x:Math.round((box[0]+box[2])/2),y:Math.round((box[1]+box[3])/2)},to:{x:target.x,y:target.y},tick:s.tick});}
}
