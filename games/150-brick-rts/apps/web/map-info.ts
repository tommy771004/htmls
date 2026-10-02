// Which maps a match can be played on, grouped the way the lobby lists them, and what a generated map holds. Pure (no
// DOM): the lobby, the codex's 地圖 pages and the tests read the same answers. Every playable map comes from the
// catalogue (packages/content/maps.ts) through its layout, so a map that gains a layout (the special starts and the
// island maps) appears here, in the lobby and in the codex without further changes.
import {mapCatalog,mapExpansions} from '../../packages/content/maps.ts';
import type {MapCatalogEntry} from '../../packages/content/maps.ts';
import {mapSizes} from '../../packages/sim/terrain.ts';
import type {MapLayout} from '../../packages/sim/terrain.ts';
import {makeMap,buildingKinds} from '../../packages/sim/navigation.ts';
import type {MapData} from '../../packages/sim/navigation.ts';
import {placeRelics} from '../../packages/sim/religion.ts';
import {obstacleBounds} from '../../packages/content/footprints.ts';
import type {ObstacleKind} from '../../packages/content/footprints.ts';
// This game's own maps: the match maps that came before the 地圖 round, and the small practice grounds.
const ownMaps:{layout:MapLayout;zh:string;note:string}[]=[{layout:'open',zh:'曠野',note:'本作原本的對戰圖：隨機出生的開闊地，散落樹林與一個小池塘。'},
 {layout:'lakes',zh:'湖畔',note:'本作原本的對戰圖：中央一座大湖，深水魚只有漁船捕得到。'}];
const practiceMaps:{layout:MapLayout;zh:string;note:string}[]=[{layout:'meadow',zh:'草甸',note:'小型練習場，中間一條道路。'},
 {layout:'coast',zh:'海岸',note:'小型練習場，南邊是海。'},{layout:'acceptance',zh:'高地與淺灘',note:'小型練習場，有坡地與淺灘。'}];
// A catalogue entry is playable when its layout is a real generated layout of this game.
export const playableLayout=(m:MapCatalogEntry)=>m.layout!==null&&m.layout in mapSizes?m.layout as MapLayout:null;
// The first sentence of the site's description (the lobby shows one line); maps the site has no page for say so.
export const firstLine=(m:MapCatalogEntry)=>m.summary?m.summary.split('。')[0].replace(/^（[^）]*）/,'')+'。':'網站沒有這張地圖的頁面，本作照原版的樣子生成。';
export type MapChoice={layout:MapLayout;zh:string;note:string};
export type MapChoiceGroup={label:string;maps:MapChoice[]};
// The lobby's map select: the site's maps by expansion (only the playable ones), then this game's own and practice maps.
export function mapChoices():MapChoiceGroup[]{
 const out:MapChoiceGroup[]=[];
 for(const x of mapExpansions){const maps=mapCatalog.filter(m=>m.expansion===x.id&&playableLayout(m)).map(m=>({layout:playableLayout(m)!,zh:m.zh,note:firstLine(m)}));if(maps.length)out.push({label:x.zh,maps});}
 out.push({label:'本作地圖',maps:ownMaps},{label:'練習地圖',maps:practiceMaps});
 return out;}
export const allChoices=()=>mapChoices().flatMap(g=>g.maps);
export const mapName=(layout:MapLayout)=>allChoices().find(m=>m.layout===layout)?.zh??layout;
// Relics lie on every full-size match map (sim.ts createState); a start without town centres has none to space them from.
export function mapRelics(map:MapData,seed:number){if(map.size!==32)return [];try{return placeRelics(map,seed);}catch{return [];}}
// ── What a generated map holds ─────────────────────────────────────────────────────────────────────────────────────
export type BaseKit={sheep:number;boar:number;deer:number;berries:number;gold:number;stone:number;fish:number};
export type MapSummary={bases:[BaseKit,BaseKit];neutral:BaseKit;fish:number;relics:number;wolves:number;jaguars:number;water:number;ice:number;
 towncentres:[number,number];villagers:[number,number];prebuilt:[Record<string,number>,Record<string,number>]};
