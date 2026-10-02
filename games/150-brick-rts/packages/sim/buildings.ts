import {obstacleBounds,obstacleRects} from '../content/footprints.ts';
import {rules} from '../content/rules.ts';
import {reserve,cancelReservation,commitReservation,forfeitReservation} from './economy.ts';
import type {Account} from './economy.ts';
import {refreshNavigation,navigationRules,position,isBuilding} from './navigation.ts';
import type {MapData,Obstacle} from './navigation.ts';
import type {Unit} from './movement.ts';
import {tileAt,terrainRules,sizeOfTiles} from './terrain.ts';
import {combatRules,buildingHpOf} from './stats.ts';
import {ownerOf,costOf,civAvailable,housingBonus,popCapBonus,farmFoodBonus,buildRateBonus} from './civ.ts';
import {neutralCiv} from '../content/civs.ts';
import {farmFoodOf} from './tech.ts';
import type {Tile} from './terrain.ts';
// Player buildings (design_default engineering rules, not reference-game values).
export type BuildKind='house'|'barracks'|'farm'|'lumber-camp'|'mining-camp'|'mill'|'stable'|'archery-range'|'monastery'|'blacksmith'|'watch-tower'|'siege-workshop'|'castle'|'university'|'town-center'|'market'|'dock'|'fish-trap'|'outpost'|'bombard-tower'|'wonder'|'palisade-wall'|'palisade-gate'|'stone-wall'|'gate';
export const buildKinds:readonly BuildKind[]=['house','barracks','farm','lumber-camp','mining-camp','mill','stable','archery-range','monastery','blacksmith','watch-tower','siege-workshop','castle','university',
 // The 建築 round (the town centre becomes buildable from the third age).
 'town-center','market','dock','fish-trap','outpost','bombard-tower','wonder','palisade-wall','palisade-gate','stone-wall','gate'];
// queue: production/research in order (only the first advances); rally: where finished units walk.
export type QueueItem={id:number;entryId:string;reservationId:string;work:number;required:number};
// hp: structure points; a foundation starts at 1 and gains hit points in step with construction work.
export type Building={boost?:number;id:string;kind:BuildKind|'town-center';player:number;x:number;y:number;work:number;required:number;complete:boolean;reservationId:string|null;queue:QueueItem[];rally:{x:number;y:number;inside?:true}|null;hp:number;maxHp:number};
// capacity: population housed when complete (hard cap rules.settings.populationCap). One builder adds one
// work point per tick; required = entry time (s) x tick rate. Positions snap to a 10-unit grid, fine enough
// that the mirror image of any site (the maps are left-right symmetric) is also a legal position.
export const buildingRules={provenance:'design_default',capacity:{'town-center':5,house:5,barracks:0,farm:0,'lumber-camp':0,'mining-camp':0,mill:0,stable:0,'archery-range':0,monastery:0,blacksmith:0,'watch-tower':0,'siege-workshop':0,castle:10,university:0,market:0,dock:0,'fish-trap':0,outpost:0,'bombard-tower':0,wonder:0,'palisade-wall':0,'palisade-gate':0,'stone-wall':0,gate:0},grid:10,
 required:Object.fromEntries(buildKinds.map(k=>[k,rules.entries.find(e=>e.id===k)!.time*rules.settings.tickHz])) as Record<BuildKind,number>} as const;
