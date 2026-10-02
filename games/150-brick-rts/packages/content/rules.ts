import {civDefs} from './civs.ts';
export const resources = ['food', 'wood', 'gold', 'stone'] as const;
export type Resource = typeof resources[number];
export type Entry = {referenceVersion:null; sourceEvidence:string[]; implementationStatus:'not_started'|'in_progress'; testEvidence:string[]; id: string; kind: 'unit'|'building'|'technology'; name: string; cost: Record<Resource, number>; time: number; population: number; requires: string[]; verificationStatus: 'design_default'};
export type Rules = {schemaVersion: number; id: string; reference: {game: string; version: string|null; build: string|null; contentPacks: string[]; verificationStatus: 'unverified'|'verified_against_reference'; sourceEvidence: string[]}; coverage: {contentDenominator: number|null; exactReferenceCoveragePercent: number|null}; settings: {tickHz: number; populationCap: number; mapSize: number; speed: number; mode: string; seed: number; platform: string; provenance: 'design_default'}; entries: Entry[]; production: Record<string,string|null>; civilizations: {id: string; available: string[]; unavailable: string[]}[]};
const entry = (id: string, kind: Entry['kind'], name: string, food=0, wood=0, gold=0, stone=0, requires: string[]=[], population=0, time=20, source='original design defaults: packages/content/rules.ts'): Entry => ({referenceVersion:null,sourceEvidence:[source],implementationStatus:id==='villager'?'in_progress':'not_started',testEvidence:['tests/foundation.test.ts (data validation only)'],id,kind,name,cost:{food,wood,gold,stone},time,population,requires,verificationStatus:'design_default'});
// Castle content from aoetw.com (civs, units, techs pages; see packages/content/civs.ts): costs and times as the site
// gives them, carried as design_default. The Castle's stone is scaled to this map (one 250-stone mine per base).
const aoetw='aoetw.com via github.com/webrsb/aoetw (2026-09-30), design_default in this ruleset';
const unique=(id:string,name:string,food:number,wood:number,gold:number,time:number)=>entry(id,'unit',name,food,wood,gold,0,[],1,time,aoetw);
const upgrade=(id:string,name:string,food:number,wood:number,gold:number,stone:number,age:3|4,time:number)=>entry(id,'technology',name,food,wood,gold,stone,[`age-${age}`],0,time,aoetw);
const castleEntries:Entry[]=[entry('castle','building','城堡',0,0,0,300,['age-3'],0,60,'aoetw.com/building/Castle (650 stone there); 300 stone and 60 s are design_default for this map'),
 unique('longbowman','長弓兵',0,35,40,18),unique('woad-raider','菘藍武士',65,0,25,10),unique('throwing-axeman','擲斧兵',55,0,25,17),unique('huskarl','哥德衛隊',80,0,40,16),
 unique('teutonic-knight','條頓武士',85,0,40,12),unique('berserk','狂戰士',65,0,25,14),unique('cataphract','拜占庭聖騎兵',70,0,75,20),unique('war-elephant','戰象',200,0,75,31),
 unique('mameluke','阿拉伯奴隸兵',55,0,85,23),unique('janissary','土耳其火槍兵',60,0,55,17),unique('chu-ko-nu','連弩兵',0,40,35,16),unique('samurai','日本武士',60,0,30,9),unique('mangudai','蒙古突騎',0,55,65,26),
 upgrade('elite-longbowman','精銳長弓兵',850,0,850,0,4,60),upgrade('elite-woad-raider','精銳菘藍武士',1000,0,800,0,4,45),upgrade('elite-throwing-axeman','精銳擲斧兵',1000,0,750,0,4,45),
 upgrade('elite-huskarl','精銳哥德衛隊',1200,0,550,0,4,40),upgrade('elite-teutonic-knight','精銳條頓武士',1200,0,600,0,4,50),upgrade('elite-berserk','精銳狂戰士',1300,0,550,0,4,45),
 upgrade('elite-cataphract','精銳拜占庭聖騎兵',1600,0,800,0,4,50),upgrade('elite-war-elephant','精銳戰象',1600,0,1200,0,4,75),upgrade('elite-mameluke','精銳阿拉伯奴隸兵',600,0,500,0,4,50),
 upgrade('elite-janissary','精銳土耳其火槍兵',850,0,750,0,4,55),upgrade('elite-chu-ko-nu','精銳連弩兵',950,0,950,0,4,50),upgrade('elite-samurai','精銳日本武士',950,0,875,0,4,60),upgrade('elite-mangudai','精銳蒙古突騎',1100,0,675,0,4,50),
 upgrade('yeomen','義勇騎兵',0,750,450,0,3,60),upgrade('stronghold','堡壘',250,0,200,0,3,30),upgrade('furor-celtica','塞爾特狂熱',750,0,450,0,4,50),
 upgrade('chivalry','騎士精神',0,400,400,0,3,40),upgrade('bearded-axe','倒鉤斧',400,0,400,0,4,60),upgrade('anarchy','無政府狀態',450,0,250,0,3,40),upgrade('perfusion','井噴',0,400,600,0,4,40),
 upgrade('ironclad','鋼鐵甲',0,400,350,0,3,60),upgrade('crenellations','砲門垛口',600,0,0,400,4,60),upgrade('chieftains','酋長',700,0,500,0,3,40),upgrade('berserkergang','狂戰士幫',850,0,400,0,4,40),
 upgrade('logistica','後勤',1000,0,600,0,4,50),upgrade('kamandaran','波斯弓兵',400,0,300,0,3,40),upgrade('mahouts','象伕',300,0,300,0,4,50),upgrade('madrasah','穆斯林學墊',200,0,100,0,3,30),
 upgrade('zealotry','狂熱',750,0,700,0,4,50),upgrade('great-wall','長城',0,400,0,200,3,40),upgrade('rocketry','火箭技術',0,750,750,0,4,60),upgrade('yasama','射箭孔',300,300,0,0,3,40),
 upgrade('nomads','游牧',0,300,150,0,3,40),upgrade('drill','鑿岩機',500,0,450,0,4,60)];