// A resource counts as a base's when it lies within this distance of the base's centre (the far sheep of the standard
// kit lie about 1050 out); a mine farther than mineReach must also lie nearer the base than the map's centre (Gold Rush's field and a central
// gold stay neutral). The generators mirror every placement round the map's centre, but snap the second town centre to
// its grid, so red's base is measured from the exact mirror of blue's: both bases then come out the same.
export const baseRadius=1300;
// A base's own mines lie within this distance of its centre whatever the map (the standard kit puts them about 550 out).
export const mineReach=720;
const empty=():BaseKit=>({sheep:0,boar:0,deer:0,berries:0,gold:0,stone:0,fish:0});
const kitKey:Record<string,keyof BaseKit>={gold:'gold',stone:'stone',berries:'berries',fish:'fish'};
export function summarizeMap(map:MapData,relics:readonly unknown[]):MapSummary{
 const centreOf=(o:{kind:string;x:number;y:number})=>{const b=obstacleBounds(o as {kind:ObstacleKind;x:number;y:number});return {x:(b[0]+b[2])/2,y:(b[1]+b[3])/2};};
 const tcs=[0,1].map(p=>map.obstacles.filter(o=>o.kind==='town-center'&&!!o.red===(p===1)));
 // A base is its first town centre, or (a start without one) its first villager.
 const found=[0,1].map(p=>tcs[p][0]?centreOf(tcs[p][0]):map.starts[p]?.[0]??{x:0,y:0}),W=map.size*100,b=found[0];
 // Red's centre: whichever mirror of blue's (half-turn, left-right, top-bottom) lies nearest where red really is.
 const mirrors=[{x:W-b.x,y:W-b.y},{x:W-b.x,y:b.y},{x:b.x,y:W-b.y}],red=mirrors.sort((p,q)=>Math.hypot(p.x-found[1].x,p.y-found[1].y)-Math.hypot(q.x-found[1].x,q.y-found[1].y))[0];
 const centres=Math.hypot(red.x-found[1].x,red.y-found[1].y)<=100?[b,red]:found;
 const bases:[BaseKit,BaseKit]=[empty(),empty()],neutral=empty();
 const mid=map.size*50;
 const where=(x:number,y:number,mine=false)=>{const d=centres.map(c=>Math.hypot(c.x-x,c.y-y)),p=d[0]<=d[1]?0:1;return d[p]<=baseRadius&&(!mine||d[p]<=mineReach||d[p]<Math.hypot(mid-x,mid-y))?bases[p]:neutral;};
 // A mine is measured from its footprint's centre (its position is the footprint's corner, which mirrors unevenly).
 for(const r of map.resources){const k=kitKey[r.kind];if(!k)continue;const o=r.obstacleId?map.obstacles.find(o=>o.id===r.obstacleId):null,c=o?centreOf(o):r;where(c.x,c.y,k==='gold'||k==='stone')[k]++;}
 let wolves=0,jaguars=0;
 for(const a of map.animals??[]){if(a.kind==='wolf'){wolves++;continue;}if(a.kind==='jaguar'){jaguars++;continue;}
  const kit=a.owner===0||a.owner===1?bases[a.owner]:where(a.x,a.y);if(a.kind==='sheep'||a.kind==='boar'||a.kind==='deer')kit[a.kind]++;}
 const prebuilt:[Record<string,number>,Record<string,number>]=[{},{}];
 for(const o of map.obstacles)if(buildingKinds.has(o.kind)&&o.kind!=='town-center'){const p=o.red?1:0;prebuilt[p][o.kind]=(prebuilt[p][o.kind]??0)+1;}
 const share=(types:string[])=>Math.round(map.tiles.filter(t=>types.includes(t.terrainType)).length*100/map.tiles.length);
 return {bases,neutral,fish:map.resources.filter(r=>r.kind==='fish').length,relics:relics.length,wolves,jaguars,water:share(['water','shallow']),ice:share(['ice']),
  towncentres:[tcs[0].length,tcs[1].length],villagers:[map.starts[0]?.length??0,map.starts[1]?.length??0],prebuilt};}
// The summary of a layout generated from a seed (the codex uses one fixed seed so the page is the same every time).
export function layoutSummary(layout:MapLayout,seed:number){const map=makeMap(seed,layout),relics=mapRelics(map,seed);return {map,relics,summary:summarizeMap(map,relics)};}
