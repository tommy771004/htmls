import {obstacleBounds,obstacleRects} from '../content/footprints.ts';
import type {ObstacleKind} from '../content/footprints.ts';
// Engineering defaults, not values from the reference game.
import {createTiles,tileAt,canTraverse,terrainRules,extractResource,resourceDefinitions,mapSizes,terrainDefinitions} from './terrain.ts';
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
// size: tiles per side (world units = size x 100); navigation nodes sit every 50 units, (2 x size - 1) per side.
// starts: each player's villager start points (first entry is the player's reference spawn).
// scouts: each player's scout start point (the match map only; the 16-tile test grounds have none).
export type MapData={size:number;starts:Point[][];scouts?:Point[];obstacles:Obstacle[];blocked:number[];tiles:Tile[];resources:ResourceNode[];navigationRevision:number;generationAttempt:number};
// Fast lookup of map.blocked (kept as a sorted list for saves and hashes); rebuilt when the list changes.
const tables=new WeakMap<MapData,{list:number[];length:number;revision:number;table:Uint8Array}>();
export function blockedTable(map:MapData):Uint8Array{let t=tables.get(map);
 if(!t||t.list!==map.blocked||t.length!==map.blocked.length||t.revision!==map.navigationRevision){const table=new Uint8Array(nodeTotal(map));for(const n of map.blocked)table[n]=1;t={list:map.blocked,length:map.blocked.length,revision:map.navigationRevision,table};tables.set(map,t);}
 return t.table;}
export const isBlocked=(map:MapData,n:number)=>blockedTable(map)[n]===1;
// Node ids whose position lies inside box expanded by pad, in ascending id order (the same order a full scan gives).
export function nodesNear(map:{size:number},box:readonly number[],pad:number):number[]{const side=sideOf(map),out:number[]=[];
 const x0=Math.max(0,Math.ceil((box[0]-pad-50)/50)),x1=Math.min(side-1,Math.floor((box[2]+pad-50)/50)),y0=Math.max(0,Math.ceil((box[1]-pad-50)/50)),y1=Math.min(side-1,Math.floor((box[3]+pad-50)/50));
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)out.push(y*side+x);return out;}
// Areas changed since the movement layer last rebuilt its edge table (derived data, never saved).
const dirtyAreas=new WeakMap<MapData,[number,number,number,number][]>();
export function takeDirtyAreas(map:MapData){const list=dirtyAreas.get(map)??[];dirtyAreas.delete(map);return list;}
// Shared search budget per tick, scaled with the node count so a search covers the same share of any map
// (961 nodes: exactly expansionsPerTick; the 3969-node match map: about four times as many).
export const searchBudget=(map:{size:number})=>Math.round(navigationRules.expansionsPerTick*nodeTotal(map)/961);
export const sideOf=(map:{size:number})=>map.size*2-1;
export const nodeTotal=(map:{size:number})=>sideOf(map)**2;
export const worldOf=(map:{size:number})=>map.size*100;
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
 if(layout==='open')return generateOpen(seed);
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
 const map:MapData={size:mapSizes[layout],starts:[[{x:350,y:700},{x:450,y:700},{x:400,y:800}],[{x:1150,y:700},{x:1250,y:700},{x:1200,y:800}]],obstacles,blocked:[],tiles:createTiles(layout,seed),resources:[],navigationRevision:0,generationAttempt:0};
 obstacles.forEach((o,index)=>{o.id=`obstacle-${index}`;map.tiles[tileAt(o.x,o.y,map.size)].obstacleRefs.push(o.id);
 if(!isBuilding(o)){const kind=(o.kind==='rock'?'stone':o.kind) as ResourceKind;const id=`resource-${index}`,capacity=terrainRules.resourceCapacity[kind];map.resources.push({id,kind,x:o.x,y:o.y,capacity,remaining:capacity,collectible:true,status:'available',obstacleId:o.id,depletedAt:null});map.tiles[tileAt(o.x,o.y,map.size)].resourceRefs.push(id);}});
 const addResource=(kind:'hunt'|'livestock'|'fish',x:number,y:number)=>{const id=`resource-${kind}-${x}-${y}`,capacity=terrainRules.resourceCapacity[kind],obstacleId=kind==='fish'?null:`obstacle-${kind}-${x}-${y}`;if(obstacleId&&kind!=='fish'){map.obstacles.push({id:obstacleId,kind,x,y});map.tiles[tileAt(x,y,map.size)].obstacleRefs.push(obstacleId);}map.resources.push({id,kind,x,y,capacity,remaining:capacity,collectible:true,status:'available',obstacleId,depletedAt:null});map.tiles[tileAt(x,y,map.size)].resourceRefs.push(id);};
 for(const x of [300,1200])addResource('livestock',x,900);for(const x of [500,1000])addResource('hunt',x,1000);
 if(layout==='coast')for(const x of [300,1200])addResource('fish',x,1450);
 if(layout==='acceptance')for(const y of [300,1200])addResource('fish',800,y);
 for(let i=0;i<nodeTotal(map);i++)if(!clearSegment(map,position(map,i),position(map,i)))map.blocked.push(i);return map;
}
// Open-land match map (design_default, loosely after the reference's random_placement idea; no reference numbers).
// Players sit on a circle round the centre at a seeded angle, the second roughly opposite. Every base gets the same
// resource kit, turned to face the player's own direction; woods line the border and grow in clumps away from bases.
export const openMapRules={provenance:'design_default',size:32,radius:[.29,.34],oppositeJitter:Math.PI/8,
 // Clear area around each town centre (the gate faces south, villagers start there): offsets from its centre.
 apron:{left:-320,top:-320,right:320,bottom:620},
 // Kit: offsets from the town centre, identical for every player (the gate always faces south), so each base
 // has the same distances. margin: room the whole kit needs round a town centre (left, top, right, bottom).
 kit:[{kind:'tree',dx:0,dy:-560,group:6},{kind:'gold',dx:520,dy:-60},{kind:'rock',dx:-520,dy:-60},{kind:'berries',dx:480,dy:360},{kind:'livestock',dx:-480,dy:340},{kind:'hunt',dx:0,dy:780}],
 margin:{left:-700,top:-760,right:700,bottom:900},
 forestClumps:10,clumpTrees:[6,13],clumpClearance:1050,borderWood:.45,borderClearance:750,neutral:{gold:2,rock:2},neutralRadius:650,dirtPatches:7} as const;