// The 單位 round (aoetw.com units pages, 2026-10-01): the generic lines' last upgrades and the new land units. Costs and
// times as the site gives them, design_default in this ruleset. upgrade(...) researches at the producing building.
const unit=(id:string,name:string,food:number,wood:number,gold:number,age:2|3|4,time:number)=>entry(id,'unit',name,food,wood,gold,0,[`age-${age}`],1,time,aoetw);
const line=(id:string,name:string,food:number,wood:number,gold:number,after:string|null,time:number)=>entry(id,'technology',name,food,wood,gold,0,after?['age-4',after]:['age-4'],0,time,aoetw);
const unitEntries:Entry[]=[
 line('two-handed-swordsman','雙手劍兵',300,0,100,'long-swordsman',75),line('champion','劍兵勇士',750,0,350,'two-handed-swordsman',100),line('halberdier','戟兵',300,0,600,'pikeman',50),
 line('arbalest','強弩兵',350,0,300,'crossbowman',50),unit('cavalry-archer','馬弓騎兵',0,40,60,3,34),line('heavy-cavalry-archer','重裝馬弓騎兵',900,0,500,null,50),
 line('hussar','匈牙利輕騎兵',500,0,600,'light-cavalry',50),line('cavalier','重裝騎士',300,0,300,null,100),line('paladin','遊俠',1300,0,750,'cavalier',170),
 unit('camel','駱駝騎兵',55,0,60,3,22),line('heavy-camel','重裝駱駝騎兵',325,0,365,null,105),
 line('capped-ram','裝甲衝撞車',300,0,0,null,50),line('siege-ram','重型衝撞車',1000,0,0,'capped-ram',75),
 unit('mangonel','輕型投石車',0,160,135,3,46),line('onager','中型投石車',800,0,500,null,75),line('siege-onager','重型投石車',1450,0,1000,'onager',150),
 unit('scorpion','弩砲',0,75,75,3,30),line('heavy-scorpion','重型弩砲',1000,1100,0,null,50),
 unit('trebuchet','巨型投石機',0,200,200,4,50),unit('petard','炸藥桶',65,0,20,3,25),
 // Unique techs whose targets exist from this round on (they were deferred in the civilization round).
 upgrade('warwolf','戰狼號',0,800,400,0,4,40),upgrade('kataparuto','彈射器',0,750,400,0,4,60),upgrade('sipahi','采邑騎兵',350,0,150,0,3,60)];
