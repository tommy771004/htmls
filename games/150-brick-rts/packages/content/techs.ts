// Generic technologies' effects (the 科技 round): the same Effect records as civilization bonuses (civs.ts), active for
// every civilization once researched. Numbers from aoetw.com's technology pages (2026-10-01; see
// docs/aoe2-rules-research.md) in this game's scale: a tile of range is 50, of sight 100; building bonuses x0.32.
// Left out because nothing here could carry them: Ballistics and Thumb Ring's accuracy (every shot hits), Murder Holes
// (towers have no minimum range), Tracking (folded into the second age in the site's era), and the market's Coinage,
// Banking and Cartography (tribute and allied sight: one player a side, no allies). The 建築 round added the dock's, the
// market's and the university's remaining technologies (below).
import {fx} from './civs.ts';
import type {Effect,Selector} from './civs.ts';
const infantry:Selector={classes:['infantry']};
const mounted:Selector={classes:['cavalry','camel']};
const ships=['fishing-ship','transport-ship','trade-cog','galley','fire-galley','demolition-raft','cannon-galleon','longboat'];
const footArchers:Selector={classes:['archer'],exclude:['skirmisher','gunpowder','cavalry-archer','chu-ko-nu']};
// Every building that sees (vision.ts), the 建築 round's included.
const sighted=['town-center','house','barracks','watch-tower','castle','outpost','bombard-tower','market','dock','wonder','palisade-wall','stone-wall','palisade-gate','gate'];
export const techEffects:readonly Effect[]=[
 // University.
 fx('masonry.hp','buildingHp',{},1.1,'磚瓦技術：建築生命 +10%',{tech:'masonry'}),
 fx('masonry.melee','buildingMeleeArmor',{},1,'磚瓦技術：建築近戰護甲 +1',{tech:'masonry'}),
 fx('masonry.pierce','buildingPierceArmor',{},1,'磚瓦技術：建築遠程護甲 +1',{tech:'masonry'}),
 fx('masonry.class','buildingClassArmor',{},1,'磚瓦技術：建築的建築類護甲 +1（原作 +3，攻城加成 ×0.32）',{tech:'masonry'}),
 fx('architecture.hp','buildingHp',{},1.1,'建築學：建築生命再 +10%',{tech:'architecture'}),
 fx('architecture.melee','buildingMeleeArmor',{},1,'建築學：建築近戰護甲再 +1',{tech:'architecture'}),
 fx('architecture.pierce','buildingPierceArmor',{},1,'建築學：建築遠程護甲再 +1',{tech:'architecture'}),
 fx('architecture.class','buildingClassArmor',{},1,'建築學：建築的建築類護甲再 +1',{tech:'architecture'}),
 fx('chemistry.missiles','attack',{kinds:['mangonel','scorpion','trebuchet'],classes:['archer','warship'],exclude:['gunpowder']},1,'化學：弓兵、投射攻城器與戰船攻擊 +1（火藥單位、衝撞車除外）',{tech:'chemistry'}),
 fx('chemistry.buildings','arrowDamage',{buildings:['town-center','watch-tower','castle']},1,'化學：城鎮中心、箭塔與城堡的箭 +1',{tech:'chemistry'}),
 fx('siege-engineers.range','range',{kinds:['mangonel','scorpion','trebuchet','bombard-cannon']},50,'攻城工程師：攻城器射程 +1（衝撞車除外）',{tech:'siege-engineers'}),
 fx('siege-engineers.buildings','bonusScale',{classes:['siege']},1.2,'攻城工程師：攻城器對建築攻擊 +20%',{vs:'building',tech:'siege-engineers'}),
 fx('guard-tower.hp','buildingHp',{buildings:['watch-tower']},1.47,'防禦箭塔：箭塔生命 +47%（原作 1020 → 1500）',{tech:'guard-tower'}),
 fx('guard-tower.arrow','arrowDamage',{buildings:['watch-tower']},1,'防禦箭塔：箭塔攻擊 +1',{tech:'guard-tower'}),
 fx('keep.hp','buildingHp',{buildings:['watch-tower']},1.5,'大型箭塔：箭塔生命再 +50%（原作 1500 → 2250）',{tech:'keep'}),
 fx('keep.arrow','arrowDamage',{buildings:['watch-tower']},1,'大型箭塔：箭塔攻擊再 +1',{tech:'keep'}),
 fx('treadmill-crane','buildRate',{},20,'磨坊水車：村民建造速度 +20%',{tech:'treadmill-crane'}),
 fx('arrowslits','arrowDamage',{buildings:['watch-tower']},2,'箭狹槽：箭塔攻擊 +2（原作依塔的等級 +1／+2／+3）',{tech:'arrowslits'}),
 // Barracks.
 fx('supplies','cost',{entries:['militia']},0.75,'供給：民兵系食物 -15',{tech:'supplies',resource:'food'}),
 fx('squires','speed',infantry,1.1,'護衛技術：步兵移動速度 +10%',{tech:'squires'}),
 fx('arson','bonus',infantry,2,'縱火：步兵對標準建築攻擊 +2',{vs:'standard-building',tech:'arson'}),
 // Archery range.
 fx('thumb-ring.foot','cooldown',footArchers,1/1.18,'拇指環：徒步弓兵射速 +18%',{tech:'thumb-ring'}),
 fx('thumb-ring.horse','cooldown',{classes:['cavalry-archer'],exclude:['mangudai']},1/1.11,'拇指環：馬弓騎兵射速 +11%',{tech:'thumb-ring'}),
 // The 戰術技巧 round: the Mangudai takes the foot archers' +18% (aoetw.com Thumb Ring), not the horse archers' +11%.
 fx('thumb-ring.mangudai','cooldown',{kinds:['mangudai']},1/1.18,'拇指環：蒙古突騎射速 +18%',{tech:'thumb-ring'}),
 // And sure shots at a standing target for the archer, skirmisher and horse archer lines, the Chu Ko Nu and the Mangudai.
 fx('thumb-ring.accuracy','accuracy',{classes:['archer'],exclude:['gunpowder']},100,'拇指環：弓兵射擊靜止目標必中',{tech:'thumb-ring'}),
 fx('thumb-ring.chu-ko-nu','cooldown',{kinds:['chu-ko-nu']},1/1.25,'拇指環：連弩兵射速 +25%',{tech:'thumb-ring'}),
 fx('parthian.melee','meleeArmor',{classes:['cavalry-archer']},1,'安息人戰術：馬弓騎兵近戰護甲 +1',{tech:'parthian-tactics'}),
 fx('parthian.pierce','pierceArmor',{classes:['cavalry-archer']},2,'安息人戰術：馬弓騎兵遠程護甲 +2',{tech:'parthian-tactics'}),
 fx('parthian.spear','bonus',{kinds:['cavalry-archer']},4,'安息人戰術：馬弓騎兵對長槍兵 +4',{vs:'spear',tech:'parthian-tactics'}),
 fx('parthian.spear-unique','bonus',{kinds:['mangudai']},2,'安息人戰術：其他馬弓騎兵（蒙古突騎）對長槍兵 +2',{vs:'spear',tech:'parthian-tactics'}),
 // Stable.
 fx('bloodlines','hp',mounted,20,'品種：騎兵與駱駝生命 +20',{tech:'bloodlines',op:'add'}),
 fx('husbandry','speed',mounted,1.1,'耕種技術：騎兵與駱駝移動速度 +10%',{tech:'husbandry'}),
 // Town centre: sight of every building (a tile of sight is 100 here).
 fx('town-watch','los',{buildings:sighted},400,'城鎮瞭望：建築視野 +4',{tech:'town-watch'}),
 fx('town-patrol','los',{buildings:sighted},400,'城鎮巡邏：建築視野再 +4',{tech:'town-patrol'}),
 // Monastery.
 fx('fervor','speed',{kinds:['monk']},1.15,'宗教狂熱：僧侶移動速度 +15%',{tech:'fervor'}),
 fx('herbal-medicine','garrisonHeal',{},6,'草藥治療：進駐單位回血快 6 倍',{tech:'herbal-medicine'}),
 // Castle.
 fx('hoardings','buildingHp',{buildings:['castle']},1.21,'圍牆：城堡生命 +21%',{tech:'hoardings'}),
 fx('sappers','bonus',{kinds:['villager']},15,'兵工學：村民對建築攻擊 +15',{vs:'building',tech:'sappers'}),
 // University, the 建築 round: Heated Shot (towers and castles +125% against ships: the arrows' ship bonus here),
 // Fortified Wall (stone walls 1800 -> 3000, gates 2750 -> 4000 hit points in the reference).
 fx('heated-shot','arrowBonus',{buildings:['watch-tower','castle']},6,'火箭：箭塔與城堡的箭對船 +6（原作 +125%）',{vs:'ship',tech:'heated-shot'}),
 fx('heated-shot.fishing','arrowBonus',{buildings:['watch-tower','castle']},6,'火箭：箭塔與城堡的箭對漁船 +6',{vs:'fishing-ship',tech:'heated-shot'}),
 fx('fortified-wall.wall','buildingHp',{buildings:['stone-wall']},5/3,'垛牆：石牆生命 +67%（原作 1800 → 3000）',{tech:'fortified-wall'}),
 fx('fortified-wall.class','buildingClassArmor',{buildings:['stone-wall']},3,'垛牆：石牆的建築類護甲 5 → 8（原作 16 → 24）',{tech:'fortified-wall'}),
 fx('fortified-wall.gate','buildingHp',{buildings:['gate']},4000/2750,'垛牆：城門生命 +45%（原作 2750 → 4000）',{tech:'fortified-wall'}),
 // Dock.
 fx('gillnets','gather',{kinds:['fishing-ship'],sources:['fish','fish-trap']},25,'流刺網：漁船工作速度 +25%',{tech:'gillnets'}),
 fx('careening.armor','pierceArmor',{classes:['ship','fishing-ship']},1,'航海技術：船隻遠程護甲 +1',{tech:'careening'}),
 fx('careening.capacity','transportCapacity',{kinds:['transport-ship']},5,'航海技術：運輸船運載 +5',{tech:'careening'}),
 fx('dry-dock.speed','speed',{classes:['ship','fishing-ship']},1.15,'船塢：船隻移動速度 +15%',{tech:'dry-dock'}),
 fx('dry-dock.capacity','transportCapacity',{kinds:['transport-ship']},10,'船塢：運輸船運載 +10',{tech:'dry-dock'}),
 fx('shipwright.cost','cost',{entries:ships},0.8,'造船員：船隻木材 -20%',{tech:'shipwright',resource:'wood'}),
 fx('shipwright.time','time',{entries:ships},0.65,'造船員：船隻訓練時間 -35%',{tech:'shipwright'}),
 // Market.
 fx('caravan','speed',{classes:['trade']},1.5,'商隊：貿易車隊與貿易商船移動速度 +50%',{tech:'caravan'}),
 fx('guilds','marketFee',{},-15,'公會制度：市集交易費 30% → 15%',{tech:'guilds'}),
 // The 戰術技巧 round. Ballistics (University): shots aim where a moving target will be when they land, for the archers
 // (not gunpowder), the galley line, the Longboat and fire ships, and the buildings that shoot (aoetw.com Ballistics).
 fx('ballistics.units','lead',{classes:['archer','warship','fire'],exclude:['gunpowder']},1,'彈道學：弓兵、戰船與火戰船的箭會預判移動中的目標',{tech:'ballistics'}),
 fx('ballistics.buildings','lead',{buildings:['town-center','watch-tower','castle','bombard-tower']},1,'彈道學：城鎮中心、箭塔、城堡與火砲塔會預判移動中的目標',{tech:'ballistics'}),
 fx('conscription','workRate',{buildings:['barracks','archery-range','stable','castle'],allUnits:true},33,'徵兵技術：兵營、靶場、馬廄與城堡訓練速度 +33%（研究不變）',{tech:'conscription'}),
];
// Free with an age for everyone (no research): Tracking (aoetw.com techs/Tracking: in the site's era infantry simply see
// 2 tiles farther from the second age on).
export const ageEffects:readonly Effect[]=[
 fx('tracking','los',{classes:['infantry']},200,'追蹤：第二時代起步兵視野 +2',{age:2}),
];
