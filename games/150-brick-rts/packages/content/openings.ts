// The 戰術技巧 round: the openings on aoetw.com's tactics pages (pages/ar, Arabia one-on-one, fetched 2026-10-02 from
// github.com/webrsb/aoetw). Data only: the computer plays them (packages/sim/ai.ts), the page's practice coach and the
// codex show their steps. Every number is design_default in this game's scale:
// - Population: this game's cap is 40 (the reference's 200) and the computer's economy aims at a dozen villagers, so the
//   site's villager counts are halved (its 22p click-up, 21 villagers and the scout, becomes 10 villagers here). The
//   scout is never counted.
// - The Feudal Age costs 300 food here (the site's timings assume 500): "click up when the food is there" means 300.
// - Deer cannot be pushed (趕鹿): a deer only runs from the hunter that strikes it, so those steps are left out.
// - Boar: the site's 殺豬 steps are 打獵 here (a boar or a deer; the computer hunts deer, never a boar).
// - Walls (圍家) are advice in the steps; the computer does not wall.
export type Gather='sheep'|'hunt'|'berries'|'wood'|'gold'|'stone'|'farm';
export const gatherKinds:readonly Gather[]=['sheep','hunt','berries','wood','gold','stone','farm'];
export const gatherNames:Readonly<Record<Gather,string>>={sheep:'羊肉',hunt:'打獵',berries:'果樹',wood:'木材',gold:'黃金',stone:'石頭',farm:'農田'};
// What a step needs to count as done, checked against an OpeningView (all given parts at least as high):
// villagers: own villagers; gather: villagers on that source; buildings: own buildings of a kind (foundations count);
// forward: own villagers ('villager') or buildings on the opponent's half of the map; units: own units of a kind;
// techs: researched; age: reached; clicked: that age reached or being researched; raiding: own soldiers on the
// opponent's half (the exploring scout not counted).
export type Need={villagers?:number;gather?:Partial<Record<Gather,number>>;buildings?:Readonly<Record<string,number>>;forward?:Readonly<Record<string,number>>;units?:Readonly<Record<string,number>>;techs?:readonly string[];age?:number;clicked?:number;raiding?:number};
// done null: advice only (no check).
export type OpeningStep={label:string;phase:'dark'|'up'|'feudal'|'castle';done:Need|null};
export type Weights=Readonly<Record<'food'|'wood'|'gold'|'stone',number>>;
// What the computer does (ai.ts). villagers: villager target while the opening runs; clickAt: villagers when it researches
// the Feudal Age (clickOnFood: as soon as the food is there, from clickAt villagers); loom: Loom first; barracks: when
// it goes up ('dark' at barracksAt villagers, 'up' while the Feudal Age is researched, 'none' not during the opening);
// forwardBarracks: built by the forward villagers near the opponent instead; weights: villagers per resource before
// clicking, while clicking and after; dark/up/feudal train: units kept up to that many (counting the dead as gone) in
// that phase; build: extra buildings in the Feudal Age; research: technologies first in line; raid: these kinds go for
// the opponent's villagers once sendAt of them stand (reinforce: later ones follow); train counts include the exploring
// scout (scout:4 is three raiders); towers: builders forward villagers
// raise count watch towers by the opponent's resources (prefer: the resource kinds tried first; stone stops counting in
// the weights once the towers still to build are paid for); castle: the Castle Age
// right after the Feudal Age; until: the opening hands over to the normal plan at this tick or age.
export type OpeningPlan={villagers:number;clickAt:number;clickOnFood?:boolean;loom:boolean;barracks:'dark'|'up'|'none';barracksAt?:number;forwardBarracks?:number;
 weights:{dark:Weights;up:Weights;feudal:Weights};
 train:{dark?:Readonly<Record<string,number>>;up?:Readonly<Record<string,number>>;feudal?:Readonly<Record<string,number>>};
 build:readonly {kind:string;count:number}[];research:readonly string[];
 raid:{kinds:readonly string[];sendAt:number;reinforce:boolean}|null;
 towers:{builders:number;count:number;prefer:readonly string[];leave:'start'|'click'}|null;
 castle:boolean;until:{tick:number;age?:number}};
