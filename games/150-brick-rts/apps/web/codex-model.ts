// The encyclopedia's data model: pure (no DOM), so node tests import it. Prose comes from packages/content/codex.ts;
// every number from rules.ts, stats.ts and civ.ts, evaluated for the civilization being read.
import {civDefs,neutralCiv,deferredTechs,uniqueUnitOwner,civById} from '../../packages/content/civs.ts';
import type {CivDef,Omitted} from '../../packages/content/civs.ts';
import {rules,resources} from '../../packages/content/rules.ts';
import type {Resource} from '../../packages/content/rules.ts';
import {civProse,uniqueUnitText,referenceOnlyNames,classLabel,architectureLabel,codexIntro} from '../../packages/content/codex.ts';
import {statsOf,speedOf} from '../../packages/sim/stats.ts';
import type {CombatUnitKind} from '../../packages/sim/stats.ts';
import {costOf,timeTicks} from '../../packages/sim/civ.ts';
import type {Owner} from '../../packages/sim/civ.ts';
export type Cost=Record<Resource,number>;
export type Role='self'|'rival'|'both'|null;
export type CivListItem={id:string;name:string;nameEn:string;type:string;architecture:string;group:string;role:Role};
export type StatSheet={hp:number;damage:number;attack:'melee'|'pierce'|'none';range:number;armor:readonly [number,number];cooldown:number;speed:number;
 bonus:{vs:string;label:string;value:number}[];regen:number;extraShots:number;extraDamage:number;splash:number};
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
  bonus:Object.entries(st.bonus).map(([vs,value])=>({vs,label:classLabel[vs]??vs,value})),regen:st.regen??0,extraShots:st.extraShots??0,extraDamage:st.extraDamage??0,splash:st.splash??0};}
// Display helpers shared with the unit panel's conventions (main.ts): range in tiles of 100 units, armor melee/pierce.
export const rangeText=(range:number)=>range<=50?'近戰':`射程 ${range/100} 格`;
const trim=(n:number)=>String(Math.round(n*100)/100);
export const secondsText=(s:number)=>`${trim(s)} 秒`;
export const cooldownSeconds=(cooldown:number)=>cooldown/tick;
// Steps per tick → tiles per second.
export const tilesPerSecond=(speed:number)=>speed*tick/100;
export const numberText=trim;
const seconds=(id:string,o:Owner)=>timeTicks(id,o,'castle')/tick;
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
