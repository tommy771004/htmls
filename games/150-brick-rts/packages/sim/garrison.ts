// Units carried by units (the 遊戲元素 round): rams take infantry and foot archers aboard (aoetw.com units/Battering_Ram,
// Capped_Ram, Siege_Ram and elements/Garrison). They ride in the same store as a transport's passengers (naval.ts
// transports, keyed by the carrier's unit id); unlike a sunk transport, a ram that falls lets them out (combat.ts).
// Only infantry push: each one inside adds a tenth of the ram's base speed (the site's +0.05 on 0.5) and 3 attack against
// buildings (the site's +10, x0.32 like every building bonus here), up to a cap per line step (+40/+50/+60 there).
// Leaf module: stats only, so movement.ts and combat.ts can ask it.
import {combatRules} from './stats.ts';
import type {CombatUnitKind,UnitStats} from './stats.ts';
export const carrierRules={provenance:'aoetw.com (capacities, who boards, the per-infantry boosts); design_default for the conversions',
 ram:{capacity:{ram:4,'capped-ram':5,'siege-ram':6},speedPerInfantry:0.1,buildingPerInfantry:3,buildingCap:{ram:13,'capped-ram':16,'siege-ram':19}}} as const;
type Carrier={kind:string;id:number;player:number};
type Carrying={transports?:Record<number,{kind:string}[]>;techs?:readonly (readonly string[])[]};
const classesOf=(kind:string)=>kind in combatRules.units?combatRules.units[kind as CombatUnitKind].classes:[];
// Infantry and foot archers (no horse archers); never monks, villagers or the petard.
export const ridesRam=(kind:string)=>{const c=classesOf(kind);return c.includes('infantry')||c.includes('archer')&&!c.includes('cavalry')&&!c.includes('cavalry-archer');};
// The ram's line step for its owner's research (Capped Ram, Siege Ram).
export const ramStep=(techs:readonly string[]=[])=>techs.includes('siege-ram')?'siege-ram':techs.includes('capped-ram')?'capped-ram':'ram';
export const ramCapacity=(s:Carrying,player:number)=>carrierRules.ram.capacity[ramStep(s.techs?.[player])];
const infantryIn=(s:Carrying,id:number)=>(s.transports?.[id]??[]).filter(u=>classesOf(u.kind).includes('infantry')).length;
// Speed multiplier of a unit for what it carries (1 for everything but a ram with infantry inside).
export const carriedSpeedScale=(s:object,u:Carrier)=>u.kind==='ram'?1+carrierRules.ram.speedPerInfantry*infantryIn(s as Carrying,u.id):1;
// A ram's numbers with the infantry inside: more attack against buildings, capped by its line step.
export function withCarried(state:object,u:Carrier,st:UnitStats):UnitStats{
 const s=state as Carrying;if(u.kind!=='ram')return st;const n=infantryIn(s,u.id);if(!n)return st;
 const extra=Math.min(carrierRules.ram.buildingCap[ramStep(s.techs?.[u.player])],carrierRules.ram.buildingPerInfantry*n);
 return {...st,bonus:{...st.bonus,building:(st.bonus.building??0)+extra}};
}