const unitProducers:Record<string,string>={'two-handed-swordsman':'barracks',champion:'barracks',halberdier:'barracks',arbalest:'archery-range','cavalry-archer':'archery-range','heavy-cavalry-archer':'archery-range',
 hussar:'stable',cavalier:'stable',paladin:'stable',camel:'stable','heavy-camel':'stable','capped-ram':'siege-workshop','siege-ram':'siege-workshop',mangonel:'siege-workshop',onager:'siege-workshop','siege-onager':'siege-workshop',
 scorpion:'siege-workshop','heavy-scorpion':'siege-workshop',trebuchet:'castle',petard:'castle',warwolf:'castle',kataparuto:'castle',sipahi:'castle'};
// The 科技 round (aoetw.com techs pages, 2026-10-01): generic technologies at their buildings, the University that
// researches the defensive and siege ones, and the gunpowder units Chemistry opens. Effects in packages/content/techs.ts.
const tech=(id:string,name:string,food:number,wood:number,gold:number,stone:number,requires:string[],time:number)=>entry(id,'technology',name,food,wood,gold,stone,requires,0,time,aoetw);
const techEntries:Entry[]=[
 entry('university','building','學院',0,200,0,0,['age-3'],0,40,'aoetw.com/building/University; 40 s is design_default like the other buildings'),
 tech('masonry','磚瓦技術',150,175,0,0,['age-3'],50),tech('architecture','建築學',300,200,0,0,['age-4','masonry'],70),tech('chemistry','化學',300,0,200,0,['age-4'],100),
 tech('siege-engineers','攻城工程師',500,600,0,0,['age-4'],45),tech('guard-tower','防禦箭塔',100,250,0,0,['age-3'],30),tech('keep','大型箭塔',500,350,0,0,['age-4','guard-tower'],75),
 tech('treadmill-crane','磨坊水車',300,200,0,0,['age-3'],50),tech('arrowslits','箭狹槽',250,250,0,0,['age-4'],25),
 // The 戰術技巧 round (aoetw.com techs/Ballistics): every civilization of this game has it.
 tech('ballistics','彈道學',0,300,175,0,['age-3'],60),
 tech('supplies','供給',150,0,100,0,['age-2'],35),tech('squires','護衛技術',100,0,0,0,['age-3'],40),tech('arson','縱火',150,0,50,0,['age-3'],25),
 tech('thumb-ring','拇指環',300,250,0,0,['age-3'],45),tech('parthian-tactics','安息人戰術',200,0,250,0,['age-4'],65),
 tech('bloodlines','品種',150,0,100,0,['age-2'],50),tech('husbandry','耕種技術',150,0,0,0,['age-3'],40),
 tech('town-watch','城鎮瞭望',75,0,0,0,['age-2'],25),tech('town-patrol','城鎮巡邏',300,0,100,0,['age-3','town-watch'],40),
 tech('fervor','宗教狂熱',0,0,140,0,['age-3'],50),tech('herbal-medicine','草藥治療',0,0,350,0,['age-3'],35),
 tech('hoardings','圍牆',400,400,0,0,['age-4'],75),tech('sappers','兵工學',400,0,200,0,['age-4'],10),tech('conscription','徵兵技術',150,0,150,0,['age-4'],60),
 entry('hand-cannoneer','unit','火槍兵',45,0,50,0,['age-4','chemistry'],1,34,aoetw),entry('bombard-cannon','unit','火砲',0,225,225,0,['age-4','chemistry'],1,56,aoetw),
 // Turks' Artillery: its bombard cannon exists from this round on.
 upgrade('artillery','砲兵',0,0,500,450,4,40)];
const techProducers:Record<string,string>={masonry:'university',architecture:'university',chemistry:'university','siege-engineers':'university','guard-tower':'university',keep:'university','treadmill-crane':'university',arrowslits:'university',ballistics:'university',
 supplies:'barracks',squires:'barracks',arson:'barracks','thumb-ring':'archery-range','parthian-tactics':'archery-range',bloodlines:'stable',husbandry:'stable','town-watch':'town-center','town-patrol':'town-center',
 fervor:'monastery','herbal-medicine':'monastery',hoardings:'castle',sappers:'castle',conscription:'castle','hand-cannoneer':'archery-range','bombard-cannon':'siege-workshop',artillery:'castle'};
