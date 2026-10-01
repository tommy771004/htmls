import {obstacleBounds} from '../content/footprints.ts';
import {forfeitReservation} from './economy.ts';
import {refreshNavigation,position,navigationRules,nodesNear} from './navigation.ts';
import {routeTo,cancelMovement,commandMove,blockedOf,layerOf} from './movement.ts';
import type {Unit} from './movement.ts';
import {recomputeCapacity,closeFarm,housingOf} from './buildings.ts';
import type {Building} from './buildings.ts';
import type {WorkState} from './work.ts';
import {combatRules,statsOf,hitDamage,buildingTargetOf} from './stats.ts';
import type {CombatUnitKind} from './stats.ts';
import {ownerOf,deathRefund,keepsHousing} from './civ.ts';
import type {Owner} from './civ.ts';
import {tileAt} from './terrain.ts';
import type {KnownObstacle} from './vision.ts';
import {isAnimal,makeCarcass} from './fauna.ts';
import type {AnimalKind} from './fauna.ts';
// Deterministic combat: fixed damage on a fixed cooldown, no randomness, no animation timing.
export type Target={kind:'unit';id:number}|{kind:'building';id:string};
export type Attack={target:Target;cooldown:number;auto:boolean;repath:number;firedTick:number};
export type Corpse={id:number;player:number;kind:Unit['kind'];x:number;y:number;tick:number};
// reason: conquest (no units and no buildings left) or resign (a player conceded).
export type Outcome={winner:number|null;defeated:number[];tick:number;reason?:'resign'|'relic'|'wonder'};
// beasts: animals that were struck and by whom (a deer flees from its hunter, a boar charges it; animals.ts).
export type Beast={foe:number;cooldown:number;repath:number};
// setups: trebuchets that are unpacked (or on their way to it; progress counts ticks of packing or unpacking).
export type CombatState=WorkState&{keptHousing?:number[];setups?:Record<number,{unpacked:boolean;progress:number}>;attacks:Record<number,Attack>;corpses:Corpse[];outcome:Outcome|null;beasts:Record<number,Beast>;vision:{visible:number[];explored:number[];known:KnownObstacle[]}[]};
const REPATH=20;
function buildingBox(s:CombatState,b:Building){const o=s.map.obstacles.find(o=>o.id===b.id);return o?obstacleBounds(o):null;}
// Chebyshev distance from a point to a unit centre or to a building footprint edge.
export function reach(p:{x:number;y:number},t:{x:number;y:number}|number[]){if(!Array.isArray(t))return Math.max(Math.abs(p.x-t.x),Math.abs(p.y-t.y));return Math.max(t[0]-p.x,0,p.x-t[2],t[1]-p.y,0,p.y-t[3]);}
function resolve(s:CombatState,t:Target){if(t.kind==='unit'){const u=s.units.find(u=>u.id===t.id);return u?{player:u.player,shape:{x:u.x,y:u.y} as {x:number;y:number}|number[],tiles:[tileAt(u.x,u.y,s.map.size)]}:null;}
 const b=s.buildings.find(b=>b.id===t.id),box=b&&buildingBox(s,b);if(!b||!box)return null;
 const tiles:number[]=[];for(let ty=Math.floor(box[1]/100);ty<=Math.floor((box[3]-1)/100);ty++)for(let tx=Math.floor(box[0]/100);tx<=Math.floor((box[2]-1)/100);tx++)tiles.push(ty*s.map.size+tx);
 return {player:b.player,shape:box as {x:number;y:number}|number[],tiles};}
