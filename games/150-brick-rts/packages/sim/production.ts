import {obstacleBounds} from '../content/footprints.ts';
import {rules,resources} from '../content/rules.ts';
import {reserve,cancelReservation,commitReservation} from './economy.ts';
import {position,navigationRules,nearest,blockedTable,nodesNear} from './navigation.ts';
import {makeUnit,commandMove} from './movement.ts';
import type {UnitKind,MovementState} from './movement.ts';
import type {Building,BuildingState} from './buildings.ts';
// Training and research queues (design_default). Cost and population are reserved when an item is queued,
// committed when it finishes, refunded in full when it is cancelled. Only the first item advances.
export const productionRules={provenance:'design_default',queueLimit:5} as const;
export type ProductionState=MovementState&BuildingState&{nextUnitId:number;nextQueueId:number};
const names:Record<string,string>={food:'食物',wood:'木材',gold:'黃金',stone:'石頭'};
export function ageOf(entryId:string){const m=/^age-(\d)$/.exec(entryId);return m?Number(m[1]):0;}
const entryOf=(id:string)=>rules.entries.find(e=>e.id===id);
// Pure check shared by the Worker (authoritative) and the page (button reasons), from plain data only.
export type TrainInput={player:number;age:number;building:{kind:string;complete:boolean;queue:{entryId:string}[]};ownBuildings:{kind:string;complete:boolean;queue:{entryId:string}[]}[];stock:Record<string,number>;populationUsed:number;populationReserved:number;populationCap:number};
export function trainBlocker(i:TrainInput,entryId:string):string|null{
 const e=entryOf(entryId),civ=rules.civilizations[i.player];
 if(!e||e.kind==='building')return '未知的生產項目';
 if(!civ.available.includes(entryId))return '此文明不能生產';
 if(!i.building.complete)return '建築尚未完工';
 if(rules.production[entryId]!==i.building.kind)return '這棟建築不能生產這個項目';
 for(const req of e.requires){
  const need=entryOf(req);
  if(need?.kind==='building'&&!i.ownBuildings.some(v=>v.kind===req&&v.complete))return `需要完工的${need.name}`;
  if(need?.kind==='technology'&&i.age<ageOf(req))return `需要${need.name}`;
 }
 const age=ageOf(entryId);
 if(age){if(i.age>=age)return '已研究';if(i.ownBuildings.some(v=>v.queue.some(q=>q.entryId===entryId)))return '已在研究中';}
 if(i.building.queue.length>=productionRules.queueLimit)return `佇列已滿（${productionRules.queueLimit}）`;
 const short=resources.filter(r=>i.stock[r]<e.cost[r]);
 if(short.length)return short.map(r=>`${names[r]}不足：需要 ${e.cost[r]}，目前 ${i.stock[r]}`).join('；');
 if(i.populationUsed+i.populationReserved+e.population>i.populationCap)return `人口已滿（${i.populationUsed+i.populationReserved}/${i.populationCap}）：請蓋住宅`;
 return null;
}
export function trainable(s:ProductionState,player:number,b:Building,entryId:string):string|null{
 if(b.player!==player)return '不能操作敵方建築';
 const a=s.accounts[player];
 return trainBlocker({player,age:s.ages[player],building:b,ownBuildings:s.buildings.filter(v=>v.player===player),stock:a.stock,populationUsed:a.populationUsed,populationReserved:a.populationReserved,populationCap:a.populationCap},entryId);
}
export function enqueue(s:ProductionState,player:number,buildingId:string,entryId:string,reservationId:string){
 const b=s.buildings.find(v=>v.id===buildingId);if(!b)throw Error('找不到這棟建築');
 const problem=trainable(s,player,b,entryId);if(problem)throw Error(problem);
 reserve(s.accounts[player],reservationId,entryId);
 b.queue.push({id:s.nextQueueId++,entryId,reservationId,work:0,required:entryOf(entryId)!.time*rules.settings.tickHz});
}
export function dequeue(s:ProductionState,player:number,buildingId:string,itemId:number){
 const b=s.buildings.find(v=>v.id===buildingId);if(!b||b.player!==player)throw Error('找不到這棟己方建築');
 const item=b.queue.find(q=>q.id===itemId);if(!item)throw Error('佇列項目已完成或不存在');
 cancelReservation(s.accounts[player],item.reservationId);b.queue=b.queue.filter(q=>q!==item);
}
// Free nodes on the ring just outside the footprint, nearest to the rally point (or the front) first.
function exitNode(s:ProductionState,b:Building):number{
 const o=s.map.obstacles.find(o=>o.id===b.id)!,box=obstacleBounds(o,navigationRules.radius);
 const held=new Set(s.units.flatMap(u=>u.next===null?[u.node]:[u.node,u.next]));
 const aim=b.rally??{x:(box[0]+box[2])/2,y:box[3]+50};
 let best=-1,dist=Infinity;
 const closed=blockedTable(s.map);for(const n of nodesNear(s.map,box,50)){if(closed[n]||held.has(n))continue;const p=position(s.map,n),g=Math.max(box[0]-p.x,0,p.x-box[2])+Math.max(box[1]-p.y,0,p.y-box[3]);if(g<=0||g>50)continue;
  const d=Math.abs(p.x-aim.x)+Math.abs(p.y-aim.y);if(d<dist){dist=d;best=n;}}
 return best;
}
const unitKindOf:Record<string,UnitKind>={villager:'villager',militia:'militia',archer:'archer',scout:'scout',monk:'monk'};
export function stepProduction(s:ProductionState){
 for(const b of [...s.buildings].sort((a,b)=>a.id<b.id?-1:1)){
  const item=b.queue[0];if(!item)continue;
  if(item.work<item.required){item.work++;if(item.work<item.required)continue;}
  const age=ageOf(item.entryId);
  if(age){commitReservation(s.accounts[b.player],item.reservationId);b.queue.shift();s.ages[b.player]=age;
   // Every building of that player now renders in the new age (appearance only).
   const own=new Set(s.buildings.filter(v=>v.player===b.player).map(v=>v.id));for(const o of s.map.obstacles)if(o.id&&own.has(o.id))o.age=age;continue;}
  // A blocked exit keeps the finished unit waiting at 100% until a ring node frees up.
  const node=exitNode(s,b);if(node<0)continue;
  commitReservation(s.accounts[b.player],item.reservationId);b.queue.shift();
  const p=position(s.map,node),u=makeUnit(s.map,s.nextUnitId++,b.player,p.x,p.y,unitKindOf[item.entryId]);s.units.push(u);
  // A rally point later covered by a building (or otherwise unstandable) is skipped, never an error.
  if(b.rally&&nearest(s.map,b.rally,false)>=0)commandMove(s,[u.id],b.rally);
 }
}
