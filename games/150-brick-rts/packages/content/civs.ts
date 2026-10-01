// Civilizations (prompt 11): data only, no imports. Each civ lists the entries its tech tree lacks, its unique units
// and technologies, and its bonuses as effects the sim evaluates (packages/sim/civ.ts); there is no per-civ code path.
// Source: aoetw.com (the Traditional Chinese AoE II encyclopedia; its pages follow the HD / UserPatch 5.8 era,
// fetched 2026-09-30, see docs/aoe2-rules-research.md). The site's numbers are carried as design_default in this
// game's scale: 1 tile of the reference's range = 50 units here (Fletching adds 50), 1 tile of sight = 100 units,
// and attack speeds become integer tick cooldowns.
export type AgeValues=readonly [number,number,number,number];
// A value per age (Dark, Feudal, Castle, Imperial) when the bonus grows by age; the tiers replace each other.
export type EffectValue=number|AgeValues;
// Which things an effect touches (a workRate effect with allUnits speeds training only, not research). Unit effects match a unit kind or class (exclude wins); entry effects match entry
// ids or every unit/technology entry; building effects match building kinds; economy effects match a yield
// (resources) or a source kind (sources: berries, hunt, livestock, farm, tree, gold, stone, fish).
export type Selector={kinds?:readonly string[];classes?:readonly string[];exclude?:readonly string[];entries?:readonly string[];allUnits?:boolean;allTechs?:boolean;buildings?:readonly string[];resources?:readonly string[];sources?:readonly string[];prey?:readonly string[]};
export type EffectKind=
 // unit numbers (statsOf): hp (mul), attack/range/meleeArmor/pierceArmor (add), cooldown (mul, below 1 = faster),
 // bonus (add, against the class in vs), speed (mul, rounded to whole units per tick), regen (hp per minute),
 // extraShots (arrows beyond the first), splash (damage to enemies next to the target), los (add to sight radius),
 // blast (add an impact radius), setup (mul, trebuchet pack/unpack time), bonusScale (mul, the bonus against the class in vs)
 'bonusScale'|'blast'|'setup'|'hp'|'attack'|'range'|'meleeArmor'|'pierceArmor'|'cooldown'|'bonus'|'speed'|'regen'|'extraShots'|'splash'|'los'
 // economy: gather (percent points), carry (add), farmFood (add), huntDamage (add, per strike on the prey kinds)
 |'gather'|'carry'|'farmFood'|'huntDamage'
 // entries: cost (mul, one resource or all), costShift (move a resource's share onto another), time (mul),
 // producer (also trained at the building in select.buildings), grant (researched for free when triggered)
 |'cost'|'costShift'|'time'|'producer'|'grant'
 // buildings: workRate (percent points of production speed), buildingHp (mul), housing/garrison/arrows/arrowDamage/
 // arrowRange (add), arrowCooldown (mul), garrisonArrows (these unit classes inside add an arrow)
 |'workRate'|'buildingHp'|'housing'|'garrison'|'arrows'|'arrowDamage'|'arrowRange'|'arrowCooldown'|'garrisonArrows'
 // buildingMeleeArmor/buildingPierceArmor (add), buildRate (percent points of construction speed), garrisonHeal (mul, the
 // healing pace of units inside)
 |'buildingMeleeArmor'|'buildingPierceArmor'|'buildRate'|'garrisonHeal'
 // player: popCap (add), startStock (add to the resource), startVillagers (add), keepHousing (lost houses keep housing),
 // deathRefund (gold when a selected unit dies)
 |'popCap'|'startStock'|'startVillagers'|'keepHousing'|'deathRefund'
 // monks: healRange (mul), healRate (mul), conversionResist (add conversion attempts before one can succeed)
 |'healRange'|'healRate'|'conversionResist'
 // the 建築 round: marketFee (add, percent points of the market's 30% fee), transportCapacity (add, units a transport
 // ship carries), arrowBonus (add, a building's arrows against the class in vs)
 |'marketFee'|'transportCapacity'|'arrowBonus';
export type Resource='food'|'wood'|'gold'|'stone';
// trigger: active from that age and/or once that technology is researched. stacking: every active effect of a kind
// applies (add sums, mul multiplies); the age tiers of one effect never stack. priority orders the layers: 0 base
// adds, 1 multipliers. appliesToExisting: units and buildings already on the field take it at once (hit points follow
// their maximum); cost, time and production rate apply to what is queued after. scope 'team' is the team bonus: with
// one player per side it applies to its owner only.
export type Effect={id:string;kind:EffectKind;select:Selector;op:'add'|'mul';value:EffectValue;vs?:string;resource?:Resource;to?:Resource;
 trigger:{age?:number;tech?:string};stacking:'sum'|'product';priority:0|1;scope:'self'|'team';appliesToExisting:boolean;text:string};
