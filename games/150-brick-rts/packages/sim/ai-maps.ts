// The computer on the 地圖 round's special maps (design_default; deterministic, read from the state each pass like
// ai.ts): a nomad start's town centre, wolves, breaking out of a walled start, and crossing the water on island maps
// (attack waves by transport, villagers to land with the gold and stone the home islet lacks).
import {obstacleBounds} from '../content/footprints.ts';
import {terrainRules,canTraverse,tileAt} from './terrain.ts';
import type {MapData} from './navigation.ts';
import {placementProblem} from './buildings.ts';
import type {Building} from './buildings.ts';
import type {Unit} from './movement.ts';
import {layerOf} from './movement.ts';
import {position} from './navigation.ts';
import {costOf,ownerOf} from './civ.ts';
import {isHostile} from './fauna.ts';
import {passengers,capacityOf} from './naval.ts';
import {garrisonCapacity} from './defense.ts';
import type {AIState,Order} from './ai.ts';
type Box=[number,number,number,number];type Point={x:number;y:number};
export const mapAIRules={provenance:'design_default',
 // Nomad: the town centre's site within siteRange of the villagers, scored by the explored resources within reach of
 // it (weights per kind) less its distance.
 nomad:{siteRange:900,step:50,reach:700,weights:{berries:3,hunt:3,livestock:3,gold:2,stone:1,tree:.4} as Record<string,number>,distance:.5},
 // Wolves: a villager a wolf goes for shelters in the town centre (or runs to it); soldiers and the scout kill wolves
 // within guard of the town centre.
 wolves:{guard:800},
 // Over water: transports kept, the expansion party's size and from how many villagers it leaves.
 // dockAt: the dock goes up from this many villagers (no barracks needed first: on an islet there may be no room).
 ferry:{transports:1,expandAt:4,expanders:4,returnRange:400,dockAt:3,campWood:200},
 // A walled start: the gate goes into the own wall from the second age (a stone gate needs it).
 gateAge:2} as const;
const centre=(b:Box)=>({x:(b[0]+b[2])/2,y:(b[1]+b[3])/2});
const dist=(a:Point,b:Point)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
const boxOf=(s:AIState,b:Building)=>{const o=s.map.obstacles.find(o=>o.id===b.id);return o?obstacleBounds(o) as Box:null;};
// Landmasses by tile (terrain only: buildings and trees do not split land): -1 for water. Cached per map.
const lands=new WeakMap<MapData,Int32Array>();
export function landOf(map:MapData):Int32Array{let out=lands.get(map);if(out)return out;const n=map.size,land=new Int32Array(n*n).fill(-1);let id=0;
 for(let t=0;t<n*n;t++){if(land[t]>=0||!canTraverse(map.tiles[t],'land'))continue;land[t]=id;const q=[t];
  for(let h=0;h<q.length;h++){const c=q[h],x=c%n,y=Math.floor(c/n);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=n||ny>=n)continue;const m=ny*n+nx;
   if(land[m]>=0||!canTraverse(map.tiles[m],'land')||Math.abs(map.tiles[m].height-map.tiles[c].height)>terrainRules.maxLandStep)continue;land[m]=id;q.push(m);}}id++;}
 lands.set(map,out=land);return land;}
export const landAt=(map:MapData,p:Point)=>landOf(map)[tileAt(Math.min(map.size*100-1,Math.max(0,p.x)),Math.min(map.size*100-1,Math.max(0,p.y)),map.size)];
const knownInput=(s:AIState,P:number)=>{const explored=new Set(s.vision[P].explored),bodies=s.units.flatMap(u=>[{x:u.x,y:u.y},...(u.next===null?[]:[position(s.map,u.next)])]);
 return {tiles:s.map.tiles,obstacles:s.map.obstacles,units:bodies,explored:(t:number)=>explored.has(t)};};
