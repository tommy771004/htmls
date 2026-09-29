// Combat numbers (design_default engineering values, not reference-game data). Only the leaf tech.ts is imported: shared by
// movement (unit hp), buildings (structure hp) and combat. range/sight are in simulation units
// (Chebyshev distance to the target's centre, or to a building's footprint edge); cooldown in ticks.
import {villagerHpBonus} from './tech.ts';
export type UnitStats={hp:number;damage:number;range:number;cooldown:number;sight:number;attack:'melee'|'pierce'|'none';armor:readonly [number,number];classes:readonly string[];bonus:Readonly<Record<string,number>>};
export const combatRules={provenance:'design_default',
 // attack: melee or pierce (arrows, javelins); armor: [melee, pierce], subtracted from that kind of attack; classes:
 // what bonus damage keys on; bonus: extra damage against a class. Final damage = max(1, attack - armor + bonuses).
 units:{
  villager:{hp:25,damage:1,range:50,cooldown:30,sight:0,attack:'melee',armor:[0,0],classes:['villager'],bonus:{}},
  militia:{hp:45,damage:6,range:50,cooldown:20,sight:350,attack:'melee',armor:[0,1],classes:['infantry'],bonus:{}},
  archer:{hp:30,damage:4,range:250,cooldown:30,sight:400,attack:'pierce',armor:[0,0],classes:['archer'],bonus:{spear:3}},
  // Scout: the reference's standard start includes one (research doc); these numbers are design_default.
  // sight here is the automatic-engage radius (vision is visionRules): 0 means the unit only fights when ordered.
  // The scout scouts; it attacks only on an explicit order.
  scout:{hp:45,damage:3,range:50,cooldown:40,sight:0,attack:'melee',armor:[0,2],classes:['cavalry'],bonus:{}},
  // Monk: hit points 30 as in the reference; no attack (converts and heals instead, see religion.ts).
  monk:{hp:30,damage:0,range:0,cooldown:0,sight:0,attack:'none',armor:[0,0],classes:['monk'],bonus:{}},
  // Animals (fauna.ts): sheep and deer never fight; a boar only strikes back at whoever hunts it.
  sheep:{hp:7,damage:0,range:0,cooldown:0,sight:0,attack:'none',armor:[0,0],classes:['animal'],bonus:{}},
  deer:{hp:5,damage:0,range:0,cooldown:0,sight:0,attack:'none',armor:[0,0],classes:['animal'],bonus:{}},
  boar:{hp:75,damage:8,range:50,cooldown:40,sight:0,attack:'melee',armor:[0,0],classes:['animal'],bonus:{}},
  // The counter units (after the reference's triangle): the spearman against cavalry, the skirmisher against archers,
  // the knight as heavy cavalry. Values design_default, in this game's scale.
  spearman:{hp:45,damage:4,range:50,cooldown:30,sight:350,attack:'melee',armor:[0,0],classes:['infantry','spear'],bonus:{cavalry:12}},
  skirmisher:{hp:30,damage:2,range:200,cooldown:30,sight:400,attack:'pierce',armor:[0,3],classes:['archer','skirmisher'],bonus:{archer:4,spear:3}},
  knight:{hp:100,damage:10,range:50,cooldown:18,sight:350,attack:'melee',armor:[2,2],classes:['cavalry'],bonus:{}},
  // Battering ram: strikes buildings only (+40 against them), all but immune to arrows, slow.
  ram:{hp:175,damage:2,range:50,cooldown:60,sight:0,attack:'melee',armor:[0,120],classes:['siege'],bonus:{building:40}},
 } as Record<'villager'|'militia'|'archer'|'scout'|'monk'|'sheep'|'deer'|'boar'|'spearman'|'skirmisher'|'knight'|'ram',UnitStats>,
 // Structures shrug off arrows: [melee, pierce] armor of every building.
 buildingArmor:[0,2] as [number,number],
 buildings:{'town-center':400,house:150,barracks:300,farm:100,'lumber-camp':200,'mining-camp':200,mill:200,stable:300,'archery-range':300,monastery:350,blacksmith:300,'watch-tower':250,'siege-workshop':300},
 corpseTicks:40,hitFlashTicks:6,
 // Movement per tick; every value divides the 50-unit node spacing, so a unit always lands exactly on its node.
 speed:{villager:5,militia:5,archer:5,scout:10,monk:5,sheep:5,deer:10,boar:5,spearman:5,skirmisher:5,knight:10,ram:2},
};
// Monastery technology effects that touch unit stats (reference values, see aoe2-rules-research.md).
export const religionBonus={sanctityHp:15} as const;
export type CombatUnitKind=keyof typeof combatRules.units;
// Unit-line upgrades (researched at the unit's own building): every unit of that kind, in the field or trained later,
// takes the new values and name. Listed in research order; a later one overrides an earlier one.
export const lineUpgrades:{id:string;kind:CombatUnitKind;name:string;set:Partial<UnitStats>}[]=[
 {id:'man-at-arms',kind:'militia',name:'重步兵',set:{hp:55,damage:8}},
 {id:'long-swordsman',kind:'militia',name:'長劍士',set:{hp:60,damage:9,armor:[1,1]}},
 {id:'pikeman',kind:'spearman',name:'長矛兵',set:{hp:55,bonus:{cavalry:18}}},
 {id:'crossbowman',kind:'archer',name:'弩手',set:{hp:35,damage:5,range:300}},
 {id:'elite-skirmisher',kind:'skirmisher',name:'精銳散兵',set:{hp:35,damage:3,armor:[0,4]}},
 {id:'light-cavalry',kind:'scout',name:'輕騎兵',set:{hp:60,damage:5}},
];
// Blacksmith technologies: what they add to units of the given classes (attack, range, melee/pierce armor).
export const blacksmith:Record<string,{classes:string[];attack?:number;range?:number;melee?:number;pierce?:number;melee_only?:boolean}>={
 forging:{classes:['infantry','cavalry'],attack:1},'iron-casting':{classes:['infantry','cavalry'],attack:1},'blast-furnace':{classes:['infantry','cavalry'],attack:2},
 'scale-mail-armor':{classes:['infantry'],melee:1,pierce:1},'chain-mail-armor':{classes:['infantry'],melee:1,pierce:1},'plate-mail-armor':{classes:['infantry'],melee:1,pierce:2},
 'scale-barding-armor':{classes:['cavalry'],melee:1,pierce:1},'chain-barding-armor':{classes:['cavalry'],melee:1,pierce:1},'plate-barding-armor':{classes:['cavalry'],melee:1,pierce:2},
 fletching:{classes:['archer'],attack:1,range:50},'bodkin-arrow':{classes:['archer'],attack:1,range:50},bracer:{classes:['archer'],attack:1,range:50},
 'padded-archer-armor':{classes:['archer'],melee:1,pierce:1},'leather-archer-armor':{classes:['archer'],melee:1,pierce:1},'ring-archer-armor':{classes:['archer'],melee:1,pierce:2},
};
// A unit's current numbers for its owner's research: base, then line upgrades, then blacksmith, then health techs.
export function statsOf(kind:CombatUnitKind,techs:readonly string[]=[]):UnitStats{
 let st:UnitStats={...combatRules.units[kind]};
 for(const up of lineUpgrades)if(up.kind===kind&&techs.includes(up.id))st={...st,...up.set};
 let [m,p]=st.armor;
 for(const id of techs){const b=blacksmith[id];if(!b||!b.classes.some(c=>st.classes.includes(c)))continue;
  if(b.attack&&st.attack!=='none')st.damage+=b.attack;if(b.range&&st.range>50)st.range+=b.range;m+=b.melee??0;p+=b.pierce??0;}
 st.armor=[m,p];
 st.hp+=(kind==='monk'&&techs.includes('sanctity')?religionBonus.sanctityHp:0)+(kind==='villager'?villagerHpBonus(techs):0);
 return st;
}
// A unit's full health for its owner's research.
export function maxHpOf(kind:CombatUnitKind,techs:readonly string[]){return statsOf(kind,techs).hp;}
// The name a unit goes by after its line upgrades (null: the base name).
export function lineName(kind:string,techs:readonly string[]){let name:string|null=null;for(const up of lineUpgrades)if(up.kind===kind&&techs.includes(up.id))name=up.name;return name;}
// Damage of one hit: attack minus the armor against that attack (melee or pierce), plus bonuses against the target's
// classes; never below 1.
export function hitDamage(attacker:UnitStats,target:{armor:readonly [number,number];classes:readonly string[]}){
 if(attacker.attack==='none')return 0;
 const armor=attacker.attack==='pierce'?target.armor[1]:target.armor[0],bonus=target.classes.reduce((t,c)=>t+(attacker.bonus[c]??0),0);
 return Math.max(1,attacker.damage-armor+bonus);
}
export const buildingTarget={armor:combatRules.buildingArmor as readonly [number,number],classes:['building'] as readonly string[]};
