// Engineering defaults, not values from the reference game.
import {createTiles,tileAt,canTraverse,terrainRules,extractResource} from './terrain.ts';
import type {Tile,ResourceNode} from './terrain.ts';
export const navigationRules={provenance:'design_default',spacing:50,size:31,radius:25,expansionsPerTick:32,speedPerTick:5} as const;
export type Point={x:number;y:number};
export type Obstacle={id?:string;kind:'house'|'tree'|'rock';x:number;y:number;red?:boolean};
export type MapData={obstacles:Obstacle[];blocked:number[];tiles:Tile[];resources:ResourceNode[];navigationRevision:number;generationAttempt:number};
export type PathJob={unitId:number;start:number;goal:number;target:Point;frontier:number[];head:number;parents:number[];status:'searching'|'found'|'unreachable';path:Point[]};
export function makeMap(seed:number):MapData{
 if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw Error('地圖 seed 必須為 uint32');
 let lastErrors:string[]=[];
 for(let attempt=0;attempt<terrainRules.generationAttempts;attempt++){
 const map=generateCandidate((seed+Math.imul(attempt,2654435761))>>>0);map.generationAttempt=attempt;
 lastErrors=validateMap(map);if(!lastErrors.length)return map;
 }
 throw Error(`地圖生成失敗（${terrainRules.generationAttempts} 次）：${lastErrors.join('；')}`);
}
function generateCandidate(seed:number):MapData{
 let rng=seed||1;const obstacles:Obstacle[]=[{kind:'house',x:300,y:400},{kind:'house',x:1100,y:400,red:true}];
 for(let x=0;x<16;x++)for(let y=0;y<16;y++){rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;const v=(rng>>>0)/4294967296;
 if((x<2||y<2||x>13||y>13)&&v<.34)obstacles.push({kind:'tree',x:x*100+12,y:y*100+12});
 else if(v<.028&&Math.abs(x-8)<3)obstacles.push({kind:'rock',x:x*100,y:y*100});}
 const map:MapData={obstacles,blocked:[],tiles:createTiles(),resources:[],navigationRevision:0,generationAttempt:0};
 obstacles.forEach((o,index)=>{o.id=`obstacle-${index}`;map.tiles[tileAt(o.x,o.y)].obstacleRefs.push(o.id);
 if(o.kind!=='house'){const kind=o.kind==='tree'?'tree':'stone';const id=`resource-${index}`,capacity=terrainRules.resourceCapacity[kind];map.resources.push({id,kind,x:o.x,y:o.y,capacity,remaining:capacity,collectible:true,status:'available',obstacleId:o.id,depletedAt:null});map.tiles[tileAt(o.x,o.y)].resourceRefs.push(id);}});
 for(let i=0;i<961;i++)if(!clearSegment(map,position(i),position(i)))map.blocked.push(i);return map;
}
function bounds(o:Obstacle):[number,number,number,number]{const r=navigationRules.radius;return o.kind==='house'?[o.x-15-r,o.y-15-r,o.x+235+r,o.y+215+r]:o.kind==='tree'?[o.x-20-r,o.y-20-r,o.x+80+r,o.y+80+r]:[o.x-r,o.y-r,o.x+65+r,o.y+70+r];}
// Slab intersection includes contact: center-lines cannot clip expanded footprints.
export function clearSegment(map:MapData,a:Point,b:Point):boolean{
 if([a.x,a.y,b.x,b.y].some(v=>!Number.isSafeInteger(v)||v<50||v>1550))return false;
 // Closed cell footprints include unit radius; material color never controls passage.
 for(const tile of map.tiles)if(!canTraverse(tile,'land')){
 const x=(tile.id%16)*100,y=Math.floor(tile.id/16)*100,r=navigationRules.radius;
 if(intersects(a,b,[x-r,y-r,x+100+r,y+100+r]))return false;
 }
 for(const o of map.obstacles){const [x0,y0,x1,y1]=bounds(o);let lo=0,hi=1;
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
 resource.obstacleId=null;
 for(let id=0;id<961;id++){const p=position(id);if(p.x<area[0]||p.x>area[2]||p.y<area[1]||p.y>area[3])continue;
 const blocked=!clearSegment(map,p,p),wasBlocked=map.blocked.includes(id);if(blocked!==wasBlocked){changedNodes.push(id);if(blocked)map.blocked.push(id);else map.blocked=map.blocked.filter(n=>n!==id);}}
 map.blocked.sort((a,b)=>a-b);map.navigationRevision++;
 }
 return {amount:harvested,changedNodes};
}
export function validateMap(map:MapData):string[]{
 const errors:string[]=[];
 if(map.tiles.length!==256||map.tiles.some((t,i)=>t.id!==i))return ['地格數量或 ID 不符'];
 const obstacles=new Set(map.obstacles.map(o=>o.id)),resources=new Set(map.resources.map(r=>r.id));
 if(obstacles.size!==map.obstacles.length||obstacles.has(undefined))errors.push('障礙 ID 重複或缺少');
 if(resources.size!==map.resources.length)errors.push('資源 ID 重複');
 for(const tile of map.tiles){if(!Number.isSafeInteger(tile.height)||tile.height<0)errors.push(`地格 ${tile.id} 高度無效`);if(!['land','water','both','blocked'].includes(tile.walkClass)||typeof tile.buildability!=='boolean')errors.push(`地格 ${tile.id} 通行或建造規則無效`);if(tile.resourceRefs.some(id=>!resources.has(id))||tile.obstacleRefs.some(id=>!obstacles.has(id)))errors.push(`地格 ${tile.id} 參照失效`);}
 for(const r of map.resources){if(!Number.isSafeInteger(r.capacity)||r.capacity<=0||!Number.isSafeInteger(r.remaining)||r.remaining<0||r.remaining>r.capacity)errors.push(`資源 ${r.id} 容量無效`);
 if((r.status==='depleted')!==(r.remaining===0)||r.collectible!==(r.remaining>0)||r.status==='depleted'&&(r.obstacleId!==null||r.depletedAt===null))errors.push(`資源 ${r.id} 狀態不一致`);
 if(r.obstacleId&&!obstacles.has(r.obstacleId))errors.push(`資源 ${r.id} 障礙參照失效`);
 if(!map.tiles[tileAt(r.x,r.y)]?.resourceRefs.includes(r.id))errors.push(`資源 ${r.id} 地格參照失效`);}
 const spawns=[{x:350,y:700},{x:450,y:700},{x:400,y:800},{x:1150,y:700}];
 if(spawns.some(p=>!clearSegment(map,p,p)))errors.push('出生點不可通行');
 else {const job=createPathJob(map,0,spawns[0],spawns[3]);advancePathJob(map,job,961);if(job.status!=='found')errors.push('玩家出生區互不連通');}
 return errors;
}
export function position(id:number):Point{return {x:50+(id%31)*50,y:50+Math.floor(id/31)*50};}
function connector(map:MapData,a:Point,b:Point){const elbow={x:b.x,y:a.y};return clearSegment(map,a,elbow)&&clearSegment(map,elbow,b);}
function nearest(map:MapData,p:Point,outbound=true):number{
 let best=-1,distance=Infinity;for(let i=0;i<961;i++){const q=position(i),d=Math.abs(p.x-q.x)+Math.abs(p.y-q.y);if(d<distance&&!map.blocked.includes(i)&&(outbound?connector(map,p,q):connector(map,q,p))){best=i;distance=d;}}return best;
}
export function createPathJob(map:MapData,unitId:number,from:Point,target:Point):PathJob{
 const start=nearest(map,from),goal=nearest(map,target,false),parents=Array(961).fill(-2);if(start>=0)parents[start]=-1;
 return {unitId,start,goal,target:{...target},frontier:start<0?[]:[start],head:0,parents,status:start<0||goal<0?'unreachable':'searching',path:[]};
}
export function advancePathJob(map:MapData,job:PathJob,budget:number):number{
 if(!Number.isSafeInteger(budget)||budget<0)throw Error('無效尋路預算');let used=0;
 while(job.status==='searching'&&used<budget){
 if(job.head===job.frontier.length){job.status='unreachable';break;}
 const id=job.frontier[job.head++];used++;
 if(id===job.goal){const path:Point[]=[];let cursor=id;while(cursor!==-1){path.push(position(cursor));cursor=job.parents[cursor];}job.path=path.reverse();if(job.path.at(-1)!.x!==job.target.x||job.path.at(-1)!.y!==job.target.y)job.path.push({...job.target});job.status='found';break;}
 const x=id%31,y=Math.floor(id/31);for(const next of [x<30?id+1:-1,y<30?id+31:-1,x>0?id-1:-1,y>0?id-31:-1])if(next>=0&&job.parents[next]===-2&&!map.blocked.includes(next)&&clearSegment(map,position(id),position(next))){job.parents[next]=id;job.frontier.push(next);}
 }return used;
}
