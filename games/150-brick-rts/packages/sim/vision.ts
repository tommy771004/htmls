import type {MapData,Obstacle} from './navigation.ts';
import {isBuilding} from './navigation.ts';
import type {ResourceNode} from './terrain.ts';
import {tileAt} from './terrain.ts';
import {obstacleBounds} from '../content/footprints.ts';
// Buildings count as seen when any tile under their footprint is visible; other objects use their anchor tile.
function footprintTiles(o:Obstacle,size:number):number[]{if(!isBuilding(o))return [tileAt(o.x,o.y,size)];const [x0,y0,x1,y1]=obstacleBounds(o),tiles:number[]=[];for(let ty=Math.max(0,Math.floor(y0/100));ty<=Math.min(size-1,Math.floor((y1-1)/100));ty++)for(let tx=Math.max(0,Math.floor(x0/100));tx<=Math.min(size-1,Math.floor((x1-1)/100));tx++)tiles.push(ty*size+tx);return tiles;}
export const visionRules={provenance:'design_default',unitRadius:400,scoutRadius:550,sheepRadius:200,houseRadius:300,townCenterRadius:600,towerRadius:700,
 // The 建築 round: the outpost sees 6/8/10/12 tiles by age on aoetw.com, at the tower's 70 a tile (its 10 tiles -> 700);
 // walls a little, the wonder like its 8 tiles; market, dock and gates like a house.
 outpostRadius:[420,560,700,840],wallRadius:200,wonderRadius:560,shareVision:false,rememberStaticObjects:true} as const;
// Sight of the 建築 round's buildings by age (the bombard tower sees as far as a tower).
const sighted:Record<string,(age:number)=>number>={outpost:a=>visionRules.outpostRadius[Math.min(4,Math.max(1,a))-1],'bombard-tower':()=>visionRules.towerRadius,
 'palisade-wall':()=>visionRules.wallRadius,'stone-wall':()=>visionRules.wallRadius,wonder:()=>visionRules.wonderRadius,
 market:()=>visionRules.houseRadius,dock:()=>visionRules.houseRadius,'palisade-gate':()=>visionRules.houseRadius,gate:()=>visionRules.houseRadius};
export type Observer={player:number;x:number;y:number;kind?:string};
export type KnownObstacle={obstacle:Obstacle;lastSeenTick:number};
export type PlayerVision={explored:number[];visible:number[];known:KnownObstacle[];resources:ResourceNode[]};
export function createVision():PlayerVision[]{return Array.from({length:2},()=>({explored:[],visible:[],known:[],resources:[]}));}
// Policy is explicit: callers may only supply allies after diplomacy/technology validation.
// extra: sight a player's civilization adds to a unit or building kind (packages/sim/civ.ts losBonus).
export function updateVision(visions:PlayerVision[],map:MapData,units:Observer[],tick:number,sharing:number[][]=[[0],[1]],extra:(player:number,kind:string)=>number=()=>0):void{
 if(sharing.length!==2||sharing.some((members,p)=>!members.includes(p)||members.some(id=>!Number.isInteger(id)||id<0||id>1)))throw Error('無效共享視野規則');
 const own=[new Set<number>(),new Set<number>()];
 // Tile centres within the radius; only the tiles in the radius' bounding box are tested.
 const size=map.size,reveal=(player:number,x:number,y:number,radius:number)=>{const t0=Math.max(0,Math.floor((x-radius)/100)),t1=Math.min(size-1,Math.floor((x+radius)/100)),u0=Math.max(0,Math.floor((y-radius)/100)),u1=Math.min(size-1,Math.floor((y+radius)/100));
  for(let ty=u0;ty<=u1;ty++)for(let tx=t0;tx<=t1;tx++){const dx=tx*100+50-x,dy=ty*100+50-y;if(dx*dx+dy*dy<=radius*radius)own[player].add(ty*size+tx);}};
 // Wild animals see for nobody; an owned sheep shows its owner a little ground round it.
 for(const u of units){if(u.player!==0&&u.player!==1)continue;reveal(u.player,u.x,u.y,(u.kind==='scout'?visionRules.scoutRadius:u.kind==='sheep'?visionRules.sheepRadius:visionRules.unitRadius)+(u.kind?extra(u.player,u.kind):0));}
 // Buildings see a little further with the owner's Town Watch and Town Patrol (extra by building kind).
 for(const o of map.obstacles)if(o.kind==='house'||o.kind==='barracks')reveal(o.red?1:0,o.x+100,o.y+100,visionRules.houseRadius+(o.progress===undefined?extra(o.red?1:0,o.kind):0));
 else if(o.kind==='town-center'&&o.progress===undefined)reveal(o.red?1:0,o.x+135,o.y+135,visionRules.townCenterRadius+extra(o.red?1:0,o.kind));
 // The 建築 round's buildings once finished (a town centre's foundation sees like a house's), from the footprint centre.
 else if(o.progress===undefined&&o.kind in sighted||o.kind==='town-center'){const [x0,y0,x1,y1]=obstacleBounds(o),p=o.red?1:0,r=o.kind==='town-center'?visionRules.houseRadius:sighted[o.kind](o.age??1);
  reveal(p,(x0+x1)/2,(y0+y1)/2,r+(o.kind==='town-center'?0:extra(p,o.kind)));}
 else if(o.kind==='watch-tower'&&o.progress===undefined)reveal(o.red?1:0,o.x+50,o.y+50,visionRules.towerRadius+extra(o.red?1:0,o.kind));
 // The Castle sees as far as a tower, from its centre.
 else if(o.kind==='castle'&&o.progress===undefined)reveal(o.red?1:0,o.x+185,o.y+185,visionRules.towerRadius+extra(o.red?1:0,o.kind));
 for(let player=0;player<2;player++){
 const vision=visions[player],visible=new Set(sharing[player].flatMap(id=>[...own[id]]));
 vision.resources=map.resources.filter(r=>r.status==='available'&&visible.has(tileAt(r.x,r.y,size))).map(r=>({...r}));
 vision.visible=[...visible].sort((a,b)=>a-b);vision.explored=[...new Set([...vision.explored,...vision.visible])].sort((a,b)=>a-b);
 // Reconcile only observed cells. A hidden disappearance does not erase memory.
 const known=new Map(vision.known.filter(k=>!['hunt','livestock'].includes(k.obstacle.kind)&&!footprintTiles(k.obstacle,size).some(id=>visible.has(id))).map(k=>[k.obstacle.id,k]));
 for(const obstacle of map.obstacles)if(footprintTiles(obstacle,size).some(id=>visible.has(id)))known.set(obstacle.id,{obstacle:{...obstacle},lastSeenTick:tick});
 vision.known=[...known.values()].sort((a,b)=>a.obstacle.id!<b.obstacle.id!?-1:a.obstacle.id!>b.obstacle.id!?1:0);
 }
}
export function projectVision(vision:PlayerVision,size:number){const visible=new Set(vision.visible),explored=new Set(vision.explored);return {fog:Array.from({length:size*size},(_,id)=>visible.has(id)?2:explored.has(id)?1:0),known:structuredClone(vision.known),resources:structuredClone(vision.resources)};}
export function unitVisible(vision:PlayerVision,unit:Observer,player:number,size:number):boolean{return unit.player===player||vision.visible.includes(tileAt(unit.x,unit.y,size));}