// Nomad: with no town centre (built or going up), the villagers found one at the best site near them.
export function nomadStart(s:AIState,order:Order,P:number,villagers:Unit[],own:Building[]){
 if(!s.map.nomad||own.some(b=>b.kind==='town-center')||!villagers.length)return;
 const R=mapAIRules.nomad,stock=s.accounts[P].stock,cost=costOf('town-center',ownerOf(s,P));if((Object.keys(cost) as (keyof typeof cost)[]).some(k=>stock[k]<cost[k]))return;
 const c={x:villagers.reduce((t,u)=>t+u.x,0)/villagers.length,y:villagers.reduce((t,u)=>t+u.y,0)/villagers.length},explored=new Set(s.vision[P].explored),input=knownInput(s,P);
 const known=s.map.resources.filter(r=>r.collectible&&explored.has(tileAt(r.x,r.y,s.map.size))&&R.weights[r.kind]);
 let best:{x:number;y:number;score:number}|null=null;
 for(let x=Math.ceil((c.x-R.siteRange)/50)*50;x<=c.x+R.siteRange;x+=R.step)for(let y=Math.ceil((c.y-R.siteRange)/50)*50;y<=c.y+R.siteRange;y+=R.step){const box=obstacleBounds({kind:'town-center',x,y}),m=centre(box as Box);
  if(box[0]<100||box[1]<100||box[2]>s.map.size*100-100||box[3]>s.map.size*100-100)continue;
  const score=known.reduce((t,r)=>{const d=Math.hypot(r.x-m.x,r.y-m.y);return d<=R.reach&&d>=200?t+R.weights[r.kind]*r.remaining/100:t;},0)-Math.hypot(m.x-c.x,m.y-c.y)*R.distance/100;
  if(best&&score<=best.score)continue;if(placementProblem(input,'town-center',x,y))continue;best={x,y,score};}
 if(best)order('build',{unitIds:villagers.map(u=>u.id).sort((a,b)=>a-b),kind:'town-center',x:best.x,y:best.y});}
// Wolves: a red villager a wolf is after shelters (or runs home); soldiers and the scout near home kill the wolves there.
export function wolves(s:AIState,order:Order,P:number,mine:Unit[],tc:Building|undefined,idle:(u:Unit)=>boolean){
 const box=tc&&boxOf(s,tc);if(!box)return;const home=centre(box),hunters=new Map<number,number>();
 for(const [id,b] of Object.entries(s.beasts)){const w=s.units.find(u=>u.id===Number(id));if(w&&isHostile(w.kind))hunters.set(w.id,b.foe);}
 const chased=mine.filter(u=>u.kind==='villager'&&[...hunters.values()].includes(u.id)).sort((a,b)=>a.id-b.id);
 if(chased.length){const room=tc.complete?garrisonCapacity(s,tc)-(s.garrison[tc.id]?.units.length??0):0;
  if(room>0)order('garrison',{unitIds:chased.slice(0,room).map(u=>u.id),buildingId:tc.id});else order('move',{unitIds:chased.map(u=>u.id),x:Math.round(home.x/50)*50,y:Math.round((box[3]+100)/50)*50});}
 const near=s.units.filter(u=>isHostile(u.kind)&&dist(u,home)<=mapAIRules.wolves.guard).sort((a,b)=>dist(a,home)-dist(b,home)||a.id-b.id)[0];
 if(!near)return;const guards=mine.filter(u=>(u.kind==='scout'||u.kind==='militia'||u.kind==='spearman'||u.kind==='archer'||u.kind==='knight')&&idle(u)&&dist(u,home)<=mapAIRules.wolves.guard);
 if(guards.length)order('attack',{unitIds:guards.map(u=>u.id).sort((a,b)=>a-b),target:{kind:'unit',id:near.id}});}
// A walled start: from the second age a gate replaces the own wall segment nearest the way out (towards the goal,
// with open land beyond it), built by the nearest villager.
export function breakout(s:AIState,order:Order,P:number,own:Building[],villagers:Unit[],tc:Building|undefined,goal:Point){
 if(!s.map.walled||s.ages[P]<mapAIRules.gateAge||!tc)return;const box=boxOf(s,tc);if(!box)return;const home=centre(box);
 if(own.some(b=>b.kind==='gate'))return;const cost=costOf('gate',ownerOf(s,P)),stock=s.accounts[P].stock;if((Object.keys(cost) as (keyof typeof cost)[]).some(k=>stock[k]<cost[k]))return;
 const size=s.map.size,input=knownInput(s,P),occupied=new Set(s.map.obstacles.map(o=>tileAt(o.x,o.y,size)));
 const walls=own.filter(b=>b.kind==='stone-wall'&&b.complete).map(b=>({b,c:{x:b.x+50,y:b.y+50}}));
 const out=(c:Point)=>{const dx=Math.sign(Math.round((c.x-home.x)/100)),dy=Math.sign(Math.round((c.y-home.y)/100)),tx=Math.floor(c.x/100)+dx,ty=Math.floor(c.y/100)+dy;
  if(tx<0||ty<0||tx>=size||ty>=size)return false;const t=ty*size+tx;return canTraverse(s.map.tiles[t],'land')&&!occupied.has(t);};
 const pick=walls.filter(w=>out(w.c)&&!placementProblem(input,'gate',w.b.x,w.b.y,P)).sort((a,b)=>Math.hypot(a.c.x-goal.x,a.c.y-goal.y)-Math.hypot(b.c.x-goal.x,b.c.y-goal.y)||(a.b.id<b.b.id?-1:1))[0];
 if(!pick)return;const builder=villagers.filter(u=>s.works[u.id]?.kind!=='build').sort((a,b)=>dist(a,pick.c)-dist(b,pick.c)||a.id-b.id)[0];
 if(builder)order('build',{unitIds:[builder.id],kind:'gate',x:pick.b.x,y:pick.b.y});}
