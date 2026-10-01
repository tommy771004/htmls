// Combat numbers (design_default engineering values, not reference-game data). Only the leaf tech.ts is imported: shared by
// movement (unit hp), buildings (structure hp) and combat. range/sight are in simulation units
// (Chebyshev distance to the target's centre, or to a building's footprint edge); cooldown in ticks.
import {villagerHpBonus} from './tech.ts';
import {asOwner,unitSum,unitProduct,unitBonuses,bonusScales,buildingHpScale,buildingArmorBonus} from './civ.ts';
import type {Owner} from './civ.ts';
// regen: hit points regained per minute; extraShots: arrows after the first each hit (extraDamage each); splash: damage
// to enemy units next to the target. minRange: closer targets cannot be hit; blast: every enemy unit this close to the
// impact takes the hit too (mangonel line, Warwolf); passThrough: the bolt goes on this far behind the target and hits
// the enemy units along it (scorpions); buildingsOnly: only buildings are targets (rams, trebuchets); selfDestruct:
// the unit is spent by its hit (petard); setup: ticks to unpack before firing and to pack before moving (trebuchet).
export type UnitStats={hp:number;damage:number;range:number;cooldown:number;sight:number;attack:'melee'|'pierce'|'none';armor:readonly [number,number];classes:readonly string[];bonus:Readonly<Record<string,number>>;regen?:number;extraShots?:number;extraDamage?:number;splash?:number;minRange?:number;blast?:number;passThrough?:number;buildingsOnly?:boolean;selfDestruct?:boolean;setup?:number};
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
  // Camels are their own class (aoetw: 駱駝, not 騎兵); the spear line's camel bonus keeps the site's ratio to its cavalry one.
  spearman:{hp:45,damage:4,range:50,cooldown:30,sight:350,attack:'melee',armor:[0,0],classes:['infantry','spear'],bonus:{cavalry:12,camel:10}},
  skirmisher:{hp:30,damage:2,range:200,cooldown:30,sight:400,attack:'pierce',armor:[0,3],classes:['archer','skirmisher'],bonus:{archer:4,spear:3}},
  knight:{hp:100,damage:10,range:50,cooldown:18,sight:350,attack:'melee',armor:[2,2],classes:['cavalry'],bonus:{}},
  // Battering ram: strikes buildings only (+40 against them), all but immune to arrows, slow.
  ram:{hp:175,damage:2,range:50,cooldown:60,sight:0,attack:'melee',armor:[0,120],classes:['siege'],bonus:{building:40},buildingsOnly:true},
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
  // The 單位 round (aoetw.com units pages). Ranges 50 + 50 a tile like the archers (mangonel 7 -> 400, below the
  // castle's 400 as the site's 7 is below its 8), minimum ranges 50 a tile; building bonuses x0.32
  // (the battering ram's 125 -> 40 here) so a trebuchet levels a castle in about as many shots as there; blast radii in
  // this map's units (a node is 50).
  'cavalry-archer':{hp:50,damage:6,range:250,cooldown:30,sight:400,attack:'pierce',armor:[0,0],classes:['archer','cavalry','cavalry-archer'],bonus:{spear:2}},
  camel:{hp:100,damage:6,range:50,cooldown:20,sight:350,attack:'melee',armor:[0,0],classes:['camel'],bonus:{cavalry:9,camel:5}},
  // Hurls a stone that hits every enemy unit near the impact; cannot shoot closer than 3 tiles.
  mangonel:{hp:50,damage:40,range:400,cooldown:60,sight:500,attack:'melee',armor:[0,6],classes:['siege'],bonus:{building:11},minRange:150,blast:75},
  // A bolt that goes on through the target: the units behind it on its path take half.
  scorpion:{hp:40,damage:12,range:400,cooldown:54,sight:500,attack:'pierce',armor:[0,7],classes:['siege'],bonus:{elephant:6,building:1},minRange:100,passThrough:200},
  // Strikes buildings only, from 16 tiles; unpacks before firing and packs before moving (7.5 s each).
  trebuchet:{hp:150,damage:25,range:850,cooldown:100,sight:0,attack:'melee',armor:[1,8],classes:['siege'],bonus:{building:50},minRange:200,buildingsOnly:true,setup:150},
  // Spent by its charge; goes only where it is sent (no automatic fights).
  // The 科技 round: the gunpowder units Chemistry opens (aoetw.com; no accuracy model, every shot hits).
  'hand-cannoneer':{hp:35,damage:17,range:400,cooldown:52,sight:450,attack:'pierce',armor:[1,0],classes:['archer','gunpowder'],bonus:{infantry:10,siege:2,spear:1}},
  // Heavy shot from 12 tiles (minimum 5); the site's half-tile blast is one node here (50).
  'bombard-cannon':{hp:80,damage:40,range:650,cooldown:65,sight:650,attack:'melee',armor:[2,5],classes:['siege','gunpowder'],bonus:{building:64,siege:6},minRange:250,blast:50},
  petard:{hp:50,damage:25,range:50,cooldown:20,sight:0,attack:'melee',armor:[0,2],classes:['petard'],bonus:{building:55,siege:19},selfDestruct:true},
  // The 建築 round: the dock's ships and the market's trade cart (aoetw.com units pages). Same conversions as above;
  // 'ship' puts a unit on the water layer (movement.ts layerOf). Fishing ships, transports and the trade units never
  // fight. 'warship': the galley line and the Longboat, which take the archer attack lines (Fletching to Bracer).
  'fishing-ship':{hp:60,damage:0,range:0,cooldown:0,sight:0,attack:'none',armor:[0,4],classes:['ship','fishing'],bonus:{}},
  'transport-ship':{hp:100,damage:0,range:0,cooldown:0,sight:0,attack:'none',armor:[4,8],classes:['ship','transport'],bonus:{}},
  'trade-cog':{hp:80,damage:0,range:0,cooldown:0,sight:0,attack:'none',armor:[0,6],classes:['ship','trade'],bonus:{}},
  'trade-cart':{hp:70,damage:0,range:0,cooldown:0,sight:0,attack:'none',armor:[0,0],classes:['trade'],bonus:{}},
  galley:{hp:120,damage:6,range:300,cooldown:46,sight:400,attack:'pierce',armor:[0,6],classes:['ship','warship','galley'],bonus:{ship:8,building:2}},
  // Fire: a short-range stream four times a second (the reference's 0.25 s), strong only against ships.
  'fire-galley':{hp:100,damage:1,range:175,cooldown:5,sight:300,attack:'melee',armor:[0,4],classes:['ship','fire'],bonus:{ship:3}},
  // Spent by its blast (the petard's rule): every enemy unit within the radius of the target takes the hit.
  'demolition-raft':{hp:45,damage:90,range:50,cooldown:20,sight:0,attack:'melee',armor:[0,2],classes:['ship','demolition'],bonus:{building:58},blast:125,selfDestruct:true},
  'cannon-galleon':{hp:120,damage:35,range:700,cooldown:100,sight:700,attack:'melee',armor:[0,6],classes:['ship','gunpowder'],bonus:{building:64,siege:13},minRange:150},
  // Four arrows a volley: the first at full attack, the other three at 1 each (aoetw).
  longboat:{hp:130,damage:7,range:350,cooldown:50,sight:400,attack:'pierce',armor:[0,6],classes:['ship','warship','unique'],bonus:{ship:9,building:2},extraShots:3,extraDamage:1},
 } as Record<'villager'|'militia'|'archer'|'scout'|'monk'|'sheep'|'deer'|'boar'|'spearman'|'skirmisher'|'knight'|'ram'|'longbowman'|'woad-raider'|'throwing-axeman'|'huskarl'|'teutonic-knight'|'berserk'|'cataphract'|'war-elephant'|'mameluke'|'janissary'|'chu-ko-nu'|'samurai'|'mangudai'|'cavalry-archer'|'camel'|'mangonel'|'scorpion'|'trebuchet'|'petard'|'hand-cannoneer'|'bombard-cannon'|'fishing-ship'|'transport-ship'|'trade-cog'|'trade-cart'|'galley'|'fire-galley'|'demolition-raft'|'cannon-galleon'|'longboat',UnitStats>,
 // Structures shrug off arrows: [melee, pierce] armor of every building.
 buildingArmor:[0,2] as [number,number],
 buildings:{'town-center':400,house:150,barracks:300,farm:100,'lumber-camp':200,'mining-camp':200,mill:200,stable:300,'archery-range':300,monastery:350,blacksmith:300,'watch-tower':250,'siege-workshop':300,castle:800,university:350,
  // The 建築 round: about the site's hit points / 6 like the castle (4800 -> 800); the fish trap keeps a token 40.
  market:350,dock:300,'fish-trap':40,outpost:100,'bombard-tower':370,wonder:800,'palisade-wall':60,'palisade-gate':70,'stone-wall':300,gate:450} as Record<string,number>,
 corpseTicks:40,hitFlashTicks:6,
 // Movement per tick.
 // A unit stops exactly on each node; what a step cut short there leaves over carries to the next tick while the walk
 // goes on (movement.ts u.stride), so a walk covers speed x ticks for any speed to a hundredth (speedOf).
 speed:{villager:5,militia:5,archer:5,scout:10,monk:5,sheep:5,deer:10,boar:5,spearman:5,skirmisher:5,knight:10,ram:2,
  longbowman:5,'woad-raider':7,'throwing-axeman':6,huskarl:6,'teutonic-knight':4,berserk:6,cataphract:10,'war-elephant':4,mameluke:10,janissary:5,'chu-ko-nu':5,samurai:6,mangudai:10,'cavalry-archer':10,camel:10,mangonel:4,scorpion:4,trebuchet:5,petard:5,'hand-cannoneer':5,'bombard-cannon':4.4,
  // Ships and the trade cart: the site's tiles a second x 6.25 (the villager's 0.8 -> 5).
  'fishing-ship':7.9,'transport-ship':9.1,'trade-cog':8.25,'trade-cart':6.25,galley:8.9,'fire-galley':8.1,'demolition-raft':9.4,'cannon-galleon':6.9,longboat:9.6},
};
// Monastery technology effects that touch unit stats (reference values, see aoe2-rules-research.md).
export const religionBonus={sanctityHp:15} as const;
export type CombatUnitKind=keyof typeof combatRules.units;
// Unit-line upgrades (researched at the unit's own building): every unit of that kind, in the field or trained later,
// takes the new values and name. Listed in research order; a later one overrides an earlier one.
export const lineUpgrades:{id:string;kind:CombatUnitKind;name:string;set:Partial<UnitStats>}[]=[
 {id:'man-at-arms',kind:'militia',name:'重步兵',set:{hp:55,damage:8}},
 {id:'long-swordsman',kind:'militia',name:'長劍士',set:{hp:60,damage:9,armor:[1,1]}},
 {id:'pikeman',kind:'spearman',name:'長矛兵',set:{hp:55,bonus:{cavalry:18,camel:15}}},
 {id:'crossbowman',kind:'archer',name:'弩手',set:{hp:35,damage:5,range:300}},
 {id:'elite-skirmisher',kind:'skirmisher',name:'精銳散兵',set:{hp:35,damage:3,armor:[0,4]}},
 {id:'light-cavalry',kind:'scout',name:'輕騎兵',set:{hp:60,damage:5}},
 // The 單位 round: each line's last upgrades (aoetw.com's numbers where this game's line already matched them; whole
 // fields again, so armor and bonus are listed in full).
 {id:'two-handed-swordsman',kind:'militia',name:'雙手劍兵',set:{hp:65,damage:12,armor:[1,1]}},
 {id:'champion',kind:'militia',name:'劍兵勇士',set:{hp:75,damage:13,armor:[2,1]}},
 {id:'halberdier',kind:'spearman',name:'戟兵',set:{hp:60,damage:6,bonus:{cavalry:26,camel:21}}},
 {id:'arbalest',kind:'archer',name:'強弩兵',set:{hp:40,damage:6,range:300}},
 {id:'heavy-cavalry-archer',kind:'cavalry-archer',name:'重裝馬弓騎兵',set:{hp:60,damage:7,armor:[1,0]}},
 {id:'hussar',kind:'scout',name:'匈牙利輕騎兵',set:{hp:75,damage:7}},
 {id:'cavalier',kind:'knight',name:'重裝騎士',set:{hp:120,damage:12}},
 {id:'paladin',kind:'knight',name:'遊俠',set:{hp:160,damage:14,cooldown:19,armor:[2,3]}},
 {id:'heavy-camel',kind:'camel',name:'重裝駱駝騎兵',set:{hp:120,damage:7,bonus:{cavalry:18,camel:9}}},
 {id:'capped-ram',kind:'ram',name:'裝甲衝撞車',set:{hp:200,damage:3,bonus:{building:48}}},
 {id:'siege-ram',kind:'ram',name:'重型衝撞車',set:{hp:270,damage:4,bonus:{building:64}}},
 {id:'onager',kind:'mangonel',name:'中型投石車',set:{hp:60,damage:50,range:450,armor:[0,7],bonus:{building:14},blast:90}},
 {id:'siege-onager',kind:'mangonel',name:'重型投石車',set:{hp:70,damage:75,range:450,armor:[0,8],bonus:{building:19},blast:110}},
 {id:'heavy-scorpion',kind:'scorpion',name:'重型弩砲',set:{hp:50,damage:16,bonus:{elephant:8,building:1}}},
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
 // The dock's upgrades (aoetw.com). War Galley upgrades all three Feudal ships at once.
 {id:'war-galley',kind:'galley',name:'弩砲戰船',set:{hp:135,damage:7,range:350,bonus:{ship:9,building:2}}},
 {id:'galleon',kind:'galley',name:'重型弩砲戰船',set:{hp:165,damage:8,range:400,armor:[0,8],bonus:{ship:11,building:3}}},
 {id:'war-galley',kind:'fire-galley',name:'火戰船',set:{hp:120,damage:2,armor:[0,6]}},
 {id:'fast-fire-ship',kind:'fire-galley',name:'重型火戰船',set:{hp:140,damage:3,armor:[0,8],bonus:{ship:4}}},
 {id:'war-galley',kind:'demolition-raft',name:'爆破船',set:{hp:60,damage:110,armor:[0,3],bonus:{building:70},blast:150}},
 {id:'heavy-demolition-ship',kind:'demolition-raft',name:'重型爆破船',set:{hp:70,damage:140,armor:[0,5],bonus:{building:90},blast:175}},
 {id:'elite-cannon-galleon',kind:'cannon-galleon',name:'精銳火砲戰船',set:{hp:150,damage:45,range:800,armor:[0,8],bonus:{building:88,siege:13}}},
 {id:'elite-longboat',kind:'longboat',name:'精銳維京大戰船',set:{hp:160,damage:8,range:400,armor:[0,8],bonus:{ship:11,building:3}}},
];
// Blacksmith technologies: what they add to units of the given classes (attack, range, melee/pierce armor).
// exclude: classes a line skips entirely (gunpowder units take no arrow attack or range; horse archers take the
// archer lines, not the melee attack or barding lines, as in the reference).
export const blacksmith:Record<string,{classes:string[];exclude?:string[];attack?:number;range?:number;melee?:number;pierce?:number;melee_only?:boolean}>={
 forging:{classes:['infantry','cavalry','camel'],exclude:['cavalry-archer'],attack:1},'iron-casting':{classes:['infantry','cavalry','camel'],exclude:['cavalry-archer'],attack:1},'blast-furnace':{classes:['infantry','cavalry','camel'],exclude:['cavalry-archer'],attack:2},
 'scale-mail-armor':{classes:['infantry'],melee:1,pierce:1},'chain-mail-armor':{classes:['infantry'],melee:1,pierce:1},'plate-mail-armor':{classes:['infantry'],melee:1,pierce:2},
 'scale-barding-armor':{classes:['cavalry','camel'],exclude:['cavalry-archer'],melee:1,pierce:1},'chain-barding-armor':{classes:['cavalry','camel'],exclude:['cavalry-archer'],melee:1,pierce:1},'plate-barding-armor':{classes:['cavalry','camel'],exclude:['cavalry-archer'],melee:1,pierce:2},
 fletching:{classes:['archer','warship'],exclude:['gunpowder'],attack:1,range:50},'bodkin-arrow':{classes:['archer','warship'],exclude:['gunpowder'],attack:1,range:50},bracer:{classes:['archer','warship'],exclude:['gunpowder'],attack:1,range:50},
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
 for(const {vs,scale} of bonusScales(o,kind,cls))if(st.bonus[vs]){st.bonus={...st.bonus,[vs]:Math.round(st.bonus[vs]*scale)};}
 const pace=unitProduct(o,'cooldown',kind,cls);if(pace!==1)st.cooldown=Math.max(1,Math.round(st.cooldown*pace));
 for(const k of ['regen','extraShots','splash','blast'] as const){const v=unitSum(o,k,kind,cls);if(v)st[k]=(st[k]??0)+v;}
 const pack=unitProduct(o,'setup',kind,cls);if(st.setup&&pack!==1)st.setup=Math.max(1,Math.round(st.setup*pack));
 st.hp=Math.round(st.hp*unitProduct(o,'hp',kind,cls))+(kind==='monk'&&techs.includes('sanctity')?religionBonus.sanctityHp:0)+(kind==='villager'?villagerHpBonus(techs):0)+unitSum(o,'hp',kind,cls);
 return st;
}
// A unit's full health for its owner.
export function maxHpOf(kind:CombatUnitKind,who:Owner|readonly string[]){return statsOf(kind,who).hp;}
// Distance per tick for its owner, to a hundredth (movement.ts carries the fraction from tick to tick).
export function speedOf(kind:CombatUnitKind,who:Owner|readonly string[]=[]){const o=asOwner(who),base=combatRules.speed[kind];
 const scale=unitProduct(o,'speed',kind,combatRules.units[kind].classes);return scale===1?base:Math.max(1,Math.round(base*scale*100)/100);}
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
// A building's armor for its owner (Masonry, Architecture).
export function buildingTargetOf(kind:string,who:Owner|readonly string[]=[]){const [m,p]=buildingArmorBonus(asOwner(who),kind);return m||p?{armor:[buildingTarget.armor[0]+m,buildingTarget.armor[1]+p] as readonly [number,number],classes:buildingTarget.classes}:buildingTarget;}
