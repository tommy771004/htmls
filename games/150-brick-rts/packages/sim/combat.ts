import {obstacleBounds} from '../content/footprints.ts';
import {forfeitReservation} from './economy.ts';
import {refreshNavigation,position,navigationRules,blockedTable,nodesNear} from './navigation.ts';
import {routeTo,cancelMovement} from './movement.ts';
import type {Unit} from './movement.ts';
import {recomputeCapacity,closeFarm} from './buildings.ts';
import type {Building} from './buildings.ts';
import type {WorkState} from './work.ts';
import {combatRules} from './stats.ts';
import {tileAt} from './terrain.ts';
// Deterministic combat: fixed damage on a fixed cooldown, no randomness, no animation timing.
export type Target={kind:'unit';id:number}|{kind:'building';id:string};
export type Attack={target:Target;cooldown:number;auto:boolean;repath:number;firedTick:number};
export type Corpse={id:number;player:number;kind:Unit['kind'];x:number;y:number;tick:number};
// reason: conquest (no units and no buildings left) or resign (a player conceded).
export type Outcome={winner:number|null;defeated:number[];tick:number;reason?:'resign'};
export type CombatState=WorkState&{attacks:Record<number,Attack>;corpses:Corpse[];outcome:Outcome|null;vision:{visible:number[];explored:number[]}[]};
const REPATH=20;
function buildingBox(s:CombatState,b:Building){const o=s.map.obstacles.find(o=>o.id===b.id);return o?obstacleBounds(o):null;}
// Chebyshev distance from a point to a unit centre or to a building footprint edge.
export function reach(p:{x:number;y:number},t:{x:number;y:number}|number[]){if(!Array.isArray(t))return Math.max(Math.abs(p.x-t.x),Math.abs(p.y-t.y));return Math.max(t[0]-p.x,0,p.x-t[2],t[1]-p.y,0,p.y-t[3]);}
function resolve(s:CombatState,t:Target){if(t.kind==='unit'){const u=s.units.find(u=>u.id===t.id);return u?{player:u.player,shape:{x:u.x,y:u.y} as {x:number;y:number}|number[],tiles:[tileAt(u.x,u.y,s.map.size)]}:null;}
 const b=s.buildings.find(b=>b.id===t.id),box=b&&buildingBox(s,b);if(!b||!box)return null;
 const tiles:number[]=[];for(let ty=Math.floor(box[1]/100);ty<=Math.floor((box[3]-1)/100);ty++)for(let tx=Math.floor(box[0]/100);tx<=Math.floor((box[2]-1)/100);tx++)tiles.push(ty*s.map.size+tx);
 return {player:b.player,shape:box as {x:number;y:number}|number[],tiles};}