function generateOpen(seed:number):MapData{
 let rng=seed||1;const random=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return (rng>>>0)/4294967296;};
 const R=openMapRules,size=R.size,world=size*100,mid=world/2,tiles=createTiles('open',seed);
 // Dirt patches (walkable, buildable): small random blobs for texture only.
 for(let i=0;i<R.dirtPatches;i++){let tx=2+Math.floor(random()*(size-4)),ty=2+Math.floor(random()*(size-4));for(let k=0;k<4+Math.floor(random()*6);k++){const t=tiles[ty*size+tx];Object.assign(t,{terrainType:'sand',...terrainDefinitions.sand});tx=Math.min(size-2,Math.max(1,tx+Math.floor(random()*3)-1));ty=Math.min(size-2,Math.max(1,ty+Math.floor(random()*3)-1));}}
 // Town centres: gate centres on node columns (anchor x = 50k+15, y = 50k), apron kept inside the map.
 const a0=random()*Math.PI*2,angles=[a0,a0+Math.PI+(random()*2-1)*R.oppositeJitter],centres=angles.map(a=>{const r=world*(R.radius[0]+random()*(R.radius[1]-R.radius[0]));
  const cx=Math.min(world-R.margin.right,Math.max(-R.margin.left,mid+Math.cos(a)*r)),cy=Math.min(world-R.margin.bottom,Math.max(-R.margin.top,mid+Math.sin(a)*r));
  const ax=Math.round((cx-135-15)/50)*50+15,ay=Math.round((cy-135)/50)*50;return {ax,ay,x:ax+135,y:ay+135};});
 const obstacles:Obstacle[]=centres.map((c,p)=>({kind:'town-center',x:c.ax,y:c.ay,...(p?{red:true}:{})}));
 const starts=centres.map(c=>[{x:c.ax+85,y:c.ay+350},{x:c.ax+185,y:c.ay+350},{x:c.ax+135,y:c.ay+450}]),scouts=centres.map(c=>({x:c.ax+235,y:c.ay+450}));
 // Occupancy by tile, plus each base's apron: nothing is placed on them.
 const taken=new Set<number>(),aprons=centres.map(c=>[c.x+R.apron.left,c.y+R.apron.top,c.x+R.apron.right,c.y+R.apron.bottom]);
 for(const c of centres)for(let ty=Math.floor((c.y-150)/100);ty<=Math.floor((c.y+150)/100);ty++)for(let tx=Math.floor((c.x-150)/100);tx<=Math.floor((c.x+150)/100);tx++)taken.add(ty*size+tx);
 const free=(tx:number,ty:number)=>tx>=1&&ty>=1&&tx<size-1&&ty<size-1&&!taken.has(ty*size+tx)&&!aprons.some(b=>tx*100+100>b[0]&&tx*100<b[2]&&ty*100+100>b[1]&&ty*100<b[3]);
 const offset:Record<string,number>={tree:12,gold:15,rock:15,berries:15,livestock:15,hunt:15};
 const animals:{kind:'hunt'|'livestock';x:number;y:number}[]=[];
 const put=(kind:string,tx:number,ty:number)=>{taken.add(ty*size+tx);const x=tx*100+offset[kind],y=ty*100+offset[kind];if(kind==='hunt'||kind==='livestock')animals.push({kind,x,y});else obstacles.push({kind:kind as Obstacle['kind'],x,y});};
 // Base kits: the same offsets for both players; only a blocked spot turns round the centre in 15-degree steps.
 centres.forEach(c=>{
  for(const item of R.kit){let placed=false;const d=Math.hypot(item.dx,item.dy),base=Math.atan2(item.dy,item.dx);
   for(let step=0;step<24&&!placed;step++){const a=base+(step%2?-1:1)*Math.ceil(step/2)*15*Math.PI/180,tx=Math.floor((c.x+Math.cos(a)*d)/100),ty=Math.floor((c.y+Math.sin(a)*d)/100);
    const cells=item.kind==='tree'?[[0,0],[1,0],[0,1],[1,1],[-1,0],[0,-1]].slice(0,(item as {group?:number}).group??1).map(([dx,dy])=>[tx+dx,ty+dy]):[[tx,ty]];
    if(cells.every(([x,y])=>free(x,y))){for(const [x,y] of cells)put(item.kind,x,y);placed=true;}}
   // A kit item with no room is left out; validateStartingResources then rejects the candidate and makeMap retries.
   if(!placed)continue;}});
 const far=(tx:number,ty:number,d:number)=>centres.every(c=>Math.hypot(tx*100+50-c.x,ty*100+50-c.y)>=d);
 // Neutral mines near the middle, away from both bases.
 for(const [kind,count] of Object.entries(R.neutral))for(let i=0;i<count;i++)for(let k=0;k<40;k++){const a=random()*Math.PI*2,d=random()*R.neutralRadius,tx=Math.floor((mid+Math.cos(a)*d)/100),ty=Math.floor((mid+Math.sin(a)*d)/100);if(free(tx,ty)&&far(tx,ty,R.clumpClearance)){put(kind,tx,ty);break;}}
 // Forest clumps grown by a seeded random walk, away from bases.
 for(let i=0;i<R.forestClumps;i++){let tx=0,ty=0,ok=false;for(let k=0;k<60&&!ok;k++){tx=1+Math.floor(random()*(size-2));ty=1+Math.floor(random()*(size-2));ok=free(tx,ty)&&far(tx,ty,R.clumpClearance);}
  if(!ok)continue;const want=R.clumpTrees[0]+Math.floor(random()*(R.clumpTrees[1]-R.clumpTrees[0]+1));
  for(let n=0,k=0;n<want&&k<want*6;k++){if(free(tx,ty)&&far(tx,ty,R.clumpClearance)){put('tree',tx,ty);n++;}const dir=Math.floor(random()*4);tx+=dir===0?1:dir===1?-1:0;ty+=dir===2?1:dir===3?-1:0;tx=Math.min(size-2,Math.max(1,tx));ty=Math.min(size-2,Math.max(1,ty));}}
 // Border woods on the outermost ring of tiles, thinned near bases.
 for(let ty=0;ty<size;ty++)for(let tx=0;tx<size;tx++){if(tx>0&&ty>0&&tx<size-1&&ty<size-1)continue;const v=random();if(v<R.borderWood&&!taken.has(ty*size+tx)&&far(tx,ty,R.borderClearance)){taken.add(ty*size+tx);obstacles.push({kind:'tree',x:tx*100+12,y:ty*100+12});}}
 const map:MapData={size,starts,scouts,obstacles,blocked:[],tiles,resources:[],navigationRevision:0,generationAttempt:0};
 obstacles.forEach((o,index)=>{o.id=`obstacle-${index}`;map.tiles[tileAt(o.x,o.y,size)].obstacleRefs.push(o.id);
  if(!isBuilding(o)){const kind=(o.kind==='rock'?'stone':o.kind) as ResourceKind;const id=`resource-${index}`,capacity=terrainRules.resourceCapacity[kind];map.resources.push({id,kind,x:o.x,y:o.y,capacity,remaining:capacity,collectible:true,status:'available',obstacleId:o.id,depletedAt:null});map.tiles[tileAt(o.x,o.y,size)].resourceRefs.push(id);}});
 for(const {kind,x,y} of animals){const id=`resource-${kind}-${x}-${y}`,capacity=terrainRules.resourceCapacity[kind],obstacleId=`obstacle-${kind}-${x}-${y}`;map.obstacles.push({id:obstacleId,kind,x,y});map.tiles[tileAt(x,y,size)].obstacleRefs.push(obstacleId);map.resources.push({id,kind,x,y,capacity,remaining:capacity,collectible:true,status:'available',obstacleId,depletedAt:null});map.tiles[tileAt(x,y,size)].resourceRefs.push(id);}
 for(let i=0;i<nodeTotal(map);i++)if(!clearSegment(map,position(map,i),position(map,i)))map.blocked.push(i);return map;
}
export const buildingKinds=new Set(['house','town-center','barracks','farm','lumber-camp','mining-camp','mill','stable','archery-range']);
export function isBuilding(o:Obstacle){return buildingKinds.has(o.kind);}
function bounds(o:Obstacle):[number,number,number,number]{return obstacleBounds(o,navigationRules.radius);}
// Slab intersection includes contact: center-lines cannot clip expanded footprints.
export function clearSegment(map:MapData,a:Point,b:Point,movement:'land'|'water'='land'):boolean{
 const size=map.size,edge=size*100-50;if([a.x,a.y,b.x,b.y].some(v=>!Number.isSafeInteger(v)||v<50||v>edge))return false;
 // Expanded height discontinuities prevent both cliff crossings and body overhang.
 // Only tiles within one tile of the segment's bounding box can matter (segments are node steps or short links).
 const maxStep=movement==='land'?terrainRules.maxLandStep:0,radius=navigationRules.radius;
 const tx0=Math.max(0,Math.floor((Math.min(a.x,b.x)-radius)/100)-1),tx1=Math.min(size-1,Math.floor((Math.max(a.x,b.x)+radius)/100)+1),ty0=Math.max(0,Math.floor((Math.min(a.y,b.y)-radius)/100)-1),ty1=Math.min(size-1,Math.floor((Math.max(a.y,b.y)+radius)/100)+1);
 for(let y=ty0;y<=ty1;y++)for(let x=tx0;x<=tx1;x++){const tile=map.tiles[y*size+x];
 if(x<size-1&&Math.abs(tile.height-map.tiles[tile.id+1].height)>maxStep&&intersects(a,b,[(x+1)*100-radius,y*100-radius,(x+1)*100+radius,(y+1)*100+radius]))return false;
 if(y<size-1&&Math.abs(tile.height-map.tiles[tile.id+size].height)>maxStep&&intersects(a,b,[x*100-radius,(y+1)*100-radius,(x+1)*100+radius,(y+1)*100+radius]))return false;
 // Closed cell footprints include unit radius; material color never controls passage.
 if(!canTraverse(tile,movement)&&intersects(a,b,[x*100-radius,y*100-radius,x*100+100+radius,y*100+100+radius]))return false;
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
 (dirtyAreas.get(map)??dirtyAreas.set(map,[]).get(map)!).push([...area]);
 for(const id of nodesNear(map,area,0)){const p=position(map,id);
 const blocked=!clearSegment(map,p,p),wasBlocked=map.blocked.includes(id);if(blocked!==wasBlocked){changed.push(id);if(blocked)map.blocked.push(id);else map.blocked=map.blocked.filter(n=>n!==id);}}
 map.blocked.sort((a,b)=>a-b);map.navigationRevision++;return changed;
}
export function validateMap(map:MapData):string[]{
 const errors:string[]=[];
 if(map.tiles.length!==map.size*map.size||map.tiles.some((t,i)=>t.id!==i))return ['地格數量或 ID 不符'];
 const obstacles=new Set(map.obstacles.map(o=>o.id)),resources=new Set(map.resources.map(r=>r.id));
 if(obstacles.size!==map.obstacles.length||obstacles.has(undefined))errors.push('障礙 ID 重複或缺少');
 if(resources.size!==map.resources.length)errors.push('資源 ID 重複');
 for(const tile of map.tiles){if(!Number.isSafeInteger(tile.height)||tile.height<0)errors.push(`地格 ${tile.id} 高度無效`);if(!['land','water','both','blocked'].includes(tile.walkClass)||typeof tile.buildability!=='boolean')errors.push(`地格 ${tile.id} 通行或建造規則無效`);if(tile.resourceRefs.some(id=>!resources.has(id))||tile.obstacleRefs.some(id=>!obstacles.has(id)))errors.push(`地格 ${tile.id} 參照失效`);}
 for(const r of map.resources){if(!resourceDefinitions[r.kind]){errors.push(`資源 ${r.id} 類別無效`);continue;}
 const cell=map.tiles[tileAt(r.x,r.y,map.size)];if(!cell||!canTraverse(cell,resourceDefinitions[r.kind].movement))errors.push(`資源 ${r.id} 地形不符`);
 if(!Number.isSafeInteger(r.capacity)||r.capacity<=0||!Number.isSafeInteger(r.remaining)||r.remaining<0||r.remaining>r.capacity)errors.push(`資源 ${r.id} 容量無效`);
 if((r.status==='depleted')!==(r.remaining===0)||r.collectible!==(r.remaining>0)||r.status==='depleted'&&(r.obstacleId!==null||r.depletedAt===null))errors.push(`資源 ${r.id} 狀態不一致`);
 if(r.obstacleId&&!obstacles.has(r.obstacleId))errors.push(`資源 ${r.id} 障礙參照失效`);
 if(!map.tiles[tileAt(r.x,r.y,map.size)]?.resourceRefs.includes(r.id))errors.push(`資源 ${r.id} 地格參照失效`);}
 const spawns=[...map.starts.flat(),...(map.scouts??[])];
 if(spawns.some(p=>!clearSegment(map,p,p)))errors.push('出生點不可通行');
 else {const job=createPathJob(map,0,map.starts[0][0],map.starts[1][0]);advancePathJob(map,job,nodeTotal(map));if(job.status!=='found')errors.push('玩家出生區互不連通');}
 return errors;
}
export function position(map:{size:number},id:number):Point{const side=sideOf(map);return {x:50+(id%side)*50,y:50+Math.floor(id/side)*50};}
export function nodeAt(map:{size:number},p:Point):number{const side=sideOf(map),x=(p.x-50)/50,y=(p.y-50)/50;return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<side&&y>=0&&y<side?y*side+x:-1;}
// Generation-only gate: runtime maps may legitimately exhaust their starting stock.
export function validateStartingResources(map:MapData){
 const errors:string[]=[];
 const players=map.starts.map(start=>start[0]).map((spawn,player)=>{
 const side=sideOf(map),total=nodeTotal(map),distances=Array<number>(total).fill(Infinity),start=nearest(map,spawn),frontier:number[]=[];
 if(start>=0){distances[start]=Math.abs(position(map,start).x-spawn.x)+Math.abs(position(map,start).y-spawn.y);frontier.push(start);}
 const closed=blockedTable(map);for(let head=0;head<frontier.length;head++){const id=frontier[head],x=id%side,y=Math.floor(id/side);for(const next of [x<side-1?id+1:-1,y<side-1?id+side:-1,x>0?id-1:-1,y>0?id-side:-1])if(next>=0&&!Number.isFinite(distances[next])&&!closed[next]&&clearSegment(map,position(map,id),position(map,next))){distances[next]=distances[id]+50;frontier.push(next);}}
 const access=Object.entries(startingResourceRules.minimum).map(([kind,minimum])=>{
 const nodes=map.resources.filter(r=>r.kind===kind&&r.collectible&&r.remaining>0).map(resource=>{
 const obstacle=map.obstacles.find(o=>o.id===resource.obstacleId);if(!obstacle)return {id:resource.id,remaining:resource.remaining,distance:Infinity,approach:null as Point|null};
 const [x0,y0,x1,y1]=bounds(obstacle);let distance=Infinity,approach:Point|null=null;
 for(let i=0;i<total;i++){if(!Number.isFinite(distances[i]))continue;const p=position(map,i),gap=Math.max(x0-p.x,0,p.x-x1)+Math.max(y0-p.y,0,p.y-y1);if(gap>0&&gap<=50&&distances[i]<distance){distance=distances[i];approach=p;}}
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
 const closed=blockedTable(map);let best=-1,distance=Infinity;for(let i=0;i<nodeTotal(map);i++){const q=position(map,i),d=Math.abs(p.x-q.x)+Math.abs(p.y-q.y);if(d<distance&&!(movement==='land'?closed[i]:!clearSegment(map,q,q,movement))&&(outbound?connector(map,p,q,movement):connector(map,q,p,movement))){best=i;distance=d;}}return best;
}
export function nearestOpen(map:MapData,p:Point):number{const closed=blockedTable(map);let best=-1,distance=Infinity;for(let i=0;i<nodeTotal(map);i++){if(closed[i])continue;const q=position(map,i),d=Math.abs(p.x-q.x)+Math.abs(p.y-q.y);if(d<distance){best=i;distance=d;}}return best;}
export function createPathJob(map:MapData,unitId:number,from:Point,target:Point,movement:'land'|'water'='land'):PathJob{
 const start=nearest(map,from,true,movement),goal=nearest(map,target,false,movement),parents=Array(nodeTotal(map)).fill(-2);if(start>=0)parents[start]=-1;
 return {...(movement==='water'?{movement}:{}),unitId,start,goal,target:{...target},frontier:start<0?[]:[start],head:0,parents,status:start<0||goal<0?'unreachable':'searching',path:[]};
}
export function advancePathJob(map:MapData,job:PathJob,budget:number):number{
 if(!Number.isSafeInteger(budget)||budget<0)throw Error('無效尋路預算');let used=0;
 while(job.status==='searching'&&used<budget){
 if(job.head===job.frontier.length){job.status='unreachable';break;}
 const id=job.frontier[job.head++];used++;
 if(id===job.goal){const path:Point[]=[];let cursor=id;while(cursor!==-1){path.push(position(map,cursor));cursor=job.parents[cursor];}job.path=path.reverse();if(job.path.at(-1)!.x!==job.target.x||job.path.at(-1)!.y!==job.target.y)job.path.push({...job.target});job.status='found';break;}
 const side=sideOf(map),closed=blockedTable(map),x=id%side,y=Math.floor(id/side);for(const next of [x<side-1?id+1:-1,y<side-1?id+side:-1,x>0?id-1:-1,y>0?id-side:-1])if(next>=0&&job.parents[next]===-2&&!(job.movement==='water'?!clearSegment(map,position(map,next),position(map,next),'water'):closed[next])&&clearSegment(map,position(map,id),position(map,next),job.movement??'land')){job.parents[next]=id;job.frontier.push(next);}
 }return used;
}