// An enemy building the player has seen and still remembers (now in the fog) stays a valid target, as in the
// reference: the units walk there. Whether it still stands is not revealed by the answer.
function remembered(s:CombatState,player:number,id:string){return s.vision[player].known.find(k=>k.obstacle.id===id&&!!k.obstacle.red===(player===0))?.obstacle??null;}
export function targetProblem(s:CombatState,player:number,t:Target):string|null{
 const r=resolve(s,t);if(r&&r.player===player)return '不能攻擊己方';
 if(t.kind==='building'&&remembered(s,player,t.id))return null;
 if(!r)return '找不到目標';
 const seen=new Set(s.vision[player].visible);if(!r.tiles.some(id=>seen.has(id)))return '找不到目標';return null;
}
export function commandAttack(s:CombatState,unitIds:number[],t:Target){
 for(const id of unitIds){cancelMovement(s,id);delete s.works[id];s.attacks[id]={target:t,cooldown:0,auto:false,repath:0,firedTick:-1};}
}
export function clearAttacks(s:CombatState,unitIds:number[]){for(const id of unitIds)delete s.attacks[id];}
// Against a building, range counts from the unit's body edge (range + radius), like a builder's work ring;
// otherwise some footprint offsets leave no free node inside the band that range-from-centre allows.
const limit=(u:Unit,shape:{x:number;y:number}|number[],owner:Owner|readonly string[]=[])=>statsOf(u.kind,owner).range+(Array.isArray(shape)?navigationRules.radius:0);
// The closest a unit may shoot from (mangonels, trebuchets); 0 for everyone else.
const nearest=(u:Unit,owner:Owner|readonly string[]=[])=>statsOf(u.kind,owner).minRange??0;
// One hit from a unit with these numbers on a target: armor and bonuses of the target unit (its owner's research), or
// a building's armor.
export function damageOn(s:CombatState,attacker:ReturnType<typeof statsOf>,t:Target){if(t.kind==='building'){const b=s.buildings.find(b=>b.id===t.id);return hitDamage(attacker,buildingTargetOf(b?.kind??'',b?ownerOf(s,b.player):[]));}const v=s.units.find(u=>u.id===t.id);return v?hitDamage(attacker,statsOf(v.kind,ownerOf(s,v.player))):0;}
// Free nodes within range of the target (range defaults to the unit's attack reach); monks use it for their rites too.
export function approach(s:CombatState,u:Unit,shape:{x:number;y:number}|number[],range=limit(u,shape),min=0){
 const out:number[]=[];
 // On the attacker's own layer (ships fire from the water, archers from the shore); enemy gates are closed to it.
 const closed=blockedOf(s.map,layerOf(u.kind),u.player),area=Array.isArray(shape)?shape:[shape.x,shape.y,shape.x,shape.y];
 for(const n of nodesNear(s.map,area,range)){if(closed[n])continue;const p=position(s.map,n),d=reach(p,shape);if(d<=range&&d>=min&&(Array.isArray(shape)||d>0))out.push(n);}
 // Prefer positions no other unit is standing on, so attackers spread around the target.
 const held=new Set(s.units.filter(v=>v!==u&&v.next===null&&!v.path.length).map(v=>v.node)),free=out.filter(n=>!held.has(n));
 return free.length?free:out;
}
export function killUnit(s:CombatState,u:Unit){
 // An animal leaves its food where it fell; it never counted towards anyone's population.
 if(isAnimal(u.kind)){delete s.beasts[u.id];delete s.attacks[u.id];cancelMovement(s,u.id);s.units=s.units.filter(v=>v!==u);makeCarcass(s.map,u as Unit&{kind:AnimalKind});return;}
 const a=s.accounts[u.player],c=s.cargo[u.id];if(c){a.ledger.lost[c.resource]+=c.amount;delete s.cargo[u.id];}
 // Madrasah: a fallen monk returns part of its gold to its owner.
 const refund=u.kind in combatRules.units?deathRefund(ownerOf(s,u.player),u.kind,combatRules.units[u.kind as CombatUnitKind].classes):0;if(refund){a.stock.gold+=refund;a.ledger.refund.gold+=refund;}
 // A sunk transport takes its passengers down with it (naval.ts).
 const naval=s as {transports?:Record<number,Unit[]>;unloading?:Record<number,unknown>;boarding?:Record<number,unknown>},aboard=naval.transports?.[u.id];
 if(aboard){delete naval.transports![u.id];for(const v of aboard){v.x=u.x;v.y=u.y;killUnit(s,v);}}if(naval.unloading)delete naval.unloading[u.id];if(naval.boarding)delete naval.boarding[u.id];
 delete s.works[u.id];delete s.attacks[u.id];if(s.setups)delete s.setups[u.id];cancelMovement(s,u.id);a.populationUsed--;
 s.units=s.units.filter(v=>v!==u);s.corpses.push({id:u.id,player:u.player,kind:u.kind,x:u.x,y:u.y,tick:s.tick});
}
function destroyBuilding(s:CombatState,b:Building){
 const a=s.accounts[b.player];if(!b.complete&&b.reservationId)forfeitReservation(a,b.reservationId);for(const q of b.queue)forfeitReservation(a,q.reservationId);
 const o=s.map.obstacles.find(o=>o.id===b.id)!;s.map.obstacles=s.map.obstacles.filter(v=>v!==o);for(const t of s.map.tiles)t.obstacleRefs=t.obstacleRefs.filter(r=>r!==b.id);
 // Nomads: a finished house that falls keeps its housing for its owner.
 if(b.complete&&keepsHousing(ownerOf(s,b.player),b.kind)){(s.keptHousing??=[0,0])[b.player]+=housingOf(s,b.player,b.kind);}
 s.buildings=s.buildings.filter(v=>v!==b);if(b.kind==='farm'||b.kind==='fish-trap')closeFarm(s,b.id,s.tick);refreshNavigation(s.map,obstacleBounds(o,navigationRules.radius));recomputeCapacity(s,b.player);
}
// attacker: who struck (a struck animal remembers the first one, see animals.ts).
export function strike(s:CombatState,t:Target,amount:number,attacker:number){
 if(t.kind==='unit'){const u=s.units.find(u=>u.id===t.id)!;u.hp-=amount;u.hitTick=s.tick;if(isAnimal(u.kind)&&!s.beasts[u.id])s.beasts[u.id]={foe:attacker,cooldown:0,repath:0};if(u.hp<=0)killUnit(s,u);return;}
 const b=s.buildings.find(b=>b.id===t.id)!;b.hp-=amount;const o=s.map.obstacles.find(o=>o.id===b.id)!;
 // The damaged look (missing parts) appears below half health; it is appearance only.
 if(b.hp*2<b.maxHp)o.damaged=true;if(b.hp<=0)destroyBuilding(s,b);
}
// One attack: the hit itself, then any extra arrows (the Chu Ko Nu's) and splash on the enemy units next to a unit
// target (Logistica's trample).
function volley(s:CombatState,u:Unit,stats:ReturnType<typeof statsOf>,t:Target){
 const at=t.kind==='unit'?s.units.find(v=>v.id===t.id):undefined,where=at?{x:at.x,y:at.y}:null;
 const box=t.kind==='building'?(()=>{const b=s.buildings.find(b=>b.id===t.id);return b?buildingBox(s,b):null;})():null;
 const foes=()=>[...s.units].sort((a,b)=>a.id-b.id).filter(v=>v.id!==(t as {id:unknown}).id&&v.player!==u.player&&!isAnimal(v.kind));
 // The line of a pass-through bolt, taken before the hit (the target may fall).
 const line=stats.passThrough&&where?{x0:u.x,y0:u.y,x1:where.x,y1:where.y}:null;
 strike(s,t,damageOn(s,stats,t),u.id);
 // Blast: every other enemy unit within the radius of the impact (the target's centre or its footprint) takes the hit;
 // own units are spared (design_default: no friendly fire).
 if(stats.blast&&(where||box))for(const v of foes())if(s.units.includes(v)&&reach(v,where??box!)<=stats.blast)strike(s,{kind:'unit',id:v.id},damageOn(s,stats,{kind:'unit',id:v.id}),u.id);
 // Pass-through: enemy units within half a node of the bolt's path, from the shooter to passThrough past the target,
 // take half the bolt's attack (aoetw: only the target takes the full hit).
 if(line){const dx=line.x1-line.x0,dy=line.y1-line.y0,len=Math.hypot(dx,dy)||1,end=len+stats.passThrough!;
  for(const v of foes()){if(!s.units.includes(v))continue;const along=((v.x-line.x0)*dx+(v.y-line.y0)*dy)/len,off=Math.abs((v.x-line.x0)*dy-(v.y-line.y0)*dx)/len;
   if(along>0&&along<=end&&off<=25)strike(s,{kind:'unit',id:v.id},damageOn(s,{...stats,damage:Math.max(1,Math.round(stats.damage/2))},{kind:'unit',id:v.id}),u.id);}}
 for(let i=0;i<(stats.extraShots??0);i++){if(t.kind==='unit'&&!s.units.some(v=>v.id===t.id))break;strike(s,t,damageOn(s,{...stats,damage:stats.extraDamage??1,bonus:{}},t),u.id);}
 if(stats.splash&&where)for(const v of [...s.units].sort((a,b)=>a.id-b.id))if(v.id!==(t as {id:number}).id&&v.player!==u.player&&!isAnimal(v.kind)&&reach(where,v)<=50&&s.units.includes(v))strike(s,{kind:'unit',id:v.id},damageOn(s,{...stats,damage:stats.splash,bonus:{}},{kind:'unit',id:v.id}),u.id);
}
// Regeneration (the Berserk): a hit point every so many ticks, up to the unit's maximum.
function regenerate(s:CombatState){
 for(const u of s.units){if(!(u.kind in combatRules.units))continue;const st=statsOf(u.kind as CombatUnitKind,ownerOf(s,u.player));if(!st.regen)continue;
  const every=Math.max(1,Math.round(60*20/st.regen));if(s.tick%every===0&&u.hp<st.hp)u.hp=Math.min(st.hp,u.hp+1);}
}
export function stepCombat(s:CombatState){
 regenerate(s);
 s.corpses=s.corpses.filter(c=>s.tick-c.tick<combatRules.corpseTicks);
 const busy=new Set(s.pathJobs.flatMap(j=>j.kind==='group'?j.unitIds:[j.unitId]));
 // Idle soldiers engage the nearest visible enemy unit within sight (lowest id on ties).
 for(const u of [...s.units].sort((a,b)=>a.id-b.id)){
  const own=statsOf(u.kind,ownerOf(s,u.player)),sight=own.sight;if(!sight||own.buildingsOnly||s.attacks[u.id]||s.works[u.id]||u.next!==null||u.path.length||busy.has(u.id))continue;
  const seen=new Set(s.vision[u.player].visible);let best:Unit|null=null,dist=Infinity;
  // Animals are never picked automatically (hunting is an order); they have no sight here, so they pick no fights.
  // Across the shore (a ship and a land unit) only units that shoot pick each other (range 150 and up): a swordsman
  // never locks onto a galley it cannot reach.
  const layer=layerOf(u.kind),across=own.range>=150;
  for(const e of s.units)if(e.player!==u.player&&!isAnimal(e.kind)&&(across||layerOf(e.kind)===layer)&&seen.has(tileAt(e.x,e.y,s.map.size))){const d=reach(u,e);if(d<=sight&&d>=(own.minRange??0)&&(d<dist||d===dist&&best&&e.id<best.id)){best=e;dist=d;}}
  if(best)s.attacks[u.id]={target:{kind:'unit',id:best.id},cooldown:0,auto:true,repath:0,firedTick:-1};
 }
 for(const id of Object.keys(s.attacks).map(Number).sort((a,b)=>a-b)){
  const a=s.attacks[id],u=s.units.find(u=>u.id===id);if(!a||!u)continue;
  // Target gone or out of sight: stop at the next node instead of walking on to a stale position.
  if(targetProblem(s,u.player,a.target)){delete s.attacks[id];cancelMovement(s,u.id);Object.assign(u,{path:[],goal:null,target:null,navigation:u.next===null?'idle':'moving'});continue;}
  // A remembered building that is gone: the order becomes a walk to where it stood (the memory clears on arrival).
  const r=resolve(s,a.target);if(!r){const o=a.target.kind==='building'?remembered(s,u.player,a.target.id):null;delete s.attacks[id];
   if(o){const [x0,y0,x1,y1]=obstacleBounds(o);commandMove(s,[u.id],{x:Math.round((x0+x1)/2),y:Math.round((y0+y1)/2)});}continue;}
  const owner=ownerOf(s,u.player),stats=statsOf(u.kind,owner);if(a.cooldown>0)a.cooldown--;
  const d=reach(u,r.shape),min=nearest(u,owner);
  // An automatic fight with a target inside the minimum range is dropped; an order walks back out to firing distance.
  if(d<min&&a.auto){delete s.attacks[id];continue;}
  if(d<=limit(u,r.shape,owner)&&d>=min){
   if(u.next!==null)continue;
   if(u.path.length||busy.has(u.id)){cancelMovement(s,u.id);u.path=[];u.goal=null;u.target=null;}
   u.navigation='idle';
   // A trebuchet unpacks on the spot before its first shot.
   // Staying to shoot also abandons any packing begun by a move order (it would otherwise carry over to the next move).
   if(stats.setup){const st=(s.setups??={})[u.id]??={unpacked:false,progress:0};if(!st.unpacked){if(++st.progress<stats.setup)continue;st.unpacked=true;st.progress=0;a.cooldown=0;}else st.progress=0;}
   if(a.cooldown===0){a.cooldown=stats.cooldown;a.firedTick=s.tick;volley(s,u,stats,a.target);
    // A petard is spent by its charge.
    if(stats.selfDestruct&&s.units.includes(u)){delete s.attacks[id];killUnit(s,u);}}
   continue;
  }
  if(u.next!==null)continue;
  // An unpacked trebuchet packs up before it moves (movement.ts waits for it).
  if(a.repath>0&&(u.path.length||busy.has(u.id))){a.repath--;continue;}
  const nodes=approach(s,u,r.shape,limit(u,r.shape,owner),min);if(!nodes.length){delete s.attacks[id];continue;}
  routeTo(s,u,nodes);a.repath=REPATH;
 }
 // Conquest: a player with no units and no buildings is defeated; the last one standing wins.
 if(!s.outcome){// Units inside a town centre or tower count too (they come out when it falls, defense.ts).
  const inside=(p:number)=>Object.values((s as {garrison?:Record<string,{units:{unit:Unit}[]}>}).garrison??{}).some(g=>g.units.some(e=>e.unit.player===p))||
   Object.values((s as {transports?:Record<number,Unit[]>}).transports??{}).some(l=>l.some(v=>v.player===p));
  const alive=[0,1].filter(p=>s.units.some(u=>u.player===p&&!isAnimal(u.kind))||s.buildings.some(b=>b.player===p)||inside(p));
  if(alive.length<2)s.outcome={winner:alive.length===1?alive[0]:null,defeated:[0,1].filter(p=>!alive.includes(p)),tick:s.tick};}
}
