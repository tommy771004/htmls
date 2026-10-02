// Evaluates the civilization effects of packages/content/civs.ts for one player (civ, age, research). Pure: shared by
// the sim, the AI and the page. Every rule that a civilization can change asks here; nothing branches on a civ name.
import {civDefs,neutralCiv} from '../content/civs.ts';
import {techEffects,ageEffects} from '../content/techs.ts';
import type {Effect,EffectKind,Selector,Resource} from '../content/civs.ts';
import {rules,resources,allTechCivilizations} from '../content/rules.ts';
// allTechs: the match's 所有科技 setting (availability only; bonuses are the civ's own).
export type Owner={civ:string;age:number;techs:readonly string[];allTechs?:boolean};
export const neutralOwner:Owner={civ:neutralCiv,age:1,techs:[]};
// The player's context from any state that carries civs, ages and techs (older fixtures carry only techs).
export function ownerOf(s:{civs?:readonly string[];ages?:readonly number[];techs?:readonly (readonly string[])[];settings?:{allTechs:boolean}},player:number):Owner{
 const o:Owner={civ:s.civs?.[player]??neutralCiv,age:s.ages?.[player]??1,techs:s.techs?.[player]??[]};if(s.settings?.allTechs)o.allTechs=true;return o;}
// A bare technology list (tests, older callers) means the neutral civilization in the Dark Age.
export const asOwner=(o:Owner|readonly string[]):Owner=>Array.isArray(o)?{civ:neutralCiv,age:1,techs:o as readonly string[]}:o as Owner;
const byCiv=new Map(civDefs.map(c=>[c.id,c.effects]));
export const civExists=(id:unknown)=>typeof id==='string'&&byCiv.has(id);
// Per kind: the effects of a civ plus the generic technologies, cached (activeEffects runs inside statsOf).
// Effects of this kind in force for the owner: its civ's, from their age and once their technology is researched.
const withTechs=new Map<string,Effect[]>();
// Generic technologies (packages/content/techs.ts) work the same way for every civilization.
export function activeEffects(o:Owner,kind:EffectKind):Effect[]{
 let list=withTechs.get(o.civ);if(!list){list=[...(byCiv.get(o.civ)??[]),...techEffects,...ageEffects];withTechs.set(o.civ,list);}
 return list.filter(e=>e.kind===kind&&(e.trigger.age===undefined||o.age>=e.trigger.age)&&(e.trigger.tech===undefined||o.techs.includes(e.trigger.tech)));}
export const valueOf=(e:Effect,o:Owner)=>typeof e.value==='number'?e.value:e.value[Math.min(3,Math.max(0,o.age-1))];
const hit=(list:readonly string[]|undefined,values:readonly string[])=>!!list&&values.some(v=>list.includes(v));
export function unitMatches(sel:Selector,kind:string,classes:readonly string[]){
 if(hit(sel.exclude,[kind,...classes]))return false;
 return hit(sel.kinds,[kind])||hit(sel.classes,classes);}
export function entryMatches(sel:Selector,entryId:string){
 if(sel.exclude?.includes(entryId))return false;
 const e=rules.entries.find(e=>e.id===entryId);
 return !!sel.entries?.includes(entryId)||!!e&&(sel.allUnits&&e.kind==='unit'||sel.allTechs&&e.kind==='technology');}
// No building list: every building.
export const buildingMatches=(sel:Selector,kind:string)=>!sel.buildings||sel.buildings.includes(kind);
const sum=(list:Effect[],o:Owner)=>list.reduce((t,e)=>t+valueOf(e,o),0);
const product=(list:Effect[],o:Owner)=>list.reduce((t,e)=>t*valueOf(e,o),1);
// Unit numbers: additive effects summed, multipliers multiplied (callers round).
export const unitSum=(o:Owner,kind:EffectKind,unit:string,classes:readonly string[],op:'add'|'mul'='add')=>sum(activeEffects(o,kind).filter(e=>e.op===op&&unitMatches(e.select,unit,classes)),o);
export const unitProduct=(o:Owner,kind:EffectKind,unit:string,classes:readonly string[])=>product(activeEffects(o,kind).filter(e=>e.op==='mul'&&unitMatches(e.select,unit,classes)),o);
// Bonus damage added per target class, then scaled per class (Siege Engineers against buildings).
export function unitBonuses(o:Owner,unit:string,classes:readonly string[]):Record<string,number>{
 const out:Record<string,number>={};for(const e of activeEffects(o,'bonus'))if(e.vs&&unitMatches(e.select,unit,classes)){const v=valueOf(e,o);if(v)out[e.vs]=(out[e.vs]??0)+v;}return out;}
