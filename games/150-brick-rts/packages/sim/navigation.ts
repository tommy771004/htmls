// Engineering defaults, not values from the reference game.
export const navigationRules={provenance:'design_default',spacing:50,size:31,radius:25,expansionsPerTick:32,speedPerTick:5} as const;
export type Point={x:number;y:number};
export type Obstacle={kind:'house'|'tree'|'rock';x:number;y:number;red?:boolean};
export type MapData={obstacles:Obstacle[];blocked:number[]};
export type PathJob={unitId:number;start:number;goal:number;target:Point;frontier:number[];head:number;parents:number[];status:'searching'|'found'|'unreachable';path:Point[]};
export function makeMap(seed:number):MapData{
 let rng=seed||1;const obstacles:Obstacle[]=[{kind:'house',x:300,y:400},{kind:'house',x:1100,y:400,red:true}];
 for(let x=0;x<16;x++)for(let y=0;y<16;y++){rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;const v=(rng>>>0)/4294967296;
 if((x<2||y<2||x>13||y>13)&&v<.34)obstacles.push({kind:'tree',x:x*100+12,y:y*100+12});
 else if(v<.028&&Math.abs(x-8)<3)obstacles.push({kind:'rock',x:x*100,y:y*100});}
 const map:MapData={obstacles,blocked:[]};for(let i=0;i<961;i++)if(!clearSegment(map,position(i),position(i)))map.blocked.push(i);return map;
}
function bounds(o:Obstacle):[number,number,number,number]{const r=navigationRules.radius;return o.kind==='house'?[o.x-15-r,o.y-15-r,o.x+235+r,o.y+215+r]:o.kind==='tree'?[o.x-20-r,o.y-20-r,o.x+80+r,o.y+80+r]:[o.x-r,o.y-r,o.x+65+r,o.y+70+r];}
// Slab intersection includes contact: center-lines cannot clip expanded footprints.
export function clearSegment(map:MapData,a:Point,b:Point):boolean{
 if([a.x,a.y,b.x,b.y].some(v=>!Number.isSafeInteger(v)||v<50||v>1550))return false;
 for(const o of map.obstacles){const [x0,y0,x1,y1]=bounds(o);let lo=0,hi=1;
 for(const [start,delta,min,max] of [[a.x,b.x-a.x,x0,x1],[a.y,b.y-a.y,y0,y1]]){
 if(delta===0){if(start<min||start>max){lo=2;break;}}else{const t0=(min-start)/delta,t1=(max-start)/delta;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));}}
 if(lo<=hi)return false;
 }return true;
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
