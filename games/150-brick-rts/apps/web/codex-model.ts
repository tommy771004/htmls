// The encyclopedia's data model: pure (no DOM), so node tests import it. Prose comes from packages/content/codex.ts;
// every number from rules.ts, stats.ts and civ.ts, evaluated for the civilization being read.
import {civDefs,neutralCiv,deferredTechs,uniqueUnitOwner,civById} from '../../packages/content/civs.ts';
import type {CivDef,Omitted} from '../../packages/content/civs.ts';
import {rules,resources} from '../../packages/content/rules.ts';
import type {Resource} from '../../packages/content/rules.ts';
import {civProse,uniqueUnitText,referenceOnlyNames,classLabel,architectureLabel,codexIntro,unitsIntro,unitsNote,unitCategories,trashText,unitPendingReasons,aoetwUnitExtras,aoetwUnits,unitText,unitCounters,
 techsIntro,techsMissingText,techsNote,techBuildingText,techPendingReasons,techPendingKind,techPartials,aoetwTechs,techText,stepAliases} from '../../packages/content/codex.ts';
import type {AoetwUnit} from '../../packages/content/codex.ts';
import {statsOf,speedOf,lineUpgrades,blacksmith,religionBonus} from '../../packages/sim/stats.ts';
import {techEffects} from '../../packages/content/techs.ts';
import {techEffectText} from '../../packages/sim/tech.ts';
import {religionRules} from '../../packages/sim/religion.ts';
import {unitKinds} from '../../packages/sim/movement.ts';
import {isAnimal} from '../../packages/sim/fauna.ts';
import type {CombatUnitKind} from '../../packages/sim/stats.ts';
import {costOf,timeTicks,activeEffects,entryMatches,buildingMatches,civAvailable,producedAt,housingBonus,arrowsOf} from '../../packages/sim/civ.ts';
import {buildKinds,buildingRules} from '../../packages/sim/buildings.ts';
import {defenseRules,garrisonCapacity} from '../../packages/sim/defense.ts';
import {buildingHpOf,buildingTargetOf} from '../../packages/sim/stats.ts';
import {obstacleFootprints} from '../../packages/content/footprints.ts';
import {buildingsIntro,buildingsNote,buildingsMissingText,buildingGroups,buildingPendingReasons,aoetwBuildings,buildingText,buildingPartials} from '../../packages/content/codex.ts';
import type {Effect} from '../../packages/content/civs.ts';
import type {Owner} from '../../packages/sim/civ.ts';
export type Cost=Record<Resource,number>;
export type Role='self'|'rival'|'both'|null;
export type CivListItem={id:string;name:string;nameEn:string;type:string;architecture:string;group:string;role:Role};
// Mechanics beyond attack and armor: 0 / false when the unit has none (setup in ticks, distances in map units).
export type StatSheet={hp:number;damage:number;attack:'melee'|'pierce'|'none';range:number;armor:readonly [number,number];cooldown:number;speed:number;
 bonus:{vs:string;label:string;value:number}[];regen:number;extraShots:number;extraDamage:number;splash:number;
 minRange:number;blast:number;passThrough:number;buildingsOnly:boolean;selfDestruct:boolean;setup:number};
export type UnitCard={id:string;name:string;text:string;at:string;classes:string[];cost:Cost;seconds:number;stats:StatSheet;
 elite:{id:string;name:string;age:number;at:string;cost:Cost;seconds:number;stats:StatSheet}|null};
export type TechCard={id:string;name:string;nameEn:string;age:3|4;at:string;reference:string;implemented:boolean;reason:string|null;cost:Cost|null;seconds:number|null;
 effects:string[];partial:Omitted[]};
export type TreeGroup={building:string;name:string;entries:{id:string;name:string}[]};
export type CivDetail=CivListItem&{summary:string;strategy:string;bonuses:string[];team:string[];omitted:Omitted[];units:UnitCard[];techs:TechCard[];
 tree:TreeGroup[];later:{id:string;name:string}[];sources:string[]};
export {codexIntro};
const tick=rules.settings.tickHz;
const entryOf=(id:string)=>rules.entries.find(e=>e.id===id);
const nameOf=(id:string)=>entryOf(id)?.name??id;
// The building that offers an entry, and the age an entry requires (from its requires list).
const producerName=(id:string)=>{const b=rules.production[id];return b?nameOf(b):'';};
const ageOf=(id:string)=>Number(entryOf(id)?.requires.find(r=>r.startsWith('age-'))?.slice(4)??1);
const ageNames=['','第一時代','第二時代','第三時代','第四時代'];
export const ageName=(age:number)=>ageNames[age]??'';
// Settlers last: the reference civilizations first, in the order of their architecture groups.
export const codexCivs=():CivDef[]=>[...civDefs.filter(c=>c.id!==neutralCiv),...civDefs.filter(c=>c.id===neutralCiv)];
export function roleOf(id:string,civs:readonly string[]):Role{const self=civs[0]===id,rival=civs[1]===id;return self&&rival?'both':self?'self':rival?'rival':null;}
export function civList(civs:readonly string[]):CivListItem[]{
 return codexCivs().map(c=>({id:c.id,name:c.name,nameEn:c.nameEn,type:c.type,architecture:c.architecture,group:architectureLabel[c.architecture]??c.architecture,role:roleOf(c.id,civs)}));}