export function targetProblem(s:CombatState,player:number,t:Target):string|null{
 const r=resolve(s,t);if(!r)return '找不到目標';if(r.player===player)return '不能攻擊己方';
 const seen=new Set(s.vision[player].visible);if(!r.tiles.some(id=>seen.has(id)))return '找不到目標';return null;
}
export function commandAttack(s:CombatState,unitIds:number[],t:Target){
 for(const id of unitIds){cancelMovement(s,id);delete s.works[id];s.attacks[id]={target:t,cooldown:0,auto:false,repath:0,firedTick:-1};}
}
export function clearAttacks(s:CombatState,unitIds:number[]){for(const id of unitIds)delete s.attacks[id];}
// Against a building, range counts from the unit's body edge (range + radius), like a builder's work ring;
// otherwise some footprint offsets leave no free node inside the band that range-from-centre allows.
const limit=(u:Unit,shape:{x:number;y:number}|number[])=>combatRules.units[u.kind].range+(Array.isArray(shape)?navigationRules.radius:0);
// Free nodes within range of the target (range defaults to the unit's attack reach); monks use it for their rites too.
export function approach(s:CombatState,u:Unit,shape:{x:number;y:number}|number[],range=limit(u,shape)){
 const out:number[]=[];
 const closed=blockedTable(s.map),area=Array.isArray(shape)?shape:[shape.x,shape.y,shape.x,shape.y];
 for(const n of nodesNear(s.map,area,range)){if(closed[n])continue;const p=position(s.map,n),d=reach(p,shape);if(d<=range&&(Array.isArray(shape)||d>0))out.push(n);}
 // Prefer positions no other unit is standing on, so attackers spread around the target.
 const held=new Set(s.units.filter(v=>v!==u&&v.next===null&&!v.path.length).map(v=>v.node)),free=out.filter(n=>!held.has(n));
 return free.length?free:out;
}
function killUnit(s:CombatState,u:Unit){
 const a=s.accounts[u.player],c=s.cargo[u.id];if(c){a.ledger.lost[c.resource]+=c.amount;delete s.cargo[u.id];}
 delete s.works[u.id];delete s.attacks[u.id];cancelMovement(s,u.id);a.populationUsed--;
 s.units=s.units.filter(v=>v!==u);s.corpses.push({id:u.id,player:u.player,kind:u.kind,x:u.x,y:u.y,tick:s.tick});
}
function destroyBuilding(s:CombatState,b:Building){
 const a=s.accounts[b.player];if(!b.complete&&b.reservationId)forfeitReservation(a,b.reservationId);for(const q of b.queue)forfeitReservation(a,q.reservationId);
 const o=s.map.obstacles.find(o=>o.id===b.id)!;s.map.obstacles=s.map.obstacles.filter(v=>v!==o);for(const t of s.map.tiles)t.obstacleRefs=t.obstacleRefs.filter(r=>r!==b.id);
 s.buildings=s.buildings.filter(v=>v!==b);if(b.kind==='farm')closeFarm(s,b.id,s.tick);refreshNavigation(s.map,obstacleBounds(o,navigationRules.radius));recomputeCapacity(s,b.player);
}
function damage(s:CombatState,t:Target,amount:number){
 if(t.kind==='unit'){const u=s.units.find(u=>u.id===t.id)!;u.hp-=amount;u.hitTick=s.tick;if(u.hp<=0)killUnit(s,u);return;}
 const b=s.buildings.find(b=>b.id===t.id)!;b.hp-=amount;const o=s.map.obstacles.find(o=>o.id===b.id)!;
 // The damaged look (missing parts) appears below half health; it is appearance only.
 if(b.hp*2<b.maxHp)o.damaged=true;if(b.hp<=0)destroyBuilding(s,b);
}
export function stepCombat(s:CombatState){
 s.corpses=s.corpses.filter(c=>s.tick-c.tick<combatRules.corpseTicks);
 const busy=new Set(s.pathJobs.flatMap(j=>j.kind==='group'?j.unitIds:[j.unitId]));
 // Idle soldiers engage the nearest visible enemy unit within sight (lowest id on ties).
 for(const u of [...s.units].sort((a,b)=>a.id-b.id)){
  const sight=combatRules.units[u.kind].sight;if(!sight||s.attacks[u.id]||s.works[u.id]||u.next!==null||u.path.length||busy.has(u.id))continue;
  const seen=new Set(s.vision[u.player].visible);let best:Unit|null=null,dist=Infinity;
  for(const e of s.units)if(e.player!==u.player&&seen.has(tileAt(e.x,e.y,s.map.size))){const d=reach(u,e);if(d<=sight&&(d<dist||d===dist&&best&&e.id<best.id)){best=e;dist=d;}}
  if(best)s.attacks[u.id]={target:{kind:'unit',id:best.id},cooldown:0,auto:true,repath:0,firedTick:-1};
 }
 for(const id of Object.keys(s.attacks).map(Number).sort((a,b)=>a-b)){
  const a=s.attacks[id],u=s.units.find(u=>u.id===id);if(!a||!u)continue;
  // Target gone or out of sight: stop at the next node instead of walking on to a stale position.
  if(targetProblem(s,u.player,a.target)){delete s.attacks[id];cancelMovement(s,u.id);Object.assign(u,{path:[],goal:null,target:null,navigation:u.next===null?'idle':'moving'});continue;}
  const r=resolve(s,a.target)!,stats=combatRules.units[u.kind];if(a.cooldown>0)a.cooldown--;
  if(reach(u,r.shape)<=limit(u,r.shape)){
   if(u.next!==null)continue;
   if(u.path.length||busy.has(u.id)){cancelMovement(s,u.id);u.path=[];u.goal=null;u.target=null;}
   u.navigation='idle';
   if(a.cooldown===0){a.cooldown=stats.cooldown;a.firedTick=s.tick;damage(s,a.target,stats.damage);}
   continue;
  }
  if(u.next!==null)continue;
  if(a.repath>0&&(u.path.length||busy.has(u.id))){a.repath--;continue;}
  const nodes=approach(s,u,r.shape);if(!nodes.length){delete s.attacks[id];continue;}
  routeTo(s,u,nodes);a.repath=REPATH;
 }
 // Conquest: a player with no units and no buildings is defeated; the last one standing wins.
 if(!s.outcome){const alive=[0,1].filter(p=>s.units.some(u=>u.player===p)||s.buildings.some(b=>b.player===p));
  if(alive.length<2)s.outcome={winner:alive.length===1?alive[0]:null,defeated:[0,1].filter(p=>!alive.includes(p)),tick:s.tick};}
}
