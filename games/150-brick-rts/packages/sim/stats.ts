// Combat numbers (design_default engineering values, not reference-game data). Only the leaf tech.ts is imported: shared by
// movement (unit hp), buildings (structure hp) and combat. range/sight are in simulation units
// (Chebyshev distance to the target's centre, or to a building's footprint edge); cooldown in ticks.
import {villagerHpBonus} from './tech.ts';
import {asOwner,unitSum,unitProduct,unitBonuses,buildingHpScale} from './civ.ts';
import type {Owner} from './civ.ts';
// regen: hit points regained per minute; extraShots: arrows after the first each hit (extraDamage each); splash: damage
// to enemy units next to the target.
export type UnitStats={hp:number;damage:number;range:number;cooldown:number;sight:number;attack:'melee'|'pierce'|'none';armor:readonly [number,number];classes:readonly string[];bonus:Readonly<Record<string,number>>;regen?:number;extraShots?:number;extraDamage?:number;splash?:number};
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
  // Unique units (trained at the Castle): hit points, attack, armor and bonuses from aoetw.com's unit pages; range at
  // 50 units per tile over a 150 base (Longbowman 5 -> 300), melee cooldown = the reference's seconds x 10, ranged x 15.
  // Classes: 'unique' (the Samurai's bonus), 'gunpowder' (Turks), 'cavalry-archer' (Mongols); see docs/aoe2-rules-research.md.
  longbowman:{hp:35,damage:6,range:300,cooldown:30,sight:400,attack:'pierce',armor:[0,0],classes:['archer','unique'],bonus:{spear:2}},
  'woad-raider':{hp:65,damage:8,range:50,cooldown:20,sight:350,attack:'melee',armor:[0,1],classes:['infantry','unique'],bonus:{building:2}},
  // Its axes are thrown: a melee attack from 3 tiles.
  'throwing-axeman':{hp:60,damage:7,range:200,cooldown:20,sight:350,attack:'melee',armor:[0,0],classes:['infantry','unique'],bonus:{building:1}},
  huskarl:{hp:60,damage:10,range:50,cooldown:20,sight:350,attack:'melee',armor:[0,6],classes:['infantry','unique'],bonus:{building:2,archer:6}},
  'teutonic-knight':{hp:80,damage:12,range:50,cooldown:20,sight:350,attack:'melee',armor:[5,2],classes:['infantry','unique'],bonus:{building:4}},
  // Regains 20 hit points a minute (Berserkergang: 40).
  berserk:{hp:54,damage:9,range:50,cooldown:20,sight:350,attack:'melee',armor:[0,1],classes:['infantry','unique'],bonus:{building:2},regen:20},
  cataphract:{hp:110,damage:9,range:50,cooldown:18,sight:350,attack:'melee',armor:[2,1],classes:['cavalry','unique'],bonus:{infantry:9}},
  'war-elephant':{hp:450,damage:15,range:50,cooldown:20,sight:350,attack:'melee',armor:[1,2],classes:['cavalry','unique','elephant'],bonus:{building:7}},
  // A melee attack from 3 tiles, like the Throwing Axeman.
  mameluke:{hp:65,damage:8,range:200,cooldown:20,sight:350,attack:'melee',armor:[0,0],classes:['cavalry','unique'],bonus:{cavalry:9}},
  janissary:{hp:35,damage:17,range:450,cooldown:50,sight:450,attack:'pierce',armor:[1,0],classes:['archer','gunpowder','unique'],bonus:{siege:2}},
  // Fires three arrows a shot: the first at full attack, the other two at 3 each.
  'chu-ko-nu':{hp:45,damage:8,range:250,cooldown:55,sight:400,attack:'pierce',armor:[0,0],classes:['archer','unique'],bonus:{spear:2},extraShots:2,extraDamage:3},
  samurai:{hp:60,damage:8,range:50,cooldown:19,sight:350,attack:'melee',armor:[1,1],classes:['infantry','unique'],bonus:{building:2,unique:10}},
  mangudai:{hp:60,damage:6,range:250,cooldown:30,sight:400,attack:'pierce',armor:[0,0],classes:['archer','cavalry','cavalry-archer','unique'],bonus:{siege:3,spear:1}},
 } as Record<'villager'|'militia'|'archer'|'scout'|'monk'|'sheep'|'deer'|'boar'|'spearman'|'skirmisher'|'knight'|'ram'|'longbowman'|'woad-raider'|'throwing-axeman'|'huskarl'|'teutonic-knight'|'berserk'|'cataphract'|'war-elephant'|'mameluke'|'janissary'|'chu-ko-nu'|'samurai'|'mangudai',UnitStats>,
 // Structures shrug off arrows: [melee, pierce] armor of every building.
 buildingArmor:[0,2] as [number,number],
 buildings:{'town-center':400,house:150,barracks:300,farm:100,'lumber-camp':200,'mining-camp':200,mill:200,stable:300,'archery-range':300,monastery:350,blacksmith:300,'watch-tower':250,'siege-workshop':300,castle:800} as Record<string,number>,
 corpseTicks:40,hitFlashTicks:6,
 // Movement per tick.
 // Units always step at most this far and stop exactly on the next node, so any whole number works: a node takes
 // ceil(50/speed) ticks (a civilization's speed multiplier rounds to the nearest whole step).
 speed:{villager:5,militia:5,archer:5,scout:10,monk:5,sheep:5,deer:10,boar:5,spearman:5,skirmisher:5,knight:10,ram:2,
  longbowman:5,'woad-raider':7,'throwing-axeman':6,huskarl:6,'teutonic-knight':4,berserk:6,cataphract:10,'war-elephant':4,mameluke:10,janissary:5,'chu-ko-nu':5,samurai:6,mangudai:10},
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
 // Elite unique units (aoetw.com's elite columns; armor and bonus are whole fields, so each lists both).
 {id:'elite-longbowman',kind:'longbowman',name:'精銳長弓兵',set:{hp:40,damage:7,range:350,armor:[0,1]}},
 {id:'elite-woad-raider',kind:'woad-raider',name:'精銳菘藍武士',set:{hp:80,damage:13,bonus:{building:3}}},
 {id:'elite-throwing-axeman',kind:'throwing-axeman',name:'精銳擲斧兵',set:{hp:70,damage:8,range:250,armor:[1,0],bonus:{building:2}}},
 {id:'elite-huskarl',kind:'huskarl',name:'精銳哥德衛隊',set:{hp:70,damage:12,armor:[0,8],bonus:{building:3,archer:10}}},
 {id:'elite-teutonic-knight',kind:'teutonic-knight',name:'精銳條頓武士',set:{hp:100,damage:17,armor:[10,2]}},
 {id:'elite-berserk',kind:'berserk',name:'精銳狂戰士',set:{hp:62,damage:14,armor:[2,1],bonus:{building:3}}},
 {id:'elite-cataphract',kind:'cataphract',name:'精銳拜占庭聖騎兵',set:{hp:150,damage:12,cooldown:17,bonus:{infantry:12}}},
 {id:'elite-war-elephant',kind:'war-elephant',name:'精銳戰象',set:{hp:600,damage:20,armor:[1,3],bonus:{building:10}}},
 {id:'elite-mameluke',kind:'mameluke',name:'精銳阿拉伯奴隸兵',set:{hp:80,damage:10,armor:[1,0],bonus:{cavalry:12}}},
 {id:'elite-janissary',kind:'janissary',name:'精銳土耳其火槍兵',set:{hp:40,damage:22,armor:[2,0],bonus:{siege:3}}},
 {id:'elite-chu-ko-nu',kind:'chu-ko-nu',name:'精銳連弩兵',set:{hp:50,cooldown:58,extraShots:4}},
 {id:'elite-samurai',kind:'samurai',name:'精銳日本武士',set:{hp:80,damage:12,bonus:{building:3,unique:12}}},
 {id:'elite-mangudai',kind:'mangudai',name:'精銳蒙古突騎',set:{damage:8,armor:[1,0],bonus:{siege:5,spear:1}}},
];
// Blacksmith technologies: what they add to units of the given classes (attack, range, melee/pierce armor).
// exclude: classes a line skips entirely (gunpowder units take no arrow attack or range; horse archers take the
// archer lines, not the melee attack or barding lines, as in the reference).
export const blacksmith:Record<string,{classes:string[];exclude?:string[];attack?:number;range?:number;melee?:number;pierce?:number;melee_only?:boolean}>={
 forging:{classes:['infantry','cavalry'],exclude:['cavalry-archer'],attack:1},'iron-casting':{classes:['infantry','cavalry'],exclude:['cavalry-archer'],attack:1},'blast-furnace':{classes:['infantry','cavalry'],exclude:['cavalry-archer'],attack:2},
 'scale-mail-armor':{classes:['infantry'],melee:1,pierce:1},'chain-mail-armor':{classes:['infantry'],melee:1,pierce:1},'plate-mail-armor':{classes:['infantry'],melee:1,pierce:2},
 'scale-barding-armor':{classes:['cavalry'],exclude:['cavalry-archer'],melee:1,pierce:1},'chain-barding-armor':{classes:['cavalry'],exclude:['cavalry-archer'],melee:1,pierce:1},'plate-barding-armor':{classes:['cavalry'],exclude:['cavalry-archer'],melee:1,pierce:2},
 fletching:{classes:['archer'],exclude:['gunpowder'],attack:1,range:50},'bodkin-arrow':{classes:['archer'],exclude:['gunpowder'],attack:1,range:50},bracer:{classes:['archer'],exclude:['gunpowder'],attack:1,range:50},
 'padded-archer-armor':{classes:['archer'],melee:1,pierce:1},'leather-archer-armor':{classes:['archer'],melee:1,pierce:1},'ring-archer-armor':{classes:['archer'],melee:1,pierce:2},
};
// A unit's current numbers for its owner: base, then line upgrades, then blacksmith, then the civilization's effects and
// unique technologies (after the upgrades, whose whole-field sets would otherwise drop them), then health techs.
// A bare technology list stands for the neutral civilization.
export function statsOf(kind:CombatUnitKind,who:Owner|readonly string[]=[]):UnitStats{
 const o=asOwner(who),techs=o.techs;
 let st:UnitStats={...combatRules.units[kind]};
 for(const up of lineUpgrades)if(up.kind===kind&&techs.includes(up.id))st={...st,...up.set};
 let [m,p]=st.armor;
 for(const id of techs){const b=blacksmith[id];if(!b||!b.classes.some(c=>st.classes.includes(c)))continue;if(b.exclude?.some(c=>st.classes.includes(c)))continue;
  if(b.attack&&st.attack!=='none')st.damage+=b.attack;if(b.range&&st.range>50)st.range+=b.range;m+=b.melee??0;p+=b.pierce??0;}
 const cls=st.classes;
 if(st.attack!=='none')st.damage+=unitSum(o,'attack',kind,cls);
 if(st.range>50)st.range+=unitSum(o,'range',kind,cls);
 st.armor=[m+unitSum(o,'meleeArmor',kind,cls),p+unitSum(o,'pierceArmor',kind,cls)];
 const extra=unitBonuses(o,kind,cls);if(Object.keys(extra).length){const bonus={...st.bonus};for(const [c,v] of Object.entries(extra))bonus[c]=(bonus[c]??0)+v;st.bonus=bonus;}
 const pace=unitProduct(o,'cooldown',kind,cls);if(pace!==1)st.cooldown=Math.max(1,Math.round(st.cooldown*pace));
 for(const k of ['regen','extraShots','splash'] as const){const v=unitSum(o,k,kind,cls);if(v)st[k]=(st[k]??0)+v;}
 st.hp=Math.round(st.hp*unitProduct(o,'hp',kind,cls))+(kind==='monk'&&techs.includes('sanctity')?religionBonus.sanctityHp:0)+(kind==='villager'?villagerHpBonus(techs):0)+unitSum(o,'hp',kind,cls);
 return st;
}
// A unit's full health for its owner.
export function maxHpOf(kind:CombatUnitKind,who:Owner|readonly string[]){return statsOf(kind,who).hp;}
// Steps per tick for its owner (a speed multiplier rounds to a whole step, at least 1).
export function speedOf(kind:CombatUnitKind,who:Owner|readonly string[]=[]){const o=asOwner(who),base=combatRules.speed[kind];
 const scale=unitProduct(o,'speed',kind,combatRules.units[kind].classes);return scale===1?base:Math.max(1,Math.round(base*scale));}
// A building's full health for its owner (Byzantine age tiers, Persian town centres, the Great Wall).
export function buildingHpOf(kind:string,who:Owner|readonly string[]=[]){return Math.round((combatRules.buildings[kind]??0)*buildingHpScale(asOwner(who),kind));}
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