// A unit's sheet for one owner: the numbers the simulation uses (statsOf, speedOf), with its bonus classes named.
export function statSheet(kind:CombatUnitKind,o:Owner):StatSheet{
 const st=statsOf(kind,o);
 return {hp:st.hp,damage:st.damage,attack:st.attack,range:st.range,armor:st.armor,cooldown:st.cooldown,speed:speedOf(kind,o),
  bonus:Object.entries(st.bonus).map(([vs,value])=>({vs,label:classLabel[vs]??vs,value})),regen:st.regen??0,extraShots:st.extraShots??0,extraDamage:st.extraDamage??0,splash:st.splash??0,
  minRange:st.minRange??0,blast:st.blast??0,passThrough:st.passThrough??0,buildingsOnly:!!st.buildingsOnly,selfDestruct:!!st.selfDestruct,setup:st.setup??0};}
// Display helpers shared with the unit panel's conventions (main.ts): range in tiles of 100 units, armor melee/pierce.
export const rangeText=(range:number)=>range<=50?'近戰':`射程 ${range/100} 格`;
const trim=(n:number)=>String(Math.round(n*100)/100);
export const secondsText=(s:number)=>`${trim(s)} 秒`;
export const cooldownSeconds=(cooldown:number)=>cooldown/tick;
// Steps per tick → tiles per second.
export const tilesPerSecond=(speed:number)=>speed*tick/100;
export const numberText=trim;
// Training or research time at the entry's own building (the Longboat at the dock, the rest at the castle).
const seconds=(id:string,o:Owner)=>timeTicks(id,o,rules.production[id]??'castle')/tick;
// The reason a unique technology is missing, and reference parts of implemented ones that are not (both in omitted).
const deferredReason=(c:CivDef,name:string)=>c.omitted.find(o=>o.text.includes(`「${name}」`))?.reason??null;
const partialOf=(c:CivDef,name:string)=>c.omitted.filter(o=>!o.text.includes(`「${name}」`)&&o.text.startsWith(name));
export function civDetail(id:string,civs:readonly string[]=[]):CivDetail{
 const c=civById(id)??civById(neutralCiv)!,prose=civProse[c.id];
 const own=(age:number):Owner=>({civ:c.id,age,techs:[]});
 const utIds=new Set(c.uniqueTechs.map(t=>t.id));
 // Bonuses: effects of the civilization's unique technologies go on their cards; team bonuses (scope team) apart.
 const general=c.effects.filter(e=>!(e.trigger.tech&&utIds.has(e.trigger.tech)));
 const units:UnitCard[]=c.uniqueUnits.map(kind=>{const k=kind as CombatUnitKind,elite=c.eliteUpgrades.find(u=>u===`elite-${kind}`)??null,o3=own(3),o4:Owner={civ:c.id,age:4,techs:elite?[elite]:[]};
  return {id:kind,name:nameOf(kind),text:uniqueUnitText[kind]??'',at:producerName(kind),classes:statsOf(k,o3).classes.map(x=>classLabel[x]??x),cost:costOf(kind,o3),seconds:seconds(kind,o3),stats:statSheet(k,o3),
   elite:elite?{id:elite,name:nameOf(elite),age:ageOf(elite),at:producerName(elite),cost:costOf(elite,own(4)),seconds:seconds(elite,own(4)),stats:statSheet(k,o4)}:null};});
 const techs:TechCard[]=c.uniqueTechs.map(t=>{const implemented=!!entryOf(t.id)&&!deferredTechs.includes(t.id),o=own(t.age);
  return {id:t.id,name:t.name,nameEn:t.nameEn,age:t.age,at:producerName(t.id),reference:t.effectText,implemented,reason:implemented?null:deferredReason(c,t.name),
   cost:implemented?costOf(t.id,o):null,seconds:implemented?seconds(t.id,o):null,
   effects:c.effects.filter(e=>e.trigger.tech===t.id).map(e=>e.text.replace(`${t.name}：`,'')),partial:partialOf(c,t.name)};});
 const onCards=new Set(c.uniqueTechs.flatMap(t=>c.omitted.filter(o=>o.text.includes(`「${t.name}」`)||o.text.startsWith(t.name))));
 // What this civilization's tree lacks: its unavailable entries minus the other civilizations' unique content (every
 // civ lacks those), grouped by the building that offers them; buildings themselves under 建築.
 const civ=rules.civilizations.find(x=>x.id===c.id),groups=new Map<string,TreeGroup>();
 for(const eid of civ?.unavailable??[]){const owner=uniqueUnitOwner[eid];if(owner&&owner!==c.id)continue;const e=entryOf(eid);if(!e)continue;
  const at=e.kind==='building'?'':rules.production[eid]??'',key=at||'-';
  if(!groups.has(key))groups.set(key,{building:at,name:at?nameOf(at):'建築',entries:[]});groups.get(key)!.entries.push({id:eid,name:e.name});}
 const order=(g:TreeGroup)=>g.building?rules.entries.findIndex(e=>e.id===g.building):-1;
 return {id:c.id,name:c.name,nameEn:c.nameEn,type:c.type,architecture:c.architecture,group:architectureLabel[c.architecture]??c.architecture,role:roleOf(c.id,civs),
  summary:prose?.summary??'',strategy:prose?.strategy??'',
  bonuses:general.filter(e=>e.scope!=='team').map(e=>e.text),team:general.filter(e=>e.scope==='team').map(e=>e.text.replace(/^團隊加成：/,'')),
  omitted:c.omitted.filter(o=>!onCards.has(o)),units,techs,tree:[...groups.values()].sort((a,b)=>order(a)-order(b)),
  later:c.missingLater.map(x=>({id:x,name:referenceOnlyNames[x]??x})),sources:(prose?.sources??[]).map(p=>`aoetw.com/${p}`)};
}
export const costEntries=(cost:Cost)=>resources.filter(r=>cost[r]>0).map(r=>[r,cost[r]] as const);
// ── Category 單位 ───────────────────────────────────────────────────────────────────────────────────────────────────
// The book's categories, in aoetw.com's order; only the ones this game can show (no placeholder tabs).
export const codexSections=[{id:'civs',label:'文明'},{id:'units',label:'單位'},{id:'techs',label:'科技'},{id:'buildings',label:'建築'}] as const;
export type CodexSection=typeof codexSections[number]['id'];
export {unitsIntro,unitsNote,trashText};
export type UnitCategory={id:string;label:string;short:string;text:string};
// id: the step's unit (the site's page id); tech: the research that reaches it (the line's first unit: its own kind).
export type LineStep={id:string;tech:string;name:string;nameEn:string;refName:string|null;text:string;age:number;
 // How the step is reached: null for the line's first unit (trained), else the upgrade's research.
 research:{name:string;at:string;cost:Cost;seconds:number}|null;stats:StatSheet;lacks:string[]};
