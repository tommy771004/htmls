import type {MapLayout} from './terrain.ts';
import {createVision,updateVision,visionRules} from './vision.ts';
import type {PlayerVision} from './vision.ts';
import {createAccount,reserve,cancelReservation,economyRules} from './economy.ts';
import type {Account} from './economy.ts';
import {terrainRules,terrainDefinitions,resourceDefinitions,mapSizes} from './terrain.ts';
import {rules} from '../content/rules.ts';
import {footprintContract} from '../content/footprints.ts';
import {combatRules,lineUpgrades,blacksmith,religionBonus,maxHpOf,statsOf,projectileRules} from './stats.ts';
import type {CombatUnitKind} from './stats.ts';
import {civDefs,neutralCiv} from '../content/civs.ts';
import {openings,openingChoices,standardOpening,randomOpening,pickOpening} from '../content/openings.ts';
import {techEffects} from '../content/techs.ts';
import {ownerOf,civExists,costOf,startStock,startVillagers,losBonus} from './civ.ts';
import {matchMapRules} from './maps/index.ts';
import {makeMap,clearSegment,navigationRules,startingResourceRules,openMapRules,nodesNear,blockedTable,position} from './navigation.ts';
import type {MapData} from './navigation.ts';
import {makeUnit,commandMove,commandStop,stepMovement} from './movement.ts';
import type {Unit,Job} from './movement.ts';
import {commandGather,commandBuild,clearWork,stepWork,gatherable,dropoffRules,commandHunt,huntProblem} from './work.ts';
import {stepAnimals,claimSheep} from './animals.ts';
import {techRules} from './tech.ts';
import {stepDefense,commandGarrison,garrisonProblem,release,ringBell,defenseRules,rallyInside} from './defense.ts';
import type {Garrison,Shot} from './defense.ts';
import {animalRules,GAIA,isAnimal} from './fauna.ts';
import {nomadStock} from './maps/special.ts';
import {initBuildings,placeBuilding,cancelBuilding,authoritativeProblem,buildKinds,farmOwner,buildRequirement,wallKinds,wallProblem,placeWall,nomadWaiver} from './buildings.ts';
import type {Building,BuildKind} from './buildings.ts';
import {enqueue,dequeue,stepProduction,trainable,grantTechs} from './production.ts';
import {matchSettings,settingsOf,settingRules} from './settings.ts';
import type {MatchSettings} from './settings.ts';
import {commandAttack,clearAttacks,stepCombat,targetProblem,stances,tacticsRules,elevationRules} from './combat.ts';
import type {Attack,Beast,Corpse,Outcome,Target,Reveal,Projectile,Stance,Patrol} from './combat.ts';
import type {Work,Cargo} from './work.ts';
import {tileAt} from './terrain.ts';
import {stepAI,aiRules} from './ai.ts';
import {marketRules,marketProblem,marketTrade,startPrices,tradeProblem,commandTrade,clearTrades,stepTrade,stepWonders} from './market.ts';
import type {MarketResource,Prices,TradeRoute,WonderVictory} from './market.ts';
import {taunts,tauntOf,tauntRules} from '../content/taunts.ts';
import {religionRules,riteProblem,commandRite,clearRites,stepReligion,faithOf,carrying,placeRelics} from './religion.ts';
import type {Rite,Relic,RelicVictory} from './religion.ts';
import {navalRules,loadProblem,commandLoad,unloadProblem,commandUnload,clearNaval,stepNaval,releaseCarried,passengers} from './naval.ts';
import {repairRules,repairProblem,commandRepair} from './repair.ts';
import type {RepairTarget,RepairLedger} from './repair.ts';
import {carrierRules} from './garrison.ts';
import {layerOf} from './movement.ts';
export type {Unit} from './movement.ts';
type Envelope={protocolVersion:1;rulesetHash:string;playerId:number;sequence:number;targetTick:number};
// spread: the units keep two nodes apart at the destination (the 戰術技巧 round's 分散).
export type MoveCommand=Envelope&{commandType:'move';payload:{unitIds:number[];x:number;y:number;spread?:boolean}};
// The 戰術技巧 round: a unit's stance (combat.ts Stance) and a patrol between where it stands and a point.
export type StanceCommand=Envelope&{commandType:'stance';payload:{unitIds:number[];stance:Stance}};
export type PatrolCommand=Envelope&{commandType:'patrol';payload:{unitIds:number[];x:number;y:number}};
export type StopCommand=Envelope&{commandType:'stop';payload:{unitIds:number[]}};
export type GatherCommand=Envelope&{commandType:'gather';payload:{unitIds:number[];resourceId:string}};
export type GarrisonCommand=Envelope&{commandType:'garrison';payload:{unitIds:number[];buildingId:string}}|Envelope&{commandType:'ungarrison';payload:{buildingId?:string;unitId?:number}}|Envelope&{commandType:'bell';payload:{ring:boolean}};
export type ReseedCommand=Envelope&{commandType:'reseed';payload:{enabled:boolean}};
export type HuntCommand=Envelope&{commandType:'hunt';payload:{unitIds:number[];animalId:number}};
// to: the far end of a dragged wall (palisade or stone walls only): a line of one-tile segments from x, y to there.
export type BuildCommand=Envelope&{commandType:'build';payload:{unitIds:number[];kind:BuildKind;x:number;y:number;to?:{x:number;y:number}}};
// The market: 100 units of food, wood or stone for gold or back. Trade: carts and cogs to the other player's market/dock.
export type MarketCommand=Envelope&{commandType:'market';payload:{action:'buy'|'sell';resource:MarketResource}};
export type TradeCommand=Envelope&{commandType:'trade';payload:{unitIds:number[];buildingId:string}};
export type ConstructCommand=Envelope&{commandType:'construct';payload:{unitIds:number[];buildingId:string}};
export type CancelBuildCommand=Envelope&{commandType:'cancelBuild';payload:{buildingId:string}};
export type TrainCommand=Envelope&{commandType:'train';payload:{buildingId:string;entryId:string}};
export type CancelTrainCommand=Envelope&{commandType:'cancelTrain';payload:{buildingId:string;itemId:number}};
export type RallyCommand=Envelope&{commandType:'rally';payload:{buildingId:string;x:number;y:number}};
export type ResignCommand=Envelope&{commandType:'resign';payload:Record<string,never>};
// A numbered taunt (packages/content/taunts.ts); both sides see it in the chat log.
export type TauntCommand=Envelope&{commandType:'taunt';payload:{number:number}};
export type AttackCommand=Envelope&{commandType:'attack';payload:{unitIds:number[];target:Target}};
export type RiteCommand=Envelope&{commandType:'convert'|'heal';payload:{unitIds:number[];targetId?:number;buildingId?:string}}|Envelope&{commandType:'relic';payload:{unitIds:number[];relicId:number}}|Envelope&{commandType:'deposit';payload:{unitIds:number[];buildingId:string}};
// The 建築 round: land units board a transport ship; a transport sets its passengers down near a point (naval.ts).
// The 遊戲元素 round: villagers repair buildings, siege weapons and ships (repair.ts).
export type RepairCommand=Envelope&{commandType:'repair';payload:{unitIds:number[];target:RepairTarget}};
export type NavalCommand=Envelope&{commandType:'load';payload:{unitIds:number[];transportId:number}}|Envelope&{commandType:'unload';payload:{transportId:number;x:number;y:number}};
export type Command=StanceCommand|PatrolCommand|RepairCommand|TauntCommand|NavalCommand|MarketCommand|TradeCommand|GarrisonCommand|ReseedCommand|HuntCommand|RiteCommand|ResignCommand|AttackCommand|MoveCommand|StopCommand|GatherCommand|BuildCommand|ConstructCommand|CancelBuildCommand|TrainCommand|CancelTrainCommand|RallyCommand|Envelope&{commandType:'reserve';payload:{entryId:string}}|Envelope&{commandType:'cancelReservation';payload:{reservationId:string}};
export type LoggedCommand=Command&{acceptedTick:number};
export type TransactionResult={tick:number;playerId:number;sequence:number;ok:boolean;error?:string};
// opponent: 'ai' runs the computer player for red; 'idle' keeps red still (practice and the scripted flows).
export type Opponent='ai'|'idle';
export type State={settings:MatchSettings;aiOpening:string;navigationSeen:number;buildings:Building[];nextBuildingId:number;ages:number[];nextUnitId:number;nextQueueId:number;attacks:Record<number,Attack>;corpses:Corpse[];outcome:Outcome|null;rites:Record<number,Rite>;faith:Record<number,number>;techs:string[][];relics:Relic[];relicMemory:{id:number;x:number;y:number}[][];relicVictory:RelicVictory|null;market:Prices;trades:Record<number,TradeRoute>;wonders:Record<string,number>;wonderVictory:WonderVictory|null;transports:Record<number,Unit[]>;boarding:Record<number,{transportId:number;repath:number}>;unloading:Record<number,{x:number;y:number}>;beasts:Record<number,Beast>;reseed:boolean[];garrison:Record<string,Garrison>;entering:Record<number,{buildingId:string;repath:number;work:Work|null;bell:boolean}>;volleys:Record<string,number>;shots:Shot[];version:34;repairs:Record<string,RepairLedger>;reveals:Reveal[];projectiles:Projectile[];nextProjectileId:number;stances:Record<number,Stance>;patrols:Record<number,Patrol>;chat:{player:number;taunt:number;tick:number}[];opponent:Opponent;civs:string[];keptHousing:number[];setups:Record<number,{unpacked:boolean;progress:number}>;works:Record<number,Work>;cargo:Record<number,Cargo>;layout:MapLayout;vision:PlayerVision[];accounts:Account[];transactions:TransactionResult[];map:MapData;pathJobs:Job[];nextJobId:number;seed:number;rng:number;tick:number;sequence:number[];units:Unit[];queue:Command[];log:LoggedCommand[]};
function canonical(value:unknown):string {if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';}
export function hash(value:unknown):string{let h=2166136261;for(const c of canonical(value)){h=Math.imul(h^c.charCodeAt(0),16777619);}return (h>>>0).toString(16).padStart(8,'0');}
export const rulesetHash=hash({openings,repair:repairRules,carriers:carrierRules,taunts:tauntRules,rules,navigationRules,economyRules,terrainRules,terrainDefinitions,resourceDefinitions,visionRules,startingResourceRules,footprints:footprintContract,combat:combatRules,ai:aiRules,maps:{mapSizes,openMapRules,match:matchMapRules(),elevation:elevationRules},dropoffs:dropoffRules,naval:navalRules,market:marketRules,religion:religionRules,animals:animalRules,tech:techRules,defense:defenseRules,civs:civDefs,techs:techEffects,unitLines:{lineUpgrades,blacksmith,religionBonus},projectiles:projectileRules,tactics:tacticsRules,settings:settingRules,simulationVersion:34});
// civs: each player's civilization (packages/content/civs.ts); the neutral one keeps the original rules exactly.
// aiOpening: the computer's opening (packages/content/openings.ts): 'standard' (its normal plan), an opening's id, or
// 'random' (picked from the seed for red's civilization and stored as that id).
// The lobby's options in one object (layout, opponent, civs, aiOpening and packages/sim/settings.ts MatchSettings); the
// positional form stays for older callers.
export type MatchOptions=Partial<MatchSettings>&{layout?:MapLayout;opponent?:Opponent;civs?:readonly string[];aiOpening?:string};
const settingKeys=['difficulty','resources','popCap','reveal','startAge','victory','allTechs'] as const;
const pickSettings=(o:Record<string,unknown>)=>Object.fromEntries(settingKeys.filter(k=>k in o).map(k=>[k,o[k]]));
export function createState(seed:number,layout:MapLayout|MatchOptions='meadow',opponent:Opponent='idle',civs:readonly string[]=[neutralCiv,neutralCiv],aiOpening:string=standardOpening,options:Partial<MatchSettings>={}):State{
 if(layout&&typeof layout==='object')return createState(seed,layout.layout??'meadow',layout.opponent??'idle',layout.civs??[neutralCiv,neutralCiv],layout.aiOpening??standardOpening,pickSettings(layout));
 const settings=matchSettings(pickSettings(options as Record<string,unknown>));if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw Error('seed 必須為 uint32');if(opponent!=='ai'&&opponent!=='idle')throw Error('未知的對手設定');
 if(!Array.isArray(civs)||civs.length!==2||!civs.every(civExists))throw Error('未知的文明');if(!openingChoices.includes(aiOpening))throw Error('未知的電腦開局');const map=makeMap(seed,layout);const state:State={settings,aiOpening:aiOpening===randomOpening?pickOpening(seed,civs[1]):aiOpening,buildings:[],nextBuildingId:1,ages:[1,1],nextUnitId:5,nextQueueId:1,attacks:{},corpses:[],outcome:null,rites:{},faith:{},techs:[[],[]],relics:mapSizes[layout]===32?placeRelics(map,seed):[],relicMemory:[[],[]],relicVictory:null,market:startPrices(),trades:{},wonders:{},wonderVictory:null,transports:{},boarding:{},unloading:{},beasts:{},reseed:[true,true],garrison:{},entering:{},volleys:{},shots:[],version:34,repairs:{},chat:[],opponent,civs:[...civs],keptHousing:[0,0],reveals:[],projectiles:[],nextProjectileId:0,stances:{},patrols:{},setups:{},works:{},cargo:{},layout,vision:createVision(),accounts:[createAccount(3),createAccount(opponent==='ai'?3:1)],transactions:[],map,pathJobs:[],nextJobId:1,navigationSeen:0,seed,rng:seed||1,tick:0,sequence:[0,0],units:[...map.starts[0].map((p,i)=>makeUnit(map,1+i,0,p.x,p.y)),makeUnit(map,4,1,map.starts[1][0].x,map.starts[1][0].y)],queue:[],log:[]};
 // Against the computer red starts like blue: three villagers, mirrored around the map's centre line.
 if(opponent==='ai'){state.units.push(...map.starts[1].slice(1).map((p,i)=>makeUnit(map,5+i,1,p.x,p.y)));state.nextUnitId=5+map.starts[1].length-1;}
 // The match map adds a scout per side (red's only against the computer): ids follow the villagers.
 if(map.scouts){for(const p of opponent==='ai'?[0,1]:[0]){const at=map.scouts[p];state.units.push(makeUnit(map,state.nextUnitId++,p,at.x,at.y,'scout'));state.accounts[p].populationUsed++;}}
 // Sheep, deer and boar (ids from animalRules.firstId): each base's starting flock is its player's, the rest are wild.
 (map.animals??[]).forEach((a,i)=>state.units.push(makeUnit(map,animalRules.firstId+i,a.owner??GAIA,a.x,a.y,a.kind)));
 // Lobby settings: the starting stock preset, and the starting age (reached as if researched: its civilization tiers
 // and free technologies apply; the town centres take that age's look).
 for(const a of state.accounts)a.stock={...settingRules.resources[settings.resources]};
 // A nomad start (游牧) has no town centre: each side also gets one town centre's price (275 wood, 100 stone) to build
 // its own (design_default: the site gives the start no numbers).
 if(map.nomad)for(const a of state.accounts){a.stock.wood+=nomadStock.wood;a.stock.stone+=nomadStock.stone;}
 if(settings.startAge>1){state.ages=[settings.startAge,settings.startAge];for(const p of [0,1])grantTechs(state,p);}
 // Civilization starts: extra villagers next to the first villager (Chinese), starting stock (Persians, Chinese).
 for(const p of [0,1]){const o=ownerOf(state,p),stock=startStock(o),a=state.accounts[p];for(const k of ['food','wood','gold','stone'] as const)a.stock[k]=Math.max(0,a.stock[k]+stock[k]);
  const extra=startVillagers(o);if(!extra)continue;const at=map.starts[p][0],closed=blockedTable(map);
  const held=new Set(state.units.map(u=>u.node)),free=nodesNear(map,[at.x,at.y,at.x,at.y],400).filter(n=>!closed[n]&&!held.has(n)).sort((a,b)=>{const pa=position(map,a),pb=position(map,b);return Math.hypot(pa.x-at.x,pa.y-at.y)-Math.hypot(pb.x-at.x,pb.y-at.y)||a-b;});
  for(const n of free.slice(0,extra)){const q=position(map,n);state.units.push(makeUnit(map,state.nextUnitId++,p,q.x,q.y));a.populationUsed++;}}
 state.units.sort((a,b)=>a.id-b.id);
 for(const u of state.units)if(u.player===0||u.player===1)u.hp=maxHpOf(u.kind as CombatUnitKind,ownerOf(state,u.player));
 initBuildings(state);if(settings.startAge>1)for(const o of state.map.obstacles)if(o.kind==='town-center')o.age=settings.startAge;
 claimSheep(state);updateVision(state.vision,state.map,state.units,0,undefined,sightOf(state),[],settings.reveal==='all');
 // 已探索: the whole map starts explored (terrain and fog only; what stands there is learnt by seeing it).
 if(settings.reveal==='explored'){const all=[...Array(state.map.size**2).keys()];for(const v of state.vision)v.explored=all;}
 return state;}
// Sight a player's civilization adds to a unit or building kind.
function sightOf(s:State){return (player:number,kind:string)=>kind in combatRules.units?losBonus(ownerOf(s,player),kind,combatRules.units[kind as CombatUnitKind].classes):losBonus(ownerOf(s,player),kind);}
// xorshift32; renderers never advance this stream.
export function nextRandom(state:State):number{let n=state.rng;n^=n<<13;n^=n>>>17;n^=n<<5;state.rng=n>>>0;return state.rng;}
// The target of a monk's order: a unit id, a building id (conversion with Redemption, deposit) or a relic id.
function riteTarget(c:RiteCommand):number|string|null{const p=c.payload as {targetId?:unknown;buildingId?:unknown;relicId?:unknown};
 if(c.commandType==='relic')return Number.isSafeInteger(p.relicId)?p.relicId as number:null;
 if(c.commandType==='deposit')return typeof p.buildingId==='string'?p.buildingId:null;
 if(c.commandType==='convert'&&typeof p.buildingId==='string')return p.buildingId;
 return Number.isSafeInteger(p.targetId)?p.targetId as number:null;}
// record=false admits a command without logging it: the computer player's orders, which replay re-derives.
export function submit(state:State, c:Command, record=true):void {
 if(!c||c.protocolVersion!==1||c.rulesetHash!==rulesetHash)throw Error('命令版本不符');
 if(!Number.isSafeInteger(c.playerId)||c.playerId<0||c.playerId>1)throw Error('無效玩家');
 if(!Number.isSafeInteger(c.sequence)||c.sequence!==state.sequence[c.playerId]+1)throw Error('重複或錯序命令');
 if(!Number.isSafeInteger(c.targetTick)||c.targetTick<=state.tick||c.targetTick>state.tick+200)throw Error('命令已過期或過遠');
 if(!c.payload)throw Error('缺少 payload');
 if(state.outcome)throw Error('對局已結束：請再開一局');
 if(c.commandType==='move'||c.commandType==='stop'||c.commandType==='gather'||c.commandType==='hunt'||c.commandType==='garrison'||c.commandType==='build'||c.commandType==='construct'||c.commandType==='attack'||c.commandType==='convert'||c.commandType==='heal'||c.commandType==='relic'||c.commandType==='deposit'||c.commandType==='trade'||c.commandType==='load'||c.commandType==='repair'||c.commandType==='stance'||c.commandType==='patrol'){
 const ids=c.payload.unitIds;
 if(!Array.isArray(ids)||!ids.length||ids.length>navigationRules.maxGroupSize||!ids.every((id,i)=>Number.isSafeInteger(id)&&(i===0||id>ids[i-1])))throw Error(`單位清單需為 1–${navigationRules.maxGroupSize} 個遞增且不重複的 ID`);
 for(const id of ids){const u=state.units.find(u=>u.id===id);if(!u||u.player!==c.playerId)throw Error('不可控制敵方或不存在的單位');if(c.commandType==='convert'||c.commandType==='heal'||c.commandType==='relic'||c.commandType==='deposit'){if(u.kind!=='monk')throw Error('只有僧侶能轉化、治療或搬運聖物');}
 else if(c.commandType==='attack'){if(u.kind==='monk')throw Error('僧侶不能攻擊：右鍵敵方單位改為轉化');if(isAnimal(u.kind))throw Error('動物不能攻擊');if(statsOf(u.kind as CombatUnitKind,ownerOf(state,u.player)).attack==='none')throw Error(`${rules.entries.find(e=>e.id===u.kind)?.name??u.kind}不能攻擊`);{const st=statsOf(u.kind as CombatUnitKind,ownerOf(state,u.player)),t=c.payload.target,v=t?.kind==='unit'?state.units.find(x=>x.id===t.id):undefined;
  // Rams strike siege weapons too (aoetw.com: their bonus against siege); trebuchets buildings only.
  const siege=!!v&&v.kind in combatRules.units&&combatRules.units[v.kind as CombatUnitKind].classes.includes('siege');
  if(st.buildingsOnly&&t?.kind!=='building'&&!(st.alsoSiege&&siege))throw Error(`${rules.entries.find(e=>e.id===u.kind)?.name??u.kind}只能攻擊建築${st.alsoSiege?'與攻城器':''}`);}}
 else if(c.commandType==='garrison'||c.commandType==='trade'){}
 else if(c.commandType==='repair'){if(u.kind!=='villager')throw Error('只有村民能修理');}
 // Stances belong to fighting units (not villagers, monks or the unarmed); anyone may patrol.
 else if(c.commandType==='stance'){if(u.kind==='villager'||u.kind==='monk'||isAnimal(u.kind)||!(u.kind in combatRules.units)||statsOf(u.kind as CombatUnitKind,ownerOf(state,u.player)).attack==='none')throw Error('只有戰鬥單位有戰鬥姿態');}
 else if(c.commandType==='patrol'){}
 // Fishing ships fish and build fish traps (checked below); boarding is checked by naval.ts.
 else if(c.commandType==='load'||(c.commandType==='gather'||c.commandType==='build'||c.commandType==='construct')&&u.kind==='fishing-ship'){}
 else if(c.commandType!=='move'&&c.commandType!=='stop'&&u.kind!=='villager')throw Error('只有村民能採集或建造');}
 if((c.commandType==='gather'||c.commandType==='build'||c.commandType==='construct')&&new Set(ids.map(id=>state.units.find(u=>u.id===id)!.kind)).size>1)throw Error('漁船與村民不能一起採集或建造');
 }
 if(c.commandType==='move'||c.commandType==='patrol'){
 for(const k of ['x','y'] as const)if(!Number.isSafeInteger(c.payload[k])||c.payload[k]<50||c.payload[k]>state.map.size*100-50)throw Error('目標超出地圖');
 if(c.commandType==='move'&&c.payload.spread!==undefined&&typeof c.payload.spread!=='boolean')throw Error('分散設定無效');
 // A target inside something solid is allowed: the units walk as close as they can (as in the reference), and a
 // refusal would reveal obstacles hidden in the fog.
 }else if(c.commandType==='stop'){}
 else if(c.commandType==='convert'||c.commandType==='heal'||c.commandType==='relic'||c.commandType==='deposit'){const t=riteTarget(c);if(t===null)throw Error('無效的目標');const problem=riteProblem(state,c.playerId,c.commandType,t);if(problem)throw Error(problem);
  const ids=c.payload.unitIds;
  if(c.commandType==='convert'){if(ids.every(id=>carrying(state,id)))throw Error('攜帶聖物的僧侶不能轉化');if(ids.every(id=>faithOf(state,id)<1))throw Error('信仰尚未恢復：轉化後需要一段時間');}
  if(c.commandType==='relic'&&ids.every(id=>carrying(state,id)))throw Error('這名僧侶已經攜帶聖物');
  if(c.commandType==='deposit'&&!ids.some(id=>carrying(state,id)))throw Error('所選僧侶沒有攜帶聖物');}
 else if(c.commandType==='attack'){const t=c.payload.target;if(!t||!['unit','building'].includes(t.kind))throw Error('無效的攻擊目標');const problem=targetProblem(state,c.playerId,t);if(problem)throw Error(problem);}
 else if(c.commandType==='build'){
 const {kind,x,y,to}=c.payload;if(!buildKinds.includes(kind))throw Error('未知的建築種類');
 // Fish traps are laid by fishing ships only, and fishing ships lay nothing else.
 {const ship=state.units.some(u=>u.id===c.payload.unitIds[0]&&u.kind==='fishing-ship');if(ship!==(kind==='fish-trap'))throw Error(ship?'漁船只能放置魚網':'魚網只能由漁船放置');}
 // A dragged wall needs one segment that can stand (the rest are skipped); its far end lies on the map.
 if(to!==undefined&&(!wallKinds.has(kind)||!to||!Number.isSafeInteger(to.x)||!Number.isSafeInteger(to.y)||to.x<0||to.y<0||to.x>=state.map.size*100||to.y>=state.map.size*100))throw Error(wallKinds.has(kind)?'城牆終點超出地圖':'只有城牆可以拖曳成一列');
 const problem=buildRequirement(state.ages[c.playerId],kind,state.buildings.filter(b=>b.player===c.playerId),state.civs[c.playerId],state.techs[c.playerId],settingsOf(state).allTechs,nomadWaiver(state.map,state.buildings.filter(b=>b.player===c.playerId)))??(to?wallProblem(state,c.playerId,kind,{x,y},to):authoritativeProblem(state,c.playerId,kind,x,y));if(problem)throw Error(problem);
 const cost=costOf(kind,ownerOf(state,c.playerId)),stock=state.accounts[c.playerId].stock,short=(Object.keys(cost) as (keyof typeof cost)[]).filter(k=>stock[k]<cost[k]);
 if(short.length)throw Error(`資源不足：${short.map(k=>`${({food:'食物',wood:'木材',gold:'黃金',stone:'石頭'} as const)[k]}需要 ${cost[k]}，目前 ${stock[k]}`).join('；')}`);
 }
 else if(c.commandType==='train'||c.commandType==='cancelTrain'||c.commandType==='rally'){
 const b=state.buildings.find(b=>b.id===c.payload.buildingId);if(!b||b.player!==c.playerId)throw Error('找不到這棟己方建築');
 if(c.commandType==='train'){const problem=trainable(state,c.playerId,b,c.payload.entryId);if(problem)throw Error(problem);}
 else if(c.commandType==='cancelTrain'){if(!b.queue.some(q=>q.id===c.payload.itemId))throw Error('佇列項目已完成或不存在');}
 else{if(!b.complete)throw Error('建築尚未完工');for(const k of ['x','y'] as const)if(!Number.isSafeInteger(c.payload[k])||c.payload[k]<50||c.payload[k]>state.map.size*100-50)throw Error('集結點超出地圖');
 // A rally point on a production building itself sends its new units inside (defense.ts rallyGarrison).
 // A dock's rally point is for its ships: open water.
 if(!rallyInside(state,b,c.payload)&&!clearSegment(state.map,c.payload,c.payload,b.kind==='dock'?'water':'land'))throw Error(b.kind==='dock'?'碼頭的集結點要設在水面上':'集結點不能設在建築、資源或不可通行地形上');}
 }
 else if(c.commandType==='construct'||c.commandType==='cancelBuild'){
 const b=state.buildings.find(b=>b.id===c.payload.buildingId);if(!b||b.player!==c.playerId)throw Error('找不到這棟己方建築');if(b.complete)throw Error('建築已完工');
 if(c.commandType==='construct'){const ship=state.units.some(u=>u.id===c.payload.unitIds[0]&&u.kind==='fishing-ship');if(ship!==(b.kind==='fish-trap'))throw Error(ship?'漁船只能建造魚網':'魚網只能由漁船建造');}
 }
 else if(c.commandType==='gather'){
 const r=typeof c.payload.resourceId==='string'?state.map.resources.find(r=>r.id===c.payload.resourceId):undefined;
 // Unexplored resources are unknown to the player: same error as a missing id, so nothing leaks.
 if(!r||!state.vision[c.playerId].explored.includes(tileAt(r.x,r.y,state.map.size)))throw Error('找不到這個資源');
 if(r.kind==='farm'&&farmOwner(state,r.id)!==c.playerId)throw Error('只能耕作己方的農田');
 if(r.kind==='fish-trap'&&farmOwner(state,r.id)!==c.playerId)throw Error('只能收成己方的魚網');
 const problem=gatherable(state.map,r.id,layerOf(state.units.find(u=>u.id===c.payload.unitIds[0])!.kind));if(problem)throw Error(problem);
 }
 else if(c.commandType==='hunt'){if(!Number.isSafeInteger(c.payload.animalId))throw Error('找不到這隻動物');const problem=huntProblem(state,c.playerId,c.payload.animalId);if(problem)throw Error(problem);}
 else if(c.commandType==='garrison'){const problem=garrisonProblem(state,c.playerId,c.payload.buildingId,c.payload.unitIds);if(problem)throw Error(problem);}
 else if(c.commandType==='ungarrison'){
 // A unit carrying others (a ram, a transport by the shore) lets them out where it stands.
 if(c.payload.unitId!==undefined){const u=Number.isSafeInteger(c.payload.unitId)?state.units.find(u=>u.id===c.payload.unitId):undefined;if(!u||u.player!==c.playerId)throw Error('找不到這個己方單位');if(!passengers(state,u.id).length)throw Error('裡面沒有單位');}
 else{const b=state.buildings.find(b=>b.id===c.payload.buildingId);if(!b||b.player!==c.playerId)throw Error('找不到這棟己方建築');if(!state.garrison[b.id]?.units.length)throw Error('建築裡沒有進駐的單位');}}
 else if(c.commandType==='repair'){const problem=repairProblem(state,c.playerId,c.payload.target);if(problem)throw Error(problem);}
 else if(c.commandType==='bell'){if(typeof c.payload.ring!=='boolean')throw Error('鐘聲設定無效');if(c.payload.ring&&!state.buildings.some(b=>b.player===c.playerId&&b.complete&&b.kind in defenseRules.capacity))throw Error('沒有可以躲的城鎮中心、箭塔或城堡');}
 else if(c.commandType==='stance'){if(!stances.includes(c.payload.stance))throw Error('未知的戰鬥姿態');}
 else if(c.commandType==='reseed'){if(typeof c.payload.enabled!=='boolean')throw Error('自動補種設定無效');}
 else if(c.commandType==='load'){if(!Number.isSafeInteger(c.payload.transportId))throw Error('只能登上己方的運輸船');const problem=loadProblem(state,c.playerId,c.payload.transportId,c.payload.unitIds);if(problem)throw Error(problem);}
 else if(c.commandType==='unload'){if(!Number.isSafeInteger(c.payload.transportId))throw Error('找不到這艘己方運輸船');const problem=unloadProblem(state,c.playerId,c.payload.transportId,c.payload.x,c.payload.y);if(problem)throw Error(problem);}
 else if(c.commandType==='resign'){}
 else if(c.commandType==='taunt'){const n=c.payload.number;if(!Number.isSafeInteger(n)||!tauntOf(n))throw Error(`嘲諷編號是 1–${taunts.length}`);
  // One a second per player, counting the ones already queued.
  const last=Math.max(-Infinity,...state.chat.filter(m=>m.player===c.playerId).map(m=>m.tick),...state.queue.filter(q=>q.playerId===c.playerId&&q.commandType==='taunt').map(q=>q.targetTick));
  if(c.targetTick-last<tauntRules.everyTicks)throw Error('嘲諷太頻繁：每秒最多一則');}
 else if(c.commandType==='market'){const problem=marketProblem(state,c.playerId,c.payload.action,c.payload.resource);if(problem)throw Error(problem);}
 else if(c.commandType==='trade'){const problem=tradeProblem(state,c.playerId,c.payload.unitIds,c.payload.buildingId);if(problem)throw Error(problem);}
 else if(c.commandType==='reserve'){if(!rules.entries.some(e=>e.id===c.payload.entryId))throw Error('未知預留內容');}
 else if(c.commandType==='cancelReservation'){if(typeof c.payload.reservationId!=='string'||!c.payload.reservationId.startsWith(`${c.playerId}:`))throw Error('不可取消敵方或無效的預留');}
 else throw Error('不支援的命令');
 const copy=structuredClone(c);delete (copy as Partial<LoggedCommand>).acceptedTick;state.queue.push(copy);state.queue.sort((a,b)=>a.targetTick-b.targetTick||a.playerId-b.playerId||a.sequence-b.sequence);if(record)state.log.push({...structuredClone(copy),acceptedTick:state.tick});state.sequence[c.playerId]=c.sequence;
}
// Returns observation-only counters (never stored in State or fed back into rules).
export function tick(s:State):{expanded:number} {
 s.tick++;
 s.queue.sort((a,b)=>a.targetTick-b.targetTick||a.playerId-b.playerId||a.sequence-b.sequence);
 while(s.queue.length&&s.queue[0].targetTick===s.tick){const c=s.queue.shift()!;
 // A unit that changed sides (conversion) since the order was accepted no longer takes it.
 if('unitIds' in c.payload&&Array.isArray(c.payload.unitIds)){const ids=(c.payload.unitIds as number[]).filter(id=>s.units.some(u=>u.id===id&&u.player===c.playerId));if(!ids.length)continue;(c.payload as {unitIds:number[]}).unitIds=ids;}
 // Resigning ends the match at once for the other player (the sim then refuses every command).
 if(c.commandType==='reseed'){s.reseed[c.playerId]=c.payload.enabled;continue;}
 if(c.commandType==='ungarrison'){if(c.payload.unitId!==undefined)releaseCarried(s,c.payload.unitId);else release(s,c.payload.buildingId!);continue;}
 if(c.commandType==='bell'){ringBell(s,c.playerId,c.payload.ring);continue;}
 // Any order to a unit on its way into a building replaces that order.
 // The 戰術技巧 round: a stance is kept through every order (and changes nothing else); any other order ends a patrol.
 if(c.commandType==='stance'){for(const id of c.payload.unitIds){if(c.payload.stance==='aggressive')delete s.stances[id];else s.stances[id]=c.payload.stance;
  // No attack and stand ground drop an automatic fight in progress (an ordered one goes on).
  if((c.payload.stance==='passive'||c.payload.stance==='stand')&&s.attacks[id]?.auto)delete s.attacks[id];}continue;}
 if('unitIds' in c.payload&&Array.isArray(c.payload.unitIds))for(const id of c.payload.unitIds as number[])delete s.patrols[id];
 if('unitIds' in c.payload&&Array.isArray(c.payload.unitIds))for(const id of c.payload.unitIds as number[]){delete s.entering[id];delete s.trades[id];}
 // ... and so does any order to a unit boarding a transport, or to a transport on its way to unload.
 if('unitIds' in c.payload&&Array.isArray(c.payload.unitIds))clearNaval(s,c.payload.unitIds as number[]);
 if(c.commandType==='load'){clearWork(s,c.payload.unitIds);clearAttacks(s,c.payload.unitIds);clearRites(s,c.payload.unitIds);if(!loadProblem(s,c.playerId,c.payload.transportId,c.payload.unitIds))commandLoad(s,c.payload.unitIds,c.payload.transportId);else commandStop(s,c.payload.unitIds);continue;}
 if(c.commandType==='unload'){clearNaval(s,[c.payload.transportId]);if(!unloadProblem(s,c.playerId,c.payload.transportId,c.payload.x,c.payload.y)){clearAttacks(s,[c.payload.transportId]);commandUnload(s,c.payload.transportId,c.payload.x,c.payload.y);}continue;}
 // The market trades at execution (prices may have moved since the order was accepted); a refusal is a transaction.
 if(c.commandType==='market'){const result:TransactionResult={tick:s.tick,playerId:c.playerId,sequence:c.sequence,ok:true};try{marketTrade(s,c.playerId,c.payload.action,c.payload.resource);}catch(e){result.ok=false;result.error=(e as Error).message;}s.transactions.push(result);continue;}
 if(c.commandType==='trade'){clearWork(s,c.payload.unitIds);clearAttacks(s,c.payload.unitIds);clearRites(s,c.payload.unitIds);if(!tradeProblem(s,c.playerId,c.payload.unitIds,c.payload.buildingId))commandTrade(s,c.payload.unitIds,c.payload.buildingId);else commandStop(s,c.payload.unitIds);continue;}
 if(c.commandType==='garrison'){clearWork(s,c.payload.unitIds);clearAttacks(s,c.payload.unitIds);clearRites(s,c.payload.unitIds);if(!garrisonProblem(s,c.playerId,c.payload.buildingId,c.payload.unitIds))commandGarrison(s,c.payload.unitIds,c.payload.buildingId);else commandStop(s,c.payload.unitIds);continue;}
 if(c.commandType==='taunt'){s.chat.push({player:c.playerId,taunt:c.payload.number,tick:s.tick});if(s.chat.length>tauntRules.keep)s.chat.splice(0,s.chat.length-tauntRules.keep);continue;}
 if(c.commandType==='resign'){if(!s.outcome)s.outcome={winner:1-c.playerId,defeated:[c.playerId],tick:s.tick,reason:'resign'};continue;}
 if(c.commandType==='attack'){if(!targetProblem(s,c.playerId,c.payload.target))commandAttack(s,c.payload.unitIds,c.payload.target);else{clearAttacks(s,c.payload.unitIds);commandStop(s,c.payload.unitIds);}continue;}
 if(c.commandType==='convert'||c.commandType==='heal'||c.commandType==='relic'||c.commandType==='deposit'){const t=riteTarget(c)!;if(!riteProblem(s,c.playerId,c.commandType,t))commandRite(s,c.payload.unitIds,c.commandType,t);else{clearRites(s,c.payload.unitIds);commandStop(s,c.payload.unitIds);}continue;}
 if(c.commandType==='move'||c.commandType==='stop'||c.commandType==='gather'||c.commandType==='hunt'||c.commandType==='build'||c.commandType==='construct'){clearAttacks(s,c.payload.unitIds);clearRites(s,c.payload.unitIds);}
 // Re-validated at execution: the animal may have died, fled out of sight or changed hands.
 if(c.commandType==='hunt'){clearWork(s,c.payload.unitIds);if(!huntProblem(s,c.playerId,c.payload.animalId))commandHunt(s,c.payload.unitIds,c.payload.animalId);else commandStop(s,c.payload.unitIds);continue;}
 if(c.commandType==='move'){clearWork(s,c.payload.unitIds);commandMove(s,c.payload.unitIds,{x:c.payload.x,y:c.payload.y},c.payload.spread===true);continue;}
 if(c.commandType==='patrol'){clearWork(s,c.payload.unitIds);clearAttacks(s,c.payload.unitIds);clearRites(s,c.payload.unitIds);const to={x:c.payload.x,y:c.payload.y};
  try{commandMove(s,c.payload.unitIds,to);}catch{commandStop(s,c.payload.unitIds);continue;}
  for(const id of c.payload.unitIds){const u=s.units.find(u=>u.id===id)!;s.patrols[id]={from:{x:u.x,y:u.y},to,leg:'out',wait:tacticsRules.patrolRetry};}continue;}
 if(c.commandType==='stop'){clearWork(s,c.payload.unitIds);commandStop(s,c.payload.unitIds);continue;}
 // Re-validated at execution: the resource may have run out since the order was accepted.
 if(c.commandType==='gather'){if(!gatherable(s.map,c.payload.resourceId,layerOf(s.units.find(u=>u.id===c.payload.unitIds[0])!.kind)))commandGather(s,c.payload.unitIds,c.payload.resourceId);else{clearWork(s,c.payload.unitIds);commandStop(s,c.payload.unitIds);}continue;}
 // Placement and payment are re-checked at execution; a failure is logged as a transaction, the builders stop.
 if(c.commandType==='rally'){const b=s.buildings.find(b=>b.id===c.payload.buildingId);if(b)b.rally={x:c.payload.x,y:c.payload.y,...(rallyInside(s,b,c.payload)?{inside:true as const}:{})};continue;}
 if(c.commandType==='repair'){clearWork(s,c.payload.unitIds);clearAttacks(s,c.payload.unitIds);clearRites(s,c.payload.unitIds);if(!repairProblem(s,c.playerId,c.payload.target))commandRepair(s,c.payload.unitIds,c.payload.target);else commandStop(s,c.payload.unitIds);continue;}
 if(c.commandType==='train'||c.commandType==='cancelTrain'){const result:TransactionResult={tick:s.tick,playerId:c.playerId,sequence:c.sequence,ok:true};
  try{if(c.commandType==='train')enqueue(s,c.playerId,c.payload.buildingId,c.payload.entryId,`${c.playerId}:${c.sequence}`);else dequeue(s,c.playerId,c.payload.buildingId,c.payload.itemId);}catch(e){result.ok=false;result.error=(e as Error).message;}
  s.transactions.push(result);continue;}
 if(c.commandType==='build'||c.commandType==='construct'||c.commandType==='cancelBuild'){const result:TransactionResult={tick:s.tick,playerId:c.playerId,sequence:c.sequence,ok:true};
  try{if(c.commandType==='build'){const b=c.payload.to?placeWall(s,c.playerId,c.payload.kind,c.payload,c.payload.to,`${c.playerId}:${c.sequence}`)[0]:placeBuilding(s,c.playerId,c.payload.kind,c.payload.x,c.payload.y,`${c.playerId}:${c.sequence}`);clearWork(s,c.payload.unitIds);commandBuild(s,c.payload.unitIds,b.id);}
   else if(c.commandType==='construct'){const b=s.buildings.find(b=>b.id===c.payload.buildingId);if(!b||b.complete)throw Error('建築已不存在或已完工');clearWork(s,c.payload.unitIds);commandBuild(s,c.payload.unitIds,b.id);}
   else cancelBuilding(s,c.playerId,c.payload.buildingId);}
  catch(e){result.ok=false;result.error=(e as Error).message;if(c.commandType!=='cancelBuild'){clearWork(s,c.payload.unitIds);commandStop(s,c.payload.unitIds);}}
  s.transactions.push(result);continue;}
 {const result:TransactionResult={tick:s.tick,playerId:c.playerId,sequence:c.sequence,ok:true};try{if(c.commandType==='reserve')reserve(s.accounts[c.playerId],`${c.playerId}:${c.sequence}`,c.payload.entryId,costOf(c.payload.entryId,ownerOf(s,c.playerId)));else cancelReservation(s.accounts[c.playerId],(c.payload as {reservationId:string}).reservationId);}catch(e){result.ok=false;result.error=(e as Error).message;}s.transactions.push(result);continue;}
 }
 stepProduction(s);
 // Deterministic movement: shared search budget, node reservations, waiting and bounded replans.
 const stats=stepMovement(s);
 stepCombat(s);
 stepDefense(s);
 stepNaval(s);
 stepAnimals(s);
 stepReligion(s);
 stepWork(s);
 stepTrade(s);
 stepWonders(s);
 // A hit from out of sight shows the shooter's tile for a while (combat.ts reveal); expired reveals are dropped.
 s.reveals=s.reveals.filter(r=>r.until>s.tick);updateVision(s.vision,s.map,s.units,s.tick,undefined,sightOf(s),s.reveals,settingsOf(s).reveal==='all');
 // The computer decides on what red can see after this tick; its orders run next tick, like a human's.
 if(s.opponent==='ai')stepAI(s,(commandType,payload)=>{try{submit(s,{protocolVersion:1,rulesetHash,playerId:aiRules.player,sequence:s.sequence[aiRules.player]+1,targetTick:s.tick+1,commandType,payload} as unknown as Command,false);return true;}catch{return false;}});
 return stats;
}
export function replay(seed:number,commands:LoggedCommand[],ticks:number,layout:MapLayout|MatchOptions='meadow',opponent:Opponent='idle',civs:readonly string[]=[neutralCiv,neutralCiv],aiOpening:string=standardOpening,options:Partial<MatchSettings>={}):State{
 if(!Number.isSafeInteger(ticks)||ticks<0||ticks>100000||!Array.isArray(commands)||commands.length>10000)throw Error('無效重播範圍');
 const s=createState(seed,layout,opponent,civs,aiOpening,options);let previousTick=0;
 for(const c of commands){
 if(!c||!Number.isSafeInteger(c.acceptedTick)||c.acceptedTick<previousTick||c.acceptedTick>ticks)throw Error('無效命令接收時間');
 while(s.tick<c.acceptedTick)tick(s);submit(s,c);previousTick=c.acceptedTick;
 }
 while(s.tick<ticks)tick(s);return s;
}
export function serialize(s:State):string{if(s.tick>100000||s.log.length>10000)throw Error('已超過此階段沙盒存檔容量（100000 ticks / 10000 指令）');return JSON.stringify({format:'brick-sandbox-34',rulesetHash,state:s,checksum:hash(s)});}
export function deserialize(raw:string):State{
 const v=JSON.parse(raw);
 if(!v||v.format!=='brick-sandbox-34'||v.rulesetHash!==rulesetHash||!v.state||v.checksum!==hash(v.state))throw Error('存檔版本不符或內容損壞');
 const s=v.state as State;
 if(s.version!==34||(s.opponent!=='ai'&&s.opponent!=='idle')||!Array.isArray(s.civs)||s.civs.length!==2||!s.civs.every(civExists)||!Number.isSafeInteger(s.tick)||s.tick<0||s.tick>100000||!Array.isArray(s.log)||s.log.length>10000)throw Error('無效存檔狀態');
 if(typeof s.aiOpening!=='string'||s.aiOpening===randomOpening||!openingChoices.includes(s.aiOpening))throw Error('無效存檔狀態');
 let settings:MatchSettings;try{settings=matchSettings(s.settings);}catch{throw Error('無效存檔狀態');}
 const rebuilt=replay(s.seed,s.log,s.tick,s.layout,s.opponent,s.civs,s.aiOpening,settings);
 if(hash(rebuilt)!==hash(s))throw Error('存檔狀態無法由命令重建');
 return structuredClone(s);
}
