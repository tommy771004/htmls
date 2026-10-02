import {obstacleBounds} from '../content/footprints.ts';
import {reach,launch} from './combat.ts';
import {routeTo,cancelMovement,layerOf} from './movement.ts';
import type {Layer} from './movement.ts';
import type {Unit} from './movement.ts';
import {blockedFor,nodesNear,position,navigationRules} from './navigation.ts';
import {maxHpOf,combatRules,buildingShotOf} from './stats.ts';
import {ownerOf,garrisonBonus,arrowsOf,garrisonHealScale} from './civ.ts';
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
 // The bombard tower (the 建築 round, aoetw.com): holds 5 like a tower, but those inside add no shots (shots: false).
 capacity:{'town-center':15,'watch-tower':5,castle:20,'bombard-tower':5} as Record<string,number>,
 // bonus: extra damage against a class (aoetw: the town centre's +5 and the tower's +7 against ships). The bombard
 // tower fires one cannonball (120 pierce, +40 against ships) every 6 s (cooldown x20 like the towers), from a tower's
 // range; it outshoots nothing, it one-shots most units.
 // Arrows against ships hit fishing ships as hard (aoetw.com: the fishing-ship armor class takes the towers' ship bonus).
 arrows:{'town-center':{base:1,range:300,damage:5,cooldown:40,bonus:{ship:5,'fishing-ship':5}},'watch-tower':{base:1,range:350,damage:5,cooldown:40,bonus:{ship:7,'fishing-ship':7}},castle:{base:4,range:400,damage:5,cooldown:40},
  'bombard-tower':{base:1,range:350,damage:120,cooldown:120,bonus:{ship:40,'fishing-ship':40},shots:false}} as Record<string,{base:number;range:number;damage:number;cooldown:number;bonus?:Record<string,number>;shots?:false}>,
 // Who may go inside (foot units: no cavalry, no siege), and who adds an arrow while there.
 canGarrison:['villager','militia','spearman','archer','skirmisher','monk','longbowman','woad-raider','throwing-axeman','huskarl','teutonic-knight','berserk','janissary','chu-ko-nu','samurai','hand-cannoneer'],
 addsArrow:['villager','archer','skirmisher','longbowman','janissary','chu-ko-nu','hand-cannoneer'],
 // Units inside heal one hit point every healTicks; a shot stays drawn for shotTicks.
 healTicks:40,shotTicks:10,
 // The 遊戲元素 round (aoetw.com elements/Garrison, Regeneration): the castle heals those inside twice as fast as a town
 // centre or a tower (12 against 6 hit points a minute there); a building at ejectPercent of its hit points or less
 // lets everyone out and takes nobody in. Production buildings hold 10 of the units they train, who go in only by the
 // building's rally point set on the building itself (and cannot be ordered back in once out).
 healRate:{castle:2} as Record<string,number>,ejectPercent:20,
 rallyGarrison:{barracks:10,'archery-range':10,stable:10,'siege-workshop':10,monastery:10,dock:10} as Record<string,number>} as const;
// Inside a building: the unit itself (out of the world) and, when the town bell sent it, the work to go back to.
export type Garrisoned={unit:Unit;work:Work|null;bell:boolean};
export type Garrison={box:number[];units:Garrisoned[]};
export type Shot={player:number;from:{x:number;y:number};to:{x:number;y:number};tick:number};
export type DefenseState=ReligionState&{civs?:string[];garrison:Record<string,Garrison>;entering:Record<number,{buildingId:string;repath:number;work:Work|null;bell:boolean}>;volleys:Record<string,number>;shots:Shot[]};
const boxOf=(s:DefenseState,id:string)=>{const o=s.map.obstacles.find(o=>o.id===id);return o?obstacleBounds(o):null;};
// How many a building holds for its owner (Teuton towers and town centres hold more); 0 for buildings nobody enters.
export function garrisonCapacity(s:{civs?:string[];ages?:number[];techs?:string[][]},b:{kind:string;player:number}){const base=defenseRules.capacity[b.kind]??0;return base?base+garrisonBonus(ownerOf(s,b.player),b.kind):defenseRules.rallyGarrison[b.kind]??0;}
// Badly damaged: at ejectPercent of its hit points or below (nobody stays inside, nobody goes in).
export const battered=(b:{hp:number;maxHp:number})=>b.hp*100<=b.maxHp*defenseRules.ejectPercent;
// A rally point on the building itself (a production building's own garrison).
export function rallyInside(s:{map:{obstacles:{id?:string;kind:string;x:number;y:number}[]}},b:{id:string;kind:string},p:{x:number;y:number}){
 if(!(b.kind in defenseRules.rallyGarrison))return false;const o=s.map.obstacles.find(o=>o.id===b.id);if(!o)return false;
 const [x0,y0,x1,y1]=obstacleBounds(o as Parameters<typeof obstacleBounds>[0]);return p.x>=x0&&p.x<=x1&&p.y>=y0&&p.y<=y1;}
