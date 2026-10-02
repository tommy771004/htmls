// Repair (the 遊戲元素 round; aoetw.com elements/Hit_points, units/Villager, building/Town_Center): villagers restore the
// hit points of their own finished buildings, siege weapons and ships, paying as they go. A full repair costs half of
// what the thing costs (the civilization's discounts included), charged hit point by hit point so the total is exact;
// a town centre's repair takes no stone but twice the wood. A villager stops when its owner cannot pay the next point.
// Rate: the first villager on a target restores rate hundredths of a hit point a tick, each further one half that.
// The site's 750 hit points a minute for a building is converted like the buildings themselves (hit points / 6, times
// x2.5 for this game's building pace): 26 hundredths a tick. Siege weapons and ships keep the site's hit points and
// times, so theirs is the site's 187.5 a minute (a quarter of a building's) as it stands: 16 hundredths a tick.
// Villagers repair a building from its builders' ring, a siege weapon from beside it, a ship from the shore within reach.
import {position,blockedFor,nodesNear} from './navigation.ts';
import {routeTo,cancelMovement} from './movement.ts';
import type {Unit} from './movement.ts';
import {combatRules,maxHpOf} from './stats.ts';
import type {CombatUnitKind} from './stats.ts';
import {ownerOf,costOf} from './civ.ts';
import {resources} from '../content/rules.ts';
import type {Resource} from '../content/rules.ts';
import {reach} from './combat.ts';
import type {CombatState} from './combat.ts';
import {buildSlots} from './work.ts';
export const repairRules={provenance:'aoetw.com for the cost share, the extra-villager share and what can be repaired; design_default for the rates in this scale',
 buildingRate:26,unitRate:16,costShare:0.5,siegeReach:75,shipReach:100,retries:3,unrepairable:['farm','fish-trap']} as const;
export type RepairTarget={kind:'building';id:string}|{kind:'unit';id:number};
export type RepairWork={kind:'repair';target:RepairTarget;phase:'toRepair'|'repairing';retries:number};
// Per target ('b:<id>' or 'u:<id>'): hundredths of a hit point accrued, and per resource the cost owed in units of
// 1/(2 x maximum hit points) (paid in whole resources as it adds up).
export type RepairLedger={pool:number;owed:Record<Resource,number>};
type RepairState=CombatState&{repairs?:Record<string,RepairLedger>};
const keyOf=(t:RepairTarget)=>t.kind==='building'?`b:${t.id}`:`u:${t.id}`;
const classesOf=(kind:string)=>kind in combatRules.units?combatRules.units[kind as CombatUnitKind].classes:[];
export const repairableUnit=(kind:string)=>classesOf(kind).some(c=>c==='siege'||c==='ship');
function resolve(s:CombatState,t:RepairTarget){
 if(t.kind==='building'){const b=s.buildings.find(b=>b.id===t.id);return b?{player:b.player,hp:b.hp,max:b.maxHp,entry:b.kind,building:b,unit:null}:null;}
 const u=s.units.find(u=>u.id===t.id);return u&&u.kind in combatRules.units?{player:u.player,hp:u.hp,max:maxHpOf(u.kind as CombatUnitKind,ownerOf(s,u.player)),entry:u.kind as string,building:null,unit:u}:null;}
// Why these villagers cannot repair this target now (null when they can).
export function repairProblem(s:CombatState,player:number,t:unknown):string|null{
 const target=t as RepairTarget;if(!target||target.kind!=='building'&&target.kind!=='unit'||target.kind==='building'&&typeof target.id!=='string'||target.kind==='unit'&&!Number.isSafeInteger(target.id))return '無效的修理目標';
 const r=resolve(s,target);if(!r||r.player!==player)return '只能修理己方的建築、攻城器與船隻';
 if(r.building){if(!r.building.complete)return '建築尚未完工：用建造繼續施工';if((repairRules.unrepairable as readonly string[]).includes(r.building.kind))return '農田與魚網不能修理';}
 else if(!repairableUnit(r.entry))return '只能修理建築、攻城器與船隻：其他單位由僧侶治療';
 if(r.hp>=r.max)return '沒有受損，不需要修理';
 return null;
}
// The cost a repair is a share of: the thing's cost for its owner; a town centre's: no stone, twice the wood.
function repairBase(s:CombatState,player:number,entry:string):Record<Resource,number>{
 const c={...costOf(entry,ownerOf(s,player))};if(entry==='town-center'){c.wood*=2;c.stone=0;}return c;}
