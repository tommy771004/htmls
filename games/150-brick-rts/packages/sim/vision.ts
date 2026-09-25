import type {MapData,Obstacle} from './navigation.ts';
import {tileAt} from './terrain.ts';
export const visionRules={provenance:'design_default',unitRadius:400,houseRadius:300,shareVision:false,rememberStaticObjects:true} as const;
export type Observer={player:number;x:number;y:number};
export type KnownObstacle={obstacle:Obstacle;lastSeenTick:number};
export type PlayerVision={explored:number[];visible:number[];known:KnownObstacle[]};
export function createVision():PlayerVision[]{return Array.from({length:2},()=>({explored:[],visible:[],known:[]}));}
// Policy is explicit: callers may only supply allies after diplomacy/technology validation.
export function updateVision(visions:PlayerVision[],map:MapData,units:Observer[],tick:number,sharing:number[][]=[[0],[1]]):void{
 if(sharing.length!==2||sharing.some((members,p)=>!members.includes(p)||members.some(id=>!Number.isInteger(id)||id<0||id>1)))throw Error('無效共享視野規則');
 const own=[new Set<number>(),new Set<number>()];
 const reveal=(player:number,x:number,y:number,radius:number)=>{for(let id=0;id<256;id++){const dx=(id%16)*100+50-x,dy=Math.floor(id/16)*100+50-y;if(dx*dx+dy*dy<=radius*radius)own[player].add(id);}};
 for(const u of units)reveal(u.player,u.x,u.y,visionRules.unitRadius);
 for(const o of map.obstacles)if(o.kind==='house')reveal(o.red?1:0,o.x+100,o.y+100,visionRules.houseRadius);
 for(let player=0;player<2;player++){
 const vision=visions[player],visible=new Set(sharing[player].flatMap(id=>[...own[id]]));
 vision.visible=[...visible].sort((a,b)=>a-b);vision.explored=[...new Set([...vision.explored,...vision.visible])].sort((a,b)=>a-b);
 // Reconcile only observed cells. A hidden disappearance does not erase memory.
 const known=new Map(vision.known.filter(k=>!visible.has(tileAt(k.obstacle.x,k.obstacle.y))).map(k=>[k.obstacle.id,k]));
 for(const obstacle of map.obstacles)if(visible.has(tileAt(obstacle.x,obstacle.y)))known.set(obstacle.id,{obstacle:{...obstacle},lastSeenTick:tick});
 vision.known=[...known.values()].sort((a,b)=>a.obstacle.id!<b.obstacle.id!?-1:a.obstacle.id!>b.obstacle.id!?1:0);
 }
}
export function projectVision(vision:PlayerVision){const visible=new Set(vision.visible),explored=new Set(vision.explored);return {fog:Array.from({length:256},(_,id)=>visible.has(id)?2:explored.has(id)?1:0),known:structuredClone(vision.known)};}
export function unitVisible(vision:PlayerVision,unit:Observer,player:number):boolean{return unit.player===player||vision.visible.includes(tileAt(unit.x,unit.y));}