export type UnitLine={id:string;name:string;nameEn:string;text:string;categories:string[];primary:string;trash:boolean;producer:string;at:string;owner:string|null;
 classes:string[];train:{age:number;cost:Cost;seconds:number;population:number};steps:LineStep[];strong:string;weak:string;
 // Reference upgrades of this line the game does not have (Imperial Camel, Imperial Skirmisher).
 later:{id:string;name:string;nameEn:string;reason:string}[];sources:string[]};
export type PendingLine={id:string;name:string;nameEn:string;text:string;categories:string[];primary:string;trash:boolean;at:string;building:string|null;civ:string|null;reason:string;
 steps:{id:string;name:string;nameEn:string;text:string}[];sources:string[]};
export type UnitGroup={id:string;label:string;items:{id:string;name:string;pending:boolean;steps:number}[]};
export type UnitsOverview={intro:string;trash:string;categories:(UnitCategory&{lines:number;pending:number})[];lines:number;steps:number;pending:number;
 extras:{animals:number;heroes:number;editor:number}};
const catById=new Map(unitCategories.map(c=>[c.label,c.id]));
const refById=new Map(aoetwUnits.map(u=>[u.id,u]));
// The categories of a reference unit (its 垃圾兵 flag is a tag, not a category); units the site files under none: 其他.
const categoriesOf=(u:AoetwUnit|undefined)=>{const out=(u?.categories??[]).map(c=>catById.get(c)!).filter(Boolean);return out.length?out:['other'];};
// The category a unit is listed under: its civilization first, then the ones that keep a unit out of this game.
const primaryOf=(cats:readonly string[])=>['unique','naval','gunpowder'].find(c=>cats.includes(c))??cats[0];
// The earliest age an entry can be had: its own age requirement, its prerequisites' and its producer's.
export function minAge(id:string,path:readonly string[]=[]):number{
 const e=entryOf(id);if(!e||path.includes(id))return 1;let age=1;const next=[...path,id];
 for(const r of e.requires)age=Math.max(age,r.startsWith('age-')?Number(r.slice(4)):minAge(r,next));
 const p=rules.production[id];if(p)age=Math.max(age,minAge(p,next));return age;}
// This game's units as lines: every non-animal unit kind and its line upgrades, in research order.
export const unitLineKinds=():CombatUnitKind[]=>unitKinds.filter(k=>!isAnimal(k)) as CombatUnitKind[];
export const lineStepIds=(kind:string)=>[kind,...lineUpgrades.filter(u=>u.kind===kind).map(u=>u.id)];
// The unit a research makes of this line (War Galley makes fire ships of fire galleys, codex.ts stepAliases).
export const stepUnitId=(kind:string,tech:string)=>stepAliases[kind]?.[tech]??tech;
const inGame=()=>new Set(unitLineKinds().flatMap(k=>lineStepIds(k).map(t=>stepUnitId(k,t))));
// The owner a step's numbers are read for: the neutral civilization at the step's age with the line researched so far.
export const stepOwner=(kind:string,i:number):Owner=>{const ids=lineStepIds(kind);return {civ:neutralCiv,age:minAge(ids[i]),techs:ids.slice(1,i+1)};};
export const civsLacking=(id:string)=>rules.civilizations.filter(c=>c.unavailable.includes(id)).map(c=>c.id);
// A step is out of reach for a civilization that lacks its research or the line's first unit (the Vikings' fire ships).
export const stepLacking=(kind:string,tech:string)=>rules.civilizations.filter(c=>c.unavailable.includes(tech)||c.unavailable.includes(kind)).map(c=>c.id);
const gameCivNames=new Set(civDefs.map(c=>c.name));
export function pendingReason(u:AoetwUnit):string{
 if(u.civ&&!gameCivNames.has(u.civ))return unitPendingReasons.civ;
 return unitPendingReasons.expansion;}