// civs: each player's civilization; keptHousing: housing that destroyed houses leave behind (Mongol Nomads).
// settings: the lobby's match settings (packages/sim/settings.ts; the population ceiling).
export type BuildingState={settings?:{popCap:number;allTechs:boolean};map:MapData;units:Unit[];accounts:Account[];buildings:Building[];nextBuildingId:number;vision:{explored:number[]}[];ages:number[];civs?:string[];keptHousing?:number[]};
const overlap=(a:number[],b:number[])=>Math.min(a[2],b[2])-Math.max(a[0],b[0])>0&&Math.min(a[3],b[3])-Math.max(a[1],b[1])>0;
// Shared by the Worker (authoritative, full map) and the page (preview, only what the player knows).
// Walls are dragged as a line of one-tile segments; a gate (same material) can replace a segment of its owner's wall.
export const wallKinds=new Set<string>(['palisade-wall','stone-wall']);
export const wallGate:Record<string,string>={'palisade-gate':'palisade-wall',gate:'stone-wall'};
export const replacesWall=(kind:string,o:Obstacle,owner:number)=>wallGate[kind]===o.kind&&(o.red?1:0)===owner;
export function placementProblem(input:{tiles:Pick<Tile,'buildability'|'height'|'terrainType'>[];obstacles:Obstacle[];units:{x:number;y:number}[];explored:(tile:number)=>boolean},kind:BuildKind,x:number,y:number,owner?:number):string|null{
 if(!buildKinds.includes(kind))return '未知的建築種類';
 if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||x%buildingRules.grid||y%buildingRules.grid)return `位置必須對齊 ${buildingRules.grid} 單位格線`;
 const box=obstacleBounds({kind,x,y}),size=sizeOfTiles(input.tiles),world=size*100;
 if(box[0]<0||box[1]<0||box[2]>world||box[3]>world)return '超出地圖範圍';
 const tiles:number[]=[];for(let ty=Math.floor(box[1]/100);ty<=Math.floor((box[3]-1)/100);ty++)for(let tx=Math.floor(box[0]/100);tx<=Math.floor((box[2]-1)/100);tx++)tiles.push(ty*size+tx);
 if(tiles.some(t=>!input.explored(t)))return '尚未探索的區域不能建造';
 // On the water (the 建築 round, design_default): a dock stands wholly on water or shallows with at least one of its
 // tiles edge-to-edge with buildable land (villagers build it from that shore); a fish trap anywhere on the water.
 const wet=(t:number)=>input.tiles[t]?.terrainType==='water'||input.tiles[t]?.terrainType==='shallow';
 // The dock sits on whole water tiles (tile corners), so its builders always find the shore nodes next to it.
 if(kind==='dock'&&(x%100||y%100))return '碼頭必須對齊地圖格子';
 if(kind==='dock'||kind==='fish-trap'){if(tiles.some(t=>!wet(t)))return kind==='dock'?'碼頭必須蓋在岸邊的水面上':'魚網必須放在水面上';
  if(kind==='dock'&&!tiles.some(t=>{const tx=t%size,ty=Math.floor(t/size);return ([[1,0],[-1,0],[0,1],[0,-1]] as const).some(([dx,dy])=>{const nx=tx+dx,ny=ty+dy,n=ny*size+nx;return nx>=0&&ny>=0&&nx<size&&ny<size&&!tiles.includes(n)&&!!input.tiles[n]?.buildability;});}))return '碼頭必須緊鄰可建造的陸地';}
 else if(tiles.some(t=>!input.tiles[t]?.buildability))return '地形不可建造（水域、懸崖、坡道或淺灘）';
 if(new Set(tiles.map(t=>input.tiles[t].height)).size>1)return '地面高度不一致';
 // A farm has no blocking rectangle but still occupies its whole extent.
 // So does a fish trap (ships sail over it), and so do gates (their owner walks through): every walkable building.
 // A gate may take the place of its owner's wall of the same material (owner: the placing player; the wall goes).
 if(input.obstacles.some(o=>!(owner!==undefined&&replacesWall(kind,o,owner))&&(obstacleRects(o).length?obstacleRects(o):isBuilding(o)?[obstacleBounds(o)]:[]).some(r=>overlap(r,box))))return '與建築或資源重疊';
 // Inclusive, like navigation: a unit centre on the edge of the radius-expanded footprint counts as blocked.
