import {obstacleBounds,obstacleRects} from '../content/footprints.ts';
import type {ObstacleKind} from '../content/footprints.ts';
// Engineering defaults, not values from the reference game.
import {createTiles,tileAt,canTraverse,terrainRules,extractResource,resourceDefinitions} from './terrain.ts';
import type {Tile,ResourceNode,MapLayout,ResourceKind} from './terrain.ts';
// expansionsPerTick 128: chosen from test-results/movement-benchmark-{32,64,128,256}.json (fastest 24/40-unit
// gate settle; 32 left 40 units waiting on search for ~40 s). Node count, never wall time, decides results.
// waitLimit: ticks behind a stationary blocker between replans (x queueWaitFactor behind a unit that is
// still travelling); detourLimit: replans per order. stuckTicks: ticks without advancing a node before a
// unit reports 'stuck'. arrivalRadius: a unit this close to its station (Manhattan) stops when a settled
// group-mate blocks it.
export const navigationRules={provenance:'design_default',spacing:50,size:31,radius:25,expansionsPerTick:128,speedPerTick:5,maxGroupSize:40,waitLimit:8,queueWaitFactor:4,detourLimit:12,stuckTicks:300,arrivalRadius:150} as const;
export const startingResourceRules={provenance:'design_default',maxApproachDistance:1200,maxNearestDistanceDifference:500,minimum:{tree:300,stone:250,gold:250,berries:150}} as const;
export type Point={x:number;y:number};
// progress: construction stage in percent (0,20,..,100) for player buildings; absent means complete.
// age: owner's age (1-4) for player buildings, drives the rendered age variant only.
export type Obstacle={id?:string;kind:ObstacleKind;x:number;y:number;red?:boolean;progress?:number;age?:number;damaged?:boolean};
export type MapData={obstacles:Obstacle[];blocked:number[];tiles:Tile[];resources:ResourceNode[];navigationRevision:number;generationAttempt:number};
export type PathJob={movement?:'land'|'water';unitId:number;start:number;goal:number;target:Point;frontier:number[];head:number;parents:number[];status:'searching'|'found'|'unreachable';path:Point[]};
export function makeMap(seed:number,layout:MapLayout='meadow'):MapData{
 if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw Error('地圖 seed 必須為 uint32');
 let lastErrors:string[]=[];
 for(let attempt=0;attempt<terrainRules.generationAttempts;attempt++){
 const map=generateCandidate((seed+Math.imul(attempt,2654435761))>>>0,layout);map.generationAttempt=attempt;
 lastErrors=validateMap(map);if(!lastErrors.length)lastErrors=validateStartingResources(map).errors;if(!lastErrors.length)return map;
 }
 throw Error(`地圖生成失敗（${terrainRules.generationAttempts} 次）：${lastErrors.join('；')}`);
}
function generateCandidate(seed:number,layout:MapLayout):MapData{
 let rng=seed||1;// Starting town centers: gate centers sit on grid columns 400/1200 and face the spawn row, 65 units clear.
 let obstacles:Obstacle[]=[{kind:'town-center',x:265,y:350},{kind:'town-center',x:1065,y:350,red:true}];
 // Border woods are drawn for the west half and mirrored to the east, so both bases get the same room.
 const woods:Obstacle[]=[];
 for(let x=0;x<16;x++)for(let y=0;y<16;y++){rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;const v=(rng>>>0)/4294967296;
 if((x<2||y<2||x>13||y>13)&&v<.34){if(x<8)woods.push({kind:'tree',x:x*100+12,y:y*100+12},{kind:'tree',x:(15-x)*100+12,y:y*100+12});}
 else if(v<.028&&Math.abs(x-8)<3&&y>3)obstacles.push({kind:'rock',x:x*100,y:y*100});}
 obstacles.push(...woods);
 if(layout==='coast')obstacles=obstacles.filter(o=>o.y<1000);
 if(layout==='acceptance')obstacles=[...obstacles.slice(0,2),{kind:'tree',x:150,y:250},{kind:'tree',x:1350,y:250},{kind:'rock',x:500,y:1100},{kind:'rock',x:1050,y:1100}];
 const guaranteed:Obstacle[]=[{kind:'tree',x:150,y:850},{kind:'tree',x:1350,y:850},{kind:'rock',x:150,y:1100},{kind:'rock',x:1350,y:1100}];
 obstacles=obstacles.filter(o=>isBuilding(o)||!guaranteed.some(g=>Math.abs(g.x-o.x)<140&&Math.abs(g.y-o.y)<140));obstacles.push(...guaranteed);
 obstacles.push({kind:'gold',x:550,y:200},{kind:'gold',x:950,y:200},{kind:'berries',x:250,y:1000},{kind:'berries',x:1250,y:1000});
 const map:MapData={obstacles,blocked:[],tiles:createTiles(layout,seed),resources:[],navigationRevision:0,generationAttempt:0};
 obstacles.forEach((o,index)=>{o.id=`obstacle-${index}`;map.tiles[tileAt(o.x,o.y)].obstacleRefs.push(o.id);
 if(!isBuilding(o)){const kind=(o.kind==='rock'?'stone':o.kind) as ResourceKind;const id=`resource-${index}`,capacity=terrainRules.resourceCapacity[kind];map.resources.push({id,kind,x:o.x,y:o.y,capacity,remaining:capacity,collectible:true,status:'available',obstacleId:o.id,depletedAt:null});map.tiles[tileAt(o.x,o.y)].resourceRefs.push(id);}});
 const addResource=(kind:'hunt'|'livestock'|'fish',x:number,y:number)=>{const id=`resource-${kind}-${x}-${y}`,capacity=terrainRules.resourceCapacity[kind],obstacleId=kind==='fish'?null:`obstacle-${kind}-${x}-${y}`;if(obstacleId&&kind!=='fish'){map.obstacles.push({id:obstacleId,kind,x,y});map.tiles[tileAt(x,y)].obstacleRefs.push(obstacleId);}map.resources.push({id,kind,x,y,capacity,remaining:capacity,collectible:true,status:'available',obstacleId,depletedAt:null});map.tiles[tileAt(x,y)].resourceRefs.push(id);};
 for(const x of [300,1200])addResource('livestock',x,900);for(const x of [500,1000])addResource('hunt',x,1000);
 if(layout==='coast')for(const x of [300,1200])addResource('fish',x,1450);
 if(layout==='acceptance')for(const y of [300,1200])addResource('fish',800,y);
 for(let i=0;i<961;i++)if(!clearSegment(map,position(i),position(i)))map.blocked.push(i);return map;
}
export function isBuilding(o:Obstacle){return o.kind==='house'||o.kind==='town-center'||o.kind==='barracks'||o.kind==='farm';}
function bounds(o:Obstacle):[number,number,number,number]{return obstacleBounds(o,navigationRules.radius);}
// Slab intersection includes contact: center-lines cannot clip expanded footprints.
export function clearSegment(map:MapData,a:Point,b:Point,movement:'land'|'water'='land'):boolean{
 if([a.x,a.y,b.x,b.y].some(v=>!Number.isSafeInteger(v)||v<50||v>1550))return false;
 // Expanded height discontinuities prevent both cliff crossings and body overhang.
 const maxStep=movement==='land'?terrainRules.maxLandStep:0,radius=navigationRules.radius;
 for(const tile of map.tiles){const x=tile.id%16,y=Math.floor(tile.id/16);
 if(x<15&&Math.abs(tile.height-map.tiles[tile.id+1].height)>maxStep&&intersects(a,b,[(x+1)*100-radius,y*100-radius,(x+1)*100+radius,(y+1)*100+radius]))return false;
 if(y<15&&Math.abs(tile.height-map.tiles[tile.id+16].height)>maxStep&&intersects(a,b,[x*100-radius,(y+1)*100-radius,(x+1)*100+radius,(y+1)*100+radius]))return false;
 }
 // Closed cell footprints include unit radius; material color never controls passage.
 for(const tile of map.tiles)if(!canTraverse(tile,movement)){
 const x=(tile.id%16)*100,y=Math.floor(tile.id/16)*100,r=navigationRules.radius;
 if(intersects(a,b,[x-r,y-r,x+100+r,y+100+r]))return false;
 }
 for(const o of map.obstacles)for(const [x0,y0,x1,y1] of obstacleRects(o,navigationRules.radius)){let lo=0,hi=1;
 for(const [start,delta,min,max] of [[a.x,b.x-a.x,x0,x1],[a.y,b.y-a.y,y0,y1]]){
 if(delta===0){if(start<min||start>max){lo=2;break;}}else{const t0=(min-start)/delta,t1=(max-start)/delta;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));}}
 if(lo<=hi)return false;
 }return true;
}
function intersects(a:Point,b:Point,box:[number,number,number,number]):boolean{
 let lo=0,hi=1;for(const [start,delta,min,max] of [[a.x,b.x-a.x,box[0],box[2]],[a.y,b.y-a.y,box[1],box[3]]]){
 if(delta===0){if(start<min||start>max)return false;}else{const p=(min-start)/delta,q=(max-start)/delta;lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));}}
 return lo<=hi;
}
export function harvestMapResource(map:MapData,id:string,amount:number,tick:number):{amount:number;changedNodes:number[]}{
 const resource=map.resources.find(r=>r.id===id);if(!resource)throw Error('未知資源節點');
 if(resource.obstacleId&&!map.obstacles.some(o=>o.id===resource.obstacleId))throw Error('資源障礙參照失效');
 const harvested=extractResource(resource,amount,tick),changedNodes:number[]=[];
 if(resource.status==='depleted'&&resource.obstacleId){
 const obstacle=map.obstacles.find(o=>o.id===resource.obstacleId);if(!obstacle)throw Error('資源障礙參照失效');
 const area=bounds(obstacle);map.obstacles=map.obstacles.filter(o=>o!==obstacle);
 for(const tile of map.tiles)tile.obstacleRefs=tile.obstacleRefs.filter(ref=>ref!==resource.obstacleId);
 resource.obstacleId=null;changedNodes.push(...refreshNavigation(map,area));
 }
 return {amount:harvested,changedNodes};
}
// Local navigation update after an obstacle is added or removed inside area (radius-expanded bounds).
export function refreshNavigation(map:MapData,area:[number,number,number,number]):number[]{
 const changed:number[]=[];
 for(let id=0;id<961;id++){const p=position(id);if(p.x<area[0]||p.x>area[2]||p.y<area[1]||p.y>area[3])continue;
 const blocked=!clearSegment(map,p,p),wasBlocked=map.blocked.includes(id);if(blocked!==wasBlocked){changed.push(id);if(blocked)map.blocked.push(id);else map.blocked=map.blocked.filter(n=>n!==id);}}
 map.blocked.sort((a,b)=>a-b);map.navigationRevision++;return changed;
}
export function validateMap(map:MapData):string[]{
 const errors:string[]=[];
 if(map.tiles.length!==256||map.tiles.some((t,i)=>t.id!==i))return ['地格數量或 ID 不符'];
 const obstacles=new Set(map.obstacles.map(o=>o.id)),resources=new Set(map.resources.map(r=>r.id));
 if(obstacles.size!==map.obstacles.length||obstacles.has(undefined))errors.push('障礙 ID 重複或缺少');
 if(resources.size!==map.resources.length)errors.push('資源 ID 重複');
 for(const tile of map.tiles){if(!Number.isSafeInteger(tile.height)||tile.height<0)errors.push(`地格 ${tile.id} 高度無效`);if(!['land','water','both','blocked'].includes(tile.walkClass)||typeof tile.buildability!=='boolean')errors.push(`地格 ${tile.id} 通行或建造規則無效`);if(tile.resourceRefs.some(id=>!resources.has(id))||tile.obstacleRefs.some(id=>!obstacles.has(id)))errors.push(`地格 ${tile.id} 參照失效`);}
 for(const r of map.resources){if(!resourceDefinitions[r.kind]){errors.push(`資源 ${r.id} 類別無效`);continue;}
 const cell=map.tiles[tileAt(r.x,r.y)];if(!cell||!canTraverse(cell,resourceDefinitions[r.kind].movement))errors.push(`資源 ${r.id} 地形不符`);
 if(!Number.isSafeInteger(r.capacity)||r.capacity<=0||!Number.isSafeInteger(r.remaining)||r.remaining<0||r.remaining>r.capacity)errors.push(`資源 ${r.id} 容量無效`);
 if((r.status==='depleted')!==(r.remaining===0)||r.collectible!==(r.remaining>0)||r.status==='depleted'&&(r.obstacleId!==null||r.depletedAt===null))errors.push(`資源 ${r.id} 狀態不一致`);
 if(r.obstacleId&&!obstacles.has(r.obstacleId))errors.push(`資源 ${r.id} 障礙參照失效`);
 if(!map.tiles[tileAt(r.x,r.y)]?.resourceRefs.includes(r.id))errors.push(`資源 ${r.id} 地格參照失效`);}
 const spawns=[{x:350,y:700},{x:450,y:700},{x:400,y:800},{x:1150,y:700}];
 if(spawns.some(p=>!clearSegment(map,p,p)))errors.push('出生點不可通行');
 else {const job=createPathJob(map,0,spawns[0],spawns[3]);advancePathJob(map,job,961);if(job.status!=='found')errors.push('玩家出生區互不連通');}
 return errors;
}
export function position(id:number):Point{return {x:50+(id%31)*50,y:50+Math.floor(id/31)*50};}
// Generation-only gate: runtime maps may legitimately exhaust their starting stock.
export function validateStartingResources(map:MapData){
 const errors:string[]=[];
 const players=[{x:350,y:700},{x:1150,y:700}].map((spawn,player)=>{
 const distances=Array<number>(961).fill(Infinity),start=nearest(map,spawn),frontier:number[]=[];
 if(start>=0){distances[start]=Math.abs(position(start).x-spawn.x)+Math.abs(position(start).y-spawn.y);frontier.push(start);}
 for(let head=0;head<frontier.length;head++){const id=frontier[head],x=id%31,y=Math.floor(id/31);for(const next of [x<30?id+1:-1,y<30?id+31:-1,x>0?id-1:-1,y>0?id-31:-1])if(next>=0&&!Number.isFinite(distances[next])&&!map.blocked.includes(next)&&clearSegment(map,position(id),position(next))){distances[next]=distances[id]+50;frontier.push(next);}}
 const access=Object.entries(startingResourceRules.minimum).map(([kind,minimum])=>{
 const nodes=map.resources.filter(r=>r.kind===kind&&r.collectible&&r.remaining>0).map(resource=>{
 const obstacle=map.obstacles.find(o=>o.id===resource.obstacleId);if(!obstacle)return {id:resource.id,remaining:resource.remaining,distance:Infinity,approach:null as Point|null};
 const [x0,y0,x1,y1]=bounds(obstacle);let distance=Infinity,approach:Point|null=null;
 for(let i=0;i<961;i++){if(!Number.isFinite(distances[i]))continue;const p=position(i),gap=Math.max(x0-p.x,0,p.x-x1)+Math.max(y0-p.y,0,p.y-y1);if(gap>0&&gap<=50&&distances[i]<distance){distance=distances[i];approach=p;}}
 return {id:resource.id,remaining:resource.remaining,distance,approach};
 }).filter(n=>n.distance<=startingResourceRules.maxApproachDistance);
 const available=nodes.reduce((sum,n)=>sum+n.remaining,0),nearestDistance=nodes.length?Math.min(...nodes.map(n=>n.distance)):null;
 if(available<minimum)errors.push(`玩家 ${player} 起始 ${kind} 可達容量不足：${available}/${minimum}`);
 return {kind,minimum,available,nearestDistance,nodes};
 });return {player,spawn,access};
 });
 for(let i=0;i<players[0].access.length;i++){const a=players[0].access[i],b=players[1].access[i];if(a.nearestDistance!==null&&b.nearestDistance!==null&&Math.abs(a.nearestDistance-b.nearestDistance)>startingResourceRules.maxNearestDistanceDifference)errors.push(`雙方 ${a.kind} 最近路程差超出限制`);}
 return {rules:startingResourceRules,errors,players};
}
function connector(map:MapData,a:Point,b:Point,movement:'land'|'water'){const elbow={x:b.x,y:a.y};return clearSegment(map,a,elbow,movement)&&clearSegment(map,elbow,b,movement);}
export function nearest(map:MapData,p:Point,outbound=true,movement:'land'|'water'='land'):number{
 let best=-1,distance=Infinity;for(let i=0;i<961;i++){const q=position(i),d=Math.abs(p.x-q.x)+Math.abs(p.y-q.y);if(d<distance&&!(movement==='land'?map.blocked.includes(i):!clearSegment(map,q,q,movement))&&(outbound?connector(map,p,q,movement):connector(map,q,p,movement))){best=i;distance=d;}}return best;
}
export function createPathJob(map:MapData,unitId:number,from:Point,target:Point,movement:'land'|'water'='land'):PathJob{
 const start=nearest(map,from,true,movement),goal=nearest(map,target,false,movement),parents=Array(961).fill(-2);if(start>=0)parents[start]=-1;
 return {...(movement==='water'?{movement}:{}),unitId,start,goal,target:{...target},frontier:start<0?[]:[start],head:0,parents,status:start<0||goal<0?'unreachable':'searching',path:[]};
}
export function advancePathJob(map:MapData,job:PathJob,budget:number):number{
 if(!Number.isSafeInteger(budget)||budget<0)throw Error('無效尋路預算');let used=0;
 while(job.status==='searching'&&used<budget){
 if(job.head===job.frontier.length){job.status='unreachable';break;}
 const id=job.frontier[job.head++];used++;
 if(id===job.goal){const path:Point[]=[];let cursor=id;while(cursor!==-1){path.push(position(cursor));cursor=job.parents[cursor];}job.path=path.reverse();if(job.path.at(-1)!.x!==job.target.x||job.path.at(-1)!.y!==job.target.y)job.path.push({...job.target});job.status='found';break;}
 const x=id%31,y=Math.floor(id/31);for(const next of [x<30?id+1:-1,y<30?id+31:-1,x>0?id-1:-1,y>0?id-31:-1])if(next>=0&&job.parents[next]===-2&&!(job.movement==='water'?!clearSegment(map,position(next),position(next),'water'):map.blocked.includes(next))&&clearSegment(map,position(id),position(next),job.movement??'land')){job.parents[next]=id;job.frontier.push(next);}
 }return used;
}
