import {obstacleBounds,obstacleRects} from '../content/footprints.ts';
import {rules} from '../content/rules.ts';
import {reserve,cancelReservation,commitReservation} from './economy.ts';
import type {Account} from './economy.ts';
import {refreshNavigation,navigationRules} from './navigation.ts';
import type {MapData,Obstacle} from './navigation.ts';
import type {Unit} from './movement.ts';
import {tileAt} from './terrain.ts';
import type {Tile} from './terrain.ts';
// Player buildings (design_default engineering rules, not reference-game values).
export type BuildKind='house'|'barracks';
export const buildKinds:readonly BuildKind[]=['house','barracks'];
// queue: production/research in order (only the first advances); rally: where finished units walk.
export type QueueItem={id:number;entryId:string;reservationId:string;work:number;required:number};
export type Building={id:string;kind:BuildKind|'town-center';player:number;x:number;y:number;work:number;required:number;complete:boolean;reservationId:string|null;queue:QueueItem[];rally:{x:number;y:number}|null};
// capacity: population housed when complete (hard cap rules.settings.populationCap). One builder adds one
// work point per tick; required = entry time (s) x tick rate. Positions snap to the 50-unit grid.
export const buildingRules={provenance:'design_default',capacity:{'town-center':5,house:5,barracks:0},grid:50,
 required:Object.fromEntries(buildKinds.map(k=>[k,rules.entries.find(e=>e.id===k)!.time*rules.settings.tickHz])) as Record<BuildKind,number>} as const;
export type BuildingState={map:MapData;units:Unit[];accounts:Account[];buildings:Building[];nextBuildingId:number;vision:{explored:number[]}[];ages:number[]};
const overlap=(a:number[],b:number[])=>Math.min(a[2],b[2])-Math.max(a[0],b[0])>0&&Math.min(a[3],b[3])-Math.max(a[1],b[1])>0;
// Shared by the Worker (authoritative, full map) and the page (preview, only what the player knows).
export function placementProblem(input:{tiles:Pick<Tile,'buildability'|'height'>[];obstacles:Obstacle[];units:{x:number;y:number}[];explored:(tile:number)=>boolean},kind:BuildKind,x:number,y:number):string|null{
 if(!buildKinds.includes(kind))return '未知的建築種類';
 if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||x%buildingRules.grid||y%buildingRules.grid)return '位置必須對齊 50 單位格線';
 const box=obstacleBounds({kind,x,y});
 if(box[0]<0||box[1]<0||box[2]>1600||box[3]>1600)return '超出地圖範圍';
 const tiles:number[]=[];for(let ty=Math.floor(box[1]/100);ty<=Math.floor((box[3]-1)/100);ty++)for(let tx=Math.floor(box[0]/100);tx<=Math.floor((box[2]-1)/100);tx++)tiles.push(ty*16+tx);
 if(tiles.some(t=>!input.explored(t)))return '尚未探索的區域不能建造';
 if(tiles.some(t=>!input.tiles[t]?.buildability))return '地形不可建造（水域、懸崖、坡道或淺灘）';
 if(new Set(tiles.map(t=>input.tiles[t].height)).size>1)return '地面高度不一致';
 if(input.obstacles.some(o=>obstacleRects(o).some(r=>overlap(r,box))))return '與建築或資源重疊';
 const r=navigationRules.radius;if(input.units.some(u=>overlap([u.x-r,u.y-r,u.x+r,u.y+r],box)))return '有單位站在預定地上';
 return null;
}
export function authoritativeProblem(s:BuildingState,player:number,kind:BuildKind,x:number,y:number){
 const explored=new Set(s.vision[player].explored);
 // Units crossing an edge also occupy the node they are entering.
 const bodies=s.units.flatMap(u=>[{x:u.x,y:u.y},...(u.next===null?[]:[{x:50+(u.next%31)*50,y:50+Math.floor(u.next/31)*50}])]);
 return placementProblem({tiles:s.map.tiles,obstacles:s.map.obstacles,units:bodies,explored:t=>explored.has(t)},kind,x,y);
}
export function stageOf(b:Building){return b.complete?100:Math.min(80,Math.floor(b.work*5/b.required)*20);}
function obstacleOf(s:BuildingState,b:Building){return s.map.obstacles.find(o=>o.id===b.id);}
function recomputeCapacity(s:BuildingState,player:number){
 const housed=s.buildings.filter(b=>b.player===player&&b.complete).reduce((t,b)=>t+buildingRules.capacity[b.kind],0);
 s.accounts[player].populationCap=Math.min(rules.settings.populationCap,housed);
}
export function initBuildings(s:BuildingState){
 for(const o of s.map.obstacles)if(o.kind==='town-center'){s.buildings.push({id:o.id!,kind:'town-center',player:o.red?1:0,x:o.x,y:o.y,work:0,required:0,complete:true,reservationId:null,queue:[],rally:null});o.age=s.ages[o.red?1:0];}
 for(const p of [0,1])recomputeCapacity(s,p);
}
// Pays up front (reservation), places a blocking foundation and updates navigation. Throws before any change.
export function placeBuilding(s:BuildingState,player:number,kind:BuildKind,x:number,y:number,reservationId:string):Building{
 const problem=authoritativeProblem(s,player,kind,x,y);if(problem)throw Error(problem);
 reserve(s.accounts[player],reservationId,kind);
 const b:Building={id:`building-${s.nextBuildingId++}`,kind,player,x,y,work:0,required:buildingRules.required[kind],complete:false,reservationId,queue:[],rally:null};
 s.buildings.push(b);const o:Obstacle={id:b.id,kind,x,y,progress:0,age:s.ages[player],...(player?{red:true}:{})};s.map.obstacles.push(o);s.map.tiles[tileAt(x,y)].obstacleRefs.push(b.id);
 refreshNavigation(s.map,obstacleBounds(o,navigationRules.radius));return b;
}
// One tick of work by one builder. Returns true when this call completed the building.
export function addWork(s:BuildingState,b:Building):boolean{
 if(b.complete)return false;b.work++;const o=obstacleOf(s,b)!;
 if(b.work>=b.required){b.complete=true;commitReservation(s.accounts[b.player],b.reservationId!);delete o.progress;recomputeCapacity(s,b.player);return true;}
 o.progress=stageOf(b);return false;
}
// Cancelling a foundation refunds the full reservation (economyRules.cancellationRefundPercent 100).
export function cancelBuilding(s:BuildingState,player:number,id:string){
 const b=s.buildings.find(b=>b.id===id);if(!b||b.player!==player)throw Error('找不到這棟己方建築');if(b.complete||!b.reservationId)throw Error('已完工的建築不能取消');
 cancelReservation(s.accounts[player],b.reservationId);
 const o=obstacleOf(s,b)!;s.map.obstacles=s.map.obstacles.filter(v=>v!==o);for(const t of s.map.tiles)t.obstacleRefs=t.obstacleRefs.filter(r=>r!==b.id);
 s.buildings=s.buildings.filter(v=>v!==b);refreshNavigation(s.map,obstacleBounds(o,navigationRules.radius));
}
