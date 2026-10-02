import {obstacleBounds} from '../content/footprints.ts';
import {rules,resources} from '../content/rules.ts';
import {reserve,cancelReservation,commitReservation} from './economy.ts';
import {position,navigationRules,nearest,blockedFor,nodesNear} from './navigation.ts';
import {makeUnit,commandMove,unitKinds,layerOf} from './movement.ts';
import type {Layer} from './movement.ts';
import type {UnitKind,MovementState,Unit} from './movement.ts';
import {battered,garrisonCapacity} from './defense.ts';
import type {Building,BuildingState} from './buildings.ts';
import {recomputeCapacity} from './buildings.ts';
import {combatRules,maxHpOf,buildingHpOf} from './stats.ts';
import {ownerOf,costOf,timeTicks,producersOf,civAvailable,grantsOf} from './civ.ts';
import type {Owner} from './civ.ts';
import {neutralCiv} from '../content/civs.ts';
// Training and research queues (design_default). Cost and population are reserved when an item is queued,
// committed when it finishes, refunded in full when it is cancelled. Only the first item advances.
export const productionRules={provenance:'design_default',queueLimit:5} as const;
export type ProductionState=MovementState&BuildingState&{nextUnitId:number;nextQueueId:number;techs:string[][];civs?:string[]};
const names:Record<string,string>={food:'食物',wood:'木材',gold:'黃金',stone:'石頭'};
export function ageOf(entryId:string){const m=/^age-(\d)$/.exec(entryId);return m?Number(m[1]):0;}
const entryOf=(id:string)=>rules.entries.find(e=>e.id===id);
// Pure check shared by the Worker (authoritative) and the page (button reasons), from plain data only.
// civ: the player's civilization (the neutral one when absent).
// allTechs: the match's 所有科技 setting.
export type TrainInput={allTechs?:boolean;player:number;civ?:string;age:number;techs:readonly string[];building:{kind:string;complete:boolean;queue:{entryId:string}[]};ownBuildings:{kind:string;complete:boolean;queue:{entryId:string}[]}[];stock:Record<string,number>;populationUsed:number;populationReserved:number;populationCap:number};
export function trainBlocker(i:TrainInput,entryId:string):string|null{
 const e=entryOf(entryId),owner:Owner={civ:i.civ??neutralCiv,age:i.age,techs:i.techs,...(i.allTechs?{allTechs:true}:{})};
 if(!e||e.kind==='building')return '未知的生產項目';
 if(!civAvailable(owner.civ,entryId,!!i.allTechs))return '此文明不能生產';
 if(!i.building.complete)return '建築尚未完工';
 if(!producersOf(entryId,owner).includes(i.building.kind))return '這棟建築不能生產這個項目';
 for(const req of e.requires){
  const need=entryOf(req);
  if(need?.kind==='building'&&!i.ownBuildings.some(v=>v.kind===req&&v.complete))return `需要完工的${need.name}`;
  if(need?.kind==='technology'&&ageOf(req)&&i.age<ageOf(req))return `需要${need.name}`;
  // A technology that follows another (Bow Saw after Double-Bit Axe) needs it researched first.
  if(need?.kind==='technology'&&!ageOf(req)&&!i.techs.includes(req))return `需要先研究「${need.name}」`;
 }
 const age=ageOf(entryId);
 if(age||e.kind==='technology'){if(age?i.age>=age:i.techs.includes(entryId))return '已研究';if(i.ownBuildings.some(v=>v.queue.some(q=>q.entryId===entryId)))return '已在研究中';}
 if(i.building.queue.length>=productionRules.queueLimit)return `佇列已滿（${productionRules.queueLimit}）`;
 const cost=costOf(entryId,owner),short=resources.filter(r=>i.stock[r]<cost[r]);
 if(short.length)return short.map(r=>`${names[r]}不足：需要 ${cost[r]}，目前 ${i.stock[r]}`).join('；');
 if(i.populationUsed+i.populationReserved+e.population>i.populationCap)return `人口已滿（${i.populationUsed+i.populationReserved}/${i.populationCap}）：請蓋住宅`;
 return null;
}
export function trainable(s:ProductionState,player:number,b:Building,entryId:string):string|null{
 if(b.player!==player)return '不能操作敵方建築';
 const a=s.accounts[player];
 const o=ownerOf(s,player);return trainBlocker({...(o.allTechs?{allTechs:true}:{}),player,civ:o.civ,age:s.ages[player],techs:s.techs[player],building:b,ownBuildings:s.buildings.filter(v=>v.player===player),stock:a.stock,populationUsed:a.populationUsed,populationReserved:a.populationReserved,populationCap:a.populationCap},entryId);
}
export function enqueue(s:ProductionState,player:number,buildingId:string,entryId:string,reservationId:string){
 const b=s.buildings.find(v=>v.id===buildingId);if(!b)throw Error('找不到這棟建築');
 const problem=trainable(s,player,b,entryId);if(problem)throw Error(problem);
 const owner=ownerOf(s,player);reserve(s.accounts[player],reservationId,entryId,costOf(entryId,owner));
 b.queue.push({id:s.nextQueueId++,entryId,reservationId,work:0,required:timeTicks(entryId,owner,b.kind)});
}
export function dequeue(s:ProductionState,player:number,buildingId:string,itemId:number){
 const b=s.buildings.find(v=>v.id===buildingId);if(!b||b.player!==player)throw Error('找不到這棟己方建築');
 const item=b.queue.find(q=>q.id===itemId);if(!item)throw Error('佇列項目已完成或不存在');
 cancelReservation(s.accounts[player],item.reservationId);b.queue=b.queue.filter(q=>q!==item);
}
// Free nodes on the ring just outside the footprint, nearest to the rally point (or the front) first. A ship leaves
// onto the water ring (the dock's water side), anything else onto land.
function exitNode(s:ProductionState,b:Building,layer:Layer='land'):number{
 const o=s.map.obstacles.find(o=>o.id===b.id)!,box=obstacleBounds(o,navigationRules.radius);
 const held=new Set(s.units.flatMap(u=>u.next===null?[u.node]:[u.node,u.next]));
 const aim=b.rally??{x:(box[0]+box[2])/2,y:box[3]+50};
 let best=-1,dist=Infinity;
 const closed=blockedFor(s.map,layer);for(const n of nodesNear(s.map,box,50)){if(closed[n]||held.has(n))continue;const p=position(s.map,n),g=Math.max(box[0]-p.x,0,p.x-box[2])+Math.max(box[1]-p.y,0,p.y-box[3]);if(g<=0||g>50)continue;
  const d=Math.abs(p.x-aim.x)+Math.abs(p.y-aim.y);if(d<dist){dist=d;best=n;}}
 return best;
}
// Every unit entry id is its unit kind.
const unitKindOf=(entryId:string)=>{if(!(unitKinds as readonly string[]).includes(entryId))throw Error(`沒有這種單位：${entryId}`);return entryId as UnitKind;};
// After research or an age changes what a player's units and buildings are worth: units in the field (and inside
// buildings) keep their damage and gain or lose the difference in maximum health; buildings keep their share of health.
export function refreshOwner(s:ProductionState,player:number,before:Owner){
 const after=ownerOf(s,player),inside=Object.values((s as {garrison?:Record<string,{units:{unit:{kind:string;player:number;hp:number}}[]}>}).garrison??{}).flatMap(g=>g.units.map(e=>e.unit));
 for(const u of [...s.units,...inside])if(u.player===player&&u.kind in combatRules.units){const k=u.kind as keyof typeof combatRules.units;u.hp+=maxHpOf(k,after)-maxHpOf(k,before);}
 for(const b of s.buildings)if(b.player===player){const max=buildingHpOf(b.kind,after);if(max!==b.maxHp&&b.maxHp>0){b.hp=Math.max(1,Math.round(b.hp*max/b.maxHp));b.maxHp=max;}}
 // Housing and the population ceiling can change with the age too (Goths +10 in the fourth age).
 recomputeCapacity(s,player);
}
// Technologies a civilization receives for free once their age is reached (Vikings).
export function grantTechs(s:ProductionState,player:number){for(const id of grantsOf(ownerOf(s,player)))s.techs[player].push(id);}
export function stepProduction(s:ProductionState){
 for(const b of [...s.buildings].sort((a,b)=>a.id<b.id?-1:1)){
  const item=b.queue[0];if(!item)continue;
  if(item.work<item.required){item.work++;if(item.work<item.required)continue;}
  const age=ageOf(item.entryId);
  if(age){commitReservation(s.accounts[b.player],item.reservationId);b.queue.shift();const before={...ownerOf(s,b.player),techs:[...s.techs[b.player]]};s.ages[b.player]=age;
   // Age tiers of the civilization and its free technologies take effect now.
   grantTechs(s,b.player);refreshOwner(s,b.player,before);
   // Every building of that player now renders in the new age (appearance only).
   const own=new Set(s.buildings.filter(v=>v.player===b.player).map(v=>v.id));for(const o of s.map.obstacles)if(o.id&&own.has(o.id))o.age=age;continue;}
  // Other technologies are recorded for the player; their effects read s.techs (religion.ts), Sanctity also
  // raises the hit points of monks already in the field.
  // Units already in the field gain whatever health the research adds (Sanctity for monks, Loom for villagers).
  if(entryOf(item.entryId)?.kind==='technology'){commitReservation(s.accounts[b.player],item.reservationId);b.queue.shift();const before={...ownerOf(s,b.player),techs:[...s.techs[b.player]]};s.techs[b.player].push(item.entryId);
   refreshOwner(s,b.player,before);continue;}
  // A rally point on the building itself (the 遊戲元素 round, defense.ts rallyGarrison): the new unit goes straight
  // inside while there is room and the building is not badly damaged; otherwise it comes out as usual.
  const g=(s as {garrison?:Record<string,{box:number[];units:{unit:Unit;work:null;bell:boolean}[]}>}).garrison;
  if(b.rally?.inside&&g&&!battered(b)&&(g[b.id]?.units.length??0)<garrisonCapacity(s,b)){
   commitReservation(s.accounts[b.player],item.reservationId);b.queue.shift();const box=obstacleBounds(s.map.obstacles.find(o=>o.id===b.id)!);
   const u=makeUnit(s.map,s.nextUnitId++,b.player,Math.round((box[0]+box[2])/100)*50,Math.round((box[1]+box[3])/100)*50,unitKindOf(item.entryId));u.hp=maxHpOf(u.kind as keyof typeof combatRules.units,ownerOf(s,b.player));
   (g[b.id]??={box,units:[]}).units.push({unit:u,work:null,bell:false});continue;}
  // A blocked exit keeps the finished unit waiting at 100% until a ring node frees up.
  const layer=layerOf(unitKindOf(item.entryId)),node=exitNode(s,b,layer);if(node<0)continue;
  commitReservation(s.accounts[b.player],item.reservationId);b.queue.shift();
  const p=position(s.map,node),u=makeUnit(s.map,s.nextUnitId++,b.player,p.x,p.y,unitKindOf(item.entryId));u.hp=maxHpOf(u.kind as keyof typeof combatRules.units,ownerOf(s,b.player));s.units.push(u);
  // A rally point later covered by a building (or otherwise unstandable) is skipped, never an error.
  // A ship heads for the water nearest the rally point instead.
  if(b.rally&&!b.rally.inside&&nearest(s.map,b.rally,false,layer)>=0)commandMove(s,[u.id],b.rally);
 }
}
