import {obstacleBounds} from '../content/footprints.ts';
import {forfeitReservation} from './economy.ts';
import {refreshNavigation,position,navigationRules,nodesNear} from './navigation.ts';
import {routeTo,cancelMovement,commandMove,blockedOf,layerOf} from './movement.ts';
import type {Unit} from './movement.ts';
import {recomputeCapacity,closeFarm,housingOf} from './buildings.ts';
import type {Building} from './buildings.ts';
import type {WorkState} from './work.ts';
import {combatRules,statsOf,hitDamage,buildingTargetOf,shotOf,projectileRules,speedOf} from './stats.ts';
import type {CombatUnitKind,UnitStats,ShotRule} from './stats.ts';
import {ownerOf,deathRefund,keepsHousing} from './civ.ts';
import type {Owner} from './civ.ts';
import {tileAt} from './terrain.ts';
import type {KnownObstacle} from './vision.ts';
import {isAnimal,makeCarcass} from './fauna.ts';
import {withCarried} from './garrison.ts';
import {releaseCarried} from './naval.ts';
import type {AnimalKind} from './fauna.ts';
// Deterministic combat: fixed damage on a fixed cooldown; ranged shots fly and may miss (the 戰術技巧 round), rolled on
// the match's own random stream, so replays are exact.
export type Target={kind:'unit';id:number}|{kind:'building';id:string};
// windup: ticks left of the aim before the first shot at this target (frameDelay; absent until in range, 0 once fired).
export type Attack={target:Target;cooldown:number;auto:boolean;repath:number;firedTick:number;windup?:number;anchor?:{x:number;y:number}};
// The 戰術技巧 round. A shot in flight: it moves speed units a tick from where it was fired towards `to`; sure: the
// accuracy roll succeeded, so it strikes the target unit when it passes within hitRadius of it (a unit that steps
// aside lets it fly past); otherwise it lands at `to` and strikes whatever enemy unit (or the aimed building) is there.
// extra: an extra arrow (Chu Ko Nu, Longboat), which has no blast or pass-through.
export type Projectile={id:number;player:number;attacker:number;kind:string;from:{x:number;y:number};x:number;y:number;to:{x:number;y:number};speed:number;target:Target;sure:boolean;stats:UnitStats;extra?:boolean;tick:number};
// Stances (aoetw.com 控兵: 攻擊／防禦／堅守／不還擊): aggressive engages anything in sight and chases it; defensive engages
// but gives up past defensiveLeash from where it stood and walks back; stand ground only fights what is already in range
// and never moves to fight; no attack never picks a fight (an explicit attack order still works).
export type Stance='aggressive'|'defensive'|'stand'|'passive';
export const stances:readonly Stance[]=['aggressive','defensive','stand','passive'];
// A patrol: the unit walks between from and to, turning at each end, and fights (per its stance) what it meets.
export type Patrol={from:{x:number;y:number};to:{x:number;y:number};leg:'out'|'back';wait:number};
export const tacticsRules={provenance:'design_default (aoetw.com names the stances and patrol but gives no numbers)',defensiveLeash:300,patrolTurn:100,patrolRetry:20} as const;
// reveals: an attacker's tile the victim's owner sees until the tick given (a hit from out of sight shows the shooter).
export type Reveal={player:number;tile:number;until:number};
export type Corpse={id:number;player:number;kind:Unit['kind'];x:number;y:number;tick:number};
// reason: conquest (no units and no buildings left) or resign (a player conceded).
export type Outcome={winner:number|null;defeated:number[];tick:number;reason?:'resign'|'relic'|'wonder'};
// beasts: animals that were struck and by whom (a deer flees from its hunter, a boar charges it; animals.ts).
export type Beast={foe:number;cooldown:number;repath:number};
// setups: trebuchets that are unpacked (or on their way to it; progress counts ticks of packing or unpacking).
export type CombatState=WorkState&{projectiles?:Projectile[];nextProjectileId?:number;rng?:number;stances?:Record<number,Stance>;patrols?:Record<number,Patrol>;keptHousing?:number[];setups?:Record<number,{unpacked:boolean;progress:number}>;attacks:Record<number,Attack>;corpses:Corpse[];outcome:Outcome|null;beasts:Record<number,Beast>;vision:{visible:number[];explored:number[];known:KnownObstacle[]}[]};
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
 // A fallen ram lets its infantry out instead (the reference; garrison.ts): only those with no free ground round it die.
 if(aboard&&u.kind==='ram')releaseCarried(s,u.id);const left=naval.transports?.[u.id];
 if(left){delete naval.transports![u.id];for(const v of left){v.x=u.x;v.y=u.y;killUnit(s,v);}}if(naval.unloading)delete naval.unloading[u.id];if(naval.boarding)delete naval.boarding[u.id];
 delete s.works[u.id];delete s.attacks[u.id];if(s.setups)delete s.setups[u.id];if(s.stances)delete s.stances[u.id];if(s.patrols)delete s.patrols[u.id];cancelMovement(s,u.id);a.populationUsed--;
 s.units=s.units.filter(v=>v!==u);s.corpses.push({id:u.id,player:u.player,kind:u.kind,x:u.x,y:u.y,tick:s.tick});
}
function destroyBuilding(s:CombatState,b:Building){
 const a=s.accounts[b.player];if(!b.complete&&b.reservationId)forfeitReservation(a,b.reservationId);for(const q of b.queue)forfeitReservation(a,q.reservationId);
 const o=s.map.obstacles.find(o=>o.id===b.id)!;s.map.obstacles=s.map.obstacles.filter(v=>v!==o);for(const t of s.map.tiles)t.obstacleRefs=t.obstacleRefs.filter(r=>r!==b.id);
 // Nomads: a finished house that falls keeps its housing for its owner.
 if(b.complete&&keepsHousing(ownerOf(s,b.player),b.kind)){(s.keptHousing??=[0,0])[b.player]+=housingOf(s,b.player,b.kind);}
 s.buildings=s.buildings.filter(v=>v!==b);if(b.kind==='farm'||b.kind==='fish-trap')closeFarm(s,b.id,s.tick);refreshNavigation(s.map,obstacleBounds(o,navigationRules.radius));recomputeCapacity(s,b.player);
}
// A hit from where the victim's owner cannot see shows the attacker's tile to that owner for revealTicks (aoetw.com 視野:
// a unit struck by a ranged unit out of its sight reveals where the shot came from).
export const revealTicks=40;
function reveal(s:CombatState,victim:number,from:{x:number;y:number}){
 if(victim!==0&&victim!==1)return;const tile=tileAt(from.x,from.y,s.map.size);if(s.vision[victim].visible.includes(tile))return;
 const list=((s as {reveals?:Reveal[]}).reveals??=[]),old=list.find(r=>r.player===victim&&r.tile===tile);
 if(old)old.until=s.tick+revealTicks;else list.push({player:victim,tile,until:s.tick+revealTicks});
}
// attacker: who struck (a struck animal remembers the first one, see animals.ts); from: where the blow came from.
export function strike(s:CombatState,t:Target,amount:number,attacker:number,from?:{x:number;y:number}){
 if(from){const p=t.kind==='unit'?s.units.find(u=>u.id===t.id)?.player:s.buildings.find(b=>b.id===t.id)?.player;if(p!==undefined)reveal(s,p,from);}
 if(t.kind==='unit'){const u=s.units.find(u=>u.id===t.id)!;u.hp-=amount;u.hitTick=s.tick;if(isAnimal(u.kind)&&!s.beasts[u.id])s.beasts[u.id]={foe:attacker,cooldown:0,repath:0};if(u.hp<=0)killUnit(s,u);return;}
 const b=s.buildings.find(b=>b.id===t.id)!;b.hp-=amount;const o=s.map.obstacles.find(o=>o.id===b.id)!;
 // The damaged look (missing parts) appears below half health; it is appearance only.
 if(b.hp*2<b.maxHp)o.damaged=true;if(b.hp<=0)destroyBuilding(s,b);
}
// What one blow does where it lands: the hit on the target (if any), then the blast round the impact, a trample, a
// ram's splash on nearby buildings, a pass-through bolt's line, extra arrows (instant blows only) and Logistica's splash.
// shooter: who dealt it (id for credit and to spare it from its own blast; player for friend and foe); where: the impact
// point (a unit target's centre, or where a shot came down); box: the struck building's footprint.
function land(s:CombatState,shooter:{id:number;player:number},stats:UnitStats,t:Target|null,where:{x:number;y:number}|null,box:number[]|null,from:{x:number;y:number},extras:boolean){
 const tid=t?(t as {id:unknown}).id:undefined;
 const foes=()=>[...s.units].sort((a,b)=>a.id-b.id).filter(v=>v.id!==tid&&v.player!==shooter.player&&!isAnimal(v.kind));
 // The line of a pass-through bolt, from where it was shot through the impact.
 const line=stats.passThrough&&where?{x0:from.x,y0:from.y,x1:where.x,y1:where.y}:null;
 // Neighbours of a unit target, taken before the hit (a trample lands round where the target stood).
 const near=stats.trample&&where&&t?.kind==='unit'?foes().filter(v=>reach(where,v)<=50):[];
 if(t)strike(s,t,damageOn(s,stats,t),shooter.id,from);
 // Blast: every other unit within the radius of the impact (the target's centre or its footprint) takes the hit. The
 // mangonel line and the bombard cannon hit own units too (aoetw.com 擴散範圍, marked *; never the shooter itself);
 // demolition ships, Warwolf and the rest spare them.
 const blasted=()=>stats.friendlyFire?[...s.units].sort((a,b)=>a.id-b.id).filter(v=>v.id!==shooter.id&&v.id!==tid&&!isAnimal(v.kind)):foes();
 if(stats.blast&&(where||box))for(const v of blasted())if(s.units.includes(v)&&reach(v,box??where!)<=stats.blast)strike(s,{kind:'unit',id:v.id},damageOn(s,stats,{kind:'unit',id:v.id}),shooter.id,from);
 // Trample (the war elephant): enemy units next to the target take that share of what the hit would do to them.
 for(const v of near)if(s.units.includes(v))strike(s,{kind:'unit',id:v.id},Math.max(1,Math.round(damageOn(s,stats,{kind:'unit',id:v.id})*stats.trample!)),shooter.id,from);
 // Capped and siege rams: enemy buildings whose footprint is this close to the struck one take the hit too.
 if(stats.buildingSplash&&box)for(const b of [...s.buildings].sort((a,b)=>a.id<b.id?-1:1)){if(b.id===tid||b.player===shooter.player||!s.buildings.includes(b))continue;const o=buildingBox(s,b);
  if(o&&Math.max(o[0]-box[2],box[0]-o[2],o[1]-box[3],box[1]-o[3],0)<=stats.buildingSplash)strike(s,{kind:'building',id:b.id},damageOn(s,stats,{kind:'building',id:b.id}),shooter.id,from);}
 // Pass-through: enemy units within half a node of the bolt's path, from the shooter to passThrough past the impact,
 // take half the bolt's attack (aoetw: only the target takes the full hit).
 if(line){const dx=line.x1-line.x0,dy=line.y1-line.y0,len=Math.hypot(dx,dy)||1,end=len+stats.passThrough!;
  for(const v of foes()){if(!s.units.includes(v))continue;const along=((v.x-line.x0)*dx+(v.y-line.y0)*dy)/len,off=Math.abs((v.x-line.x0)*dy-(v.y-line.y0)*dx)/len;
   if(along>0&&along<=end&&off<=25)strike(s,{kind:'unit',id:v.id},damageOn(s,{...stats,damage:Math.max(1,Math.round(stats.damage/2))},{kind:'unit',id:v.id}),shooter.id,from);}}
 if(extras&&t)for(let i=0;i<(stats.extraShots??0);i++){if(t.kind==='unit'&&!s.units.some(v=>v.id===t.id))break;strike(s,t,damageOn(s,{...stats,damage:stats.extraDamage??1,bonus:{}},t),shooter.id,from);}
 if(stats.splash&&where&&t)for(const v of [...s.units].sort((a,b)=>a.id-b.id))if(v.id!==tid&&v.player!==shooter.player&&!isAnimal(v.kind)&&reach(where,v)<=50&&s.units.includes(v))strike(s,{kind:'unit',id:v.id},damageOn(s,{...stats,damage:stats.splash,bonus:{}},{kind:'unit',id:v.id}),shooter.id,from);
}
// The match's random stream (xorshift32, shared with conversions; renderers never draw from it).
function random(s:CombatState){let n=(s.rng??1)||1;n^=n<<13;n^=n>>>17;n^=n<<5;s.rng=n>>>0;return s.rng;}
const moving=(u:Unit)=>u.next!==null||u.path.length>0;
// Where a shot at this target is aimed: a unit's centre now, or (Ballistics) where it will be when the shot arrives, from
// its current step and speed; a building's centre.
function aimAt(s:CombatState,t:Target,from:{x:number;y:number},speed:number,lead:boolean){
 if(t.kind==='building'){const b=s.buildings.find(b=>b.id===t.id),box=b&&buildingBox(s,b);return box?{x:Math.round((box[0]+box[2])/2),y:Math.round((box[1]+box[3])/2)}:null;}
 const v=s.units.find(u=>u.id===t.id);if(!v)return null;if(!lead||v.next===null)return {x:v.x,y:v.y};
 const n=position(s.map,v.next),dx=n.x-v.x,dy=n.y-v.y,len=Math.hypot(dx,dy)||1,pace=v.kind in combatRules.units?speedOf(v.kind as CombatUnitKind,ownerOf(s,v.player)):0;
 const flight=Math.hypot(v.x-from.x,v.y-from.y)/speed,ahead=pace*flight;
 return {x:Math.round(v.x+dx/len*ahead),y:Math.round(v.y+dy/len*ahead)};
}
// Fires one shot: the accuracy roll (a standing target can be sure with Thumb Ring or Warwolf), then a miss lands
// missSpread away from the aim in a random direction.
export function launch(s:CombatState,shooter:{id:number;player:number;kind:string;x:number;y:number},stats:UnitStats,t:Target,rule:ShotRule,extra=false){
 const from={x:shooter.x,y:shooter.y},aim=aimAt(s,t,from,rule.speed,rule.lead);if(!aim)return;
 const tv=t.kind==='unit'?s.units.find(u=>u.id===t.id):undefined,standing=!tv||!moving(tv);
 const chance=standing&&rule.steady?Math.max(rule.accuracy,rule.steady):rule.accuracy,sure=chance>=100||random(s)%100<chance;
 let to=aim;if(!sure){const [lo,hi]=projectileRules.missSpread,a=(random(s)%3600)*Math.PI/1800,d=lo+random(s)%(hi-lo+1);to={x:Math.round(aim.x+Math.cos(a)*d),y:Math.round(aim.y+Math.sin(a)*d)};}
 (s.projectiles??=[]).push({id:s.nextProjectileId=(s.nextProjectileId??0)+1,player:shooter.player,attacker:shooter.id,kind:shooter.kind,from,x:from.x,y:from.y,to,speed:rule.speed,target:t,sure,stats,...(extra?{extra}:{}),tick:s.tick});
}
// Shots in flight move; a sure shot strikes its unit when it passes close enough, and every other shot comes down where
// it was aimed: on the aimed building if it lands on it, else on the nearest enemy unit there (lowest id on ties), else
// on the ground (a blast still goes off).
function stepProjectiles(s:CombatState){
 if(!s.projectiles?.length)return;const R=projectileRules.hitRadius,done=new Set<number>();
 for(const p of [...s.projectiles].sort((a,b)=>a.id-b.id)){
  const dx=p.to.x-p.x,dy=p.to.y-p.y,d=Math.hypot(dx,dy),arrived=d<=p.speed;
  if(arrived){p.x=p.to.x;p.y=p.to.y;}else{p.x+=dx/d*p.speed;p.y+=dy/d*p.speed;}
  const shooter={id:p.attacker,player:p.player};
  if(p.sure&&p.target.kind==='unit'){const v=s.units.find(u=>u.id===(p.target as {id:number}).id);
   if(v&&Math.hypot(v.x-p.x,v.y-p.y)<=R){done.add(p.id);land(s,shooter,p.stats,p.target,{x:v.x,y:v.y},null,p.from,false);continue;}}
  if(!arrived)continue;done.add(p.id);const at={x:p.to.x,y:p.to.y};
  if(p.target.kind==='building'){const b=s.buildings.find(b=>b.id===(p.target as {id:string}).id),box=b&&buildingBox(s,b);
   if(box&&reach(at,box)<=R){land(s,shooter,p.stats,p.target,null,box,p.from,false);continue;}}
  const hit=[...s.units].filter(v=>v.player!==p.player&&!isAnimal(v.kind)&&Math.hypot(v.x-at.x,v.y-at.y)<=R).sort((a,b)=>Math.hypot(a.x-at.x,a.y-at.y)-Math.hypot(b.x-at.x,b.y-at.y)||a.id-b.id)[0];
  if(p.extra){if(hit)strike(s,{kind:'unit',id:hit.id},damageOn(s,p.stats,{kind:'unit',id:hit.id}),p.attacker,p.from);continue;}
  land(s,shooter,p.stats,hit?{kind:'unit',id:hit.id}:null,hit?{x:hit.x,y:hit.y}:at,null,p.from,false);
 }
 s.projectiles=s.projectiles.filter(p=>!done.has(p.id));
}
// One attack. A blow at hand lands at once; a shot (projectileRules) flies, and its extra arrows fly as their own shots.
function volley(s:CombatState,u:Unit,stats:UnitStats,t:Target){
 const from={x:u.x,y:u.y},rule=stats.range>projectileRules.meleeReach?shotOf(u.kind,ownerOf(s,u.player)):null;
 if(rule){const shooter={id:u.id,player:u.player,kind:u.kind,x:u.x,y:u.y};launch(s,shooter,stats,t,rule);
  for(let i=0;i<(stats.extraShots??0);i++)launch(s,shooter,{...stats,damage:stats.extraDamage??1,bonus:{}},t,rule,true);return;}
 const at=t.kind==='unit'?s.units.find(v=>v.id===t.id):undefined,where=at?{x:at.x,y:at.y}:null;
 const box=t.kind==='building'?(()=>{const b=s.buildings.find(b=>b.id===t.id);return b?buildingBox(s,b):null;})():null;
 land(s,{id:u.id,player:u.player},stats,t,where,box,from,true);
}
// Patrols: an idle patrolling unit (no fight, no walk) heads for the end it is on its way to, turning at each end; a
// unit that cannot get there tries again after patrolRetry ticks.
function stepPatrols(s:CombatState,busy:Set<number>){
 for(const id of Object.keys(s.patrols??{}).map(Number).sort((a,b)=>a-b)){const p=s.patrols![id],u=s.units.find(u=>u.id===id);
  if(!u){delete s.patrols![id];continue;}if(p.wait>0){p.wait--;continue;}
  if(s.attacks[id]||u.next!==null||u.path.length||busy.has(id))continue;
  let goal=p.leg==='out'?p.to:p.from;if(reach(u,goal)<=tacticsRules.patrolTurn){p.leg=p.leg==='out'?'back':'out';goal=p.leg==='out'?p.to:p.from;}
  try{commandMove(s,[id],goal);}catch{delete s.patrols![id];continue;}p.wait=tacticsRules.patrolRetry;}
}
// Regeneration (the Berserk): a hit point every so many ticks, up to the unit's maximum.
function regenerate(s:CombatState){
 for(const u of s.units){if(!(u.kind in combatRules.units))continue;const st=statsOf(u.kind as CombatUnitKind,ownerOf(s,u.player));if(!st.regen)continue;
  const every=Math.max(1,Math.round(60*20/st.regen));if(s.tick%every===0&&u.hp<st.hp)u.hp=Math.min(st.hp,u.hp+1);}
}
export function stepCombat(s:CombatState){
 regenerate(s);
 stepProjectiles(s);
 s.corpses=s.corpses.filter(c=>s.tick-c.tick<combatRules.corpseTicks);
 const busy=new Set(s.pathJobs.flatMap(j=>j.kind==='group'?j.unitIds:[j.unitId]));
 stepPatrols(s,busy);
 // Idle soldiers engage the nearest visible enemy unit within sight (lowest id on ties); a patrolling one looks while it
 // walks. Stances: no attack never does; stand ground only takes what is already in range.
 for(const u of [...s.units].sort((a,b)=>a.id-b.id)){
  const own=statsOf(u.kind,ownerOf(s,u.player)),stance=s.stances?.[u.id]??'aggressive',patrolling=!!s.patrols?.[u.id];
  if(stance==='passive'||own.buildingsOnly||s.attacks[u.id]||s.works[u.id]||!patrolling&&(u.next!==null||u.path.length||busy.has(u.id)))continue;
  const sight=stance==='stand'?Math.min(own.sight,own.range):own.sight;if(!sight)continue;
  const seen=new Set(s.vision[u.player].visible);let best:Unit|null=null,dist=Infinity;
  // Animals are never picked automatically (hunting is an order); they have no sight here, so they pick no fights.
  // Across the shore (a ship and a land unit) only units that shoot pick each other (range 150 and up): a swordsman
  // never locks onto a galley it cannot reach.
  const layer=layerOf(u.kind),across=own.range>=150;
  for(const e of s.units)if(e.player!==u.player&&!isAnimal(e.kind)&&(across||layerOf(e.kind)===layer)&&seen.has(tileAt(e.x,e.y,s.map.size))){const d=reach(u,e);if(d<=sight&&d>=(own.minRange??0)&&(d<dist||d===dist&&best&&e.id<best.id)){best=e;dist=d;}}
  if(best)s.attacks[u.id]={target:{kind:'unit',id:best.id},cooldown:0,auto:true,repath:0,firedTick:-1,...(stance==='defensive'?{anchor:{x:u.x,y:u.y}}:{})};
 }
 for(const id of Object.keys(s.attacks).map(Number).sort((a,b)=>a-b)){
  const a=s.attacks[id],u=s.units.find(u=>u.id===id);if(!a||!u)continue;
  // Target gone or out of sight: stop at the next node instead of walking on to a stale position.
  if(targetProblem(s,u.player,a.target)){delete s.attacks[id];cancelMovement(s,u.id);Object.assign(u,{path:[],goal:null,target:null,navigation:u.next===null?'idle':'moving'});continue;}
  // A remembered building that is gone: the order becomes a walk to where it stood (the memory clears on arrival).
  const r=resolve(s,a.target);if(!r){const o=a.target.kind==='building'?remembered(s,u.player,a.target.id):null;delete s.attacks[id];
   if(o){const [x0,y0,x1,y1]=obstacleBounds(o);commandMove(s,[u.id],{x:Math.round((x0+x1)/2),y:Math.round((y0+y1)/2)});}continue;}
  const owner=ownerOf(s,u.player),stats=withCarried(s,u,statsOf(u.kind,owner));if(a.cooldown>0)a.cooldown--;
  const d=reach(u,r.shape),min=nearest(u,owner),stance=s.stances?.[u.id]??'aggressive';
  // An automatic fight with a target inside the minimum range is dropped; an order walks back out to firing distance.
  if(d<min&&a.auto){delete s.attacks[id];continue;}
  // Stand ground: an automatic fight that would need a step is dropped. Defensive: a chase that strays past the leash
  // from where the unit stood ends, and the unit walks back there.
  if(a.auto&&stance==='stand'&&d>limit(u,r.shape,owner)){delete s.attacks[id];continue;}
  if(a.auto&&a.anchor&&reach(u,a.anchor)>tacticsRules.defensiveLeash){const home=a.anchor;delete s.attacks[id];commandMove(s,[u.id],home);continue;}
  if(d<=limit(u,r.shape,owner)&&d>=min){
   if(u.next!==null){delete a.windup;continue;}
   if(u.path.length||busy.has(u.id)){cancelMovement(s,u.id);u.path=[];u.goal=null;u.target=null;}
   u.navigation='idle';
   // A trebuchet unpacks on the spot before its first shot.
   // Staying to shoot also abandons any packing begun by a move order (it would otherwise carry over to the next move).
   if(stats.setup){const st=(s.setups??={})[u.id]??={unpacked:false,progress:0};if(!st.unpacked){if(++st.progress<stats.setup)continue;st.unpacked=true;st.progress=0;a.cooldown=0;}else st.progress=0;}
   // Frame delay (開火間隔): a ranged unit aims this many ticks, standing, before its first shot at the target.
   if(stats.frameDelay&&a.windup!==0){a.windup=a.windup===undefined?stats.frameDelay:a.windup-1;if(a.windup>0)continue;}
   if(a.cooldown===0){a.cooldown=stats.cooldown;a.firedTick=s.tick;volley(s,u,stats,a.target);
    // A petard is spent by its charge.
    if(stats.selfDestruct&&s.units.includes(u)){delete s.attacks[id];killUnit(s,u);}}
   continue;
  }
  // Walking (out of range, or chasing): the aim starts over at the next stop.
  delete a.windup;
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