// A drop-off camp on the first free site next to a resource on another landmass (the own-half rule of ai.ts place
// does not apply there), built by the nearest of the builders.
function campNear(s:AIState,order:Order,P:number,kind:'mining-camp'|'lumber-camp',near:Point,builders:Unit[]){
 const stock=s.accounts[P].stock,cost=costOf(kind,ownerOf(s,P));if((Object.keys(cost) as (keyof typeof cost)[]).some(k=>stock[k]<cost[k]))return;const input=knownInput(s,P);
 const sites:{x:number;y:number;d:number}[]=[];for(let x=Math.round((near.x-650)/50)*50;x<=near.x+650;x+=50)for(let y=Math.round((near.y-650)/50)*50;y<=near.y+650;y+=50){const b=obstacleBounds({kind,x,y}),m=centre(b as Box),d=Math.hypot(m.x-near.x,m.y-near.y);if(d>=130&&d<=650)sites.push({x,y,d});}
 sites.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);
 for(const v of sites){if(placementProblem(input,kind,v.x,v.y))continue;const builder=builders.filter(u=>s.works[u.id]?.kind!=='build').sort((a,b)=>dist(a,v)-dist(b,v)||a.id-b.id)[0];
  if(builder)order('build',{unitIds:[builder.id],kind,x:v.x,y:v.y});return;}}
// Whether the soldiers at home can walk to the goal: not when it lies on another landmass, nor when red is walled in
// without a gate yet.
export function landBlocked(s:AIState,own:Building[],home:Point,goal:Point){
 if(s.map.walled&&!own.some(b=>b.kind==='gate'&&b.complete))return true;
 if(!s.map.separate)return false;const a=landAt(s.map,home),b=landAt(s.map,goal);return a<0||b<0||a!==b;}