// A farm is walkable: units standing there stay (a farmer reseeding stands on the old field).
 // So is a fish trap for ships.
 const r=navigationRules.radius;if(kind!=='farm'&&kind!=='fish-trap'&&input.units.some(u=>u.x>=box[0]-r&&u.x<=box[2]+r&&u.y>=box[1]-r&&u.y<=box[3]+r))return '有單位站在預定地上';
 return null;
}
export function authoritativeProblem(s:BuildingState,player:number,kind:BuildKind,x:number,y:number){
 const explored=new Set(s.vision[player].explored);
 // Units crossing an edge also occupy the node they are entering.
 const bodies=s.units.flatMap(u=>[{x:u.x,y:u.y},...(u.next===null?[]:[position(s.map,u.next)])]);
 const problem=placementProblem({tiles:s.map.tiles,obstacles:s.map.obstacles,units:bodies,explored:t=>explored.has(t)},kind,x,y,player);if(problem)return problem;
 // A relic lying on the ground keeps its spot free (relics are never buried under a building).
 const relics=(s as {relics?:{x:number;y:number;carrier:number|null;monastery:string|null}[]}).relics??[],[x0,y0,x1,y1]=obstacleBounds({kind,x,y});
 if(relics.some(r=>r.carrier===null&&r.monastery===null&&r.x>=x0-25&&r.x<=x1+25&&r.y>=y0-25&&r.y<=y1+25))return '聖物所在的位置不能建造';
 // Nor is a shoal of fish or a carcass (point resources without a footprint): a dock never buries the fish.
 return s.map.resources.some(r=>!r.obstacleId&&r.status==='available'&&r.x>x0&&r.x<x1&&r.y>y0&&r.y<y1)?'與資源重疊':null;
}
// A finished farm becomes a food source only its owner may work (resource id = farmResourceId).
export const farmResourceId=(buildingId:string)=>`resource-${buildingId}`;
// Its food: the base plus the owner's farming technologies at completion (Horse Collar, Heavy Plow, Crop Rotation).
// A fish trap opens the same way: its own food (no farming technologies), worked by its owner's fishing ships.
function openFarm(s:BuildingState,b:Building){const trap=b.kind==='fish-trap',capacity=trap?terrainRules.resourceCapacity['fish-trap']:farmFoodOf((s as {techs?:string[][]}).techs?.[b.player]??[],terrainRules.resourceCapacity.farm)+farmFoodBonus(ownerOf(s,b.player));s.map.resources.push({id:farmResourceId(b.id),kind:trap?'fish-trap':'farm',x:b.x,y:b.y,capacity,remaining:capacity,collectible:true,status:'available',obstacleId:b.id,depletedAt:null});s.map.tiles[tileAt(b.x,b.y,s.map.size)].resourceRefs.push(farmResourceId(b.id));}
// Removing a farm (destroyed, cancelled or worked out) closes its food source.
export function closeFarm(s:BuildingState,buildingId:string,tick:number){const r=s.map.resources.find(r=>r.id===farmResourceId(buildingId));if(!r||r.status==='depleted')return;r.collectible=false;r.status='depleted';r.obstacleId=null;r.depletedAt=tick;}
export function farmOwner(s:BuildingState,resourceId:string){return s.buildings.find(b=>farmResourceId(b.id)===resourceId)?.player??null;}
// Construction requirements from the rule data: an age, and finished buildings of the player's own (the archery
// range and the stable need a barracks). Shared by the Worker and the page, so both give the same reason.
// civ: the builder's civilization (the neutral one when absent); a building outside its tree is refused.
// techs: the builder's research (the bombard tower needs its University technology).
// nomadTownCenter: a nomad start's first town centre, which may go up in any age (aoetw.com buildings/Town_Center: on
// nomad maps the town centre can be placed anywhere before the Castle Age; nomadWaiver says when it applies).
export function buildRequirement(age:number,kind:string,own:readonly {kind:string;complete:boolean}[],civ:string=neutralCiv,techs:readonly string[]=[],allTechs=false,nomadTownCenter=false):string|null{
 const entry=rules.entries.find(e=>e.id===kind);if(!entry)return '未知的建築種類';
 if(!civAvailable(civ,kind,allTechs))return '此文明不能建造';
 for(const req of entry.requires){const need=rules.entries.find(e=>e.id===req),m=/^age-(\d)$/.exec(req);
  if(m&&age<Number(m[1])&&!(nomadTownCenter&&kind==='town-center'))return `需要${need?.name??req}`;
  if(!m&&need?.kind==='technology'&&!techs.includes(req))return `需要先研究「${need.name}」`;
  if(need?.kind==='building'&&!own.some(b=>b.kind===req&&b.complete))return `需要完工的${need.name}`;}
 return null;}