export const bonusScales=(o:Owner,unit:string,classes:readonly string[])=>activeEffects(o,'bonusScale').filter(e=>e.vs&&unitMatches(e.select,unit,classes)).map(e=>({vs:e.vs!,scale:valueOf(e,o)}));
// What an entry costs this owner now (age tiers at the moment of queueing): multipliers per resource, then shifts
// (Kamandaran moves the gold onto wood). Whole units, never negative.
export function costOf(entryId:string,o:Owner):Record<Resource,number>{
 const e=rules.entries.find(e=>e.id===entryId);const cost={food:0,wood:0,gold:0,stone:0,...(e?.cost??{})} as Record<Resource,number>;
 for(const fx of activeEffects(o,'cost'))if(entryMatches(fx.select,entryId))for(const r of resources)if(!fx.resource||fx.resource===r)cost[r]=cost[r]*valueOf(fx,o);
 for(const r of resources)cost[r]=Math.max(0,Math.round(cost[r]));
 for(const fx of activeEffects(o,'costShift'))if(entryMatches(fx.select,entryId)&&fx.resource&&fx.to){cost[fx.to]+=cost[fx.resource];cost[fx.resource]=0;}
 return cost;}
// Work ticks for an item queued at this building: the entry's time, its time multipliers and the building's work rate.
export function timeTicks(entryId:string,o:Owner,building:string){
 const e=rules.entries.find(e=>e.id===entryId);if(!e)return 0;
 const scale=product(activeEffects(o,'time').filter(fx=>entryMatches(fx.select,entryId)),o),rate=sum(activeEffects(o,'workRate').filter(fx=>buildingMatches(fx.select,building)&&(!fx.select.allUnits||e.kind==='unit')),o);
 return Math.round(e.time*rules.settings.tickHz*scale*100/(100+rate));}
// The buildings that train or research an entry for this owner (Anarchy adds the barracks for the Huskarl).
export function producersOf(entryId:string,o:Owner):string[]{
 const base=rules.production[entryId];const out=base?[base]:[];
 for(const fx of activeEffects(o,'producer'))if(fx.select.entries?.includes(entryId))for(const b of fx.select.buildings??[])if(!out.includes(b))out.push(b);
 return out;}
// Entries a building offers this owner: its own production plus any extra producer effects.
export function producedAt(building:string,o:Owner):string[]{
 const out=Object.entries(rules.production).filter(([,b])=>b===building).map(([id])=>id);
 for(const fx of activeEffects(o,'producer'))if(fx.select.buildings?.includes(building))for(const id of fx.select.entries??[])if(!out.includes(id))out.push(id);
 return out;}