const sourcesOf=(ids:readonly string[])=>ids.flatMap(id=>{const r=refById.get(id);return r?[`aoetw.com/units/${r.slug}`]:[];});
const refBuilding:Record<string,string>={'軍營':'barracks','射箭場':'archery-range','馬廄':'stable','攻城器製造所':'siege-workshop','城堡':'castle','修道院':'monastery','城鎮中心':'town-center'};
export function unitLine(kind:CombatUnitKind):UnitLine{
 const ids=lineStepIds(kind),base=refById.get(kind),cats=categoriesOf(base),producer=rules.production[kind]??'',o0=stepOwner(kind,0),game=inGame();
 const steps:LineStep[]=ids.map((tech,i)=>{const o=stepOwner(kind,i),id=stepUnitId(kind,tech),ref=refById.get(id),name=i?lineUpgrades.find(u=>u.id===tech&&u.kind===kind)!.name:nameOf(kind);
  const at=rules.production[tech]??'';
  return {id,tech,name,nameEn:ref?.nameEn??(id.startsWith('elite-')&&base?`Elite ${base.nameEn}`:id),refName:ref&&ref.name!==name?ref.name:null,text:i?unitText[id]??'':'',age:o.age,
   research:i?{name:nameOf(tech),at:nameOf(at),cost:costOf(tech,o),seconds:timeTicks(tech,o,at)/tick}:null,stats:statSheet(kind,o),lacks:stepLacking(kind,tech)};});
 const stepIds=steps.map(s=>s.id),later=aoetwUnits.filter(u=>u.from&&stepIds.includes(u.from)&&!game.has(u.id)).map(u=>({id:u.id,name:u.name,nameEn:u.nameEn,reason:pendingReason(u)}));
 return {id:kind,name:nameOf(kind),nameEn:base?.nameEn??kind,text:unitText[kind]??uniqueUnitText[kind]??'',categories:cats,primary:primaryOf(cats),
  trash:steps.some(s=>refById.get(s.id)?.trash),producer,at:nameOf(producer),owner:uniqueUnitOwner[kind]??null,
  classes:statsOf(kind,o0).classes.map(x=>classLabel[x]??x),
  train:{age:o0.age,cost:costOf(kind,o0),seconds:timeTicks(kind,o0,producer)/tick,population:entryOf(kind)?.population??1},steps,
  strong:unitCounters[kind]?.strong??'',weak:unitCounters[kind]?.weak??'',later,sources:sourcesOf(stepIds)};}
export const unitLines=():UnitLine[]=>unitLineKinds().map(unitLine);
// Reference units the game lacks, chained into their own lines (Galley → War Galley → Galleon), each with its reason.
export function pendingLines():PendingLine[]{
 const game=inGame(),pending=aoetwUnits.filter(u=>!game.has(u.id)),ids=new Set(pending.map(u=>u.id));
 return pending.filter(u=>!u.from||!ids.has(u.from)).map(root=>{const chain=[root];
  for(let next=pending.find(u=>u.from===root.id);next;next=pending.find(u=>u.from===chain.at(-1)!.id))chain.push(next);
  // The training building under this game's name when the game has it (軍營 is the 兵營 here), else the site's.
  const cats=[...new Set(chain.flatMap(u=>categoriesOf(u)))],building=refBuilding[root.at.split('／')[0]]??null;
  return {id:root.id,name:root.name,nameEn:root.nameEn,text:unitText[root.id]??'',categories:cats,primary:primaryOf(categoriesOf(root)),trash:chain.some(u=>u.trash),
   at:building?nameOf(building):root.at,building,civ:root.civ,reason:pendingReason(root),steps:chain.map(u=>({id:u.id,name:u.name,nameEn:u.nameEn,text:unitText[u.id]??''})),sources:sourcesOf(chain.map(u=>u.id))};});}
// The list: by the reference's categories (each line under its primary one) or by the building that trains it.
export function unitGroups(by:'category'|'building'):UnitGroup[]{
 const lines=unitLines(),pending=pendingLines();
 const item=(l:UnitLine|PendingLine,p:boolean)=>({id:l.id,name:l.name,pending:p,steps:l.steps.length});
 if(by==='category')return unitCategories.map(c=>({id:c.id,label:c.label,items:[...lines.filter(l=>l.primary===c.id).map(l=>item(l,false)),...pending.filter(l=>l.primary===c.id).map(l=>item(l,true))]})).filter(g=>g.items.length);
 const order=rules.entries.filter(e=>e.kind==='building').map(e=>e.id),groups=new Map<string,UnitGroup>();
 const add=(key:string,label:string,it:ReturnType<typeof item>)=>{if(!groups.has(key))groups.set(key,{id:key,label,items:[]});groups.get(key)!.items.push(it);};
 for(const b of order){for(const l of lines)if(l.producer===b)add(b,nameOf(b),item(l,false));for(const l of pending)if(l.building===b)add(b,nameOf(b),item(l,true));}
 for(const l of pending)if(!l.building)add(l.at,l.at,item(l,true));
 return [...groups.values()];}
export function unitsOverview():UnitsOverview{
 const lines=unitLines(),pending=pendingLines();
 return {intro:unitsIntro,trash:trashText,lines:lines.length,steps:lines.reduce((n,l)=>n+l.steps.length,0),pending:pending.reduce((n,l)=>n+l.steps.length,0),extras:{...aoetwUnitExtras},
  categories:unitCategories.map(c=>({...c,lines:lines.filter(l=>l.categories.includes(c.id)).length,pending:pending.filter(l=>l.categories.includes(c.id)).length}))};}
export const unitCategoryName=(id:string)=>unitCategories.find(c=>c.id===id)?.label??id;
export const civName=(id:string)=>civById(id)?.name??id;
// Display: a distance in map units as tiles (100 units each).
export const tilesText=(units:number)=>`${trim(units/100)} 格`;
// ── Category 科技 ───────────────────────────────────────────────────────────────────────────────────────────────────
export {techsIntro,techsNote};
const refTech=new Map(aoetwTechs.map(t=>[t.id,t]));
// The site's research buildings in its order, under this game's ids.
const siteBuildings:readonly [string,string][]=[['軍營','barracks'],['射箭場','archery-range'],['馬廄','stable'],['城鎮中心','town-center'],['修道院','monastery'],['市集','market'],
 ['城堡','castle'],['碼頭','dock'],['學院','university'],['兵工廠','blacksmith'],['採礦營地','mining-camp'],['伐木場','lumber-camp'],['磨坊','mill']];
