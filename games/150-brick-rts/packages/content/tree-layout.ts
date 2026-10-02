// The site's tech tree grid (aoetw.com/tree/*.vue, the 13 civ pages share it; recorded from bri.vue by the 科技樹 round's
// audit, scratchpad tree-audit.json): one block per building in page order, rows by age, cells by column (1-based after the
// age label), each item a game entry id or a reference item the game lacks (its site name and page), down: the site's
// arrow to the next step. The castle's unique unit and unique technology cells differ by civ: '@unique-unit' and
// '@unique-tech' stand for them. Layout only: availability always comes from rules.ts.
export type TreeLayoutItem={id?:string;ref?:string;path?:string;down?:boolean};
export type TreeLayoutBlock={id:string;rows:readonly {age:number;cells:readonly (readonly TreeLayoutItem[])[]}[]};
export const treeLayout:readonly TreeLayoutBlock[]=[
 {id:'barracks',rows:[
  {age:1,cells:[[{id:'militia',down:true}],[],[],[],[]]},
  {age:2,cells:[[{id:'man-at-arms',down:true}],[{id:'spearman',down:true}],[{ref:'鷹斥候',path:'/units/Eagle_Scout',down:true}],[{id:'supplies'}],[]]},
  {age:3,cells:[[{id:'long-swordsman',down:true}],[{id:'pikeman',down:true}],[{ref:'鷹勇士',path:'/units/Eagle_Warrior',down:true}],[{id:'squires'}],[{id:'arson'}]]},
  {age:4,cells:[[{id:'two-handed-swordsman',down:true},{id:'champion'}],[{id:'halberdier'}],[{ref:'精銳鷹勇士',path:'/units/Elite_Eagle_Warrior'}],[{ref:'傭兵',path:'/units/Condottiero'}],[]]}]},
 {id:'archery-range',rows:[
  {age:2,cells:[[{id:'archer',down:true}],[{id:'skirmisher',down:true}],[],[],[],[]]},
  {age:3,cells:[[{id:'crossbowman',down:true}],[{id:'elite-skirmisher',down:true}],[{id:'cavalry-archer',down:true}],[{ref:'投石手',path:'/units/Slinger'}],[{ref:'標槍騎兵',path:'/units/Genitour',down:true}],[{id:'thumb-ring'}]]},
  {age:4,cells:[[{id:'arbalest'}],[{ref:'帝王戰矛兵',path:'/units/Imperial_Skirmisher'}],[{id:'heavy-cavalry-archer'}],[{id:'hand-cannoneer'}],[{ref:'精銳標槍騎兵',path:'/units/Genitour'}],[{id:'parthian-tactics'}]]}]},
 {id:'stable',rows:[
  {age:2,cells:[[{id:'scout',down:true}],[{id:'bloodlines'}],[],[],[]]},
  {age:3,cells:[[{id:'light-cavalry',down:true}],[{id:'knight',down:true}],[{id:'camel',down:true}],[{ref:'矛象伕',path:'/units/Battle_Elephant',down:true}],[{id:'husbandry'}]]},
  {age:4,cells:[[{id:'hussar'}],[{id:'cavalier',down:true},{id:'paladin'}],[{id:'heavy-camel',down:true},{ref:'帝王駱駝騎兵',path:'/units/Imperial_Camel_Rider'}],[{ref:'精銳矛象伕',path:'/units/Elite_Battle_Elephant'}],[]]}]},
 {id:'siege-workshop',rows:[
  {age:3,cells:[[{id:'ram',down:true}],[{id:'mangonel',down:true}],[{id:'scorpion',down:true}],[{ref:'攻城塔',path:'/units/Siege_Tower'}]]},
  {age:4,cells:[[{id:'capped-ram',down:true},{id:'siege-ram'}],[{id:'onager',down:true},{id:'siege-onager'}],[{id:'heavy-scorpion'}],[{id:'bombard-cannon'}]]}]},
 {id:'castle',rows:[
  {age:3,cells:[[{id:'@unique-unit'}],[{id:'petard'}],[{id:'@unique-tech'}],[],[],[],[],[]]},
  {age:4,cells:[[{id:'@unique-unit'}],[{id:'trebuchet'}],[{id:'@unique-tech'}],[{id:'hoardings'}],[{id:'sappers'}],[{id:'conscription'}],[{ref:'間諜',path:'/techs/Spies'}]]}]},
 {id:'town-center',rows:[
  {age:1,cells:[[{id:'villager'}],[{id:'age-2',down:true}],[{id:'loom'}],[]]},
  {age:2,cells:[[{id:'town-watch',down:true}],[{id:'age-3',down:true}],[{id:'wheelbarrow',down:true}],[]]},
  {age:3,cells:[[{id:'town-patrol'}],[{id:'age-4'}],[{id:'hand-cart'}],[]]}]},
 {id:'mill',rows:[
  {age:1,cells:[[{id:'farm'}],[],[],[]]},
  {age:2,cells:[[{id:'horse-collar',down:true}],[],[],[]]},
  {age:3,cells:[[{id:'heavy-plow',down:true}],[],[],[]]},
  {age:4,cells:[[{id:'crop-rotation'}],[],[],[]]}]},
 {id:'lumber-camp',rows:[
  {age:2,cells:[[{id:'double-bit-axe',down:true}],[],[],[]]},
  {age:3,cells:[[{id:'bow-saw',down:true}],[],[],[]]},
  {age:4,cells:[[{id:'two-man-saw'}],[],[],[]]}]},
 {id:'mining-camp',rows:[
  {age:2,cells:[[{id:'gold-mining',down:true}],[{id:'stone-mining',down:true}],[],[]]},
  {age:3,cells:[[{id:'gold-shaft-mining'}],[{id:'stone-shaft-mining'}],[],[]]}]},
 {id:'dock',rows:[
  {age:1,cells:[[{id:'fishing-ship'}],[{id:'transport-ship'}],[],[],[],[],[],[],[]]},
  {age:2,cells:[[{id:'fire-galley',down:true}],[{id:'demolition-raft',down:true}],[{id:'galley',down:true}],[{id:'trade-cog'}],[],[],[],[],[{id:'fish-trap'}]]},
  {age:3,cells:[[{id:'war-galley',down:true}],[{id:'war-galley',down:true}],[{id:'war-galley',down:true}],[{id:'longboat',down:true}],[{ref:'龜甲船',path:'/units/Turtle_Ship',down:true}],[{ref:'卡拉維爾戰船',path:'/units/Caravel',down:true}],[{id:'gillnets'}],[{id:'careening',down:true}],[],[]]},
  {age:4,cells:[[{id:'fast-fire-ship'}],[{id:'heavy-demolition-ship'}],[{id:'galleon'}],[{id:'elite-longboat'}],[{ref:'精銳龜甲船',path:'/units/Turtle_Ship'}],[{ref:'精銳卡拉維爾戰船',path:'/units/Caravel'}],[{id:'cannon-galleon',down:true},{id:'elite-cannon-galleon'}],[{id:'dry-dock'}],[{id:'shipwright'}]]}]},
 {id:'blacksmith',rows:[
  {age:2,cells:[[{id:'padded-archer-armor'}],[{id:'fletching',down:true}],[{id:'forging',down:true}],[{id:'scale-barding-armor',down:true}],[{id:'scale-mail-armor',down:true}]]},
  {age:3,cells:[[{id:'leather-archer-armor',down:true}],[{id:'bodkin-arrow',down:true}],[{id:'iron-casting',down:true}],[{id:'chain-barding-armor',down:true}],[{id:'chain-mail-armor',down:true}]]},
  {age:4,cells:[[{id:'ring-archer-armor'}],[{id:'bracer'}],[{id:'blast-furnace'}],[{id:'plate-barding-armor'}],[{id:'plate-mail-armor'}]]}]},
 {id:'market',rows:[
  {age:2,cells:[[{ref:'製圖學',path:'/techs/Cartography',down:true}],[{id:'trade-cart'}],[],[]]},
  {age:3,cells:[[{id:'caravan'}],[{ref:'鑄幣術',path:'/techs/Coinage',down:true}],[],[]]},
  {age:4,cells:[[{id:'guilds'}],[{ref:'銀行制度',path:'/techs/Banking'}],[],[]]}]},
 {id:'monastery',rows:[
  {age:3,cells:[[{id:'monk'}],[{ref:'傳教士',path:'/units/Missionary'}],[{id:'redemption'}],[{id:'atonement'}],[{id:'herbal-medicine'}],[{id:'heresy'}],[{id:'sanctity'}],[{id:'fervor'}]]},
  {age:4,cells:[[{id:'faith'}],[{id:'illumination'}],[{id:'block-printing'}],[{id:'theocracy'}],[],[],[],[]]}]},
 {id:'university',rows:[
  {age:3,cells:[[{id:'masonry',down:true}],[{id:'fortified-wall'}],[{id:'ballistics'}],[{id:'guard-tower',down:true}],[{id:'heated-shot'}],[{ref:'近射孔',path:'/techs/Murder_Holes'}],[{id:'treadmill-crane'}],[]]},
  {age:4,cells:[[{id:'architecture'}],[{id:'chemistry',down:true},{id:'bombard-tower-tech'}],[{id:'siege-engineers'}],[{id:'keep'}],[{id:'arrowslits'}],[],[],[]]}]}];
// What villagers build that no site block shows (the site's tree has no build menu): a 村民建造 block placed after the
// town centre, by age (the 科技樹 round's layout decision). The production buildings head their own blocks.
export const treeBuildBlock:TreeLayoutBlock={id:'build',rows:[
 {age:1,cells:[[{id:'house'}],[{id:'palisade-wall'}],[{id:'palisade-gate'}],[{id:'outpost'}]]},
 {age:2,cells:[[{id:'watch-tower'}],[{id:'stone-wall'}],[{id:'gate'}],[]]},
 {age:4,cells:[[{id:'bombard-tower'}],[{id:'wonder'}],[],[]]}]};
// Where a block's item is upgraded in another block (the watch tower by the University's Guard Tower and Keep).
export const treeLeads:Readonly<Record<string,readonly string[]>>={'watch-tower':['guard-tower','keep']};