// A source a villager can walk to (same landmass) on a map with separate landmasses.
// (A point on the water, a dock's, matches any land.)
export const sameLand=(s:AIState,a:Point,b:Point)=>{if(!s.map.separate)return true;const x=landAt(s.map,a),y=landAt(s.map,b);return x<0||y<0||x===y;};
// Crossing the water: a transport carries each attack wave to the enemy's land and comes back for the next; on a start
// whose land lacks gold or stone, it first takes an expansion party of villagers to the nearest land with them, where a
// mining camp goes up. Warships, if any, sail with a loaded transport.
export function ferry(s:AIState,order:Order,P:number,c:{own:Building[];mine:Unit[];villagers:Unit[];wave:Unit[];idle:(u:Unit)=>boolean;home:Point;goal:Point;waveSize:number;offensive:boolean;place:(kind:'mining-camp'|'lumber-camp',near:Point,villagers:Unit[])=>boolean}){
 if(!s.map.separate)return;const R=mapAIRules.ferry,dock=c.own.find(b=>b.kind==='dock'&&b.complete),homeLand=landAt(s.map,c.home);
 const transports=c.mine.filter(u=>u.kind==='transport-ship'),boarding=(id:number)=>Object.values((s as unknown as {boarding:Record<number,{transportId:number}>}).boarding??{}).some(b=>b.transportId===id);
 const sailing=new Set(Object.keys((s as unknown as {unloading:Record<number,unknown>}).unloading??{}).map(Number));
 // Expansion: home land without collectible gold or stone, and a landmass red has seen that has them.
 const explored=new Set(s.vision[P].explored),onLand=(r:{x:number;y:number},land:number)=>landAt(s.map,r)===land;
 const mines=s.map.resources.filter(r=>(r.kind==='gold'||r.kind==='stone')&&r.collectible);
 const lacking=!mines.some(r=>onLand(r,homeLand));
 const expanders=c.villagers.filter(u=>landAt(s.map,u)!==homeLand);
 // Villagers already across: a mining camp by the nearest gold or stone on their land.
 if(expanders.length){const land=landAt(s.map,expanders[0]),camp=c.own.some(b=>(b.kind==='mining-camp')&&landAt(s.map,{x:b.x+100,y:b.y+100})===land);
  const target=mines.filter(r=>onLand(r,land)&&explored.has(tileAt(r.x,r.y,s.map.size))).sort((a,b)=>dist(a,expanders[0])-dist(b,expanders[0])||(a.id<b.id?-1:1))[0];
  if(!camp&&target&&!c.place('mining-camp',{x:target.x,y:target.y},expanders))campNear(s,order,P,'mining-camp',{x:target.x,y:target.y},expanders);
  // Wood there too: a lumber camp by the nearest trees once expanders cut them far from any drop-off.
  const cutting=expanders.filter(u=>{const w=s.works[u.id] as {kind:string;resourceId?:string}|undefined;return w?.kind==='gather'&&s.map.resources.find(r=>r.id===w.resourceId)?.kind==='tree';});
  if(cutting.length&&!c.own.some(b=>b.kind==='lumber-camp'&&landAt(s.map,{x:b.x+100,y:b.y+100})===land)){const w=s.works[cutting[0].id] as {resourceId:string},tree=s.map.resources.find(r=>r.id===w.resourceId);if(tree)campNear(s,order,P,'lumber-camp',{x:tree.x,y:tree.y},expanders);}}
 if(!dock)return;const at={x:dock.x+150,y:dock.y+150};
 // Transports: one (more while one is away) once there is something to carry.
 const wanted=lacking&&!expanders.length&&c.villagers.length>=R.expandAt||c.offensive;
 if(wanted&&transports.length<R.transports&&!dock.queue.some(q=>q.entryId==='transport-ship')&&dock.queue.length<2){const cost=costOf('transport-ship',ownerOf(s,P)),stock=s.accounts[P].stock;
  if((Object.keys(cost) as (keyof typeof cost)[]).every(k=>stock[k]>=cost[k]))order('train',{buildingId:dock.id,entryId:'transport-ship'});}
 for(const t of transports.sort((a,b)=>a.id-b.id)){if(sailing.has(t.id))continue;const aboard=passengers(s,t.id),cap=capacityOf(s,t),busy=boarding(t.id);
  if(aboard.length){if(busy)continue;
   // Loaded: villagers go to the nearest land with gold or stone, soldiers to the goal.
   const settlers=aboard.every(u=>u.kind==='villager');let to=c.goal;
   if(settlers){const target=mines.filter(r=>landAt(s.map,r)!==homeLand&&explored.has(tileAt(r.x,r.y,s.map.size))).sort((a,b)=>dist(a,at)-dist(b,at)||(a.id<b.id?-1:1))[0];to=target?{x:target.x,y:target.y}:{x:s.map.size*50,y:s.map.size*50};}
   order('unload',{transportId:t.id,x:Math.round(to.x),y:Math.round(to.y)});
   const escorts=c.mine.filter(u=>layerOf(u.kind)==='water'&&u.kind!=='transport-ship'&&u.kind!=='fishing-ship'&&c.idle(u));if(escorts.length)order('move',{unitIds:escorts.map(u=>u.id).sort((a,b)=>a-b),x:Math.round(to.x/50)*50,y:Math.round(to.y/50)*50});
   continue;}
  if(busy)continue;
  // Empty and away: back to the dock.
  if(dist(t,at)>R.returnRange&&c.idle(t)){order('move',{unitIds:[t.id],x:Math.round(at.x/50)*50,y:Math.round(at.y/50)*50});continue;}
  // The expansion party first (villagers on wood or idle, lowest id first), then each attack wave.
  // (The party leaves with wood for its two camps in hand: across the water nothing reaches a drop-off until they stand.)
  if(lacking&&!expanders.length&&c.villagers.length>=R.expandAt){if(s.accounts[P].stock.wood<R.campWood)continue;const party=c.villagers.filter(u=>landAt(s.map,u)===homeLand&&s.works[u.id]?.kind!=='build').sort((a,b)=>Number(c.idle(b))-Number(c.idle(a))||a.id-b.id).slice(0,Math.min(cap,R.expanders));
   if(party.length)order('load',{unitIds:party.map(u=>u.id).sort((a,b)=>a-b),transportId:t.id});continue;}
  if(c.offensive&&c.wave.length>=Math.min(c.waveSize,cap))order('load',{unitIds:c.wave.slice(0,cap).map(u=>u.id).sort((a,b)=>a-b),transportId:t.id});}
}
