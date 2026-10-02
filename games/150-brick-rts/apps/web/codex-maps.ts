// The codex's 地圖 category (pure model; codex.ts renders it): aoetw.com's map list by expansion in the site's index
// order, each map with the site's description, whether this game plays it, and for a playable map what the real
// generator makes of it with one fixed seed (the preview and the resource counts come from the same generated map).
import {mapCatalog,mapExpansions} from '../../packages/content/maps.ts';
import type {MapCatalogEntry} from '../../packages/content/maps.ts';
import {mapStrategy,mapLaterReason,mapPlannedReason} from '../../packages/content/codex.ts';
import {playableLayout,layoutSummary} from './map-info.ts';
import type {MapSummary} from './map-info.ts';
import type {MapLayout} from '../../packages/sim/terrain.ts';
import type {MapData} from '../../packages/sim/navigation.ts';
import {rules} from '../../packages/content/rules.ts';
// The seed every 地圖 page generates with (the default match seed).
export const mapPageSeed=260925;
export type MapListItem={id:string;zh:string;en:string;expansion:string;expansionZh:string;playable:boolean;layout:MapLayout|null};
export type MapPage=MapListItem&{page:boolean;summary:string;strategy:string|null;reason:string|null;generated:{map:MapData;relics:readonly {x:number;y:number}[];summary:MapSummary}|null;failed:string|null;facts:{label:string;value:string}[]};
const expansionZh=(id:string)=>mapExpansions.find(x=>x.id===id)?.zh??id;
const idOf=(m:MapCatalogEntry)=>m.site??m.en.replace(/\s+/g,'_');
const item=(m:MapCatalogEntry):MapListItem=>({id:idOf(m),zh:m.zh,en:m.en,expansion:m.expansion,expansionZh:expansionZh(m.expansion),playable:!!playableLayout(m),layout:playableLayout(m)});
export const mapItems=():MapListItem[]=>mapCatalog.map(item);
// The list's groups: the site's six expansions, in its index order.
export const mapGroups=()=>mapExpansions.map(x=>({id:x.id,label:x.zh,items:mapItems().filter(m=>m.expansion===x.id)})).filter(g=>g.items.length);
const nameOf=(id:string)=>rules.entries.find(e=>e.id===id)?.name??id;
const countText=(r:Record<string,number>)=>Object.entries(r).map(([k,n])=>`${nameOf(k)} ${n}`).join('、');
// The facts table of a generated map: each base's kit (blue then red), the neutral resources, the rest.
export function mapFacts(s:MapSummary):{label:string;value:string}[]{
 const kit=(k:MapSummary['bases'][0])=>`綿羊 ${k.sheep}、野豬 ${k.boar}、鹿 ${k.deer}、漿果 ${k.berries} 叢、金礦 ${k.gold} 堆、石礦 ${k.stone} 堆${k.fish?`、魚群 ${k.fish}`:''}`;
 const n=s.neutral,neutral=[n.gold?`金礦 ${n.gold} 堆`:'',n.stone?`石礦 ${n.stone} 堆`:'',n.sheep?`綿羊 ${n.sheep}`:'',n.boar?`野豬 ${n.boar}`:'',n.deer?`鹿 ${n.deer}`:'',n.berries?`漿果 ${n.berries} 叢`:''].filter(Boolean).join('、')||'沒有';
 const out=[{label:'藍方基地',value:kit(s.bases[0])},{label:'紅方基地',value:kit(s.bases[1])},{label:'中立資源',value:neutral},
  {label:'魚群',value:s.fish?`共 ${s.fish} 群`:'沒有'},{label:'聖物',value:s.relics?`${s.relics} 個`:'沒有'},
  {label:'水域',value:s.water?`約 ${s.water}% 的地面是水或淺灘`:'沒有'}];
 if(s.ice)out.push({label:'冰面',value:`約 ${s.ice}% 的地面（可以走、不能蓋建築）`});
 if(s.wolves||s.jaguars)out.push({label:'猛獸',value:[s.wolves?`狼 ${s.wolves} 隻`:'',s.jaguars?`美洲豹 ${s.jaguars} 隻`:''].filter(Boolean).join('、')});
 // Special starts: no town centre, more than one, prebuilt buildings and walls.
 const start=[0,1].map(p=>[s.towncentres[p]===1?'':s.towncentres[p]===0?'沒有城鎮中心':`城鎮中心 ${s.towncentres[p]} 座`,`村民 ${s.villagers[p]} 名`,countText(s.prebuilt[p])].filter(Boolean).join('、'));
 out.push({label:'開局',value:start[0]===start[1]?`雙方各有：${start[0]}`:`藍方：${start[0]}；紅方：${start[1]}`});
 return out;}
const cache=new Map<string,MapPage>();
export function mapPage(id:string):MapPage|null{
 const hit=cache.get(id);if(hit)return hit;const m=mapCatalog.find(e=>idOf(e)===id);if(!m)return null;const base=item(m);
 // A generator that fails on this seed is reported on the page (its message), never left to break the book.
 let generated:MapPage['generated']=null,failed:string|null=null;
 if(base.layout)try{generated=layoutSummary(base.layout,mapPageSeed);}catch(e){failed=(e as Error).message;}
 const reason=base.playable?null:m.planned?mapPlannedReason:mapLaterReason;
 const page:MapPage={...base,page:m.page,summary:m.summary,strategy:mapStrategy[id]??null,reason,generated,failed,facts:generated?mapFacts(generated.summary):[]};
 cache.set(id,page);return page;}
// The overview's counts per expansion.
export const mapOverview=()=>mapGroups().map(g=>({...g,playable:g.items.filter(m=>m.playable).length}));