const siteBuilding=new Map(siteBuildings);
const buildingLabel=(id:string)=>entryOf(id)?nameOf(id):siteBuildings.find(([,b])=>b===id)?.[0]??id;
const techSources=(id:string)=>{const p=refTech.get(id)?.page;return p?[`aoetw.com/${p}`]:[];};
// Technologies of the 科技 tab: every technology entry except the age-ups, the unit line upgrades (單位 tab: their
// numbers are the unit's) and the civilizations' Castle content (unique technologies, listed by civilization).
const lineIds=new Set(lineUpgrades.map(u=>u.id));
export const genericTechIds=()=>rules.entries.filter(e=>e.kind==='technology'&&!e.id.startsWith('age-')&&!lineIds.has(e.id)&&!uniqueUnitOwner[e.id]).map(e=>e.id);
export const lineUpgradeCount=()=>lineUpgrades.length;
const stripName=(text:string,name:string)=>text.startsWith(`${name}：`)?text.slice(name.length+1):text;
const labels=(ids:readonly string[])=>ids.map(x=>classLabel[x]??x).join('、');
// A blacksmith line as one sentence, from stats.ts's table (range in tiles of 100 units).
function blacksmithLine(b:typeof blacksmith[string]){
 const parts=[b.attack?`攻擊 +${b.attack}`:'',b.range?`射程 +${tilesText(b.range)}`:'',b.melee?`近戰護甲 +${b.melee}`:'',b.pierce?`遠程護甲 +${b.pierce}`:''].filter(Boolean);
 return `${labels(b.classes)}${b.exclude?.length?`（${labels(b.exclude)}除外）`:''}：${parts.join('、')}`;}
// Monastery technologies: what religion.ts does with them, with its numbers.
const rel=religionRules,secs=(ticks:number)=>trim(ticks/tick);
const religionLines:Record<string,()=>string>={
 redemption:()=>`僧侶可以站在建築旁轉化敵方建築（${rel.unconvertibleBuildings.map(nameOf).join('、')}除外），每座要 ${secs(rel.buildingTicks.min)}～${secs(rel.buildingTicks.max)} 秒`,
 atonement:()=>'僧侶可以轉化敵方僧侶',
 sanctity:()=>`僧侶生命 +${religionBonus.sanctityHp}`,
 heresy:()=>'被敵方轉化的己方單位改為死亡，對手得不到它',
 illumination:()=>`轉化後恢復信仰的速度加倍（原本 ${secs(rel.rechargeTicks)} 秒）`,
 'block-printing':()=>`轉化射程 +${tilesText(rel.printingRange)}（${tilesText(rel.convertRange)} → ${tilesText(rel.convertRange+rel.printingRange)}）`,
 theocracy:()=>'一群僧侶轉化成功後，只有出手的那一名需要恢復信仰',
 faith:()=>`敵方僧侶最早第 ${rel.faithAttempts.min} 次、最遲第 ${rel.faithAttempts.max} 次嘗試才能轉化己方單位（原本第 ${rel.attempts.min}～${rel.attempts.max} 次）`};
// What a generic technology does in this game: its Effect records (techs.ts), the economy table (tech.ts), the
// blacksmith table (stats.ts), the monastery rules (religion.ts), and the buildings it opens (the Bombard Tower).
export function techEffectLines(id:string):string[]{
 const name=nameOf(id),out=techEffects.filter(e=>e.trigger.tech===id).map(e=>stripName(e.text,name));
 if(techEffectText[id])out.push(techEffectText[id]);if(blacksmith[id])out.push(blacksmithLine(blacksmith[id]));if(religionLines[id])out.push(religionLines[id]());
 for(const b of rules.entries)if(b.kind==='building'&&b.requires.includes(id))out.push(`可以建造${b.name}`);
 return out;}
export type TechVariant={civ:string;cost:Cost;seconds:number;free:boolean;texts:string[]};
export type TechPage={id:string;name:string;nameEn:string;refName:string|null;text:string;building:string;at:string;age:number;cost:Cost;seconds:number;
 requires:{id:string;name:string}[];unlocks:{id:string;name:string}[];effects:string[];partial:string|null;
 // Civilization differences: effects this technology switches on for one civ, cheaper or faster research, free grants.
 civEffects:{civ:string;text:string}[];variants:TechVariant[];grants:{civ:string;text:string}[];lacks:string[];sources:string[]};
// Everything that must be researched or built first (deepest first), without ages and the building itself.
export function prereqChain(id:string):{id:string;name:string}[]{
 const out:string[]=[],producer=rules.production[id];
 const visit=(x:string,path:string[])=>{for(const q of entryOf(x)?.requires??[])if(!q.startsWith('age-')&&!path.includes(q)){visit(q,[...path,q]);if(!out.includes(q)&&q!==producer)out.push(q);}};
 visit(id,[id]);return out.map(x=>({id:x,name:nameOf(x)}));}
const neutralAt=(id:string):Owner=>({civ:neutralCiv,age:minAge(id),techs:[]});
// Cost and time for each civilization that has the technology, where they differ from the neutral civ's (read at the
// earliest age the technology can be researched), with the civilization effects that make the difference.
export function techVariants(id:string):TechVariant[]{
 const at=rules.production[id]??'',base=neutralAt(id),cost=costOf(id,base),time=timeTicks(id,base,at),out:TechVariant[]=[];
 for(const c of codexCivs()){if(c.id===neutralCiv||!civAvailable(c.id,id))continue;const o={...base,civ:c.id},cc=costOf(id,o),t=timeTicks(id,o,at);
  if(t===time&&resources.every(x=>cc[x]===cost[x]))continue;
  const texts=[...activeEffects(o,'cost'),...activeEffects(o,'costShift'),...activeEffects(o,'time')].filter(e=>entryMatches(e.select,id))
   .concat(activeEffects(o,'workRate').filter(e=>buildingMatches(e.select,at))).map(e=>e.text);
  out.push({civ:c.id,cost:cc,seconds:t/tick,free:!costEntries(cc).length&&!!costEntries(cost).length,texts});}
 return out;}