export type Opening={id:string;zh:string;en:string;page:string;age:number;power:string;difficulty:string;pros:string;cons:string;
 // civs: this game's civilizations the site says it suits (all 13 when it says every civ); best: the ones it singles out.
 civs:readonly string[];best:readonly string[];counters:readonly string[];allocation:string;siteAllocation:string;
 steps:readonly OpeningStep[];plan:OpeningPlan;notes:readonly string[]};
const all=['britons','celts','franks','goths','teutons','vikings','byzantines','persians','saracens','turks','chinese','japanese','mongols'] as const;
const w=(food:number,wood:number,gold=0,stone=0):Weights=>({food,wood,gold,stone});
const site=(page:string)=>`aoetw.com/ar/${page}`;
// The Dark Age beginning the site's flows share (2–7p sheep, 8–11p wood, 12p boar, 13–16p berries), halved.
const opening:OpeningStep[]=[
 {label:'村民 1–3：3 人採羊肉',phase:'dark',done:{villagers:3,gather:{sheep:3}}},
 {label:'村民 4–5：2 人伐木',phase:'dark',done:{villagers:5,gather:{wood:2}}},
 {label:'村民 6：1 人打獵（野豬或鹿）',phase:'dark',done:{villagers:6,gather:{hunt:1}}},
 {label:'村民 7–8：2 人採果樹',phase:'dark',done:{villagers:8,gather:{berries:2}}},
];
const loom:OpeningStep={label:'研究織布機',phase:'dark',done:{techs:['loom']}};
const up=(n:number):OpeningStep=>({label:`村民 ${n} 人：升第二時代`,phase:'dark',done:{villagers:n,clicked:2}});
export const standardOpening='standard';
export const randomOpening='random';
export const openings:readonly Opening[]=[
 {id:'scrush',zh:'肉馬開局',en:'Scout rush',page:site('scrush'),age:2,power:'普',difficulty:'控經濟簡單、控馬較難',pros:'幾乎任何文明可用，靈活度高',cons:'遇到圍死或裝甲塔會吃虧',
  civs:all,best:['mongols'],counters:['把家圍死','裝甲塔','大量弓兵','大量長槍兵（這時轉散兵或弓兵）'],allocation:'升級前：食物 5（羊、果樹、農田）、木材 5',siteAllocation:'5羊2田4果10木（22 人口）',
  steps:[...opening,{label:'村民 9–10：2 人伐木',phase:'dark',done:{villagers:10,gather:{wood:4}}},loom,up(10),
   {label:'升級中蓋兵營',phase:'up',done:{buildings:{barracks:1}}},{label:'第二時代：蓋馬廄',phase:'feudal',done:{age:2,buildings:{stable:1}}},
   {label:'研究雙刃斧與馬軛',phase:'feudal',done:{techs:['double-bit-axe','horse-collar']}},
   {label:'訓練 3 隻斥候，騷擾對方的採集點',phase:'feudal',done:{units:{scout:4},raiding:1}},
   {label:'新村民去種田',phase:'feudal',done:{gather:{farm:3}}},
   {label:'對方出長槍兵就轉散兵或弓兵',phase:'feudal',done:null}],
  plan:{villagers:12,clickAt:10,loom:true,barracks:'up',weights:{dark:w(5,5),up:w(5,5),feudal:w(8,3,1)},train:{feudal:{scout:4}},build:[{kind:'stable',count:1}],research:['double-bit-axe','horse-collar'],
   raid:{kinds:['scout'],sendAt:2,reinforce:true},towers:null,castle:false,until:{tick:9600}},
  notes:['斥候人口含開局斥候：訓練 3 隻後共 4 隻，開局那隻繼續偵察。']},
 {id:'archerstar',zh:'小弓開局',en:'Archer opening',page:site('archerstar'),age:2,power:'強',difficulty:'普',pros:'威力強，但成形慢',cons:'成形慢，容易被肉馬轉矛打死',
  civs:all,best:['britons'],counters:['散兵','先用斥候搶攻，再轉散兵'],allocation:'升級前：食物 5（羊、果樹、農田）、木材 5；點封後 2 人挖金',siteAllocation:'12木4金4果2田',
  steps:[...opening,{label:'村民 9–10：2 人種田',phase:'dark',done:{villagers:10,gather:{farm:2}}},loom,up(10),
   {label:'點封後 2 人挖金',phase:'up',done:{gather:{gold:2}}},{label:'升級中蓋兵營',phase:'up',done:{buildings:{barracks:1}}},
   {label:'第二時代：蓋兩座靶場',phase:'feudal',done:{age:2,buildings:{'archery-range':2}}},
   {label:'先出 1 隻長槍兵防斥候',phase:'feudal',done:{units:{spearman:1}}},
   {label:'弓手 6 名後出擊',phase:'feudal',done:{units:{archer:6},raiding:1}},
   {label:'對方出散兵就混長槍兵或散兵',phase:'feudal',done:null}],
  plan:{villagers:12,clickAt:10,loom:true,barracks:'up',weights:{dark:w(5,5),up:w(3,5,2),feudal:w(2,6,3)},train:{feudal:{spearman:1,archer:12}},build:[{kind:'archery-range',count:2}],research:[],
   raid:{kinds:['archer'],sendAt:6,reinforce:true},towers:null,castle:false,until:{tick:9600}},
  notes:['網站的資訊框寫「弓兵國」，內文寫所有文明都適合；這裡照內文。']},
 {id:'armstar',zh:'裝甲開局',en:'Men-at-arms opening',page:site('armstar'),age:2,power:'普',difficulty:'普',pros:'封建初期近戰最強，可擋前置與黑快',cons:'怕弓兵，封建中後期走得慢',
  civs:all,best:[],counters:['弓兵','把家圍死'],allocation:'升級前：食物 5、木材 4、黃金 1',siteAllocation:'5羊2田4果8木2金',
  steps:[...opening,{label:'村民 9：1 人挖金',phase:'dark',done:{villagers:9,gather:{gold:1}}},{label:'蓋兵營',phase:'dark',done:{buildings:{barracks:1}}},
   {label:'村民 10：伐木',phase:'dark',done:{villagers:10,gather:{wood:3}}},loom,up(10),
   {label:'點封後立刻出 3 隻民兵去騷擾',phase:'up',done:{units:{militia:3},raiding:1}},
   {label:'第二時代：民兵還活著就研究重步兵',phase:'feudal',done:{age:2,techs:['man-at-arms']}},
   {label:'家裡改蓋靶場或馬廄',phase:'feudal',done:{buildings:{'archery-range':1}}},
   {label:'接著配弓兵或斥候進攻',phase:'feudal',done:null}],
  plan:{villagers:12,clickAt:10,loom:true,barracks:'dark',barracksAt:9,weights:{dark:w(5,4,1),up:w(5,3,2),feudal:w(5,4,2)},train:{up:{militia:3},feudal:{militia:3}},build:[{kind:'archery-range',count:1}],research:['man-at-arms'],
   raid:{kinds:['militia'],sendAt:3,reinforce:false},towers:null,castle:false,until:{tick:9600}},
  notes:['網站這頁的資訊框（適合文明、難度、優缺點）是從肉馬開局複製來的；這裡的優缺點照內文。']},
 {id:'armstower',zh:'裝甲塔',en:'Men-at-arms into towers',page:site('armstower'),age:2,power:'非常強',difficulty:'難',pros:'幾乎任何文明可用，威力極大',cons:'吃控制力與運氣',
  civs:all,best:['japanese','goths','celts'],counters:['黑暗民兵或斥候抓前置的村民','村民圍住塔下拆塔'],allocation:'升級前：食物 5、木材 2、黃金 1；點封後 2 人採石、2 人前置',siteAllocation:'點封後 3～4 人前置、4 人採石',
  steps:[...opening,{label:'村民 9：蓋兵營',phase:'dark',done:{villagers:9,buildings:{barracks:1}}},{label:'村民 10：1 人挖金',phase:'dark',done:{villagers:10,gather:{gold:1}}},loom,up(10),
   {label:'點封後出 3 隻民兵',phase:'up',done:{units:{militia:3}}},{label:'2 人採石頭',phase:'up',done:{gather:{stone:2}}},
   {label:'2 名村民前往對方家',phase:'up',done:{forward:{villager:2}}},
   {label:'第二時代：研究重步兵',phase:'feudal',done:{age:2,techs:['man-at-arms']}},
   {label:'在對方的資源點蓋箭塔',phase:'feudal',done:{forward:{'watch-tower':1}}},
   {label:'連環插塔',phase:'feudal',done:{forward:{'watch-tower':2}}},
   {label:'新村民去種田',phase:'feudal',done:{gather:{farm:2}}}],
  plan:{villagers:12,clickAt:10,loom:true,barracks:'dark',barracksAt:9,weights:{dark:w(5,2,1),up:w(4,2,1,2),feudal:w(4,3,1,2)},train:{up:{militia:3},feudal:{militia:3}},build:[],research:['man-at-arms'],
   raid:{kinds:['militia'],sendAt:3,reinforce:false},towers:{builders:2,count:2,prefer:['berries','gold','stone'],leave:'click'},castle:false,until:{tick:10800}},
  notes:['網站說第一座塔蓋在好封鎖的地方，對馬國先封果樹，對弓兵國先封黃金；電腦依果樹、黃金、石頭的順序找。','網站建議塔下蓋牆，電腦不蓋。']},
 {id:'towerrush',zh:'純塔',en:'Tower rush',page:site('towerrush'),age:2,power:'看地形',difficulty:'難',pros:'幾乎任何文明可用',cons:'吃運氣與地形',
  civs:all,best:['mongols','teutons'],counters:['偵察找出前置的村民，在第一座塔蓋好前打掉','塔蓋好了就挖石頭、研究城鎮瞭望，以塔守塔','對方家裡空虛，派斥候或弓兵反打'],allocation:'升級前：食物 4、木材 1、石頭 3；點封後 3 人前置',siteAllocation:'7人前置2木5石5果',
  steps:[opening[0],{label:'村民 4：1 人伐木',phase:'dark',done:{villagers:4,gather:{wood:1}}},{label:'村民 5：1 人打獵',phase:'dark',done:{villagers:5,gather:{hunt:1}}},
   {label:'村民 6–7：2 人採果樹',phase:'dark',done:{villagers:7,gather:{berries:2}}},{label:'村民 8–9：蓋採礦場採石頭',phase:'dark',done:{villagers:9,buildings:{'mining-camp':1},gather:{stone:2}}},
   loom,up(9),{label:'點封後 3 名村民前往對方家',phase:'up',done:{forward:{villager:3}}},
   {label:'第二時代：在對方的石頭或資源區同時蓋兩座塔',phase:'feudal',done:{age:2,forward:{'watch-tower':2}}},
   {label:'繼續連環插塔',phase:'feudal',done:{forward:{'watch-tower':3}}},
   {label:'對方來拆塔時立刻在塔下蓋木牆',phase:'feudal',done:null}],
  plan:{villagers:12,clickAt:9,loom:true,barracks:'none',weights:{dark:w(4,1,0,3),up:w(3,1,0,3),feudal:w(4,2,0,3)},train:{},build:[],research:[],
   raid:null,towers:{builders:3,count:3,prefer:['stone','gold','berries'],leave:'click'},castle:false,until:{tick:10800}},
  notes:['網站 20 人口（19 名村民）點封建，這裡 9 名。','不蓋兵營，省下的木材給塔。']},
 {id:'bbrush',zh:'黑暗爆民兵',en:'Dark Age militia rush',page:site('bbrush'),age:1,power:'弱',difficulty:'普',pros:'升級時放長槍兵可以無縫接軌',cons:'很好防，木牆就擋得住',
  civs:all,best:[],counters:['有效的圍牆','上封建後出弓兵'],allocation:'升級前：食物 5、木材 3、黃金 2，兵營不停出民兵',siteAllocation:'19～20p 蓋軍營，之後村民和民兵不斷',
  steps:[...opening,{label:'村民 9：1 人挖金',phase:'dark',done:{villagers:9,gather:{gold:1}}},{label:'蓋兵營（可前置或後置）',phase:'dark',done:{buildings:{barracks:1}}},
   {label:'村民與民兵不斷生產',phase:'dark',done:{units:{militia:3}}},{label:'民兵 3 隻後去騷擾，優先打黃金區',phase:'dark',done:{raiding:1}},
   {label:'食物到 300 就升第二時代',phase:'dark',done:{clicked:2}},{label:'家裡適時蓋木牆',phase:'dark',done:{buildings:{'palisade-wall':3}}},
   {label:'上封建後短暫停留，直接跳城堡',phase:'feudal',done:null}],
  plan:{villagers:10,clickAt:9,clickOnFood:true,loom:false,barracks:'dark',barracksAt:9,weights:{dark:w(5,3,2),up:w(5,3,2),feudal:w(5,3,2)},train:{dark:{militia:6},up:{militia:6}},build:[],research:[],
   raid:{kinds:['militia'],sendAt:3,reinforce:true},towers:null,castle:false,until:{tick:8400}},
  notes:['網站寫「食物達 500 即點封建」，本作第二時代 300 食物。','電腦不蓋牆。']},
 {id:'brushtof',zh:'黑快轉封',en:'Drush into Feudal',page:site('brushtof'),age:2,power:'普',difficulty:'難',pros:'經濟比 22 人口上封建更好，打法靈活',cons:'很吃控制力',
  civs:all,best:[],counters:['家裡小圍，不讓民兵鬧到','上封建後斥候配村民清掉民兵，再反打'],allocation:'黑暗出 3 隻民兵，村民到 12 名點封建，2 人挖金',siteAllocation:'28 人口（含 3 民兵）點封建，挖金 1～4 人',
  steps:[...opening,{label:'村民 9：1 人挖金',phase:'dark',done:{villagers:9,gather:{gold:1}}},{label:'村民 10：蓋兵營',phase:'dark',done:{villagers:10,buildings:{barracks:1}}},
   {label:'出 3 隻民兵出發騷擾',phase:'dark',done:{units:{militia:3},raiding:1}},{label:'挖金增加到 2 人',phase:'dark',done:{gather:{gold:2}}},up(12),
   {label:'第二時代：民兵還多就研究重步兵',phase:'feudal',done:{age:2,techs:['man-at-arms']}},
   {label:'看對方配兵轉長槍兵或弓兵（蓋靶場）',phase:'feudal',done:{buildings:{'archery-range':1}}}],
  plan:{villagers:12,clickAt:12,loom:true,barracks:'dark',barracksAt:10,weights:{dark:w(5,3,2),up:w(5,3,2),feudal:w(5,4,2)},train:{dark:{militia:3},up:{militia:3},feudal:{militia:3}},build:[{kind:'archery-range',count:1}],research:['man-at-arms'],
   raid:{kinds:['militia'],sendAt:3,reinforce:false},towers:null,castle:false,until:{tick:10800}},
  notes:['網站 28 人口（25 名村民）點封建，這裡 12 名。','網站寫「一定要趕鹿」，本作的鹿趕不動。','網站這頁的資訊框是從黑快搶城複製來的；這裡的優缺點照內文。']},
 {id:'brushfc',zh:'黑快搶城',en:'Drush fast castle',page:site('brushfc'),age:3,power:'普',difficulty:'難',pros:'地形好的話非常好打',cons:'地形差的話對方非常好打，很怕裝甲塔',
  civs:all,best:['britons','vikings'],counters:['看到對方很晚上封建，就派 3 名村民前置箭塔，家裡挖石頭','對方圍死就跟著圍家，比誰先到城堡時代'],allocation:'黑暗出 3 隻民兵，村民到 15 名點封建，3 人挖金',siteAllocation:'總人口 33，挖金 4～6 人',
  steps:[...opening,{label:'村民 9：1 人挖金',phase:'dark',done:{villagers:9,gather:{gold:1}}},{label:'村民 10：蓋兵營',phase:'dark',done:{villagers:10,buildings:{barracks:1}}},
   {label:'出 3 隻民兵出發爭取時間',phase:'dark',done:{units:{militia:3},raiding:1}},{label:'挖金增加到 3 人',phase:'dark',done:{gather:{gold:3}}},up(15),
   {label:'趁對方封建進攻前把家圍好',phase:'up',done:null},
   {label:'第二時代：立刻升第三時代',phase:'feudal',done:{clicked:3}},
   {label:'第三時代：出騎士或城堡兵打對方經濟',phase:'castle',done:{age:3,buildings:{stable:1}}}],
  plan:{villagers:15,clickAt:15,loom:true,barracks:'dark',barracksAt:10,weights:{dark:w(6,4,2),up:w(6,4,3),feudal:w(6,4,3)},train:{dark:{militia:3}},build:[],research:[],
   raid:{kinds:['militia'],sendAt:3,reinforce:false},towers:null,castle:true,until:{tick:14400,age:3}},
  notes:['網站總人口 33（約 29 名村民），這裡 15 名村民。','網站的資訊框寫封建時代，其實是搶城堡的打法。','電腦不圍家，上城堡後由一般打法接手（城堡、特殊單位、騎士）。']},
 {id:'fontrush',zh:'前置槍矛',en:'Forward spears and skirmishers',page:site('fontrush'),age:2,power:'強',difficulty:'普',pros:'壓迫感強，還算能剋肉馬與小弓開局',cons:'風險高，報酬不如裝甲塔',
  civs:all,best:['byzantines'],counters:['黑暗民兵轉裝甲抓前置的村民','沒抓到就囤斥候加散兵反打'],allocation:'升級前：食物 5、木材 5；點封後 2 人前置、2 人採石',siteAllocation:'12木4金6果，點封後 3 人前置',
  steps:[...opening,{label:'村民 9–10：2 人伐木',phase:'dark',done:{villagers:10,gather:{wood:4}}},loom,up(10),
   {label:'點封後 2 名村民前置兵營',phase:'up',done:{forward:{barracks:1}}},{label:'2 人挖石頭',phase:'up',done:{gather:{stone:2}}},
   {label:'第二時代：先出長槍兵',phase:'feudal',done:{age:2,units:{spearman:2}}},
   {label:'蓋兩座靶場出散兵',phase:'feudal',done:{buildings:{'archery-range':2},units:{skirmisher:3}}},
   {label:'在對方資源區插箭塔，槍矛掩護推進',phase:'feudal',done:{forward:{'watch-tower':1},raiding:1}}],
  plan:{villagers:12,clickAt:10,loom:true,barracks:'none',forwardBarracks:2,weights:{dark:w(5,5),up:w(4,4,1,2),feudal:w(4,4,2,2)},train:{feudal:{spearman:3,skirmisher:6}},build:[{kind:'archery-range',count:2}],research:[],
   raid:{kinds:['spearman','skirmisher'],sendAt:5,reinforce:true},towers:{builders:2,count:1,prefer:['gold','berries','stone'],leave:'click'},castle:false,until:{tick:10800}},
  notes:['網站的「矛兵」是本作的散兵，「槍兵」是長槍兵。','網站這頁的優缺點是從小弓開局複製來的；這裡照內文。']},
];
// On the site's list but not playable here.
export const unavailableOpenings:readonly {id:string;zh:string;en:string;page:string;reason:string}[]=[
 {id:'eglerush',zh:'老鷹開局',en:'Eagle scout opening',page:site('eglerush'),reason:'要用鷹斥候，那是中美洲三國的單位；本作的 13 個原版文明都沒有'}];