// The 建築 round (aoetw.com building, units and techs pages, 2026-10-01): the remaining buildings (the town centre
// above becomes buildable from the third age), the dock and its ships, the market and its trade, walls and gates, the
// outpost, the bombard tower and the wonder. Unit and technology costs and times as the site gives them; building times
// are design_default in this game's pace (about the site's divided by 2.5, like the other buildings here), the wonder's
// cost is scaled to the map's stone and gold (one 250-stone and one 250-gold mine per base, two more in the middle).
const building=(id:string,name:string,wood:number,gold:number,stone:number,requires:string[],time:number,page:string)=>entry(id,'building',name,0,wood,gold,stone,requires,0,time,`aoetw.com/building/${page}; build time design_default`);
const ship=(id:string,name:string,wood:number,gold:number,requires:string[],time:number)=>entry(id,'unit',name,0,wood,gold,0,requires,1,time,aoetw);
const buildingEntries:Entry[]=[
 building('dock','碼頭',150,0,0,[],15,'Dock'),building('fish-trap','魚網',100,0,0,['age-2','dock'],15,'Fish_Trap'),
 building('market','市集',175,0,0,['age-2'],25,'Market'),building('outpost','哨站',25,0,5,[],6,'Outpost'),
 building('palisade-wall','木牆',2,0,0,[],3,'Palisade_Wall'),building('palisade-gate','木門',30,0,0,[],12,'Palisade_Gate'),
 building('stone-wall','石牆',0,0,5,['age-2'],4,'Stone_Wall'),building('gate','城門',0,0,30,['age-2'],12,'Gate'),
 building('bombard-tower','火砲塔',0,100,125,['age-4','bombard-tower-tech'],30,'Bombard_Tower'),
 entry('wonder','building','世界奇觀',0,1000,500,500,['age-4'],0,600,'aoetw.com/building/Wonder (1000 wood, gold and stone, 3500 s); cost and time scaled to this map, design_default'),
 // Ships (the dock) and the trade cart (the market).
 ship('fishing-ship','漁船',75,0,[],40),ship('transport-ship','運輸船',125,0,[],46),ship('trade-cog','貿易商船',100,50,['age-2'],36),
 ship('galley','戰船',90,30,['age-2'],60),ship('fire-galley','火艨艟',75,45,['age-2'],60),ship('demolition-raft','自爆筏',70,50,['age-2'],45),
 ship('cannon-galleon','火砲戰船',200,150,['age-4','chemistry'],46),ship('longboat','維京大戰船',100,50,['age-3'],25),
 entry('trade-cart','unit','貿易車隊',0,100,50,0,['age-2'],1,51,aoetw),
 // Dock upgrades: War Galley also turns fire galleys into fire ships and demolition rafts into demolition ships.
 tech('war-galley','弩砲戰船',230,0,100,0,['age-3'],50),tech('galleon','重型弩砲戰船',400,0,315,0,['age-4','war-galley'],65),
 tech('fast-fire-ship','重型火戰船',280,0,250,0,['age-4','war-galley'],50),tech('heavy-demolition-ship','重型爆破船',0,200,300,0,['age-4','war-galley'],50),
 tech('elite-cannon-galleon','精銳火砲戰船',0,525,500,0,['age-4','chemistry'],30),upgrade('elite-longboat','精銳維京大戰船',750,0,475,0,4,60),
 tech('gillnets','流刺網',150,0,200,0,['age-3'],45),tech('careening','航海技術',250,0,150,0,['age-3'],50),
 tech('dry-dock','船塢',600,0,400,0,['age-4','careening'],60),tech('shipwright','造船員',1000,0,300,0,['age-4'],60),
 // The market's and the university's.
 tech('caravan','商隊',200,0,200,0,['age-3'],40),tech('guilds','公會制度',300,0,200,0,['age-4'],50),
 tech('heated-shot','火箭',350,0,100,0,['age-3'],30),tech('fortified-wall','垛牆',200,100,0,0,['age-3'],50),
 tech('bombard-tower-tech','火砲塔技術',800,400,0,0,['age-4','chemistry'],60),
 // Byzantines' Greek Fire: its fire ships exist from this round on.
 upgrade('greek-fire','希臘之火',250,0,300,0,3,40)];