export function techPage(id:string):TechPage{
 const ref=refTech.get(id),name=nameOf(id),at=rules.production[id]??'',o=neutralAt(id);
 return {id,name,nameEn:ref?.nameEn??id,refName:ref&&ref.name!==name?ref.name:null,text:techText[id]??'',building:at,at:nameOf(at),age:o.age,
  cost:costOf(id,o),seconds:timeTicks(id,o,at)/tick,requires:prereqChain(id),unlocks:rules.entries.filter(e=>e.requires.includes(id)).map(e=>({id:e.id,name:e.name})),
  effects:techEffectLines(id),partial:techPartials[id]??null,
  civEffects:civDefs.flatMap(c=>c.effects.filter(e=>e.trigger.tech===id).map(e=>({civ:c.id,text:e.text}))),variants:techVariants(id),
  grants:civDefs.flatMap(c=>c.effects.filter(e=>e.kind==='grant'&&e.select.entries?.includes(id)).map(e=>({civ:c.id,text:e.text}))),
  lacks:civsLacking(id),sources:techSources(id)};}
export const techPages=():TechPage[]=>genericTechIds().map(techPage);
// Unique technologies, by civilization: the civ page's cards (cost for that civ, its effect texts, the reason when
// not implemented) with the site's text.
export type UniqueTechPage=TechCard&{civ:string;refName:string|null;text:string;sources:string[]};
export const uniqueTechPages=():UniqueTechPage[]=>codexCivs().flatMap(c=>civDetail(c.id).techs.map(t=>{const ref=refTech.get(t.id);
 return {...t,civ:c.id,refName:ref&&ref.name!==t.name?ref.name:null,text:techText[t.id]??'',sources:techSources(t.id)};}));
// aoetw technologies this game does not have (its age-ups are this game's 第二～第四時代 and are not listed).
export type PendingTech={id:string;name:string;nameEn:string;text:string;building:string;at:string;age:number;civ:string|null;unique:boolean;reason:string;sources:string[]};
export function pendingTechs():PendingTech[]{
 const game=new Set([...rules.entries.map(e=>e.id),...civDefs.flatMap(c=>c.uniqueTechs.map(t=>t.id))]);
 return aoetwTechs.filter(t=>t.kind!=='age'&&!game.has(t.id)).map(t=>{const building=siteBuilding.get(t.at)??'';
  return {id:t.id,name:t.name,nameEn:t.nameEn,text:techText[t.id]??'',building,at:buildingLabel(building),age:t.age,civ:t.civ,unique:t.kind==='unique',
   reason:t.kind==='unique'?techPendingReasons.civ:techPendingReasons[techPendingKind[t.id]]??'',sources:techSources(t.id)};});}
export type TechItem={id:string;name:string;sub:string;pending:boolean};
export type TechGroup={id:string;label:string;items:TechItem[]};
// The list: by research building (the site's order; unique technologies by civilization after) or by age.
export function techGroups(by:'building'|'age'):TechGroup[]{
 const gen=techPages(),uni=uniqueTechPages(),pend=pendingTechs();
 const g=(t:TechPage):TechItem=>({id:t.id,name:t.name,sub:by==='age'?t.at:ageName(t.age),pending:false});
 const u=(t:UniqueTechPage):TechItem=>({id:t.id,name:t.name,sub:by==='age'?civName(t.civ):ageName(t.age),pending:!t.implemented});
 const p=(t:PendingTech):TechItem=>({id:t.id,name:t.name,sub:t.civ??(by==='age'?t.at:ageName(t.age)),pending:true});
 let groups:TechGroup[];
 if(by==='age')groups=[1,2,3,4].map(a=>({id:`age-${a}`,label:ageName(a),items:[...gen.filter(t=>t.age===a).map(g),...uni.filter(t=>t.age===a).map(u),...pend.filter(t=>t.age===a).map(p)]}));
 else groups=[...siteBuildings.map(([,b])=>({id:b,label:buildingLabel(b),items:[...gen.filter(t=>t.building===b).map(g),...pend.filter(t=>!t.unique&&t.building===b).map(p)]})),
  ...codexCivs().filter(c=>c.uniqueTechs.length).map(c=>({id:`civ-${c.id}`,label:`${c.name}特殊科技`,items:uni.filter(t=>t.civ===c.id).map(u)})),
  {id:'civ-other',label:'其他文明的特殊科技',items:pend.filter(t=>t.unique).map(p)}];
 return groups.filter(x=>x.items.length);}
export type TechsOverview={intro:string;missing:string;generic:number;unique:number;deferred:number;pending:number;lineUpgrades:number;
 ages:{id:string;name:string;cost:Cost;seconds:number}[];buildings:{id:string;label:string;text:string;techs:number;pending:number}[]};
export function techsOverview():TechsOverview{
 const gen=techPages(),uni=uniqueTechPages(),pend=pendingTechs();
 return {intro:techsIntro,missing:techsMissingText,generic:gen.length,unique:uni.filter(t=>t.implemented).length,deferred:uni.filter(t=>!t.implemented).length,pending:pend.length,lineUpgrades:lineUpgrades.length,
  ages:['age-2','age-3','age-4'].map(id=>{const o=neutralAt(id);return {id,name:nameOf(id),cost:costOf(id,o),seconds:timeTicks(id,o,'town-center')/tick};}),
  buildings:siteBuildings.map(([,b])=>({id:b,label:buildingLabel(b),text:techBuildingText[b]??'',techs:gen.filter(t=>t.building===b).length+(b==='castle'?uni.filter(t=>t.implemented).length:0),
   pending:pend.filter(t=>t.building===b).length+(b==='castle'?uni.filter(t=>!t.implemented).length:0)}))};}