const room=(s:DefenseState,b:{id:string;kind:string;player:number})=>garrisonCapacity(s,b)-(s.garrison[b.id]?.units.length??0)-Object.values(s.entering).filter(e=>e.buildingId===b.id).length;
// Why these units cannot go into this building (null when they can).
export function garrisonProblem(s:DefenseState,player:number,buildingId:string,unitIds:number[]):string|null{
 const b=s.buildings.find(b=>b.id===buildingId);if(!b||b.player!==player)return '只能進駐己方的城鎮中心、箭塔或城堡';
 if(!(b.kind in defenseRules.capacity))return b.kind in defenseRules.rallyGarrison?'這棟建築只收自己訓練的單位：把集結點設在建築上':'只能進駐城鎮中心、箭塔或城堡';if(!b.complete)return '建築尚未完工';
 if(battered(b))return `建築受損嚴重（生命 ${defenseRules.ejectPercent}% 以下），無法進駐`;
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
// Nodes just outside the building (where a unit steps in or out); ships (a dock's) step out onto water.
function doorNodes(s:DefenseState,box:number[],from=50,to=100,layer:Layer='land'){const closed=blockedFor(s.map,layer),r=navigationRules.radius;
 return nodesNear(s.map,box,to+r).filter(n=>{if(closed[n])return false;const d=reach(position(s.map,n),box);return d>r&&d<=r+to&&d>=from-50;});}
function enter(s:DefenseState,u:Unit,id:string,work:Work|null,bell:boolean){const box=boxOf(s,id)!;
 cancelMovement(s,u.id);Object.assign(u,{path:[],goal:null,target:null,next:null,navigation:'idle',wait:0});s.units=s.units.filter(v=>v!==u);
 (s.garrison[id]??={box,units:[]}).units.push({unit:u,work,bell});}
// Out onto the free nodes round the building, nearest first; a unit sent in by the bell goes back to its work.
export function release(s:DefenseState,id:string,which:(g:Garrisoned)=>boolean=()=>true){
 const g=s.garrison[id];if(!g)return;const out=g.units.filter(which);if(!out.length)return;
 const held=new Set(s.units.flatMap(u=>u.next===null?[u.node]:[u.node,u.next]));
 // Free door nodes per layer (land units and a dock's ships), nearest the front first.
 const c={x:(g.box[0]+g.box[2])/2,y:g.box[3]+50},need:Partial<Record<Layer,number>>={},frees:Partial<Record<Layer,number[]>>={};
 for(const e of out){const l=layerOf(e.unit.kind);need[l]=(need[l]??0)+1;}
 for(const l of Object.keys(need) as Layer[]){let free:number[]=[];for(let to=100;to<=400&&free.length<need[l]!;to+=100)free=doorNodes(s,g.box,50,to,l).filter(n=>!held.has(n));
  free.sort((a,b)=>Math.abs(position(s.map,a).x-c.x)+Math.abs(position(s.map,a).y-c.y)-(Math.abs(position(s.map,b).x-c.x)+Math.abs(position(s.map,b).y-c.y))||a-b);frees[l]=free;}
 const left:Garrisoned[]=[];
 for(const e of g.units){if(!out.includes(e))continue;const n=frees[layerOf(e.unit.kind)]!.shift();if(n===undefined){left.push(e);continue;}
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
 const shelters=s.buildings.filter(b=>b.player===player&&b.complete&&!battered(b)&&b.kind in defenseRules.capacity).map(b=>({b,box:boxOf(s,b.id)!})).filter(v=>v.box);
 for(const u of s.units.filter(u=>u.player===player&&u.kind==='villager'&&!s.entering[u.id]).sort((a,b)=>a.id-b.id)){
  const best=shelters.filter(v=>room(s,v.b)>0).sort((p,q)=>reach(u,p.box)-reach(u,q.box)||(p.b.id<q.b.id?-1:1))[0];
  if(best)commandGarrison(s,[u.id],best.b.id,true);}
}
export function stepDefense(s:DefenseState){
 // Going in: walk to a door node, then step inside; an order that no longer holds is dropped.
 const busy=new Set(s.pathJobs.flatMap(j=>j.kind==='group'?j.unitIds:[j.unitId]));
 for(const id of Object.keys(s.entering).map(Number).sort((a,b)=>a-b)){const e=s.entering[id],u=s.units.find(u=>u.id===id),b=s.buildings.find(b=>b.id===e.buildingId),box=b&&boxOf(s,b.id);
  if(!u||!b||!box||b.player!==u.player||!b.complete||battered(b)||(s.garrison[b.id]?.units.length??0)>=garrisonCapacity(s,b)){delete s.entering[id];if(u&&!u.path.length&&u.next===null)u.navigation='idle';continue;}
  if(u.next!==null)continue;
  if(reach(u,box)<=navigationRules.radius+100){delete s.entering[id];enter(s,u,b.id,e.work,e.bell);continue;}
  if(e.repath>0&&(u.path.length||busy.has(u.id))){e.repath--;continue;}
  const doors=doorNodes(s,box);if(!doors.length){delete s.entering[id];continue;}routeTo(s,u,doors);e.repath=20;}
 // A building that fell, changed sides or is badly damaged lets everyone out.
 for(const id of Object.keys(s.garrison).sort()){const g=s.garrison[id],b=s.buildings.find(b=>b.id===id);if(!b||b.player!==g.units[0]?.unit.player||battered(b))release(s,id);}
 // Inside, units slowly heal.
 // Herbal Medicine heals the units inside faster (the building owner's research).
 // scale hit points every healTicks, spread evenly (6 in 40 ticks with it, not one every round(40/6) = 7 ticks).
 for(const [id,g] of Object.entries(s.garrison)){const b=s.buildings.find(b=>b.id===id),scale=b?garrisonHealScale(ownerOf(s,b.player),b.kind)*(defenseRules.healRate[b.kind]??1):1;
  const heal=Math.floor(s.tick*scale/defenseRules.healTicks)-Math.floor((s.tick-1)*scale/defenseRules.healTicks);if(heal<=0)continue;
  for(const e of g.units){const max=maxHpOf(e.unit.kind as CombatUnitKind,ownerOf(s,e.unit.player));if(e.unit.hp<max)e.unit.hp=Math.min(max,e.unit.hp+heal);}}
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
  const bonus:Record<string,number>={...def.bonus};for(const [c,v] of Object.entries(mod.bonus))bonus[c]=(bonus[c]??0)+v;
  const cooldown=Math.max(1,Math.round(def.cooldown*mod.cooldown)),arrow:UnitStats={hp:0,damage:def.damage+mod.damage,range,cooldown,sight:0,attack:'pierce',armor:[0,0],classes:[],bonus};
  // One arrow per volley plus one per villager or foot archer inside (and per unit of a class a technology adds).
  const shooter=(k:string)=>(defenseRules.addsArrow as readonly string[]).includes(k)||(k in combatRules.units&&combatRules.units[k as CombatUnitKind].classes.some(c=>mod.garrisonClasses.includes(c)));
  const count=def.base+mod.extra+(def.shots===false?0:s.garrison[b.id]?.units.filter(e=>shooter(e.unit.kind)).length??0);
  // The building is where the arrows come from (a target that cannot see it learns where it is, combat.ts reveal).
  const from={x:Math.round((box[0]+box[2])/2),y:Math.round((box[1]+box[3])/2)};
  // Each arrow flies (combat.ts launch): the 戰術技巧 round's accuracy and travel time; Ballistics leads a moving target.
  const shot=buildingShotOf(b.kind,ownerOf(s,b.player));
  for(let i=0;i<count;i++)launch(s,{id:-1,player:b.player,kind:b.kind,...from},arrow,{kind:'unit',id:target.id},shot);
  s.volleys[b.id]=cooldown;s.shots.push({player:b.player,from:{x:Math.round((box[0]+box[2])/2),y:Math.round((box[1]+box[3])/2)},to:{x:target.x,y:target.y},tick:s.tick});}
}
