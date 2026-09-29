// Economic technology effects (no imports: shared by the sim, the AI and the page). Costs and ages live in
// packages/content/rules.ts. Effects follow the reference where recorded in docs/aoe2-rules-research.md; the carry
// steps are rounded to whole units, and the reference's +10% villager speed is left out (speeds must divide the
// 50-unit node spacing). Every effect applies from the tick the research completes, to work already under way.
export const techRules={provenance:'reference effects (aoe2-rules-research.md); carry rounding design_default',
 // Gather rate in percent of the base rate, per yield: each researched entry adds its share.
 gather:{wood:{'double-bit-axe':20,'bow-saw':20,'two-man-saw':10},gold:{'gold-mining':15,'gold-shaft-mining':15},stone:{'stone-mining':15,'stone-shaft-mining':15},food:{}} as Record<string,Record<string,number>>,
 // Villager carry capacity: base economyRules.carryCapacity (10), 12 with Wheelbarrow, 15 with Hand Cart as well;
 // Heavy Plow adds 1 for farmers.
 carry:{wheelbarrow:2,'hand-cart':3} as Record<string,number>,farmerCarry:{'heavy-plow':1} as Record<string,number>,
 // Food in each farm built (or reseeded) after the research.
 farmFood:{'horse-collar':75,'heavy-plow':125,'crop-rotation':175} as Record<string,number>,
 // Villager hit points (Loom).
 villagerHp:{loom:15} as Record<string,number>,
} as const;
const sum=(table:Record<string,number>,techs:readonly string[])=>techs.reduce((t,id)=>t+(table[id]??0),0);
export const gatherRate=(techs:readonly string[],resource:string)=>100+sum(techRules.gather[resource]??{},techs);
export const carryOf=(techs:readonly string[],base:number,farming=false)=>base+sum(techRules.carry,techs)+(farming?sum(techRules.farmerCarry,techs):0);
export const farmFoodOf=(techs:readonly string[],base:number)=>base+sum(techRules.farmFood,techs);
export const villagerHpBonus=(techs:readonly string[])=>sum(techRules.villagerHp,techs);
// What each economic technology does, for the page's tile card.
export const techEffectText:Record<string,string>={loom:'村民生命 +15','wheelbarrow':'村民攜帶量 10 → 12','hand-cart':'村民攜帶量再 +3（共 15）',
 'double-bit-axe':'伐木速度 +20%','bow-saw':'伐木速度再 +20%','two-man-saw':'伐木速度再 +10%','gold-mining':'採金速度 +15%','gold-shaft-mining':'採金速度再 +15%',
 'stone-mining':'採石速度 +15%','stone-shaft-mining':'採石速度再 +15%','horse-collar':'之後建的農田食物 +75','heavy-plow':'之後建的農田食物 +125；農夫攜帶量 +1','crop-rotation':'之後建的農田食物 +175'};