// ── Category 建築 ───────────────────────────────────────────────────────────────────────────────────────────────────
export {buildingsIntro,buildingsNote,buildingsMissingText};
const refBuildingById=new Map(aoetwBuildings.map(b=>[b.id,b]));
// Arrows a building shoots for one owner (defense.ts: the base volley, the civilization's and technologies' additions).
export type ArrowSheet={count:number;damage:number;range:number;cooldown:number;bonus:{vs:string;label:string;value:number}[]};
// A building's numbers for one owner, read the way the simulation reads them.
export type BuildingSheet={hp:number;armor:readonly [number,number];housing:number;garrison:number;arrows:ArrowSheet|null};
export function buildingSheet(kind:string,o:Owner):BuildingSheet{
 const def=defenseRules.arrows[kind] as {base:number;range:number;damage:number;cooldown:number;bonus?:Record<string,number>}|undefined;let arrows:ArrowSheet|null=null;
 if(def){const mod=arrowsOf(o,kind),bonus:Record<string,number>={...(def.bonus??{})};for(const [vs,v] of Object.entries(mod.bonus??{}))bonus[vs]=(bonus[vs]??0)+v;
  arrows={count:def.base+mod.extra,damage:def.damage+mod.damage,range:def.range+mod.range,cooldown:Math.max(1,Math.round(def.cooldown*mod.cooldown)),
   bonus:Object.entries(bonus).filter(([,v])=>v).map(([vs,value])=>({vs,label:classLabel[vs]??vs,value}))};}
 return {hp:buildingHpOf(kind,o),armor:buildingTargetOf(kind,o).armor,housing:(buildingRules.capacity as Record<string,number>)[kind]+housingBonus(o,kind),
  garrison:garrisonCapacity({civs:[o.civ],ages:[o.age],techs:[[...o.techs]]},{kind,player:0}),arrows};}
// Effect kinds that read a building kind (select.buildings, none = every building), and entry kinds (cost, time).
const buildingFxKinds=new Set(['buildingHp','housing','garrison','arrows','arrowDamage','arrowRange','arrowCooldown','garrisonArrows','buildingMeleeArmor','buildingPierceArmor','buildRate','garrisonHeal','workRate','keepHousing','arrowBonus','los']);
// Whether an effect changes this building: its numbers, its production, its sight or its price.
export function touchesBuilding(e:Effect,kind:string){
 if(e.kind==='cost'||e.kind==='costShift'||e.kind==='time')return entryMatches(e.select,kind);
 if(!buildingFxKinds.has(e.kind))return false;
 if(e.kind==='los')return !!e.select.buildings?.includes(kind);
 // Garrison healing and arrows from units inside mean nothing where nobody can go in; production pace nothing where nothing is made.
 if((e.kind==='garrisonHeal'||e.kind==='garrisonArrows')&&!defenseRules.capacity[kind])return false;
 if(e.kind==='workRate'&&!producedAt(kind,neutralOwner(1)).length)return false;
 if(e.kind==='workRate'&&!e.select.buildings)return false;
 return buildingMatches(e.select,kind);}
const neutralOwner=(age:number,techs:readonly string[]=[]):Owner=>({civ:neutralCiv,age,techs});
export type BuildingStep={id:string;name:string;nameEn:string;refName:string|null;text:string;age:number;at:string;cost:Cost;seconds:number;sheet:BuildingSheet};
export type BuildingVariant={civ:string;cost:Cost;sheet:BuildingSheet;texts:string[]};
export type BuildingPage={id:string;name:string;nameEn:string;refName:string|null;text:string;group:string;groupLabel:string;age:number;cost:Cost;seconds:number;
 builders:string;perSegment:boolean;footprint:{width:number;depth:number};sheet:BuildingSheet;requires:{id:string;name:string}[];
 trains:{id:string;name:string}[];researches:{id:string;name:string}[];
 // uniqueHere: it also trains or researches civilizations' unique content (the Castle; the dock's Longboat), listed by civ.
 uniqueHere:boolean;unique:{civ:string;names:string[]}[];steps:BuildingStep[];
 variants:BuildingVariant[];civEffects:{civ:string;text:string}[];techs:{id:string;name:string;texts:string[]}[];partial:string|null;lacks:string[];sources:string[]};