export const civAvailable=(civ:string,entryId:string,allTechs=false)=>{const list=allTechs?allTechCivilizations:rules.civilizations,c=list.find(c=>c.id===civ)??list.find(c=>c.id===neutralCiv)!;return c.available.includes(entryId);};
// The same for an owner (its match may have 所有科技 on).
export const ownerAvailable=(o:Owner,entryId:string)=>civAvailable(o.civ,entryId,!!o.allTechs);
// Economy.
// kind: the gatherer (an effect that names kinds, the fishing ships', applies to those only).
export const gatherBonus=(o:Owner,yieldKind:string,source:string,kind='villager')=>sum(activeEffects(o,'gather').filter(e=>(!e.select.kinds||e.select.kinds.includes(kind))&&(e.select.resources?.includes(yieldKind)||e.select.sources?.includes(source))),o);
export const carryBonus=(o:Owner,source:string)=>sum(activeEffects(o,'carry').filter(e=>e.select.sources?.includes(source)),o);
export const farmFoodBonus=(o:Owner)=>sum(activeEffects(o,'farmFood'),o);
export const huntDamageBonus=(o:Owner,prey:string)=>sum(activeEffects(o,'huntDamage').filter(e=>!e.select.prey||e.select.prey.includes(prey)),o);
// Buildings.
const buildingSum=(o:Owner,kind:EffectKind,building:string)=>sum(activeEffects(o,kind).filter(e=>buildingMatches(e.select,building)),o);
export const buildingHpScale=(o:Owner,building:string)=>product(activeEffects(o,'buildingHp').filter(e=>buildingMatches(e.select,building)),o);
export const housingBonus=(o:Owner,building:string)=>buildingSum(o,'housing',building);
export const garrisonBonus=(o:Owner,building:string)=>buildingSum(o,'garrison',building);
export const popCapBonus=(o:Owner)=>sum(activeEffects(o,'popCap'),o);
export const buildingArmorBonus=(o:Owner,building:string)=>[buildingSum(o,'buildingMeleeArmor',building),buildingSum(o,'buildingPierceArmor',building)] as const;
export const buildRateBonus=(o:Owner,building:string)=>buildingSum(o,'buildRate',building);
export const buildingClassArmorBonus=(o:Owner,building:string)=>buildingSum(o,'buildingClassArmor',building);
export const garrisonHealScale=(o:Owner,building:string)=>product(activeEffects(o,'garrisonHeal').filter(e=>buildingMatches(e.select,building)),o);
export const keepsHousing=(o:Owner,building:string)=>activeEffects(o,'keepHousing').some(e=>buildingMatches(e.select,building));
export function arrowsOf(o:Owner,building:string){
 return {extra:buildingSum(o,'arrows',building),damage:buildingSum(o,'arrowDamage',building),range:buildingSum(o,'arrowRange',building),
  cooldown:product(activeEffects(o,'arrowCooldown').filter(e=>buildingMatches(e.select,building)),o),
  garrisonClasses:activeEffects(o,'garrisonArrows').filter(e=>buildingMatches(e.select,building)).flatMap(e=>[...(e.select.classes??[])]),
  bonus:activeEffects(o,'arrowBonus').filter(e=>e.vs&&buildingMatches(e.select,building)).reduce((t,e)=>({...t,[e.vs!]:(t[e.vs!]??0)+valueOf(e,o)}),{} as Record<string,number>)};}
// The market: the fee in percent (30 by default; Guilds, the Saracens), never below 0.
export const marketFeeOf=(o:Owner,base:number)=>Math.max(0,base+sum(activeEffects(o,'marketFee'),o));
// Units a transport ship carries for this owner (Careening, Dry Dock, the Saracens).
export const transportCapacityOf=(o:Owner,base:number)=>base+sum(activeEffects(o,'transportCapacity').filter(e=>unitMatches(e.select,'transport-ship',['ship','transport'])),o);
// Sight radius added to a unit kind or a building kind.
export const losBonus=(o:Owner,kind:string,classes:readonly string[]=[])=>sum(activeEffects(o,'los').filter(e=>e.select.buildings?e.select.buildings.includes(kind):unitMatches(e.select,kind,classes)),o);
// Monks.
export const healRangeScale=(o:Owner)=>product(activeEffects(o,'healRange'),o);
export const healRateScale=(o:Owner)=>product(activeEffects(o,'healRate'),o);
export const conversionResist=(o:Owner)=>sum(activeEffects(o,'conversionResist'),o);
export const deathRefund=(o:Owner,unit:string,classes:readonly string[])=>sum(activeEffects(o,'deathRefund').filter(e=>unitMatches(e.select,unit,classes)),o);
// Start of the match.
export function startStock(o:Owner):Record<Resource,number>{const out={food:0,wood:0,gold:0,stone:0};for(const e of activeEffects(o,'startStock'))if(e.resource)out[e.resource]+=valueOf(e,o);return out;}
export const startVillagers=(o:Owner)=>sum(activeEffects(o,'startVillagers'),o);
// Technologies granted for free by now (Vikings: Wheelbarrow with the second age, Hand Cart with the third).
export const grantsOf=(o:Owner)=>activeEffects(o,'grant').flatMap(e=>[...(e.select.entries??[])]).filter(id=>!o.techs.includes(id));
// The 戰術技巧 round. Ballistics: this unit or building leads moving targets; accuracy: the sure-shot percent an effect
// gives against a standing target (Thumb Ring, Warwolf), 0 when none applies.
export const leadsUnit=(o:Owner,unit:string,classes:readonly string[])=>activeEffects(o,'lead').some(e=>!e.select.buildings&&unitMatches(e.select,unit,classes));
export const leadsBuilding=(o:Owner,building:string)=>activeEffects(o,'lead').some(e=>!!e.select.buildings&&e.select.buildings.includes(building));
export const steadyAccuracy=(o:Owner,unit:string,classes:readonly string[])=>Math.max(0,...activeEffects(o,'accuracy').filter(e=>unitMatches(e.select,unit,classes)).map(e=>valueOf(e,o)));