const dockItems=['fishing-ship','transport-ship','trade-cog','galley','fire-galley','demolition-raft','cannon-galleon','longboat','war-galley','galleon','fast-fire-ship','heavy-demolition-ship','elite-cannon-galleon','elite-longboat','gillnets','careening','dry-dock','shipwright'];
const buildingProducers:Record<string,string>={...Object.fromEntries(dockItems.map(id=>[id,'dock'])),'trade-cart':'market',caravan:'market',guilds:'market','heated-shot':'university','fortified-wall':'university','bombard-tower-tech':'university','greek-fire':'castle'};
// Per-civ availability from civs.ts: what the civ's tree lacks, the other civs' unique content, and the Castle for a
// civ without a unique unit (the neutral test civ).
// allTechs: the lobby's 所有科技 (every civ keeps its own unique content, nobody else's; the tree gaps are lifted).
function civilizationsOf(entries:Entry[],allTechs=false){
 const ids=entries.map(e=>e.id),uniqueIds=new Set(civDefs.flatMap(c=>[...c.uniqueUnits,...c.eliteUpgrades,...c.uniqueTechs.map(t=>t.id)]));
 return civDefs.map(c=>{const own=new Set([...c.uniqueUnits,...c.eliteUpgrades,...c.uniqueTechs.map(t=>t.id)]);
  const unavailable=ids.filter(id=>!allTechs&&c.missing.includes(id)||uniqueIds.has(id)&&!own.has(id)||id==='castle'&&!c.uniqueUnits.length);
  // Whatever needs a building or technology the civ lacks is out too (the neutral civ has no Castle, so no trebuchet).
  for(let grew=true;grew;){grew=false;for(const e of entries){if(unavailable.includes(e.id))continue;const producer=rules.production[e.id];
   if(producer&&unavailable.includes(producer)||e.requires.some(r=>unavailable.includes(r))){unavailable.push(e.id);grew=true;}}}
  return {id:c.id,available:ids.filter(id=>!unavailable.includes(id)),unavailable:ids.filter(id=>unavailable.includes(id))};});
}
export const rules: Rules = {
 schemaVersion:1,id:'brick-foundation-0.1',
 reference:{game:'Age of Empires II: Definitive Edition',version:null,build:null,contentPacks:[],verificationStatus:'unverified',sourceEvidence:[]},
 coverage:{contentDenominator:null,exactReferenceCoveragePercent:null},
 settings:{tickHz:20,populationCap:40,mapSize:16,speed:1,mode:'command-sandbox',seed:260925,platform:'desktop browser',provenance:'design_default'},
 entries:[entry('villager','unit','村民',50,0,0,0,[],1),entry('town-center','building','城鎮中心',0,275,0,100,['age-3'],0,60,'aoetw.com/building/Town_Center (275 wood, 100 stone, Castle Age); 60 s is design_default'),entry('house','building','民居',0,30),entry('barracks','building','兵營',0,150),entry('farm','building','農田',0,60),entry('lumber-camp','building','伐木場',0,100),entry('mining-camp','building','採礦場',0,100),entry('mill','building','磨坊',0,100),entry('stable','building','馬廄',0,175,0,0,['age-2','barracks']),entry('archery-range','building','靶場',0,175,0,0,['age-2','barracks']),entry('monastery','building','修道院',0,175,0,0,['age-3']),entry('militia','unit','近戰民兵',60,0,20,0,['barracks'],1),entry('archer','unit','弓手',0,40,30,0,['age-2'],1),entry('ram','unit','攻城槌',0,160,75,0,['age-3'],3),entry('watch-tower','building','箭塔',0,25,0,125,['age-2']),entry('siege-workshop','building','攻城器工坊',0,200,0,0,['age-3','blacksmith']),entry('scout','unit','斥候',80,0,0,0,['stable'],1),entry('monk','unit','僧侶',0,0,100,0,['monastery'],1),entry('redemption','technology','救贖',0,0,475,0,['monastery','age-3']),entry('atonement','technology','贖罪',0,0,325,0,['monastery','age-3']),entry('sanctity','technology','聖潔',0,0,175,0,['monastery','age-3']),entry('heresy','technology','異端',0,0,1000,0,['monastery','age-3']),entry('illumination','technology','啟蒙',0,0,120,0,['monastery','age-4']),entry('block-printing','technology','活字印刷',0,0,200,0,['monastery','age-4']),entry('theocracy','technology','神權政治',0,0,200,0,['monastery','age-4']),entry('faith','technology','信仰',550,0,750,0,['monastery','age-4']),entry('spearman','unit','長槍兵',35,25,0,0,['age-2'],1),entry('skirmisher','unit','散兵',25,35,0,0,['age-2'],1),entry('knight','unit','騎士',60,0,75,0,['age-3'],1),entry('blacksmith','building','鐵匠鋪',0,150),
entry('man-at-arms','technology','重步兵',100,0,40,0,['age-2']),entry('long-swordsman','technology','長劍士',200,0,65,0,['age-3','man-at-arms']),entry('pikeman','technology','長矛兵',215,0,90,0,['age-3']),entry('crossbowman','technology','弩手',125,0,75,0,['age-3']),entry('elite-skirmisher','technology','精銳散兵',0,250,160,0,['age-3']),entry('light-cavalry','technology','輕騎兵',150,0,50,0,['age-3']),
entry('forging','technology','鍛造',150,0,0,0,['age-2']),entry('iron-casting','technology','鑄鐵',220,0,120,0,['age-3','forging']),entry('blast-furnace','technology','高爐',275,0,225,0,['age-4','iron-casting']),
entry('scale-mail-armor','technology','鱗甲',100,0,0,0,['age-2']),entry('chain-mail-armor','technology','鎖子甲',200,0,100,0,['age-3','scale-mail-armor']),entry('plate-mail-armor','technology','板甲',300,0,150,0,['age-4','chain-mail-armor']),
entry('scale-barding-armor','technology','鱗片馬鎧',150,0,0,0,['age-2']),entry('chain-barding-armor','technology','鎖子馬鎧',250,0,150,0,['age-3','scale-barding-armor']),entry('plate-barding-armor','technology','板甲馬鎧',350,0,200,0,['age-4','chain-barding-armor']),
entry('fletching','technology','羽箭',100,0,50,0,['age-2']),entry('bodkin-arrow','technology','錐形箭',200,0,100,0,['age-3','fletching']),entry('bracer','technology','護腕',300,0,200,0,['age-4','bodkin-arrow']),
entry('padded-archer-armor','technology','襯墊弓手甲',100,0,0,0,['age-2']),entry('leather-archer-armor','technology','皮革弓手甲',150,0,150,0,['age-3','padded-archer-armor']),entry('ring-archer-armor','technology','環甲弓手甲',250,0,250,0,['age-4','leather-archer-armor']),
entry('loom','technology','織布機',0,0,50),entry('wheelbarrow','technology','手推車',175,50,0,0,['age-2']),entry('hand-cart','technology','手拉車',300,200,0,0,['age-3','wheelbarrow']),entry('double-bit-axe','technology','雙刃斧',100,50,0,0,['age-2']),entry('bow-saw','technology','弓鋸',150,100,0,0,['age-3','double-bit-axe']),entry('two-man-saw','technology','雙人鋸',300,200,0,0,['age-4','bow-saw']),entry('gold-mining','technology','採金術',100,75,0,0,['age-2']),entry('gold-shaft-mining','technology','豎井採金',200,100,0,0,['age-3','gold-mining']),entry('stone-mining','technology','採石術',100,75,0,0,['age-2']),entry('stone-shaft-mining','technology','豎井採石',200,100,0,0,['age-3','stone-mining']),entry('horse-collar','technology','馬軛',75,75,0,0,['age-2']),entry('heavy-plow','technology','重犁',125,125,0,0,['age-3','horse-collar']),entry('crop-rotation','technology','輪耕',250,250,0,0,['age-4','heavy-plow']),entry('age-2','technology','第二時代',300),entry('age-3','technology','第三時代',500,0,200,0,['age-2']),entry('age-4','technology','第四時代',800,0,400,0,['age-3']),...castleEntries,...unitEntries,...techEntries,...buildingEntries],
 // Which building produces each unit/technology (design_default). null = defined but not producible yet.
 production:{villager:'town-center',militia:'barracks','man-at-arms':'barracks','long-swordsman':'barracks',spearman:'barracks',pikeman:'barracks',archer:'archery-range',crossbowman:'archery-range',skirmisher:'archery-range','elite-skirmisher':'archery-range',ram:'siege-workshop',scout:'stable','light-cavalry':'stable',knight:'stable',
 forging:'blacksmith','iron-casting':'blacksmith','blast-furnace':'blacksmith','scale-mail-armor':'blacksmith','chain-mail-armor':'blacksmith','plate-mail-armor':'blacksmith','scale-barding-armor':'blacksmith','chain-barding-armor':'blacksmith','plate-barding-armor':'blacksmith',fletching:'blacksmith','bodkin-arrow':'blacksmith',bracer:'blacksmith','padded-archer-armor':'blacksmith','leather-archer-armor':'blacksmith','ring-archer-armor':'blacksmith',monk:'monastery',redemption:'monastery',atonement:'monastery',sanctity:'monastery',heresy:'monastery',illumination:'monastery','block-printing':'monastery',theocracy:'monastery',faith:'monastery','double-bit-axe':'lumber-camp','bow-saw':'lumber-camp','two-man-saw':'lumber-camp','gold-mining':'mining-camp','gold-shaft-mining':'mining-camp','stone-mining':'mining-camp','stone-shaft-mining':'mining-camp','horse-collar':'mill','heavy-plow':'mill','crop-rotation':'mill','age-2':'town-center','age-3':'town-center','age-4':'town-center',
 // After the ages, so the town centre's age-up keeps its tile and hotkey.
 loom:'town-center',wheelbarrow:'town-center','hand-cart':'town-center',
 // The Castle: unique units, their elite upgrades and the unique technologies.
 ...Object.fromEntries(castleEntries.filter(e=>e.kind!=='building').map(e=>[e.id,'castle'])),...unitProducers,...techProducers,...buildingProducers},
 civilizations:[]
};
rules.civilizations=civilizationsOf(rules.entries);
// Availability under the lobby's 所有科技 setting (packages/sim/settings.ts).
export const allTechCivilizations=civilizationsOf(rules.entries,true);
// Runtime validator deliberately accepts unknown: pasted JSON is an untrusted boundary.
export function validateRules(value: unknown, exact=false): string[] {
 const errors: string[]=[];
 const obj=(v: unknown): v is Record<string,any> => typeof v==='object' && v!==null && !Array.isArray(v);
 if(!obj(value)) return ['規則必須是 JSON 物件'];
 if(value.schemaVersion!==1) errors.push('schemaVersion 必須為 1');
 if(typeof value.id!=='string'||!value.id.trim()) errors.push('規則 ID 不可空白');
 if(!obj(value.reference)) errors.push('缺少 reference');
 else {
  const r=value.reference;
  if(typeof r.game!=='string'||!r.game.trim()) errors.push('缺少 reference.game');
  if(!['unverified','verified_against_reference'].includes(r.verificationStatus)) errors.push('無效 reference verificationStatus');
  for(const k of ['version','build']) if(r[k]!==null&&(typeof r[k]!=='string'||!r[k].trim())) errors.push(`無效 reference.${k}`);
  if(!Array.isArray(r.contentPacks)||!r.contentPacks.every((x:unknown)=>typeof x==='string')) errors.push('contentPacks 必須為字串陣列');
  if(!Array.isArray(r.sourceEvidence)||!r.sourceEvidence.every((x:unknown)=>typeof x==='string')) errors.push('sourceEvidence 必須為字串陣列');
  if((exact||r.verificationStatus==='verified_against_reference')&&(!r.version||!r.build||!r.sourceEvidence?.length)) errors.push('原作精確驗證失敗：版本、build 與來源證據尚未確認');
 }
 if(!obj(value.coverage)||!(value.coverage.contentDenominator===null||Number.isSafeInteger(value.coverage.contentDenominator)&&value.coverage.contentDenominator>0)||value.coverage.exactReferenceCoveragePercent!==null) errors.push('此階段 coverage 分母可為 unknown，原作覆蓋率必須為 null');
 if(!obj(value.settings)) errors.push('缺少 settings');
 else {for(const k of ['tickHz','populationCap','mapSize','speed']) if(!Number.isSafeInteger(value.settings[k])||value.settings[k]<=0) errors.push(`settings.${k} 必須為正整數`);
 if(!Number.isSafeInteger(value.settings.seed)||value.settings.seed<0||value.settings.seed>4294967295) errors.push('seed 必須為 uint32');
 if(value.settings.provenance!=='design_default') errors.push('此切片參數必須標記 design_default');}
 if(!Array.isArray(value.entries)) return [...errors,'entries 必須為陣列'];
 const entries=value.entries.filter(obj); if(entries.length!==value.entries.length) errors.push('entry 必須為物件');
 const ids=new Set<string>();
 for(const e of entries){
  if(typeof e.id!=='string'||!e.id.trim()) errors.push('entry ID 不可空白');
  else if(ids.has(e.id)) errors.push(`重複 ID：${e.id}`); else ids.add(e.id);
  if(!['unit','building','technology'].includes(e.kind)||typeof e.name!=='string') errors.push(`${e.id} 類型或名稱無效`);
  if(e.referenceVersion!==null||!Array.isArray(e.sourceEvidence)||!e.sourceEvidence.length||!Array.isArray(e.testEvidence)||!['not_started','in_progress'].includes(e.implementationStatus)) errors.push(`${e.id} 追蹤資料無效`);
  if(e.verificationStatus!=='design_default') errors.push(`${e.id} 缺少 design_default`);
  for(const k of resources) if(!obj(e.cost)||!Number.isSafeInteger(e.cost[k])||e.cost[k]<0) errors.push(`${e.id} 無效成本 ${k}`);
  for(const k of ['time','population']) if(!Number.isSafeInteger(e[k])||e[k]<0) errors.push(`${e.id} 無效 ${k}`);
  if(!Array.isArray(e.requires)||!e.requires.every((v:unknown)=>typeof v==='string')) errors.push(`${e.id} requires 必須為字串陣列`);
 }
 const graph=new Map(entries.map(e=>[e.id,Array.isArray(e.requires)?e.requires:[]]));
 const visiting=new Set(),done=new Set();
 function visit(id:string){if(visiting.has(id)){errors.push(`科技圖循環：${id}`);return;} if(done.has(id))return; visiting.add(id);
 for(const dep of graph.get(id)||[]) {if(!ids.has(dep))errors.push(`${id} 懸空前置：${dep}`);else visit(dep);} visiting.delete(id);done.add(id);}
 for(const id of ids)visit(id);
 if(!Array.isArray(value.civilizations))errors.push('civilizations 必須為陣列');
 else {const civIds=new Set();for(const c of value.civilizations){if(!obj(c)||typeof c.id!=='string'||!Array.isArray(c.available)||!Array.isArray(c.unavailable)){errors.push('文明格式無效');continue;}
 if(civIds.has(c.id))errors.push(`重複文明 ID：${c.id}`);civIds.add(c.id);
 for(const id of [...c.available,...c.unavailable])if(!ids.has(id))errors.push(`${c.id} 懸空內容：${id}`);
 for(const id of c.available)if(c.unavailable.includes(id))errors.push(`${c.id} 禁用項出現在可用列表：${id}`);
 // Every entry is either available or not, and nothing available depends on something the civ lacks.
 for(const id of ids)if(!c.available.includes(id)&&!c.unavailable.includes(id))errors.push(`${c.id} 未標明是否可用：${id}`);
 for(const e of entries)if(c.available.includes(e.id)){for(const dep of Array.isArray(e.requires)?e.requires:[])if(ids.has(dep)&&!c.available.includes(dep))errors.push(`${c.id} 的 ${e.id} 需要不可用的 ${dep}`);
  const producer=obj(value.production)?value.production[e.id]:undefined;if(typeof producer==='string'&&!c.available.includes(producer))errors.push(`${c.id} 的 ${e.id} 沒有可用的生產建築 ${producer}`);}}}
 // Every unit and technology names its producer (or null); producers must be buildings.
 if(!obj(value.production))errors.push('production 必須為物件');
 else{const kinds=new Map(entries.map(e=>[e.id,e.kind]));
  for(const e of entries)if((e.kind==='unit'||e.kind==='technology')&&!(e.id in value.production))errors.push(`${e.id} 缺少生產建築`);
  for(const [id,producer] of Object.entries(value.production)){if(!kinds.has(id)||kinds.get(id)==='building')errors.push(`production 未知項目：${id}`);if(producer!==null&&kinds.get(producer as string)!=='building')errors.push(`${id} 的生產建築無效：${producer}`);}}
 return [...new Set(errors)];
}