export const nomadWaiver=(map:{nomad?:boolean},own:readonly {kind:string}[])=>!!map.nomad&&!own.some(b=>b.kind==='town-center');
export function stageOf(b:Building){return b.complete?100:Math.min(80,Math.floor(b.work*5/b.required)*20);}
function obstacleOf(s:BuildingState,b:Building){return s.map.obstacles.find(o=>o.id===b.id);}
// Housing of a building for its owner (the Chinese town centre houses 10).
export const housingOf=(s:BuildingState,player:number,kind:BuildKind|'town-center')=>buildingRules.capacity[kind]+housingBonus(ownerOf(s,player),kind);
export function recomputeCapacity(s:BuildingState,player:number){
 const owner=ownerOf(s,player),housed=s.buildings.filter(b=>b.player===player&&b.complete).reduce((t,b)=>t+housingOf(s,player,b.kind),0)+(s.keptHousing?.[player]??0);
 s.accounts[player].populationCap=Math.min((s.settings?.popCap??rules.settings.populationCap)+popCapBonus(owner),housed);
}
// Every building the map starts with is a finished building of its owner: the town centres, and on the 地圖 round's
// special starts the prebuilt walls, towers, houses, barracks and farms (a farm opens its food at once).
export function initBuildings(s:BuildingState){
 for(const o of s.map.obstacles)if(isBuilding(o)){const p=o.red?1:0,kind=o.kind as BuildKind,hp=buildingHpOf(kind,ownerOf(s,p));const b:Building={id:o.id!,kind,player:p,x:o.x,y:o.y,work:0,required:0,complete:true,reservationId:null,queue:[],rally:null,hp,maxHp:hp};
  s.buildings.push(b);o.age=s.ages[p];if(kind==='farm')openFarm(s,b);}
 for(const p of [0,1])recomputeCapacity(s,p);
}
// Pays up front (reservation), places a blocking foundation and updates navigation. Throws before any change.
export function placeBuilding(s:BuildingState,player:number,kind:BuildKind,x:number,y:number,reservationId:string):Building{
 const owner=ownerOf(s,player),problem=authoritativeProblem(s,player,kind,x,y)??buildRequirement(s.ages[player],kind,s.buildings.filter(b=>b.player===player),owner.civ,owner.techs,!!owner.allTechs,nomadWaiver(s.map,s.buildings.filter(b=>b.player===player)));if(problem)throw Error(problem);
 reserve(s.accounts[player],reservationId,kind,costOf(kind,owner));
 // A gate takes the place of the owner's wall segments under it (no refund; a wall foundation's payment is kept).
 if(kind in wallGate){const box=obstacleBounds({kind,x,y});for(const w of s.buildings.filter(w=>w.player===player&&w.kind===wallGate[kind])){const o=obstacleOf(s,w);if(o&&overlap(obstacleBounds(o),box))removeBuilding(s,w);}}
 const b:Building={id:`building-${s.nextBuildingId++}`,kind,player,x,y,work:0,required:buildingRules.required[kind],complete:false,reservationId,queue:[],rally:null,hp:1,maxHp:buildingHpOf(kind,owner)};
 s.buildings.push(b);const o:Obstacle={id:b.id,kind,x,y,progress:0,age:s.ages[player],...(player?{red:true}:{})};s.map.obstacles.push(o);s.map.tiles[tileAt(x,y,s.map.size)].obstacleRefs.push(b.id);
 refreshNavigation(s.map,obstacleBounds(o,navigationRules.radius));return b;
}
// One tick of work by one builder. Returns true when this call completed the building.
// Treadmill Crane: a builder's tick is worth more; the hundredths carry over on the building (boost).
export function addWork(s:BuildingState,b:Building):boolean{
 if(b.complete)return false;const rate=buildRateBonus(ownerOf(s,b.player),b.kind);
 if(rate){b.boost=(b.boost??0)+rate;if(b.boost>=100&&b.work+1<b.required){b.boost-=100;if(addWork1(s,b))return true;}}
 return addWork1(s,b);
}
function addWork1(s:BuildingState,b:Building):boolean{
 b.work++;const o=obstacleOf(s,b)!;
 // Hit points follow the share of work done (damage taken meanwhile stays taken).
 const gained=Math.floor(b.work*b.maxHp/b.required)-Math.floor((b.work-1)*b.maxHp/b.required);b.hp=Math.min(b.maxHp,b.hp+gained);
 if(b.work>=b.required){b.complete=true;commitReservation(s.accounts[b.player],b.reservationId!);delete o.progress;recomputeCapacity(s,b.player);if(b.kind==='farm'||b.kind==='fish-trap')openFarm(s,b);return true;}
 o.progress=stageOf(b);return false;
}
// Takes a building off the map without refund (a wall segment a gate replaces): its foundation payment and queue are kept
// by nobody, as when it is destroyed.
export function removeBuilding(s:BuildingState,b:Building){
 const a=s.accounts[b.player];if(!b.complete&&b.reservationId)forfeitReservation(a,b.reservationId);for(const q of b.queue)forfeitReservation(a,q.reservationId);
 const o=obstacleOf(s,b);if(o){s.map.obstacles=s.map.obstacles.filter(v=>v!==o);for(const t of s.map.tiles)t.obstacleRefs=t.obstacleRefs.filter(r=>r!==b.id);}
 s.buildings=s.buildings.filter(v=>v!==b);if(o)refreshNavigation(s.map,obstacleBounds(o,navigationRules.radius));recomputeCapacity(s,b.player);
}
// The tiles of a dragged wall: one-tile segments on the straight (Bresenham) line from the start tile to the end tile,
// at most wallRules.maxSegments of them, as tile corners (the segments' x, y).
export const wallRules={provenance:'design_default',maxSegments:24,builderReach:300} as const;
export function wallLine(from:{x:number;y:number},to:{x:number;y:number}):{x:number;y:number}[]{
 let x=Math.floor(from.x/100),y=Math.floor(from.y/100);const x1=Math.floor(to.x/100),y1=Math.floor(to.y/100),dx=Math.abs(x1-x),dy=-Math.abs(y1-y),sx=x<x1?1:-1,sy=y<y1?1:-1;let err=dx+dy;
 const out:{x:number;y:number}[]=[];
 for(;;){out.push({x:x*100,y:y*100});if(out.length>=wallRules.maxSegments||x===x1&&y===y1)break;const e2=2*err;if(e2>=dy){err+=dy;x+=sx;}if(e2<=dx){err+=dx;y+=sy;}}
 return out;
}
// Why no segment of this wall can be placed (null when at least one can): the first segment's reason.
export function wallProblem(s:BuildingState,player:number,kind:BuildKind,from:{x:number;y:number},to:{x:number;y:number}):string|null{
 let first:string|null=null;for(const p of wallLine(from,to)){const why=authoritativeProblem(s,player,kind,p.x,p.y);if(!why)return null;first??=why;}return first;
}
// Places every segment that can stand (each paid on its own, in order from the start; once the money runs out the rest
// are skipped). Throws, changing nothing, when not one segment could be placed.
export function placeWall(s:BuildingState,player:number,kind:BuildKind,from:{x:number;y:number},to:{x:number;y:number},reservationId:string):Building[]{
 const out:Building[]=[];let first:Error|null=null;
 wallLine(from,to).forEach((p,i)=>{try{out.push(placeBuilding(s,player,kind,p.x,p.y,i?`${reservationId}:${i}`:reservationId));}catch(e){first??=e as Error;}});
 if(!out.length)throw first??Error('無法建造城牆');return out;
}
// Cancelling a foundation refunds the full reservation (economyRules.cancellationRefundPercent 100).
export function cancelBuilding(s:BuildingState,player:number,id:string){
 const b=s.buildings.find(b=>b.id===id);if(!b||b.player!==player)throw Error('找不到這棟己方建築');if(b.complete||!b.reservationId)throw Error('已完工的建築不能取消');
 cancelReservation(s.accounts[player],b.reservationId);
 const o=obstacleOf(s,b)!;s.map.obstacles=s.map.obstacles.filter(v=>v!==o);for(const t of s.map.tiles)t.obstacleRefs=t.obstacleRefs.filter(r=>r!==b.id);
 s.buildings=s.buildings.filter(v=>v!==b);refreshNavigation(s.map,obstacleBounds(o,navigationRules.radius));
}