const groupLabel=(id:string)=>buildingGroups.find(g=>g.id===id)?.label??id;
// One builder's construction time in seconds (buildings.ts: one work point per builder and tick).
const buildSeconds=(kind:string)=>(buildingRules.required as Record<string,number>)[kind]/tick;
// The University technologies that upgrade this building, in research order (the site's guard-tower, keep, fortified-wall pages).
export const buildingUpgrades=(kind:string)=>aoetwBuildings.filter(b=>b.kind==='upgrade'&&b.of.includes(kind)&&entryOf(b.id)).map(b=>b.id);
const sameSheet=(a:BuildingSheet,b:BuildingSheet)=>JSON.stringify(a)===JSON.stringify(b);
const sameCost=(a:Cost,b:Cost)=>resources.every(r=>a[r]===b[r]);
export function buildingPage(kind:string):BuildingPage{
 const ref=refBuildingById.get(kind),name=nameOf(kind),age=minAge(kind),o=neutralOwner(age),f=obstacleFootprints[kind as keyof typeof obstacleFootprints];
 const made=producedAt(kind,o).filter(id=>entryOf(id)),plain=made.filter(id=>!uniqueUnitOwner[id]);
 // Upgrades accumulate: each step's numbers include the ones before it.
 const ups=buildingUpgrades(kind),steps=ups.map((id,i)=>{const r=refBuildingById.get(id),at=rules.production[id]??'',so=neutralOwner(Math.max(age,minAge(id)),ups.slice(0,i+1));
  return {id,name:nameOf(id),nameEn:r?.nameEn??id,refName:r&&r.name!==nameOf(id)?r.name:null,text:buildingText[id]??'',age:minAge(id),at:nameOf(at),
   cost:costOf(id,neutralOwner(minAge(id))),seconds:timeTicks(id,neutralOwner(minAge(id)),at)/tick,sheet:buildingSheet(kind,so)};});
 // Civilization differences at the building's earliest age (cost and numbers), with the effects that make them; the
 // effects that only start later (an age tier, a technology) are listed apart.
 const base=buildingSheet(kind,o),cost=costOf(kind,o),variants:BuildingVariant[]=[],later:{civ:string;text:string}[]=[];
 for(const c of codexCivs()){if(c.id===neutralCiv||!civAvailable(c.id,kind))continue;const fx=c.effects.filter(e=>touchesBuilding(e,kind));if(!fx.length)continue;
  const co:Owner={civ:c.id,age,techs:[]},now=new Set([...activeEffects(co,'cost'),...activeEffects(co,'costShift'),...activeEffects(co,'time'),...[...buildingFxKinds].flatMap(k=>activeEffects(co,k as Effect['kind']))].map(e=>e.id));
  const sheet=buildingSheet(kind,co),cc=costOf(kind,co),active=fx.filter(e=>now.has(e.id));
  if(!sameSheet(sheet,base)||!sameCost(cc,cost))variants.push({civ:c.id,cost:cc,sheet,texts:active.map(e=>e.text)});
  for(const e of fx)if(!active.includes(e)||!variants.some(v=>v.civ===c.id))later.push({civ:c.id,text:e.text});}
 const techIds=[...new Set(techEffects.filter(e=>touchesBuilding(e,kind)&&!ups.includes(e.trigger.tech!)).map(e=>e.trigger.tech!))];
 return {id:kind,name,nameEn:ref?.nameEn??kind,refName:ref&&ref.name!==name?ref.name:null,text:buildingText[kind]??'',group:ref?.group??'other',groupLabel:groupLabel(ref?.group??'other'),age,
  cost,seconds:buildSeconds(kind),builders:kind==='fish-trap'?'漁船':'村民',perSegment:kind==='palisade-wall'||kind==='stone-wall',
  footprint:{width:f.width/100,depth:f.depth/100},sheet:base,requires:prereqChain(kind),
  trains:plain.filter(id=>entryOf(id)!.kind==='unit').map(id=>({id,name:nameOf(id)})),researches:plain.filter(id=>entryOf(id)!.kind==='technology').map(id=>({id,name:nameOf(id)})),
  uniqueHere:made.length>plain.length,unique:codexCivs().map(c=>({civ:c.id,names:made.filter(id=>uniqueUnitOwner[id]===c.id).map(nameOf)})).filter(x=>x.names.length),steps,variants,civEffects:later,
  techs:techIds.map(id=>({id,name:nameOf(id),texts:techEffects.filter(e=>e.trigger.tech===id&&touchesBuilding(e,kind)).map(e=>stripName(e.text,nameOf(id)))})),
  partial:buildingPartials[kind]??null,lacks:civsLacking(kind),sources:[...[kind,...ups].flatMap(id=>{const r=refBuildingById.get(id);return r?[`aoetw.com/building/${r.slug}`]:[];})]};}
export const buildingPages=():BuildingPage[]=>buildKinds.map(buildingPage);
export type PendingBuilding={id:string;name:string;nameEn:string;text:string;group:string;age:number;civ:string|null;reason:string;sources:string[]};
// aoetw buildings this game does not have (the upgrade pages are steps of their building's card).
export const pendingBuildings=():PendingBuilding[]=>aoetwBuildings.filter(b=>b.kind==='other').map(b=>({id:b.id,name:b.name,nameEn:b.nameEn,text:buildingText[b.id]??'',group:b.group,age:b.age,civ:b.civ,
 reason:buildingPendingReasons.civ,sources:[`aoetw.com/building/${b.slug}`]}));
export type BuildingItem={id:string;name:string;sub:string;pending:boolean};
export type BuildingGroup={id:string;label:string;items:BuildingItem[]};
// The list: by the site's four groups or by the age a building can first be built (pending ones at the site's age).
export function buildingGroupsBy(by:'group'|'age'):BuildingGroup[]{
 const pages=buildingPages(),pend=pendingBuildings();
 const g=(b:BuildingPage):BuildingItem=>({id:b.id,name:b.name,sub:by==='age'?b.groupLabel:ageName(b.age),pending:false});
 const p=(b:PendingBuilding):BuildingItem=>({id:b.id,name:b.name,sub:b.civ??'',pending:true});
 const groups=by==='group'?buildingGroups.map(x=>({id:x.id,label:x.label,items:[...pages.filter(b=>b.group===x.id).map(g),...pend.filter(b=>b.group===x.id).map(p)]}))
  :[1,2,3,4].map(a=>({id:`age-${a}`,label:ageName(a),items:[...pages.filter(b=>b.age===a).map(g),...pend.filter(b=>b.age===a).map(p)]}));
 return groups.filter(x=>x.items.length);}
export type BuildingsOverview={intro:string;missing:string;buildings:number;upgrades:number;pending:number;groups:{id:string;label:string;text:string;buildings:number;pending:number}[]};
export function buildingsOverview():BuildingsOverview{
 const pages=buildingPages(),pend=pendingBuildings();
 return {intro:buildingsIntro,missing:buildingsMissingText,buildings:pages.length,upgrades:pages.reduce((n,b)=>n+b.steps.length,0),pending:pend.length,
  groups:buildingGroups.map(x=>({...x,buildings:pages.filter(b=>b.group===x.id).length,pending:pend.filter(b=>b.group===x.id).length}))};}