export const openingById=(id:string)=>openings.find(o=>o.id===id);
// The computer's choice: 'standard' (its normal plan), a playable opening's id, or 'random' (resolved at the start).
export const openingChoices:readonly string[]=[standardOpening,randomOpening,...openings.map(o=>o.id)];
// A random pick for a civilization: the openings the site singles out for it, else any; deterministic from the seed.
export function pickOpening(seed:number,civ:string){const best=openings.filter(o=>o.best.includes(civ)),pool=best.length?best:openings;
 return pool[(Math.imul(seed>>>0,2654435761)>>>0)%pool.length].id;}
// A player's progress as the coach and the tests read it (packages/sim/ai.ts openingView builds it from the state).
export type OpeningView={age:number;clicking:number;villagers:number;gather:Readonly<Record<Gather,number>>;buildings:Readonly<Record<string,number>>;forward:Readonly<Record<string,number>>;units:Readonly<Record<string,number>>;techs:readonly string[];raiding:number};
export function needMet(need:Need,v:OpeningView){
 const atLeast=(have:Readonly<Record<string,number>>,want:Readonly<Record<string,number>>|undefined)=>!want||Object.entries(want).every(([k,n])=>(have[k]??0)>=n);
 return (need.villagers===undefined||v.villagers>=need.villagers)&&(need.age===undefined||v.age>=need.age)&&(need.clicked===undefined||Math.max(v.age,v.clicking)>=need.clicked)
  &&(need.raiding===undefined||v.raiding>=need.raiding)&&(!need.techs||need.techs.every(t=>v.techs.includes(t)))
  &&atLeast(v.gather,need.gather as Record<string,number>|undefined)&&atLeast(v.buildings,need.buildings)&&atLeast(v.forward,need.forward)&&atLeast(v.units,need.units);}