// A reference bonus or technology this game cannot express yet (its target does not exist here).
export type Omitted={text:string;reason:string};
export type UniqueTech={id:string;name:string;nameEn:string;age:3|4;effectText:string};
export type CivDef={id:string;name:string;nameEn:string;type:string;architecture:'west'|'central'|'mideast'|'eastasia'|'neutral';
 missing:readonly string[];missingLater:readonly string[];uniqueUnits:readonly string[];eliteUpgrades:readonly string[];uniqueTechs:readonly UniqueTech[];
 effects:readonly Effect[];omitted:readonly Omitted[];sources:readonly string[]};
const mulKinds:EffectKind[]=['bonusScale','garrisonHeal','setup','hp','cooldown','speed','cost','time','buildingHp','arrowCooldown','healRange','healRate'];
export type Opts={op?:'add'|'mul';vs?:string;resource?:Resource;to?:Resource;age?:number;tech?:string;team?:boolean;existing?:boolean};
export function fx(id:string,kind:EffectKind,select:Selector,value:EffectValue,text:string,o:Opts={}):Effect{
 const mul=o.op?o.op==='mul':mulKinds.includes(kind);
 return {id,kind,select,op:mul?'mul':'add',value,...(o.vs?{vs:o.vs}:{}),...(o.resource?{resource:o.resource}:{}),...(o.to?{to:o.to}:{}),
  trigger:{...(o.age?{age:o.age}:{}),...(o.tech?{tech:o.tech}:{})},stacking:mul?'product':'sum',priority:mul?1:0,scope:o.team?'team':'self',
  appliesToExisting:o.existing??!['cost','costShift','time','workRate','startStock','startVillagers','deathRefund','keepHousing','grant','producer'].includes(kind),text};
}
const site=(page:string)=>`aoetw.com/${page}（2026-09-30 取自 github.com/webrsb/aoetw 原始碼）`;
// Foot archers in the reference's sense: archer-class units that are neither skirmishers, gunpowder nor mounted.
const footArchers:Selector={classes:['archer'],exclude:['skirmisher','gunpowder','cavalry-archer']};
const infantry:Selector={classes:['infantry']};
export const neutralCiv='settlers';
export const civDefs:readonly CivDef[]=[
 {id:neutralCiv,name:'拓荒者',nameEn:'Settlers',type:'無加成（均衡測試）',architecture:'neutral',missing:[],missingLater:[],uniqueUnits:[],eliteUpgrades:[],uniqueTechs:[],effects:[],omitted:[],sources:['本作原創：沒有文明加成與城堡，作為測試與練習的基準']},
 {id:'britons',name:'不列顛',nameEn:'Britons',type:'弓兵文明',architecture:'west',
  missing:['crop-rotation','stone-shaft-mining','redemption','atonement','heresy','hussar','paladin','camel','heavy-camel','siege-ram','siege-onager','treadmill-crane','bloodlines','thumb-ring','parthian-tactics','hand-cannoneer','bombard-cannon','elite-cannon-galleon','bombard-tower'],missingLater:['missionary'],
  uniqueUnits:['longbowman'],eliteUpgrades:['elite-longbowman'],
  uniqueTechs:[{id:'yeomen',name:'義勇騎兵',nameEn:'Yeomen',age:3,effectText:'徒步弓兵射程 +1，箭塔攻擊 +2'},{id:'warwolf',name:'戰狼號',nameEn:'Warwolf',age:4,effectText:'巨型投石機獲得範圍傷害'}],
  effects:[
   fx('britons.archer-range','range',footArchers,[0,0,50,100],'徒步弓兵（散兵除外）射程：第三時代 +1、第四時代 +2'),
   fx('britons.tc-wood','cost',{entries:['town-center']},[1,1,0.5,0.5],'第三時代起城鎮中心木材 -50%',{resource:'wood'}),
   fx('britons.shepherds','gather',{sources:['livestock']},25,'牧羊（宰羊採集）速度 +25%'),
   fx('britons.team-range','workRate',{buildings:['archery-range']},20,'團隊加成：靶場生產速度 +20%',{team:true}),
   fx('britons.yeomen-range','range',{classes:['archer'],exclude:['gunpowder','cavalry-archer']},50,'義勇騎兵：徒步弓兵（含散兵）射程 +1',{tech:'yeomen'}),
   fx('britons.yeomen-tower','arrowDamage',{buildings:['watch-tower']},2,'義勇騎兵：箭塔攻擊 +2',{tech:'yeomen'}),
   fx('britons.warwolf','blast',{kinds:['trebuchet']},75,'戰狼號：巨型投石機的石彈波及落點周圍的敵兵',{tech:'warwolf'}),
  ],
  omitted:[{text:'戰狼號對靜止單位 100% 命中',reason:'本作的巨型投石機只打建築，也沒有命中率'}],
  sources:[site('civs/Britons'),site('units/Longbowman'),site('techs/Yeomen'),site('techs/Warwolf'),site('tree/bri')]},
 {id:'celts',name:'塞爾特',nameEn:'Celts',type:'步兵與攻城器文明',architecture:'west',
  missing:['two-man-saw','crop-rotation','bracer','ring-archer-armor','plate-barding-armor','redemption','atonement','illumination','block-printing','theocracy','arbalest','camel','heavy-camel','architecture','bloodlines','thumb-ring','parthian-tactics','squires','hand-cannoneer','bombard-cannon','bombard-tower','elite-cannon-galleon','fast-fire-ship'],missingLater:['missionary'],
  uniqueUnits:['woad-raider'],eliteUpgrades:['elite-woad-raider'],
  uniqueTechs:[{id:'stronghold',name:'堡壘',nameEn:'Stronghold',age:3,effectText:'城堡與箭塔射速 +25%'},{id:'furor-celtica',name:'塞爾特狂熱',nameEn:'Furor Celtica',age:4,effectText:'攻城器工坊的單位生命 +40%'}],
  effects:[
   fx('celts.lumberjacks','gather',{resources:['wood']},15,'伐木速度 +15%'),
   fx('celts.infantry-speed','speed',infantry,[1,1.15,1.15,1.15],'第二時代起步兵移動速度 +15%（本作以每 tick 整數步長換算，實際約 +11%）'),
   fx('celts.siege-rate','cooldown',{classes:['siege']},1/1.25,'攻城器攻擊速度 +25%'),
   fx('celts.team-siege','workRate',{buildings:['siege-workshop']},20,'團隊加成：攻城器工坊生產速度 +20%',{team:true}),
   fx('celts.stronghold','arrowCooldown',{buildings:['castle','watch-tower']},1/1.25,'堡壘：城堡與箭塔射速 +25%',{tech:'stronghold'}),
   fx('celts.furor','hp',{kinds:['ram','mangonel','scorpion','bombard-cannon']},1.4,'塞爾特狂熱：攻城器生命 +40%',{tech:'furor-celtica'}),
  ],
  omitted:[{text:'可在對手單位視野內搶走對手的羊',reason:'本作的搶羊規則不看視野（己方建築 4 格內的羊本來就不會被搶）'}],
  sources:[site('civs/Celts'),site('units/Woad_Raider'),site('techs/Stronghold'),site('techs/Furor_Celtica'),site('tree/cel')]},
 {id:'franks',name:'法蘭克',nameEn:'Franks',type:'騎兵文明',architecture:'west',
  missing:['two-man-saw','stone-shaft-mining','bracer','ring-archer-armor','redemption','arbalest','hussar','camel','heavy-camel','siege-ram','siege-onager','keep','bloodlines','thumb-ring','parthian-tactics','sappers','bombard-tower','heated-shot','shipwright','elite-cannon-galleon','guilds'],missingLater:['missionary'],
  uniqueUnits:['throwing-axeman'],eliteUpgrades:['elite-throwing-axeman'],
  uniqueTechs:[{id:'chivalry',name:'騎士精神',nameEn:'Chivalry',age:3,effectText:'馬廄生產速度 +40%'},{id:'bearded-axe',name:'倒鉤斧',nameEn:'Bearded Axe',age:4,effectText:'擲斧兵射程 +1'}],
  effects:[
   fx('franks.foragers','gather',{sources:['berries']},25,'採漿果速度 +25%'),
   fx('franks.free-farming','cost',{entries:['horse-collar','heavy-plow','crop-rotation']},0,'磨坊的農田科技免費'),
   fx('franks.cavalry-hp','hp',{kinds:['scout','knight']},[1,1.2,1.2,1.2],'第二時代起馬廄單位生命 +20%'),
   fx('franks.castle','cost',{entries:['castle']},0.75,'城堡便宜 25%'),
   fx('franks.team-los','los',{kinds:['knight']},200,'團隊加成：騎士視野 +2',{team:true}),
   fx('franks.chivalry','workRate',{buildings:['stable']},40,'騎士精神：馬廄生產速度 +40%',{tech:'chivalry'}),
   fx('franks.bearded-axe','range',{kinds:['throwing-axeman']},50,'倒鉤斧：擲斧兵射程 +1',{tech:'bearded-axe'}),
  ],
  omitted:[],
  sources:[site('civs/Franks'),site('units/Throwing_Axeman'),site('techs/Chivalry'),site('techs/Bearded_Axe'),site('tree/fra')]},
 {id:'goths',name:'哥德',nameEn:'Goths',type:'步兵文明',architecture:'central',
  missing:['gold-shaft-mining','plate-mail-armor','plate-barding-armor','redemption','atonement','heresy','block-printing','arbalest','paladin','camel','heavy-camel','siege-ram','siege-onager','siege-engineers','guard-tower','keep','treadmill-crane','arrowslits','thumb-ring','parthian-tactics','arson','hoardings','bombard-tower','elite-cannon-galleon','dry-dock','fortified-wall'],missingLater:['missionary'],
  uniqueUnits:['huskarl'],eliteUpgrades:['elite-huskarl'],
  uniqueTechs:[{id:'anarchy',name:'無政府狀態',nameEn:'Anarchy',age:3,effectText:'兵營也能訓練哥德衛隊'},{id:'perfusion',name:'井噴',nameEn:'Perfusion',age:4,effectText:'兵營生產速度 +100%'}],
  effects:[
   fx('goths.infantry-cost','cost',{entries:['militia','spearman','huskarl']},[0.8,0.75,0.7,0.65],'步兵便宜：第一至第四時代 -20% / -25% / -30% / -35%'),
   fx('goths.infantry-buildings','bonus',infantry,[0,1,2,3],'步兵對建築攻擊：第二至第四時代 +1 / +2 / +3',{vs:'building'}),
   fx('goths.boar','huntDamage',{prey:['boar']},5,'村民打野豬攻擊 +5'),
   fx('goths.hunter-carry','carry',{sources:['hunt']},15,'獵人攜帶量 +15'),
   fx('goths.pop','popCap',{},[0,0,0,10],'第四時代人口上限 +10'),
   fx('goths.loom','time',{entries:['loom']},0,'織布機立即完成（仍需付費）'),
   fx('goths.team-barracks','workRate',{buildings:['barracks']},20,'團隊加成：兵營生產速度 +20%',{team:true}),
   fx('goths.anarchy','producer',{entries:['huskarl'],buildings:['barracks']},1,'無政府狀態：兵營也能訓練哥德衛隊',{tech:'anarchy'}),
   fx('goths.perfusion','workRate',{buildings:['barracks']},100,'井噴：兵營生產速度 +100%',{tech:'perfusion'}),
  ],
  omitted:[],
  sources:[site('civs/Goths'),site('units/Huskarl'),site('techs/Anarchy'),site('techs/Perfusion'),site('tree/got')]},
 {id:'teutons',name:'條頓',nameEn:'Teutons',type:'步兵文明',architecture:'central',
  missing:['bracer','light-cavalry','gold-shaft-mining','arbalest','heavy-cavalry-archer','hussar','camel','heavy-camel','siege-ram','architecture','husbandry','thumb-ring','parthian-tactics','sappers','shipwright','elite-cannon-galleon','dry-dock'],missingLater:[],
  uniqueUnits:['teutonic-knight'],eliteUpgrades:['elite-teutonic-knight'],
  uniqueTechs:[{id:'ironclad',name:'鋼鐵甲',nameEn:'Ironclad',age:3,effectText:'攻城器近戰護甲 +4'},{id:'crenellations',name:'砲門垛口',nameEn:'Crenellations',age:4,effectText:'城堡射程 +3，進駐的步兵也會射箭'}],
  effects:[
   fx('teutons.heal-range','healRange',{},2,'僧侶治療距離兩倍'),
   fx('teutons.tower-garrison','garrison',{buildings:['watch-tower']},5,'箭塔可駐紮兩倍單位'),
   fx('teutons.farms','cost',{entries:['farm']},0.6,'農田便宜 40%'),
   fx('teutons.herbal','cost',{entries:['herbal-medicine']},0,'草藥治療免費'),
   fx('teutons.tc-garrison','garrison',{buildings:['town-center']},10,'城鎮中心駐軍 +10'),
   fx('teutons.melee-armor','meleeArmor',{kinds:['militia','spearman','scout','knight']},[0,0,1,2],'兵營與馬廄單位近戰護甲：第三時代 +1、第四時代 +2'),
   fx('teutons.team-faith','conversionResist',{},1,'團隊加成：單位較難被轉化（每名僧侶的判定多一次必定失敗）',{team:true}),
   fx('teutons.ironclad','meleeArmor',{classes:['siege']},4,'鋼鐵甲：攻城器近戰護甲 +4',{tech:'ironclad'}),
   fx('teutons.crenellations-range','arrowRange',{buildings:['castle']},150,'砲門垛口：城堡射程 +3',{tech:'crenellations'}),
   fx('teutons.crenellations-infantry','garrisonArrows',{buildings:['castle'],classes:['infantry']},1,'砲門垛口：進駐城堡的步兵各多一支箭',{tech:'crenellations'}),
  ],
  omitted:[{text:'免費近射孔',reason:'本作的箭塔沒有最近射程，近射孔沒有作用'}],
  sources:[site('civs/Teutons'),site('units/Teutonic_Knight'),site('techs/Ironclad'),site('techs/Crenellations'),site('tree/teu')]},
 {id:'vikings',name:'維京',nameEn:'Vikings',type:'步兵與海軍文明',architecture:'central',
  missing:['stone-shaft-mining','plate-barding-armor','redemption','sanctity','illumination','theocracy','halberdier','heavy-cavalry-archer','hussar','paladin','camel','heavy-camel','siege-onager','keep','bloodlines','husbandry','parthian-tactics','herbal-medicine','hand-cannoneer','bombard-cannon','bombard-tower','fire-galley','fast-fire-ship','elite-cannon-galleon','shipwright','guilds'],missingLater:['missionary'],
  uniqueUnits:['berserk','longboat'],eliteUpgrades:['elite-berserk','elite-longboat'],
  uniqueTechs:[{id:'chieftains',name:'酋長',nameEn:'Chieftains',age:3,effectText:'步兵對騎兵攻擊 +5'},{id:'berserkergang',name:'狂戰士幫',nameEn:'Berserkergang',age:4,effectText:'狂戰士回血速度兩倍'}],
  effects:[
   fx('vikings.infantry-hp','hp',infantry,[1,1.1,1.15,1.2],'步兵生命：第二時代 +10%、第三時代 +15%、第四時代 +20%'),
   fx('vikings.wheelbarrow','grant',{entries:['wheelbarrow']},1,'升到第二時代時免費得到手推車',{age:2}),
   fx('vikings.hand-cart','grant',{entries:['hand-cart']},1,'升到第三時代時免費得到手拉車',{age:3}),
   fx('vikings.chieftains','bonus',infantry,5,'酋長：步兵對騎兵攻擊 +5',{vs:'cavalry',tech:'chieftains'}),
   fx('vikings.chieftains-camel','bonus',infantry,4,'酋長：步兵對駱駝騎兵攻擊 +4',{vs:'camel',tech:'chieftains'}),
   fx('vikings.berserkergang','regen',{kinds:['berserk']},20,'狂戰士幫：狂戰士每分鐘回血 20 → 40',{tech:'berserkergang'}),
   fx('vikings.warships','cost',{entries:['galley','demolition-raft','cannon-galleon','longboat']},[1,0.85,0.85,0.8],'戰船便宜：第二、第三時代 -15%，第四時代 -20%'),
   fx('vikings.team-dock','cost',{entries:['dock']},0.85,'團隊加成：碼頭便宜 15%',{team:true}),
  ],
  omitted:[],
  sources:[site('civs/Vikings'),site('units/Berserk'),site('units/Longboat'),site('techs/Chieftains'),site('techs/Berserkergang'),site('tree/vik')]},
 {id:'byzantines',name:'拜占庭',nameEn:'Byzantines',type:'防禦文明',architecture:'mideast',
  missing:['masonry','architecture','blast-furnace','siege-onager','heavy-scorpion','siege-engineers','treadmill-crane','bloodlines','parthian-tactics','sappers','herbal-medicine','heated-shot','bombard-tower'],missingLater:['missionary'],
  uniqueUnits:['cataphract'],eliteUpgrades:['elite-cataphract'],
  uniqueTechs:[{id:'greek-fire',name:'希臘之火',nameEn:'Greek Fire',age:3,effectText:'火戰船射程 +1'},{id:'logistica',name:'後勤',nameEn:'Logistica',age:4,effectText:'拜占庭聖騎兵踐踏傷害，對步兵 +6'}],
  effects:[
   fx('byzantines.building-hp','buildingHp',{},[1.1,1.2,1.3,1.4],'建築生命：第一至第四時代 +10% / +20% / +30% / +40%'),
   fx('byzantines.counter-cost','cost',{entries:['spearman','skirmisher','camel']},0.75,'長槍兵、散兵與駱駝騎兵便宜 25%'),
   fx('byzantines.town-watch','cost',{entries:['town-watch']},0,'城鎮瞭望免費'),
   fx('byzantines.imperial','cost',{entries:['age-4']},0.67,'升第四時代便宜 33%'),
   fx('byzantines.team-heal','healRate',{},1.5,'團隊加成：僧侶治療速度 +50%',{team:true}),
   fx('byzantines.logistica','bonus',{kinds:['cataphract']},6,'後勤：拜占庭聖騎兵對步兵 +6',{vs:'infantry',tech:'logistica'}),
   fx('byzantines.trample','splash',{kinds:['cataphract']},5,'後勤：拜占庭聖騎兵攻擊時，目標旁的敵兵受 5 點踐踏傷害',{tech:'logistica'}),
   fx('byzantines.fire-ships','cooldown',{kinds:['fire-galley']},1/1.25,'火戰船系攻擊速度 +25%'),
   fx('byzantines.greek-fire','range',{kinds:['fire-galley']},50,'希臘之火：火戰船系射程 +1',{tech:'greek-fire'}),
  ],
  omitted:[],
  sources:[site('civs/Byzantines'),site('units/Cataphract'),site('techs/Greek_Fire'),site('techs/Logistica'),site('tree/byz')]},
 {id:'persians',name:'波斯',nameEn:'Persians',type:'騎兵文明',architecture:'mideast',
  missing:['bracer','redemption','atonement','heresy','sanctity','illumination','two-handed-swordsman','champion','arbalest','siege-onager','siege-engineers','keep','treadmill-crane','arrowslits','shipwright','bombard-tower','fortified-wall'],missingLater:['missionary'],
  uniqueUnits:['war-elephant'],eliteUpgrades:['elite-war-elephant'],
  uniqueTechs:[{id:'kamandaran',name:'波斯弓兵',nameEn:'Kamandaran',age:3,effectText:'弓手改用木材支付原本的黃金'},{id:'mahouts',name:'象伕',nameEn:'Mahouts',age:4,effectText:'戰象移動速度 +30%'}],
  effects:[
   fx('persians.food','startStock',{},50,'開局食物 +50',{resource:'food'}),
   fx('persians.wood','startStock',{},50,'開局木材 +50',{resource:'wood'}),
   fx('persians.tc-hp','buildingHp',{buildings:['town-center','dock']},2,'城鎮中心與碼頭生命兩倍'),
   fx('persians.tc-rate','workRate',{buildings:['town-center','dock']},[0,10,15,20],'城鎮中心與碼頭生產與研究速度：第二至第四時代 +10% / +15% / +20%'),
   fx('persians.team-knights','bonus',{kinds:['knight']},2,'團隊加成：騎士對弓兵攻擊 +2',{vs:'archer',team:true}),
   fx('persians.kamandaran','costShift',{entries:['archer']},1,'波斯弓兵：弓手的黃金改以木材支付',{resource:'gold',to:'wood',tech:'kamandaran'}),
   fx('persians.mahouts','speed',{kinds:['war-elephant']},1.3,'象伕：戰象移動速度 +30%',{tech:'mahouts'}),
  ],
  omitted:[],
  sources:[site('civs/Persians'),site('units/War_Elephant'),site('techs/Kamandaran'),site('techs/Mahouts'),site('tree/pre')]},
 {id:'saracens',name:'薩拉森',nameEn:'Saracens',type:'駱駝與海軍文明',architecture:'mideast',
  missing:['crop-rotation','stone-shaft-mining','halberdier','cavalier','paladin','heavy-scorpion','architecture','sappers','bombard-tower','heated-shot','shipwright','guilds','fast-fire-ship'],missingLater:['missionary'],
  uniqueUnits:['mameluke'],eliteUpgrades:['elite-mameluke'],
  uniqueTechs:[{id:'madrasah',name:'穆斯林學墊',nameEn:'Madrasah',age:3,effectText:'僧侶死亡時返還 33 黃金'},{id:'zealotry',name:'狂熱',nameEn:'Zealotry',age:4,effectText:'駱駝騎兵與阿拉伯奴隸兵生命 +30'}],
  effects:[
   fx('saracens.archer-buildings','bonus',footArchers,[0,1,2,3],'弓兵對建築攻擊：第二至第四時代 +1 / +2 / +3',{vs:'building'}),
   fx('saracens.team-archers','bonus',footArchers,2,'團隊加成：徒步弓兵對建築攻擊 +2',{vs:'building',team:true}),
   fx('saracens.horse-archer-buildings','bonus',{classes:['cavalry-archer']},[0,2,3,4],'馬弓騎兵對建築攻擊：第二至第四時代 +2 / +3 / +4（弓兵的加成再 +1）',{vs:'building'}),
   fx('saracens.madrasah','deathRefund',{kinds:['monk']},33,'穆斯林學墊：僧侶死亡時返還 33 黃金',{tech:'madrasah'}),
   fx('saracens.zealotry','hp',{kinds:['mameluke','camel']},30,'狂熱：駱駝騎兵與阿拉伯奴隸兵生命 +30',{tech:'zealotry',op:'add'}),
   fx('saracens.market-fee','marketFee',{},-25,'市集交易費 5%（一般 30%）'),
   fx('saracens.market-cost','cost',{entries:['market']},100/175,'市集便宜 75 木材',{resource:'wood'}),
   fx('saracens.transport-hp','hp',{kinds:['transport-ship']},2,'運輸船生命兩倍'),
   fx('saracens.transport-capacity','transportCapacity',{kinds:['transport-ship']},5,'運輸船運載 +5'),
   fx('saracens.galleys','cooldown',{classes:['galley']},1/1.25,'戰船系攻擊速度 +25%'),
  ],
  omitted:[],
  sources:[site('civs/Saracens'),site('units/Mameluke'),site('techs/Madrasah'),site('techs/Zealotry'),site('tree/sar')]},
 {id:'turks',name:'土耳其',nameEn:'Turks',type:'火藥文明',architecture:'mideast',
  missing:['pikeman','elite-skirmisher','stone-shaft-mining','faith','illumination','halberdier','arbalest','paladin','onager','siege-onager','siege-engineers','herbal-medicine','shipwright','fast-fire-ship'],missingLater:[],
  uniqueUnits:['janissary'],eliteUpgrades:['elite-janissary'],
  uniqueTechs:[{id:'sipahi',name:'采邑騎兵',nameEn:'Sipahi',age:3,effectText:'馬弓騎兵與標槍騎兵生命 +20'},{id:'artillery',name:'砲兵',nameEn:'Artillery',age:4,effectText:'火砲、火砲塔、火砲戰船射程 +2'}],
  effects:[
   fx('turks.gunpowder-hp','hp',{classes:['gunpowder']},1.25,'火藥單位生命 +25%'),
   fx('turks.gold','gather',{resources:['gold']},20,'採金速度 +20%'),
   fx('turks.free-light-cavalry','cost',{entries:['light-cavalry','hussar']},0,'斥候系升級免費'),
   fx('turks.sipahi','hp',{classes:['cavalry-archer']},20,'采邑騎兵：馬弓騎兵生命 +20',{tech:'sipahi',op:'add'}),
   fx('turks.scout-armor','pierceArmor',{kinds:['scout']},1,'斥候系遠程護甲 +1'),
   fx('turks.chemistry','cost',{entries:['chemistry']},0,'化學免費'),
   fx('turks.artillery','range',{kinds:['bombard-cannon','cannon-galleon']},100,'砲兵：火砲與火砲戰船射程 +2',{tech:'artillery'}),
   fx('turks.artillery-tower','arrowRange',{buildings:['bombard-tower']},100,'砲兵：火砲塔射程 +2',{tech:'artillery'}),
   fx('turks.gunpowder-techs','cost',{entries:['elite-cannon-galleon','bombard-tower-tech']},0.5,'火藥科技便宜 50%（精銳火砲戰船、火砲塔；化學另外免費）'),
   fx('turks.team-gunpowder','time',{entries:['janissary','hand-cannoneer','bombard-cannon','cannon-galleon']},1/1.25,'團隊加成：火藥單位訓練速度 +25%',{team:true}),
  ],
  omitted:[],
  sources:[site('civs/Turks'),site('units/Janissary'),site('techs/Sipahi'),site('techs/Artillery'),site('tree/tur')]},
 {id:'chinese',name:'中國',nameEn:'Chinese',type:'弓兵文明',architecture:'eastasia',
  missing:['crop-rotation','redemption','heresy','hussar','paladin','siege-onager','siege-engineers','parthian-tactics','hoardings','hand-cannoneer','bombard-cannon','guilds','fast-fire-ship','elite-cannon-galleon'],missingLater:[],
  uniqueUnits:['chu-ko-nu'],eliteUpgrades:['elite-chu-ko-nu'],
  uniqueTechs:[{id:'great-wall',name:'長城',nameEn:'Great Wall',age:3,effectText:'箭塔與城牆生命 +30%'},{id:'rocketry',name:'火箭技術',nameEn:'Rocketry',age:4,effectText:'連弩兵攻擊 +2，弩砲攻擊 +4'}],
  effects:[
   fx('chinese.villagers','startVillagers',{},3,'開局多 3 名村民'),
   fx('chinese.food','startStock',{},-200,'開局食物 -200',{resource:'food'}),
   fx('chinese.wood','startStock',{},-50,'開局木材 -50',{resource:'wood'}),
   fx('chinese.tc-housing','housing',{buildings:['town-center']},5,'城鎮中心可住 10 人'),
   fx('chinese.tc-los','los',{buildings:['town-center']},500,'城鎮中心視野 +5'),
   fx('chinese.techs','cost',{allTechs:true,exclude:['age-2','age-3','age-4']},[1,0.9,0.85,0.8],'科技便宜：第二至第四時代 -10% / -15% / -20%'),
   fx('chinese.team-farms','farmFood',{},45,'團隊加成：農田食物 +45',{team:true}),
   fx('chinese.great-wall','buildingHp',{buildings:['watch-tower','palisade-wall','stone-wall','palisade-gate','gate']},1.3,'長城：箭塔與城牆（含城門）生命 +30%',{tech:'great-wall'}),
   fx('chinese.demolition-hp','hp',{kinds:['demolition-raft']},1.5,'爆破船系生命 +50%'),
   fx('chinese.rocketry','attack',{kinds:['chu-ko-nu']},2,'火箭技術：連弩兵攻擊 +2',{tech:'rocketry'}),
   fx('chinese.rocketry-scorpion','attack',{kinds:['scorpion']},4,'火箭技術：弩砲攻擊 +4',{tech:'rocketry'}),
  ],
  omitted:[],
  sources:[site('civs/Chinese'),site('units/Chu_Ko_Nu'),site('techs/Great_Wall'),site('techs/Rocketry'),site('tree/chi')]},
 {id:'japanese',name:'日本',nameEn:'Japanese',type:'步兵文明',architecture:'eastasia',
  missing:['crop-rotation','stone-shaft-mining','plate-barding-armor','heresy','paladin','camel','heavy-camel','siege-ram','siege-onager','architecture','hoardings','bombard-cannon','bombard-tower','heated-shot','guilds','heavy-demolition-ship'],missingLater:['missionary'],
  uniqueUnits:['samurai'],eliteUpgrades:['elite-samurai'],
  uniqueTechs:[{id:'yasama',name:'射箭孔',nameEn:'Yasama',age:3,effectText:'箭塔多射兩支箭'},{id:'kataparuto',name:'彈射器',nameEn:'Kataparuto',age:4,effectText:'巨型投石機組裝與射速提升'}],
  effects:[
   fx('japanese.camps','cost',{entries:['lumber-camp','mining-camp','mill']},0.5,'伐木場、採礦場、磨坊便宜 50%'),
   fx('japanese.infantry-rate','cooldown',infantry,[1,0.9,0.85,0.75],'步兵攻擊速度：第二至第四時代 +10% / +15% / +25%'),
   fx('japanese.kataparuto-setup','setup',{kinds:['trebuchet']},0.25,'彈射器：巨型投石機組裝與拆裝快 4 倍',{tech:'kataparuto'}),
   fx('japanese.kataparuto-rate','cooldown',{kinds:['trebuchet']},0.75,'彈射器：巨型投石機射速 +33%',{tech:'kataparuto'}),
   fx('japanese.yasama','arrows',{buildings:['watch-tower']},2,'射箭孔：箭塔多射兩支箭',{tech:'yasama'}),
   fx('japanese.fishing-hp','hp',{kinds:['fishing-ship']},2,'漁船生命兩倍'),
   fx('japanese.fishing-armor','pierceArmor',{kinds:['fishing-ship']},2,'漁船遠程護甲 +2'),
   fx('japanese.fishing-rate','gather',{kinds:['fishing-ship'],sources:['fish','fish-trap']},[5,10,15,20],'漁船工作速度：第一至第四時代 +5% / +10% / +15% / +20%'),
   fx('japanese.team-galley-los','los',{classes:['warship']},200,'團隊加成：戰船視野 +50%',{team:true}),
  ],
  omitted:[],
  sources:[site('civs/Japanese'),site('units/Samurai'),site('techs/Yasama'),site('techs/Kataparuto'),site('tree/jap')]},
 {id:'mongols',name:'蒙古',nameEn:'Mongols',type:'馬弓騎兵文明',architecture:'eastasia',
  missing:['halberdier','two-man-saw','crop-rotation','plate-barding-armor','ring-archer-armor','redemption','sanctity','faith','block-printing','paladin','architecture','keep','treadmill-crane','arrowslits','bombard-cannon','bombard-tower','elite-cannon-galleon','heated-shot','guilds','dry-dock'],missingLater:[],
  uniqueUnits:['mangudai'],eliteUpgrades:['elite-mangudai'],
  uniqueTechs:[{id:'nomads',name:'游牧',nameEn:'Nomads',age:3,effectText:'民居被摧毀後人口上限不下降'},{id:'drill',name:'鑿岩機',nameEn:'Drill',age:4,effectText:'攻城器工坊的單位移動速度 +50%'}],
  effects:[
   fx('mongols.horse-archers','cooldown',{classes:['cavalry-archer']},1/1.2,'馬弓騎兵射速 +20%'),
   fx('mongols.light-cavalry','hp',{kinds:['scout']},1.3,'輕騎兵生命 +30%',{tech:'light-cavalry'}),
   fx('mongols.hunters','gather',{sources:['hunt']},40,'打獵速度 +40%'),
   fx('mongols.team-scouts','los',{kinds:['scout']},200,'團隊加成：斥候視野 +2',{team:true}),
   fx('mongols.nomads','keepHousing',{buildings:['house']},1,'游牧：民居被摧毀後人口上限不下降',{tech:'nomads'}),
   fx('mongols.drill','speed',{kinds:['ram','mangonel','scorpion','bombard-cannon']},1.5,'鑿岩機：攻城器移動速度 +50%',{tech:'drill'}),
  ],
  omitted:[],
  sources:[site('civs/Mongols'),site('units/Mangudai'),site('techs/Nomads'),site('techs/Drill'),site('tree/mon')]},
];
// Unique technologies that stay out of the Castle because their target does not exist in this game yet.
export const deferredTechs:readonly string[]=[];
// Unique units: the entry id is the unit kind; elite: the upgrade id (a technology researched at the Castle).
export const uniqueUnitOwner:Readonly<Record<string,string>>=Object.fromEntries(civDefs.flatMap(c=>[...c.uniqueUnits,...c.eliteUpgrades,...c.uniqueTechs.map(t=>t.id)].map(id=>[id,c.id])));
export const civById=(id:string)=>civDefs.find(c=>c.id===id);