// What a full repair costs (costShare of the base; whole resources, rounded down like the running total).
export const repairCost=(s:CombatState,player:number,entry:string)=>Object.fromEntries(resources.map(r=>[r,Math.floor(repairBase(s,player,entry)[r]*repairRules.costShare)])) as Record<Resource,number>;
// Where a villager stands to repair it.
function slots(s:CombatState,t:RepairTarget):number[]{
 if(t.kind==='building'){const b=s.buildings.find(b=>b.id===t.id);return b?buildSlots(s.map,b,'land'):[];}
 const u=s.units.find(u=>u.id===t.id);if(!u)return [];const range=classesOf(u.kind).includes('ship')?repairRules.shipReach:repairRules.siegeReach,closed=blockedFor(s.map,'land');
 return nodesNear(s.map,[u.x,u.y,u.x,u.y],range).filter(n=>{if(closed[n])return false;const d=reach(position(s.map,n),u);return d>0&&d<=range;});
}
const stop=(s:CombatState,u:Unit)=>{delete s.works[u.id];if(u.navigation!=='moving')u.navigation='idle';};
function goTo(s:CombatState,u:Unit,w:RepairWork){const t=slots(s,w.target);if(!t.length)return stop(s,u);
 const held=new Set(s.units.filter(v=>v!==u&&v.next===null&&!v.path.length).map(v=>v.node)),free=t.filter(n=>!held.has(n));w.phase='toRepair';routeTo(s,u,free.length?free:t);}
export function commandRepair(s:CombatState,unitIds:number[],target:RepairTarget){
 for(const id of unitIds){const u=s.units.find(u=>u.id===id)!;cancelMovement(s,id);const w:RepairWork={kind:'repair',target:{...target},phase:'toRepair',retries:0};(s.works as Record<number,unknown>)[id]=w;goTo(s,u,w);}
}
// One tick of one villager's repair. credited: targets that already had their first villager this tick.
export function stepRepairer(state:CombatState,u:Unit,w:RepairWork,credited:Set<string>){
 const s=state as RepairState,r=resolve(s,w.target);
 if(!r||r.player!==u.player||r.hp>=r.max||r.building&&!r.building.complete){if(r&&r.hp>=r.max)delete s.repairs?.[keyOf(w.target)];return stop(s,u);}
 if(!slots(s,w.target).includes(u.node)){if(++w.retries>repairRules.retries)return stop(s,u);return goTo(s,u,w);}
 w.phase='repairing';w.retries=0;u.navigation='idle';
 const key=keyOf(w.target),led=((s.repairs??={})[key]??={pool:0,owed:{food:0,wood:0,gold:0,stone:0}}),rate=r.building?repairRules.buildingRate:repairRules.unitRate;
 led.pool+=credited.has(key)?rate/2:rate;credited.add(key);
 // Each hit point owes base/(max/costShare) of every resource: base is added per point and paid off in whole units of
 // max/costShare, so a repair from 0 to full pays exactly floor(base x costShare).
 const base=repairBase(s,r.player,r.entry),stock=s.accounts[r.player].stock,unit=Math.round(r.max/repairRules.costShare);
 while(led.pool>=100&&(r.building?r.building.hp:r.unit!.hp)<r.max){
  const due=Object.fromEntries(resources.map(k=>[k,Math.floor((led.owed[k]+base[k])/unit)])) as Record<Resource,number>;
  if(resources.some(k=>stock[k]<due[k])){led.pool=Math.min(led.pool,99);return stop(s,u);}
  for(const k of resources){led.owed[k]+=base[k]-due[k]*unit;stock[k]-=due[k];s.accounts[r.player].ledger.repair[k]+=due[k];}
  led.pool-=100;if(r.building)r.building.hp++;else r.unit!.hp++;
 }
 if((r.building?r.building.hp:r.unit!.hp)>=r.max){delete s.repairs![key];stop(s,u);}
}
