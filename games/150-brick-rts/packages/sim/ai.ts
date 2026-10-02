import {obstacleBounds,obstacleRects} from '../content/footprints.ts';
import {rules} from '../content/rules.ts';
import type {Resource} from '../content/rules.ts';
import {resourceDefinitions,tileAt} from './terrain.ts';
import {clearSegment,isBuilding,position,blockedTable,nodesNear,navigationRules} from './navigation.ts';
import {placementProblem,buildKinds,farmOwner,buildingRules,buildRequirement} from './buildings.ts';
import type {Building,BuildKind} from './buildings.ts';
import {trainable,ageOf} from './production.ts';
import type {ProductionState} from './production.ts';
import {gatherable,dropoffRules,huntProblem} from './work.ts';
import {isAnimal,carcassId} from './fauna.ts';
import {targetProblem} from './combat.ts';
import type {CombatState,Target} from './combat.ts';
import type {Unit} from './movement.ts';
import type {PlayerVision} from './vision.ts';
import {faithOf,carrying,riteProblem} from './religion.ts';
import type {DefenseState} from './defense.ts';
import {unitKinds,layerOf} from './movement.ts';
import {marketQuote,marketResources,marketRules} from './market.ts';
import type {Prices} from './market.ts';
import {combatRules} from './stats.ts';
import type {CombatUnitKind} from './stats.ts';
import {ownerOf,costOf,ownerAvailable,producersOf} from './civ.ts';
import {aiTuning,settingsOf} from './settings.ts';
import {nomadStart,wolves,breakout,ferry,landBlocked,sameLand,mapAIRules} from './ai-maps.ts';
import type {MatchSettings} from './settings.ts';
import type {Owner} from './civ.ts';
import {civDefs} from '../content/civs.ts';
import {openingById,gatherKinds} from '../content/openings.ts';
import type {Opening,OpeningView,Gather,Weights} from '../content/openings.ts';
// Computer opponent (design_default engineering values, not the reference game's AI).
// It sees only its own player's vision, and every order goes through the same validation as a human's
// (sim.ts admits it without writing the replay log, because replay re-derives it from the same state).
// thinkTicks: one decision pass per second at 20 Hz. firstWaveTick: no attack wave before 4 minutes.
// Civilizations: a civ with a unique unit builds one Castle in the third age (stone gathered for it by stoneWorkers,
// castleBuilders on its foundation), trains up to uniqueTarget of its unique unit there and then researches its
// castle-age unique technologies. The computer never researches the fourth age (it has no Imperial plan), so the elite
// upgrades and fourth-age unique technologies stay out of its reach. castleMargin: a Castle fights back, so when no site
// keeps halfMargin it may stand anywhere on red's own half (the 4x4 keep rarely finds room otherwise on a grown base).
// tauntGap: the same taunt at most once in 3 minutes; tauntQuiet: any two taunts at least 30 s apart.
export const aiRules={provenance:'design_default',player:1,tauntGap:3600,tauntQuiet:600,thinkTicks:20,thinkOffset:7,villagerTarget:12,
 gatherWeights:{food:4,wood:3,gold:2,stone:0},houseMargin:2,barracksAtVillagers:3,ageUpAtVillagers:9,
 waveSize:5,firstWaveTick:4800,herdRadius:450,rams:2,bellFoes:3,bellRadius:450,penSize:3,wildFoodWorkers:6,wildRange:650,engageRange:500,defendRadius:700,baseMargin:110,laneGap:110,siteRange:900,siteSpread:1.5,siteStep:20,siteChecks:80,worldStep:50,halfMargin:100,spill:100,sourceMargin:100,campDistance:350,campWorkers:2,monkTarget:2,
 uniqueTarget:5,stoneWorkers:3,castleBuilders:3,castleMargin:0,
 // The 建築 round. Water (any map with a dock site within dockRange of the town centre, the lake map): a dock once the
 // barracks stands and dockAtVillagers work, fishingShips on the deep fish, fish traps (at most fishTraps, within
 // trapRange of the dock) once no fish is in sight, and from the third age warships galleys guarding navyRadius of
 // the dock. The market in the third age with marketSpare wood beyond its cost: a resource above sellAbove is sold
 // while gold is below goldShort, stone is bought for the castle while gold allows, and tradeCarts go to the
 // opponent's market once red has seen one finished (trade needs the other player's market).
 dockAtVillagers:6,dockRange:1300,fishingShips:4,fishTraps:3,trapRange:700,warships:2,navyRadius:900,
 marketSpare:100,sellAbove:600,goldShort:100,tradeCarts:2,
 // The 遊戲元素 round: a town centre or castle below repairBelow percent of its hit points gets up to repairers
 // villagers within repairRange (idle ones first, never builders) to repair it.
 repairBelow:70,repairers:2,repairRange:600,
 research:{blacksmith:['forging','fletching','scale-mail-armor','padded-archer-armor','iron-casting','bodkin-arrow','chain-mail-armor','scale-barding-armor'],barracks:['man-at-arms','long-swordsman'],'archery-range':['crossbowman'],'town-center':['loom','wheelbarrow','hand-cart'],dock:['gillnets'],'lumber-camp':['double-bit-axe','bow-saw','two-man-saw'],'mining-camp':['gold-mining','gold-shaft-mining'],mill:['horse-collar','heavy-plow','crop-rotation']}} as const;
export type AIState=DefenseState&ProductionState&{settings?:MatchSettings;aiOpening?:string;tick:number;ages:number[];vision:PlayerVision[];market?:Prices;trades?:Record<number,unknown>;chat?:{player:number;taunt:number;tick:number}[];wonders?:Record<string,number>};
export type Order=(commandType:'taunt'|'bell'|'hunt'|'move'|'gather'|'build'|'construct'|'train'|'attack'|'resign'|'convert'|'relic'|'deposit'|'market'|'trade'|'rally'|'repair'|'garrison'|'load'|'unload',payload:Record<string,unknown>)=>boolean;
type Box=number[];
// Soldiers: every unit that can fight except villagers, monks, animals and the scout (it explores on its own).
export const soldierKinds:readonly string[]=unitKinds.filter(k=>k!=='villager'&&k!=='monk'&&k!=='scout'&&!isAnimal(k)&&combatRules.units[k as CombatUnitKind].attack!=='none');
const classesOf=(kind:string)=>combatRules.units[kind as CombatUnitKind]?.classes??[];
// The castle plan of a civilization: its unique unit (none for the neutral civ, which has no Castle) and the castle-age
// unique technologies that exist as entries here, in the civ's listed order.
function castlePlan(o:Owner){const civ=civDefs.find(c=>c.id===o.civ),unit=civ?.uniqueUnits.find(k=>ownerAvailable(o,k)&&soldierKinds.includes(k));
 if(!civ||!unit||!ownerAvailable(o,'castle'))return null;
 return {unit,techs:civ.uniqueTechs.filter(t=>t.age===3&&ownerAvailable(o,t.id)&&rules.entries.some(e=>e.id===t.id)).map(t=>t.id)};}
const gap=(a:Box,b:Box)=>Math.max(a[0]-b[2],b[0]-a[2],a[1]-b[3],b[1]-a[3],0);
const centre=(b:Box)=>({x:(b[0]+b[2])/2,y:(b[1]+b[3])/2});
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
// Sites ordered this pass: the orders are admitted only next tick, so later placements in the same pass must keep
// clear of them (two orders for one site left all but the first refused). Reset at the start of every pass.
let claimed:Box[]=[];
// lane: the spacing kept from them (the lane gap between buildings; 0 = only no overlap, for farms and water sites).
const clashes=(box:Box,lane=0)=>claimed.some(c=>lane?gap(box,c)<lane:Math.min(box[2],c[2])>Math.max(box[0],c[0])&&Math.min(box[3],c[3])>Math.max(box[1],c[1]));
// An admitted build order claims its footprint for the rest of the pass.
function claim(ok:boolean,kind:BuildKind,x:number,y:number){if(ok)claimed.push(obstacleBounds({kind,x,y}));return ok;}
export function stepAI(s:AIState,order:Order){
 if(s.outcome||s.tick%aiTuning(s).thinkTicks!==aiRules.thinkOffset)return;
 claimed=[];
 const P=aiRules.player,vision=s.vision[P],seen=new Set(vision.visible),explored=new Set(vision.explored);
 const busy=new Set(s.pathJobs.flatMap(j=>j.kind==='group'?j.unitIds:[j.unitId]));
 const idle=(u:Unit)=>!s.works[u.id]&&!s.attacks[u.id]&&u.next===null&&!u.path.length&&!busy.has(u.id);
 // Warships keep to the lake (navy below); the land army is everything else that fights.
 const mine=s.units.filter(u=>u.player===P).sort((a,b)=>a.id-b.id),allVillagers=mine.filter(u=>u.kind==='villager'),soldiers=mine.filter(u=>soldierKinds.includes(u.kind)&&layerOf(u.kind)==='land'),warships=mine.filter(u=>soldierKinds.includes(u.kind)&&layerOf(u.kind)==='water'),scout=mine.find(u=>u.kind==='scout');
 const own=s.buildings.filter(b=>b.player===P),tc=own.find(b=>b.kind==='town-center'),tcBox=tc?boxOf(s,tc):null;
 const foes=s.units.filter(u=>u.player!==P&&!isAnimal(u.kind)&&seen.has(tileAt(u.x,u.y,s.map.size))).sort((a,b)=>a.id-b.id);
 // Concede when nothing can turn the game: no town centre (it cannot be rebuilt) and no soldiers left.
 // (A nomad start has no town centre yet: its villagers found one, nomadStart below.)
 if(!tc&&!soldiers.length&&!warships.length&&!(s.map.nomad&&allVillagers.length)){order('resign',{});return;}
 // The opening (packages/content/openings.ts) while it runs: its raiders leave the normal army's hands.
 const op=activeOpening(s),phase=op?openingPhase(s,own):null,half=tcBox?sideFrom(s,centre(tcBox)):null;
 const raiding=op&&half&&tcBox?raid(s,order,op,mine,scout,foes,idle,centre(tcBox),half,explored):new Set<number>();
 // The goal of the next wave, and whether the soldiers can walk there (not across water, not out of an ungated wall:
 // the transports and the gate below see to those, ai-maps.ts).
 const goal=tcBox?objective(s,centre(tcBox),explored,true):null,blocked=!!goal&&!!tcBox&&landBlocked(s,own,centre(tcBox),goal);
 const wave=army(s,order,soldiers.filter(u=>!raiding.has(u.id)),foes,tcBox,idle,explored,blocked);
 wolves(s,order,P,mine,tc,idle);
 taunt(s,order,wave,tc,tcBox,foes);
 // The town bell: enough enemy soldiers at the town centre and fewer own soldiers there send the villagers inside; once
 // no enemy is left near, they go back to work.
 if(tcBox){const home=centre(tcBox),raiders=foes.filter(f=>f.kind!=='villager'&&dist(f,home)<=aiRules.bellRadius).length,guards=soldiers.filter(u=>dist(u,home)<=aiRules.bellRadius).length;
  const belled=Object.values(s.garrison).some(g=>g.units.some(e=>e.bell&&e.unit.player===P));
  if(!belled&&raiders>=aiRules.bellFoes&&guards<raiders)order('bell',{ring:true});else if(belled&&!foes.some(f=>dist(f,home)<=aiRules.bellRadius+150))order('bell',{ring:false});}
 // The scout explores: whenever idle it rides to the nearest tile red has never seen, so waves can aim at
 // buildings it actually found (the point reflection stays the fallback when nothing is known).
 // Open water is left to the ships (a lake's middle would otherwise send the scout to its shore again every pass).
 if(scout&&idle(scout)){const size=s.map.size;let best=-1,far=Infinity;for(let t=0;t<size*size;t++){if(explored.has(t)||s.map.tiles[t].terrainType==='water')continue;const d=Math.hypot((t%size)*100+50-scout.x,Math.floor(t/size)*100+50-scout.y);if(d<far){far=d;best=t;}}
  if(best>=0)march(s,order,[scout],{x:(best%size)*100+50,y:Math.floor(best/size)*100+50});}
 nomadStart(s,order,P,allVillagers,own);
 if(!tc||!tcBox)return;
 // Forward villagers (tower rushes, a forward barracks) are the opening's; the rest is the home economy.
 const forward=op&&half?forwardWork(s,order,op,allVillagers,own,idle,centre(tcBox),half,explored):new Set<number>(),villagers=allVillagers.filter(u=>!forward.has(u.id));
 const account=s.accounts[P],stock=account.stock,owner=ownerOf(s,P),cost=(id:string)=>costOf(id,owner);
 const queued=(id:string)=>own.reduce((t,b)=>t+b.queue.filter(q=>q.entryId===id).length,0);
 // The castle plan (third age, a civ with a unique unit): the castle, then its unique units and technologies.
 const plan=s.ages[P]>=3?castlePlan(owner):null,castle=own.find(b=>b.kind==='castle');
 // Stone still wanted: the castle's and the unique technologies' not yet researched or queued (the Great Wall costs stone).
 const stoneDue=!!plan&&stock.stone<(castle?0:cost('castle').stone)+plan.techs.filter(id=>!s.techs[P].includes(id)&&!queued(id)).reduce((t,id)=>t+cost(id).stone,0);
 // Unfinished foundations with nobody working on them get one builder.
 // The castle takes castleBuilders (one joins per pass).
 // Forward foundations (an opening's towers and barracks) are the forward villagers' (forwardWork), not the home's.
 for(const b of own.filter(b=>!b.complete&&!(op&&half&&half(centre(boxOf(s,b)!))<0))){if(allVillagers.filter(u=>{const w=s.works[u.id];return w?.kind==='build'&&w.buildingId===b.id;}).length>=(b.kind==='castle'?aiRules.castleBuilders:1))continue;
  const builder=pickBuilder(s,villagers,idle,centre(boxOf(s,b)!));if(builder)order('construct',{unitIds:[builder.id],buildingId:b.id});}
 const pending=(k:BuildKind)=>own.some(b=>b.kind===k&&!b.complete);
 const room=account.populationCap-account.populationUsed-account.populationReserved;
 // The barracks goes down first: it needs the larger site, and houses would otherwise take those spots.
 // An opening sets when (or whether) it goes up: at so many villagers, while the Feudal Age is researched, or not at all.
 const barracksDue=!own.some(b=>b.kind==='barracks')&&(op?op.plan.barracks==='dark'?allVillagers.length>=(op.plan.barracksAt??aiRules.barracksAtVillagers):op.plan.barracks==='up'&&phase!=='dark':villagers.length>=aiRules.barracksAtVillagers);
 if(barracksDue)place(s,order,'barracks',villagers,idle,tcBox,own);
 // In the third age the castle comes before the stable and the siege workshop: its 4x4 site is the hardest to find, so
 // they wait while its stone comes in (a pass that finds no site for it lets them go ahead). The monastery does not
 // wait: held back, it found no room at all once the castle stood on this map.
 const holdForCastle=!!plan&&!castle&&(stock.stone<cost('castle').stone||place(s,order,'castle',villagers,idle,tcBox,own));
 // In the second age an archery range follows (it needs the finished barracks).
 const monasteryLost=s.ages[P]>=3&&!own.some(b=>b.kind==='monastery')&&stock.wood>=cost('monastery').wood&&!place(s,order,'monastery',villagers,idle,tcBox,own);
 // The second age adds a blacksmith (after the range); the third a stable for knights.
 // While an opening runs only its own buildings go up (the normal plan's would take the wood it counts on).
 if(!op&&s.ages[P]>=2&&own.some(b=>b.kind==='archery-range'&&b.complete)&&!own.some(b=>b.kind==='blacksmith')&&stock.wood>=cost('blacksmith').wood)place(s,order,'blacksmith',villagers,idle,tcBox,own);
 if(s.ages[P]>=3&&!holdForCastle&&own.some(b=>b.kind==='blacksmith'&&b.complete)&&!own.some(b=>b.kind==='siege-workshop')&&stock.wood>=cost('siege-workshop').wood)place(s,order,'siege-workshop',villagers,idle,tcBox,own);
 if(s.ages[P]>=3&&!holdForCastle&&!own.some(b=>b.kind==='stable')&&stock.wood>=cost('stable').wood)place(s,order,'stable',villagers,idle,tcBox,own);
 if(!op&&s.ages[P]>=2&&!own.some(b=>b.kind==='archery-range')&&!buildRequirement(s.ages[P],'archery-range',own,owner.civ,s.techs[P],!!owner.allTechs)&&stock.wood>=cost('archery-range').wood)place(s,order,'archery-range',villagers,idle,tcBox,own);
 // The opening's own Feudal Age buildings (a stable for the scouts, a second archery range), one a pass.
 if(op&&s.ages[P]>=2)for(const {kind,count} of op.plan.build){const k=kind as BuildKind;if(own.filter(b=>b.kind===k).length>=count||own.some(b=>b.kind===k&&!b.complete)||buildRequirement(s.ages[P],k,own,owner.civ,s.techs[P],!!owner.allTechs))continue;if(place(s,order,k,villagers,idle,tcBox,own))break;}
 // The monastery comes first in the third age: until it stands (or a pass finds no site for it), houses wait for a full
 // population and no camp goes up, so the wood and the room near the base go to it.
 const monasteryDue=s.ages[P]>=3&&ownerAvailable(owner,'monastery')&&!own.some(b=>b.kind==='monastery')&&!monasteryLost;
 if(room<=(monasteryDue?0:aiRules.houseMargin)&&account.populationCap<settingsOf(s).popCap&&!pending('house')&&(!barracksDue||room<=0))place(s,order,'house',villagers,idle,tcBox,own);
 // Drop-off camps: when two or more villagers carry wood (gold/stone, natural food) from farther than campDistance to the
 // nearest drop-off that takes it, a camp goes up next to that source.
 const accepts=dropoffRules.accepts as Record<string,readonly string[]>,drops=own.filter(b=>b.complete&&accepts[b.kind]).map(b=>({kinds:accepts[b.kind],box:boxOf(s,b)!})).filter(d=>d.box);
 for(const [camp,kinds] of [['lumber-camp',['wood']],['mining-camp',['gold','stone']],['mill',['food']]] as const){if(monasteryDue||own.some(b=>b.kind===camp&&!b.complete))continue;
  // A mill goes next to far natural food (bushes, carcasses, fish), never next to a farm.
  const far=villagers.map(u=>s.works[u.id]).filter(w=>w?.kind==='gather').map(w=>s.map.resources.find(r=>r.id===(w as {resourceId:string}).resourceId)).filter((r):r is NonNullable<typeof r>=>!!r&&r.kind!=='farm'&&(kinds as readonly string[]).includes(resourceDefinitions[r.kind].yield)&&Math.min(...drops.filter(d=>d.kinds.includes(resourceDefinitions[r.kind].yield)).map(d=>gap([r.x,r.y,r.x,r.y],d.box)))>aiRules.campDistance);
  // A camp that finds no site (e.g. by a mine on the far side) does not hold up the next kind.
  if(far.length>=aiRules.campWorkers&&place(s,order,camp,villagers,idle,tcBox,own,undefined,{x:far[0].x,y:far[0].y}))break;}
 // Town centre: villagers up to the target, then the second age once the barracks exists.
 const villagerCount=allVillagers.length+queued('villager');
 if(op&&tc.complete&&!tc.queue.length){const plan=op.plan,clicked=phase!=='dark',ready=allVillagers.length>=plan.clickAt;
  // The opening's click-up: Loom first when the plan says so, then the Feudal Age (the food is saved for it); with
  // clickOnFood the villagers go on until the food is there. After it: villagers up to the plan's target, and a
  // fast castle researches the Castle Age as soon as it can pay.
  if(!clicked&&ready&&(!plan.clickOnFood||stock.food>=cost('age-2').food)){const next=plan.loom&&!s.techs[P].includes('loom')?'loom':'age-2';if(!trainable(s,P,tc,next))order('train',{buildingId:tc.id,entryId:next});}
  else if(villagerCount<(clicked?Math.max(plan.villagers,aiTuning(s).villagerTarget):plan.clickOnFood?plan.villagers:plan.clickAt)&&!trainable(s,P,tc,'villager'))order('train',{buildingId:tc.id,entryId:'villager'});
  else if(plan.castle&&s.ages[P]===2&&!trainable(s,P,tc,'age-3'))order('train',{buildingId:tc.id,entryId:'age-3'});
 }else if(tc.complete&&!tc.queue.length){
  if(villagers.length+queued('villager')<aiTuning(s).villagerTarget&&!(s.map.separate&&!mine.some(u=>u.kind==='transport-ship')&&!queued('transport-ship')&&room<=1&&own.some(b=>b.kind==='dock'))&&!trainable(s,P,tc,'villager'))order('train',{buildingId:tc.id,entryId:'villager'});
  else if(s.ages[P]<2&&villagers.length>=aiRules.ageUpAtVillagers&&own.some(b=>b.kind==='barracks'&&b.complete)&&!trainable(s,P,tc,'age-2'))order('train',{buildingId:tc.id,entryId:'age-2'});
  // The third age once the villagers are complete and the archery range stands (for the monastery and its monks).
  else if(s.ages[P]===2&&villagers.length>=aiTuning(s).villagerTarget&&own.some(b=>b.kind==='archery-range'&&b.complete)&&!trainable(s,P,tc,'age-3'))order('train',{buildingId:tc.id,entryId:'age-3'});
 }
 // Barracks: militia, but food is kept for the age-up when it is due. Archery range: archers.
 const savingForAge=op?phase==='dark'&&allVillagers.length>=op.plan.clickAt&&!op.plan.clickOnFood:s.ages[P]<2&&villagers.length>=aiRules.ageUpAtVillagers&&stock.food<cost('age-2').food+60;
 // Saving for the third age: soldiers wait while food or gold is short of it (plus one soldier's worth).
 const savingForCastle=s.ages[P]===2&&!own.some(b=>b.queue.some(q=>q.entryId==='age-3'))&&(op?op.plan.castle:villagers.length>=aiTuning(s).villagerTarget&&own.some(b=>b.kind==='archery-range'&&b.complete))&&(stock.food<cost('age-3').food+60||stock.gold<cost('age-3').gold+30);
 // The opening's army this phase: each kind kept up to its count at whichever building trains it (nothing else there).
 const planned=op?Object.entries(op.plan.train[phase==='castle'?'feudal':phase!]??{}):null;
 const buildingsDue=!!op&&s.ages[P]>=2&&op.plan.build.some(({kind,count})=>own.filter(b=>b.kind===kind).length<count&&!buildRequirement(s.ages[P],kind,own,owner.civ,s.techs[P],!!owner.allTechs));
 const monks=mine.filter(u=>u.kind==='monk'),seenCavalry=foes.some(u=>classesOf(u.kind).includes('cavalry')&&(u.kind!=='scout'||s.tick>aiTuning(s).firstWaveTick)),seenArchers=foes.filter(u=>classesOf(u.kind).includes('archer')&&!classesOf(u.kind).includes('skirmisher')).length;
 // Unique units still due (castle standing or going up): the other buildings keep that many population slots and their
 // gold free, so the castle's units are not crowded out by the population cap or a spent gold mine.
 // The reserve is the next unit's cost in every resource and the gold of all of them (gold is the one that runs out).
 const slots=plan&&castle?Math.max(0,aiRules.uniqueTarget-mine.filter(u=>u.kind===plan.unit).length-queued(plan.unit)):0,unitCost=plan?cost(plan.unit):null;
 const reserve=(r:Resource)=>!slots||!unitCost?0:r==='gold'?slots*unitCost.gold:unitCost[r],left={...stock};
 const spare=(id:string)=>{const c=cost(id);return !slots||(Object.keys(c) as Resource[]).every(r=>left[r]>=reserve(r)+c[r]);};let open=room;
 // On separate landmasses the last population slot waits for the first transport (on a small islet there may be no
 // room for another house until the transport has carried villagers across).
 const holdForFerry=s.map.separate&&!mine.some(u=>u.kind==='transport-ship')&&!queued('transport-ship')&&room<=1;
 for(const b of own.filter(b=>b.complete&&b.queue.length<2&&!(holdForFerry&&b.kind!=='dock'))){
  // Units that cost wood wait while the opening's own buildings are still due (the second archery range first).
  if(planned&&!b.kind.startsWith('castle')&&b.kind!=='town-center'){if(savingForAge||savingForCastle)continue;const pick=planned.find(([k,n])=>producersOf(k,owner).includes(b.kind)&&mine.filter(u=>u.kind===k).length+queued(k)<n&&!(buildingsDue&&cost(k).wood>0)&&!trainable(s,P,b,k))?.[0];
   if(pick)order('train',{buildingId:b.id,entryId:pick});continue;}
  // Counters to what red has seen: spearmen once blue cavalry shows, skirmishers against blue archers.
  // The unique unit wherever this civ trains it (the castle; the Goths' barracks after Anarchy).
  const unique=plan&&slots&&producersOf(plan.unit,owner).includes(b.kind)?plan.unit:null;
  const pick=unique??(savingForCastle&&b.kind!=='monastery'?null:b.kind==='barracks'&&!savingForAge?(seenCavalry?'spearman':'militia'):b.kind==='archery-range'?(seenArchers>=2?'skirmisher':'archer'):b.kind==='stable'&&s.ages[P]>=3?'knight':b.kind==='siege-workshop'&&mine.filter(u=>u.kind==='ram').length+queued('ram')<aiRules.rams?'ram':b.kind==='monastery'&&monks.length+queued('monk')<aiRules.monkTarget?'monk':null);
  // (open and left count this pass's own orders, which are admitted only next tick.)
  if(pick&&pick!==unique&&slots&&(open<=slots||!spare(pick)))continue;
  if(pick&&!trainable(s,P,b,pick)&&order('train',{buildingId:b.id,entryId:pick})&&slots&&pick!==unique){open--;const c=cost(pick);for(const r of Object.keys(c) as Resource[])left[r]-=c[r];}}
 // Economic technologies, in the reference's usual order, whenever nothing is being saved for an age: the gather
 // upgrades at the camps and the mill, Loom and the carts at an idle town centre once the villagers are complete.
 // The castle researches the civ's castle-age unique technologies once its unique units are complete.
 const research={...aiRules.research,...(plan?{castle:plan.techs}:{})} as Record<string,readonly string[]>;
 // An opening's technologies go first at their buildings (the Feudal Age ones once it is reached).
 if(op)for(const id of op.plan.research)for(const b of producersOf(id,owner)){const list=research[b]??[];if(!list.includes(id))research[b]=[id,...list];}
 // While an opening runs, only its own technologies (Loom is the town centre's click-up step).
 if(op)for(const k of Object.keys(research))research[k]=research[k].filter(id=>op.plan.research.includes(id));
 if(!savingForAge&&!savingForCastle)for(const b of own.filter(b=>b.complete&&!b.queue.length)){
  if(b.kind==='town-center'&&villagers.length+queued('villager')<aiTuning(s).villagerTarget)continue;
  const next=research[b.kind]?.find(id=>!trainable(s,P,b,id)&&spare(id));if(next)order('train',{buildingId:b.id,entryId:next});}
 water(s,order,{own,mine,villagers,warships,idle,tcBox,cost,queued,spare,explored,foes});
 {const home=centre(tcBox),wave=soldiers.filter(u=>idle(u)&&!s.attacks[u.id]&&dist(u,home)<=aiRules.defendRadius&&sameLand(s,u,home)).sort((a,b)=>a.id-b.id);
  ferry(s,order,P,{own,mine,villagers:allVillagers,wave,idle,home,goal:goal??home,waveSize:aiTuning(s).waveSize,offensive:s.tick>=aiTuning(s).firstWaveTick,
   place:(kind,near,party)=>place(s,order,kind,party,idle,tcBox,own,undefined,near)});
  breakout(s,order,P,own,villagers,tc,goal??home);}
 repairHome(s,order,own,villagers,idle);
 trade(s,order,{own,mine,villagers,idle,tcBox,cost,queued,saving:savingForAge||savingForCastle||monasteryDue,stoneDue:!!plan&&!castle&&stock.stone<cost('castle').stone});
 // Monks: a carried relic goes to the monastery; with full faith a monk converts the nearest enemy unit that comes
 // near the town centre; otherwise idle monks fetch relics red has seen (one monk per relic). Healing is automatic.
 const monastery=own.find(b=>b.kind==='monastery'&&b.complete),home=tcBox?centre(tcBox):null,fetching=new Set(Object.values(s.rites).filter(r=>r.kind==='relic').map(r=>r.target));
 for(const m of monks){const rite=s.rites[m.id];
  if(carrying(s,m.id)){if(monastery&&rite?.kind!=='deposit')order('deposit',{unitIds:[m.id],buildingId:monastery.id});continue;}
  if(rite?.kind==='convert'||rite?.kind==='relic')continue;
  const intruder=home&&faithOf(s,m.id)>=1?foes.filter(u=>dist(u,home)<=aiRules.defendRadius&&!riteProblem(s,P,'convert',u.id)).sort((a,b)=>dist(a,m)-dist(b,m)||a.id-b.id)[0]:undefined;
  if(intruder){order('convert',{unitIds:[m.id],targetId:intruder.id});continue;}
  const relic=s.relicMemory[P].filter(r=>!fetching.has(r.id)).sort((a,b)=>dist(a,m)-dist(b,m)||a.id-b.id)[0];
  if(relic&&!rite&&monastery){order('relic',{unitIds:[m.id],relicId:relic.id});fetching.add(relic.id);}}
 // Idle villagers gather whichever weighted resource is most under-staffed, from the nearest explored source.
 const staff:Record<Resource,number>={food:0,wood:0,gold:0,stone:0},farmers=new Set<string>();
 // Hunters of a live animal count as food (its carcass does not exist yet).
 // wild: villagers on natural food (hunting, herding, carcasses, bushes, fish); beyond wildFoodWorkers, and from the
 // second age on, new food workers farm (those already on a carcass or a bush finish it).
 const hunted=new Set<number>();let wild=0;
 for(const u of villagers){const w=s.works[u.id];if(w?.kind==='gather'){if(w.prey!==undefined){staff.food++;wild++;hunted.add(w.prey);continue;}const r=s.map.resources.find(r=>r.id===w.resourceId);if(r){staff[resourceDefinitions[r.kind].yield]++;if(r.kind==='farm')farmers.add(r.id);else if(resourceDefinitions[r.kind].yield==='food')wild++;}}}
 // Found sheep are driven next to the town centre, where they are eaten one by one.
 // Only penSize sheep wait in the pen at a time (a big flock by the town centre would block the villagers' way); the
 // nearest stray ones are fetched as the pen empties.
 {const home=centre(tcBox),pen=penSpot(s,tcBox),sheep=mine.filter(u=>u.kind==='sheep'),penned=sheep.filter(u=>dist(u,home)<=aiRules.herdRadius||!idle(u)).length;
  const stray=sheep.filter(u=>idle(u)&&!hunted.has(u.id)&&dist(u,home)>aiRules.herdRadius).sort((a,b)=>dist(a,home)-dist(b,home)||a.id-b.id).slice(0,Math.max(0,aiRules.penSize-penned));if(stray.length)march(s,order,stray,pen);}
 // Stone for the castle plan: villagers on wood (else gold) move to the explored stone nearest the town centre, the
 // nearest to it first, until stoneWorkers mine it (busy villagers are never re-tasked otherwise). Once no stone is due
 // they are re-tasked like idle villagers (stone has no weight).
 const yieldOf=(u:Unit)=>{const w=s.works[u.id];if(w?.kind!=='gather'||w.prey!==undefined)return null;const r=s.map.resources.find(r=>r.id===w.resourceId);return r?resourceDefinitions[r.kind].yield:null;};
 if(stoneDue&&staff.stone<aiRules.stoneWorkers){const home=centre(tcBox),rock=s.map.resources.filter(r=>resourceDefinitions[r.kind].yield==='stone'&&explored.has(tileAt(r.x,r.y,s.map.size))&&!gatherable(s.map,r.id)).sort((a,b)=>dist(a,home)-dist(b,home)||(a.id<b.id?-1:1))[0];
  if(rock)for(const kind of ['wood','gold'] as const)for(const u of villagers.filter(u=>yieldOf(u)===kind).sort((a,b)=>dist(a,rock)-dist(b,rock)||a.id-b.id)){
   if(staff.stone>=aiRules.stoneWorkers)break;if(order('gather',{unitIds:[u.id],resourceId:rock.id})){staff.stone++;staff[kind]--;}}}
 // An opening's own split of the villagers (stone too, for a tower rush) while it runs.
 const towersLeft=op?.plan.towers?Math.max(0,op.plan.towers.count-own.filter(b=>b.kind==='watch-tower').length):0,planWeights=op?op.plan.weights[phase==='castle'?'feudal':phase!]:null;
 // Stone for a tower rush only while the towers still to build are not paid for.
 const weights:Weights=planWeights?{...planWeights,stone:stock.stone>=towersLeft*cost('watch-tower').stone?0:planWeights.stone}:aiRules.gatherWeights;
 for(const u of villagers.filter(u=>idle(u)||!stoneDue&&!weights.stone&&yieldOf(u)==='stone')){
  const kinds=(Object.keys(weights) as Resource[]).filter(k=>weights[k]>0).sort((a,b)=>staff[a]/weights[a]-staff[b]/weights[b]);
  // Food counts only within reach of the own town centre (otherwise villagers would walk to the opponent's
  // berries once the scout has seen them); beyond that a farm is laid out instead.
  for(const kind of kinds){const natural=wild<aiRules.wildFoodWorkers&&s.ages[P]<2,source=s.map.resources.filter(r=>resourceDefinitions[r.kind].yield===kind&&(kind!=='food'||natural||r.kind==='farm')&&explored.has(tileAt(r.x,r.y,s.map.size))&&(kind!=='food'||dist(r,centre(tcBox))<=(r.kind==='farm'?aiRules.siteRange:aiRules.wildRange))&&!gatherable(s.map,r.id)&&sameLand(s,u,r)&&(r.kind!=='farm'||farmOwner(s,r.id)===P&&!farmers.has(r.id))).sort((a,b)=>dist(u,a)-dist(u,b)||(a.id<b.id?-1:1))[0];
   // Food: an own sheep already driven home, or a deer near home (never a boar), when it is closer than any carcass,
   // bush or field; one already being hunted is joined only when no other is in reach.
   if(kind==='food'&&natural){const prey=s.units.filter(a=>(a.kind==='sheep'?dist(a,centre(tcBox))<=aiRules.herdRadius+50:a.kind==='deer'&&dist(a,centre(tcBox))<=aiRules.wildRange)&&!huntProblem(s,P,a.id)&&!s.map.resources.some(r=>r.id===carcassId(a.id))).sort((a,b)=>Number(hunted.has(a.id))-Number(hunted.has(b.id))||dist(u,a)-dist(u,b)||a.id-b.id)[0];
    if(prey&&(!source||source.kind==='farm'||dist(u,prey)<dist(u,source))&&order('hunt',{unitIds:[u.id],animalId:prey.id})){staff.food++;wild++;hunted.add(prey.id);break;}}
   if(source&&order('gather',{unitIds:[u.id],resourceId:source.id})){staff[kind]++;if(source.kind==='farm')farmers.add(source.id);else if(kind==='food')wild++;break;}
   // No natural food left in sight: this villager lays out a farm (one farmer per field).
   if(kind==='food'&&!source&&!own.some(b=>b.kind==='farm'&&!b.complete)&&place(s,order,'farm',villagers,idle,tcBox,own,u))break;}
 }
}
type Ctx={own:Building[];mine:Unit[];villagers:Unit[];idle:(u:Unit)=>boolean;tcBox:Box;cost:(id:string)=>Record<Resource,number>;queued:(id:string)=>number};
const affords=(s:AIState,c:Record<Resource,number>,extra=0)=>(Object.keys(c) as Resource[]).every(r=>s.accounts[aiRules.player].stock[r]>=c[r]+(c[r]?extra:0));
// Placement input as the player knows it (same check as a human's order).
function knownInput(s:AIState){const explored=new Set(s.vision[aiRules.player].explored),bodies=[...s.units.flatMap(u=>[{x:u.x,y:u.y},...(u.next===null?[]:[position(s.map,u.next)])]),...s.relics.filter(r=>r.carrier===null&&r.monastery===null).map(r=>({x:r.x,y:r.y}))];
 return {tiles:s.map.tiles,obstacles:s.map.obstacles,units:bodies,explored:(t:number)=>explored.has(t)};}
// Tile-aligned sites for a building on the water (dock, fish trap) whose footprint touches water, nearest to near first;
// the first that passes the placement check (only tiles are scanned, so a map without water costs one pass over them).
function waterSite(s:AIState,kind:'dock'|'fish-trap',near:{x:number;y:number},range:number){
 const size=s.map.size,[,,w,d]=obstacleBounds({kind,x:0,y:0}),n=w/100,sites:{x:number;y:number;d:number}[]=[];
 const wet=(t:number)=>s.map.tiles[t]?.terrainType==='water'||s.map.tiles[t]?.terrainType==='shallow';
 for(let ty=0;ty+d/100<=size;ty++)for(let tx=0;tx+n<=size;tx++){if(!wet(ty*size+tx))continue;const c={x:tx*100+w/2,y:ty*100+d/2},dd=dist(c,near);if(dd<=range)sites.push({x:tx*100,y:ty*100,d:dd});}
 sites.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);const input=knownInput(s);
 // (Never over a shoal of fish or another point resource: the authoritative check refuses that, buildings.ts.)
 const covers=(b:number[])=>s.map.resources.some(r=>!r.obstacleId&&r.status==='available'&&r.x>b[0]&&r.x<b[2]&&r.y>b[1]&&r.y<b[3]);
 return sites.find(v=>{const b=obstacleBounds({kind,x:v.x,y:v.y});return !clashes(b)&&!covers(b)&&!placementProblem(input,kind,v.x,v.y);})??null;}
// The lake: a dock, fishing ships on the deep fish (fish traps when none is left in sight), a few warships guarding it.
function water(s:AIState,order:Order,c:Ctx&{warships:Unit[];spare:(id:string)=>boolean;explored:Set<number>;foes:Unit[]}){
 const P=aiRules.player,owner=ownerOf(s,P),docks=c.own.filter(b=>b.kind==='dock'),dock=docks.find(b=>b.complete),home=centre(c.tcBox);
 if(!docks.length){if(ownerAvailable(owner,'dock')&&c.villagers.length>=(s.map.separate?mapAIRules.ferry.dockAt:aiRules.dockAtVillagers)&&(s.map.separate||c.own.some(b=>b.kind==='barracks'))&&affords(s,c.cost('dock'))){const site=waterSite(s,'dock',home,aiRules.dockRange);
   const builder=site&&pickBuilder(s,c.villagers,c.idle,{x:site.x+150,y:site.y+150});if(site&&builder)claim(order('build',{unitIds:[builder.id],kind:'dock',x:site.x,y:site.y}),'dock',site.x,site.y);}return;}
 if(!dock)return;const dockBox=boxOf(s,dock)!,at=centre(dockBox),ships=c.mine.filter(u=>u.kind==='fishing-ship');
 // Training: fishing ships first, then (third age) the warships; one item at a time.
 // On separate landmasses a transport comes first (ai-maps.ts ferry: the expansion party, then the waves).
 const ferryFirst=s.map.separate&&!c.mine.some(u=>u.kind==='transport-ship')&&!c.queued('transport-ship')&&ownerAvailable(owner,'transport-ship');
 if(!dock.queue.length){const pick=ferryFirst?'transport-ship':ships.length+c.queued('fishing-ship')<aiRules.fishingShips?'fishing-ship':s.ages[P]>=3&&c.warships.length+c.queued('galley')<aiRules.warships&&c.spare('galley')?'galley':null;
  if(pick&&!trainable(s,P,dock,pick))order('train',{buildingId:dock.id,entryId:pick});}
 // Fishing: the nearest explored fish or an own idle trap; without any, an idle ship lays a trap (wood allowing) or
 // sails towards the nearest unexplored water.
 const worked=new Set(c.mine.map(u=>s.works[u.id]).filter(w=>w?.kind==='gather').map(w=>(w as {resourceId:string}).resourceId));
 const traps=c.own.filter(b=>b.kind==='fish-trap').length;let laid=false;
 for(const u of ships.filter(c.idle)){
  const source=s.map.resources.filter(r=>(r.kind==='fish'||r.kind==='fish-trap'&&farmOwner(s,r.id)===P&&!worked.has(r.id))&&c.explored.has(tileAt(r.x,r.y,s.map.size))&&!gatherable(s.map,r.id,'water')).sort((a,b)=>dist(u,a)-dist(u,b)||(a.id<b.id?-1:1))[0];
  if(source){if(order('gather',{unitIds:[u.id],resourceId:source.id})&&source.kind==='fish-trap')worked.add(source.id);continue;}
  const sighted=s.map.resources.some(r=>r.kind==='fish'&&r.collectible&&c.explored.has(tileAt(r.x,r.y,s.map.size)));
  if(!sighted&&!laid&&traps<aiRules.fishTraps&&ownerAvailable(owner,'fish-trap')&&s.ages[P]>=2&&affords(s,c.cost('fish-trap'),50)){const site=waterSite(s,'fish-trap',at,aiRules.trapRange);
   if(site&&claim(order('build',{unitIds:[u.id],kind:'fish-trap',x:site.x,y:site.y}),'fish-trap',site.x,site.y)){laid=true;continue;}}
  const size=s.map.size;let best=-1,far=Infinity;for(let t=0;t<size*size;t++){if(c.explored.has(t)||s.map.tiles[t].terrainType!=='water')continue;const d=Math.hypot((t%size)*100+50-u.x,Math.floor(t/size)*100+50-u.y);if(d<far){far=d;best=t;}}
  if(best>=0)order('move',{unitIds:[u.id],x:(best%size)*100+50,y:Math.floor(best/size)*100+50});}
 // Warships: the nearest enemy unit on the water (or the nearest seen enemy dock) within navyRadius of the own dock;
 // otherwise idle ones wait by it.
 const prey=c.foes.filter(f=>layerOf(f.kind)==='water'&&dist(f,at)<=aiRules.navyRadius).sort((a,b)=>dist(a,at)-dist(b,at)||a.id-b.id)[0];
 const enemyDock=prey?undefined:s.buildings.filter(b=>b.player!==P&&b.kind==='dock').map(b=>({b,box:boxOf(s,b)})).filter(v=>v.box&&dist(centre(v.box),at)<=aiRules.navyRadius&&!targetProblem(s,P,{kind:'building',id:v.b.id})).sort((a,b)=>dist(centre(a.box!),at)-dist(centre(b.box!),at)||(a.b.id<b.b.id?-1:1))[0];
 const target:Target|null=prey?{kind:'unit',id:prey.id}:enemyDock?{kind:'building',id:enemyDock.b.id}:null;
 const free=c.warships.filter(u=>!s.attacks[u.id]);
 if(target&&free.length)order('attack',{unitIds:free.map(u=>u.id),target});
 else{const away=free.filter(u=>c.idle(u)&&dist(u,at)>400);if(away.length)order('move',{unitIds:away.map(u=>u.id),x:Math.round(at.x),y:Math.round(at.y)});}
}
// The market: built in the third age, used to turn surplus into gold (or gold into the castle's stone), and the base of
// trade carts once the opponent's finished market is known.
function trade(s:AIState,order:Order,c:Ctx&{saving:boolean;stoneDue:boolean}){
 const P=aiRules.player,owner=ownerOf(s,P),stock=s.accounts[P].stock,markets=c.own.filter(b=>b.kind==='market'),market=markets.find(b=>b.complete);
 if(!markets.length){if(s.ages[P]>=3&&!c.saving&&ownerAvailable(owner,'market')&&stock.wood>=c.cost('market').wood+aiRules.marketSpare)place(s,order,'market',c.villagers,c.idle,c.tcBox,c.own);return;}
 if(!market)return;
 // Its carts leave on the town centre's side (the ring node nearest the rally point): a market by the map's edge
 // otherwise put them in the pocket between it and the border woods.
 if(!market.rally){const box=boxOf(s,market)!,m=centre(box),h=centre(c.tcBox),d=Math.hypot(h.x-m.x,h.y-m.y)||1,k=Math.min(d,(box[2]-box[0])/2+150)/d;
  const spot=standable(s,{x:m.x+(h.x-m.x)*k,y:m.y+(h.y-m.y)*k});if(spot)order('rally',{buildingId:market.id,x:spot.x,y:spot.y});}
 // One exchange a pass: stone for the castle first, else the largest surplus sold while gold is short.
 if(s.market&&c.stoneDue&&stock.gold>=marketQuote(s.market,owner,'stone').buy+aiRules.goldShort)order('market',{action:'buy',resource:'stone'});
 else if(stock.gold<aiRules.goldShort){const surplus=[...marketResources].filter(r=>stock[r]>=aiRules.sellAbove+marketRules.lot).sort((a,b)=>stock[b]-stock[a]||(a<b?-1:1))[0];if(surplus)order('market',{action:'sell',resource:surplus});}
 // Trade carts go to the nearest finished enemy market red remembers.
 const theirs=s.vision[P].known.map(k=>k.obstacle).filter(o=>o.kind==='market'&&!o.red&&o.progress===undefined).map(o=>({id:o.id!,c:centre(obstacleBounds(o))})).sort((a,b)=>dist(a.c,centre(c.tcBox))-dist(b.c,centre(c.tcBox))||(a.id<b.id?-1:1))[0];
 if(!theirs||!ownerAvailable(owner,'trade-cart'))return;
 const carts=c.mine.filter(u=>u.kind==='trade-cart');
 if(!market.queue.length&&!c.saving&&carts.length+c.queued('trade-cart')<aiRules.tradeCarts&&!trainable(s,P,market,'trade-cart'))order('train',{buildingId:market.id,entryId:'trade-cart'});
 const idleCarts=carts.filter(u=>c.idle(u)&&!s.trades?.[u.id]);
 if(idleCarts.length)order('trade',{unitIds:idleCarts.map(u=>u.id),buildingId:theirs.id});
}
// The pen: the side of the town centre (150 beyond its footprint; the gate side last) with the most open nodes round
// it, so a carcass there lies a few steps from the drop-off ring and clear of the base's own buildings.
// Repairs: the most damaged own town centre or castle (lowest id on ties) below repairBelow gets villagers nearby.
function repairHome(s:AIState,order:Order,own:Building[],villagers:Unit[],idle:(u:Unit)=>boolean){
 const hurt=own.filter(b=>(b.kind==='town-center'||b.kind==='castle')&&b.complete&&b.hp*100<b.maxHp*aiRules.repairBelow).sort((a,b)=>a.hp*b.maxHp-b.hp*a.maxHp||(a.id<b.id?-1:1))[0];
 const box=hurt&&boxOf(s,hurt);if(!hurt||!box)return;
 const on=villagers.filter(v=>{const w=s.works[v.id] as {kind:string;target?:{id:unknown}}|undefined;return w?.kind==='repair'&&w.target?.id===hurt.id;}).length;
 // Idle villagers first, then gatherers (never builders); the nearest within repairRange, lowest id on ties.
 const dist=(v:Unit)=>Math.max(box[0]-v.x,0,v.x-box[2],box[1]-v.y,0,v.y-box[3]),busy=(v:Unit)=>{const k=(s.works[v.id] as {kind:string}|undefined)?.kind;return k==='build'||k==='repair';};
 const free=villagers.filter(v=>!busy(v)&&dist(v)<=aiRules.repairRange).sort((a,b)=>Number(idle(b))-Number(idle(a))||dist(a)-dist(b)||a.id-b.id).slice(0,Math.max(0,aiRules.repairers-on));
 if(free.length)order('repair',{unitIds:free.map(v=>v.id).sort((a,b)=>a-b),target:{kind:'building',id:hurt.id}});
}
function penSpot(s:AIState,tcBox:Box){const c=centre(tcBox),closed=blockedTable(s.map),edge=s.map.size*100-100;let best={x:c.x,y:c.y},room=-1;
 for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[-1,-1],[1,-1],[-1,1],[1,1],[0,1]]){const x=Math.round(dx<0?tcBox[0]-150:dx>0?tcBox[2]+150:c.x),y=Math.round(dy<0?tcBox[1]-150:dy>0?tcBox[3]+150:c.y);
  if(x<100||y<100||x>edge||y>edge)continue;const open=nodesNear(s.map,[x,y,x,y],100).filter(n=>!closed[n]).length;if(open>room){room=open;best={x,y};}}
 return best;}
function boxOf(s:AIState,b:Building){const o=s.map.obstacles.find(o=>o.id===b.id);return o?obstacleBounds(o):null;}
function pickBuilder(s:AIState,villagers:Unit[],idle:(u:Unit)=>boolean,near:{x:number;y:number}){
 // (Only villagers on the site's own landmass: the island maps.)
 const here=villagers.filter(u=>sameLand(s,u,near));
 const free=here.filter(idle).sort((a,b)=>dist(a,near)-dist(b,near)||a.id-b.id)[0];if(free)return free;
 // Otherwise the nearest villager that is not already building.
 return here.filter(u=>s.works[u.id]?.kind!=='build').sort((a,b)=>dist(a,near)-dist(b,near)||a.id-b.id)[0];
}
// laneGap/baseMargin: at least a unit's width of open nodes between two buildings (50 left none: units could be
// sealed inside the base).
// Sites: anywhere on the own half, nearest to the town centre first, keeping a margin around the town centre
// and other own buildings (drop-off ring and gates stay open). Same placement rule as a human's order.
// near: centre of the search (default the town centre); camps search round the resource they serve.
function place(s:AIState,order:Order,kind:BuildKind,villagers:Unit[],idle:(u:Unit)=>boolean,tcBox:Box,own:Building[],worker?:Unit,near?:{x:number;y:number}):boolean{
 const owner=ownerOf(s,aiRules.player),cost=costOf(kind,owner),stock=s.accounts[aiRules.player].stock;
 if((Object.keys(cost) as Resource[]).some(r=>stock[r]<cost[r])||!buildKinds.includes(kind)||!ownerAvailable(owner,kind))return false;
 const home=centre(tcBox),c=near??home,others=own.filter(b=>b.kind!=='farm'&&b.kind!=='town-center').map(b=>boxOf(s,b)).filter(b=>b!==null) as Box[],[x0,y0,x1,y1]=obstacleBounds({kind,x:0,y:0}),world=s.map.size*100,
  // Mines, berries and animals keep room round them, so a building never boxes in their work slots.
  sources=s.map.obstacles.filter(o=>o.kind==='gold'||o.kind==='rock'||o.kind==='berries'||o.kind==='hunt'||o.kind==='livestock').map(o=>obstacleBounds(o)),middle=world/2,axis=Math.hypot(home.x-middle,home.y-middle)||1,ux=(home.x-middle)/axis,uy=(home.y-middle)/axis;
 // Own side: how far a point lies from the map centre towards the own town centre (negative = the far side).
 const side=(x:number,y:number)=>(x-middle)*ux+(y-middle)*uy;
 const explored=new Set(s.vision[aiRules.player].explored),bodies=[...s.units.flatMap(u=>[{x:u.x,y:u.y},...(u.next===null?[]:[position(s.map,u.next)])]),...s.relics.filter(r=>r.carrier===null&&r.monastery===null).map(r=>({x:r.x,y:r.y}))];
 const input={tiles:s.map.tiles,obstacles:s.map.obstacles,units:bodies,explored:(t:number)=>explored.has(t)},sites:{x:number;y:number;d:number;half:number}[]=[];
 const g=buildingRules.grid,from=(v:number)=>Math.ceil(-v/g)*g;
 // The placement check's own tests, done cheaply per candidate (tiles bucket the obstacles and the units): explored
 // ground of one height that can carry it, no obstacle or unit in the way. A lake by the base or a crowded one otherwise
 // filled the window with sites that all failed the placement check, and the window never widened.
 const size=s.map.size,r=navigationRules.radius,bucket=new Map<number,Box[]>(),put=(b:Box)=>{for(let ty=Math.max(0,Math.floor(b[1]/100));ty<=Math.min(size-1,Math.floor(b[3]/100));ty++)for(let tx=Math.max(0,Math.floor(b[0]/100));tx<=Math.min(size-1,Math.floor(b[2]/100));tx++){const k=ty*size+tx;(bucket.get(k)??bucket.set(k,[]).get(k)!).push(b);}};
 for(const o of s.map.obstacles){const rects=obstacleRects(o);for(const b of rects.length?rects:isBuilding(o)?[obstacleBounds(o)]:[])put(b);}
 // Units (kept clear by the radius, inclusive like the check) are marked by a negative right edge.
 const bodies2=kind==='farm'?[]:bodies.map(u=>[u.x-r,u.y-r,u.x+r,u.y+r] as Box);
 const bodyBucket=new Map<number,Box[]>();for(const b of bodies2){const k=Math.floor(b[1]/100)*size+Math.floor(b[0]/100);for(const dk of [0,1,size,size+1]){const key=k+dk;(bodyBucket.get(key)??bodyBucket.set(key,[]).get(key)!).push(b);}}
 const dry=(box:Box)=>{let h:number|null=null;for(let ty=Math.floor(box[1]/100);ty<=Math.floor((box[3]-1)/100);ty++)for(let tx=Math.floor(box[0]/100);tx<=Math.floor((box[2]-1)/100);tx++){const t=ty*size+tx,tile=s.map.tiles[t];
   if(!tile?.buildability||!explored.has(t)||h!==null&&tile.height!==h)return false;h=tile.height;
   if(bucket.get(t)?.some(o=>Math.min(o[2],box[2])>Math.max(o[0],box[0])&&Math.min(o[3],box[3])>Math.max(o[1],box[1])))return false;
   if(bodyBucket.get(t)?.some(o=>o[2]>=box[0]&&o[0]<=box[2]&&o[3]>=box[1]&&o[1]<=box[3]))return false;}return true;};
 // Only the window within siteRange of the town centre (a camp's resource) is scanned; a crowded base widens it once
 // (siteSpread; never for farms and camps, which serve what is near), and the castle, houses, the market and the
 // monastery may then widen to the whole own half (a grown base often has no free 4x4 block left near the town centre
 // for the castle; on the lake map red stayed at its population cap and never got its market up).
 // A window widens whenever none of its sites passes the placement check; at most siteChecks are checked a window
 // (nearest first), which bounds a pass that finds nothing.
 for(const range of kind==='farm'||kind==='lumber-camp'||kind==='mining-camp'||kind==='mill'?[aiRules.siteRange]:kind==='castle'?[aiRules.siteRange,aiRules.siteRange*aiRules.siteSpread,world]:[aiRules.siteRange,aiRules.siteRange*aiRules.siteSpread]){sites.length=0;
  // The whole own half is scanned coarser (worldStep), so a pass that finds nothing there stays cheap.
  const step=range===world?aiRules.worldStep:aiRules.siteStep;
 const lo=(v:number,o:number)=>Math.max(from(o),Math.ceil((v-range)/g)*g),hi=(v:number,o:number)=>Math.min(world-o,v+range);
 for(let x=lo(c.x,x0);x<=hi(c.x,x1);x+=step)for(let y=lo(c.y,y0);y<=hi(c.y,y1);y+=step){const box=[x+x0,y+y0,x+x1,y+y1],mid=centre(box);
  // Buildings that train soldiers keep a buffer from the centre line so fresh soldiers do not start inside enemy sight;
  // houses and farms may reach a little past it (the 16x16 map leaves little room once a base grows). The castle
  // prefers halfMargin but settles for castleMargin (sorted below).
  const margin=kind==='castle'?aiRules.castleMargin:kind==='barracks'||kind==='archery-range'||kind==='monastery'||kind==='stable'||kind==='siege-workshop'?aiRules.halfMargin:-aiRules.spill,half=Math.min(side(box[0],box[1]),side(box[2],box[1]),side(box[0],box[3]),side(box[2],box[3])),ownHalf=half>=margin;
  if(!ownHalf||dist(mid,c)>range||!dry(box)||gap(box,tcBox)<(kind==='farm'?50:aiRules.baseMargin)||(kind!=='farm'&&(others.some(o=>gap(box,o)<aiRules.laneGap)||sources.some(o=>gap(box,o)<aiRules.sourceMargin)))||kind==='castle'&&placementProblem(input,kind,x,y))continue;sites.push({x,y,d:dist(mid,c),half});}
  const short=(v:{half:number})=>kind==='castle'&&v.half<aiRules.halfMargin?1:0;
  sites.sort((a,b)=>short(a)-short(b)||a.d-b.d||a.y-b.y||a.x-b.x);let checks=0;
  for(const site of sites){if(clashes(obstacleBounds({kind,x:site.x,y:site.y}),kind==='farm'?0:aiRules.laneGap))continue;if(++checks>aiRules.siteChecks)break;if(placementProblem(input,kind,site.x,site.y))continue;
   const builder=worker??pickBuilder(s,villagers,idle,site);if(!builder)return false;
   return claim(order('build',{unitIds:[builder.id],kind,x:site.x,y:site.y}),kind,site.x,site.y);}
 }
 return false;
}
function army(s:AIState,order:Order,soldiers:Unit[],foes:Unit[],tcBox:Box|null,idle:(u:Unit)=>boolean,explored:Set<number>,blocked=false){
 const P=aiRules.player,attackers=new Map<string,{target:Target;ids:number[]}>();
 const assign=(u:Unit,target:Target)=>{const key=target.kind+':'+target.id;if(!attackers.has(key))attackers.set(key,{target,ids:[]});attackers.get(key)!.ids.push(u.id);};
 const home=tcBox?centre(tcBox):null,intruder=home?foes.filter(f=>dist(f,home)<=aiRules.defendRadius).sort((a,b)=>dist(a,home!)-dist(b,home!)||a.id-b.id)[0]:undefined;
 const enemyBuildings=s.buildings.filter(b=>b.player!==P).map(b=>({b,box:boxOf(s,b)})).filter(v=>v.box&&!targetProblem(s,P,{kind:'building',id:v.b.id}));
 const free:Unit[]=[],offensive=s.tick>=aiTuning(s).firstWaveTick;
 for(const u of soldiers){if(s.attacks[u.id])continue;
  // Defend the base first, then the nearest enemy in reach (marching soldiers do not auto-engage).
  // Before the first wave is due, soldiers only fight inside the home area.
  const foe=combatRules.units[u.kind as CombatUnitKind]?.buildingsOnly?undefined:intruder??foes.filter(f=>dist(f,u)<=aiRules.engageRange&&(offensive||home&&dist(f,home)<=aiRules.defendRadius)).sort((a,b)=>dist(a,u)-dist(b,u)||a.id-b.id)[0];
  if(foe){assign(u,{kind:'unit',id:foe.id});continue;}
  // Buildings are attacked only by soldiers already out on a wave, never by one trickling from home.
  const site=offensive&&idle(u)&&dist(u,home??u)>aiRules.defendRadius?enemyBuildings.sort((a,b)=>dist(centre(a.box!),u)-dist(centre(b.box!),u)||(a.b.id<b.b.id?-1:1))[0]:undefined;
  if(site){assign(u,{kind:'building',id:site.b.id});continue;}
  if(idle(u))free.push(u);}
 for(const {target,ids} of attackers.values())order('attack',{unitIds:ids.sort((a,b)=>a-b),target});
 if(!free.length||!home)return;
 const atHome=free.filter(u=>dist(u,home)<=aiRules.defendRadius),away=free.filter(u=>dist(u,home)>aiRules.defendRadius);
 // A wave leaves once enough soldiers wait at home. Its first goal is the mirror of the own town centre
 // (the maps are left-right symmetric); later ones go to remembered enemy buildings, else unexplored ground.
 // A goal the soldiers cannot walk to (another landmass, an ungated wall) waits for the ferry or the gate.
 let wave=false;if(!blocked&&s.tick>=aiTuning(s).firstWaveTick&&atHome.length>=aiTuning(s).waveSize){march(s,order,atHome,objective(s,home,explored,true));wave=true;}
 // Before the first wave is due, stragglers (e.g. fresh soldiers spawned on the far side) return home.
 if(away.length)march(s,order,away,offensive?objective(s,home,explored,false):{x:home.x,y:home.y+250});
 return wave;
}
// Taunts (packages/content/taunts.ts) at a few moments that matter: a wave leaving (23 大伙進攻囉), the town centre
// under attack and below half health (12 我快招架不住了), a finished blue wonder (26 糟了！是世界奇觀！), red soldiers
// at a blue town centre (21 好地方，我要定了！), blue soldiers seen near red's town centre (16 發現敵人). The chat log
// is the only memory, so a replay says the same lines at the same ticks.
function taunt(s:AIState,order:Order,wave:boolean|undefined,tc:Building|undefined,tcBox:Box|null,foes:Unit[]){
 const P=aiRules.player,mine=(s.chat??[]).filter(m=>m.player===P),last=(n?:number)=>Math.max(-Infinity,...mine.filter(m=>n===undefined||m.taunt===n).map(m=>m.tick));
 if(s.tick-last()<aiRules.tauntQuiet)return;
 const say=(n:number)=>s.tick-last(n)>=aiRules.tauntGap&&order('taunt',{number:n});
 const home=tcBox?centre(tcBox):null,raiders=home?foes.filter(f=>f.kind!=='villager'&&dist(f,home)<=aiRules.defendRadius):[];
 if(wave&&say(23))return;
 if(tc&&tc.hp*2<tc.maxHp&&raiders.length&&say(12))return;
 if(Object.keys(s.wonders??{}).some(id=>s.buildings.some(b=>b.id===id&&b.player!==P))&&say(26))return;
 const towns=new Set(s.buildings.filter(b=>b.player!==P&&b.kind==='town-center').map(b=>b.id));
 if(Object.entries(s.attacks).some(([id,a])=>a.target.kind==='building'&&towns.has(a.target.id)&&s.units.some(u=>u.id===Number(id)&&u.player===P))&&say(21))return;
 if(raiders.length)say(16);
}
function objective(s:AIState,home:{x:number;y:number},explored:Set<number>,wave:boolean){
 const P=aiRules.player,known=s.vision[P].known.map(k=>k.obstacle).filter(o=>isBuilding(o)&&!o.red).map(o=>centre(obstacleBounds(o)));
 if(known.length)return known.sort((a,b)=>dist(a,home)-dist(b,home))[0];
 // The opponent is assumed to start roughly opposite (players are placed round the centre): the point reflection.
 const middle=s.map.size*50,mirror={x:2*middle-home.x,y:2*middle-home.y};if(wave&&!explored.has(tileAt(mirror.x,mirror.y,s.map.size)))return mirror;
 const size=s.map.size,count=size*size;for(let t=0;t<count;t++){const id=(t*97)%count;if(!explored.has(id))return {x:(id%size)*100+50,y:Math.floor(id/size)*100+50};}
 return mirror;
}
// The nearest standable node point to a spot (rings of 50 out to 200), or null.
function standable(s:AIState,goal:{x:number;y:number}){const edge=s.map.size*100-50;
 for(let r=0;r<=200;r+=50)for(let dy=-r;dy<=r;dy+=50)for(let dx=-r;dx<=r;dx+=50){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
  const p={x:Math.round((goal.x+dx)/50)*50,y:Math.round((goal.y+dy)/50)*50};if(p.x>=50&&p.y>=50&&p.x<=edge&&p.y<=edge&&clearSegment(s.map,p,p))return p;}
 return null;}
// Moves a group to the nearest standable point around the goal (the same check a human move order gets).
function march(s:AIState,order:Order,units:Unit[],goal:{x:number;y:number}){
 for(let r=0;r<=400;r+=50)for(let dy=-r;dy<=r;dy+=50)for(let dx=-r;dx<=r;dx+=50){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
  const p={x:Math.round((goal.x+dx)/50)*50,y:Math.round((goal.y+dy)/50)*50};const edge=s.map.size*100-50;if(p.x<50||p.y<50||p.x>edge||p.y>edge||!clearSegment(s.map,p,p))continue;
  if(order('move',{unitIds:units.map(u=>u.id).sort((a,b)=>a-b).slice(0,40),x:p.x,y:p.y}))return;}
}
// The 戰術技巧 round: openings (packages/content/openings.ts). An opening runs from the start until its plan's tick or age,
// then the normal plan above takes over; 'standard' (or none) is the normal plan from the start.
function activeOpening(s:AIState):Opening|null{const o=openingById(s.aiOpening??'');if(!o)return null;const u=o.plan.until;
 return s.tick>=u.tick||u.age!==undefined&&s.ages[aiRules.player]>=u.age?null:o;}
// dark: before the Feudal Age is researched; up: while it is; then the age reached.
function openingPhase(s:AIState,own:Building[]):'dark'|'up'|'feudal'|'castle'{const P=aiRules.player;if(s.ages[P]>=3)return 'castle';if(s.ages[P]>=2)return 'feudal';
 return own.some(b=>b.queue.some(q=>ageOf(q.entryId)===2))?'up':'dark';}
// How far a point lies from the map's centre line towards the own town centre (negative: the opponent's half).
function sideFrom(s:{map:{size:number}},home:{x:number;y:number}){const middle=s.map.size*50,axis=Math.hypot(home.x-middle,home.y-middle)||1,ux=(home.x-middle)/axis,uy=(home.y-middle)/axis;
 return (p:{x:number;y:number})=>(p.x-middle)*ux+(p.y-middle)*uy;}
// The opponent's home as red knows it: a remembered town centre, else the mirror of the own one.
function enemyHome(s:AIState,home:{x:number;y:number}){const P=aiRules.player,known=s.vision[P].known.map(k=>k.obstacle).filter(o=>o.kind==='town-center'&&!!o.red!==(P===1)).map(o=>centre(obstacleBounds(o))).sort((a,b)=>dist(a,home)-dist(b,home))[0];
 return known?{at:known,known:true}:{at:{x:s.map.size*100-home.x,y:s.map.size*100-home.y},known:false};}
// The raid: the opening's raiding kinds (not the exploring scout) leave together once sendAt stand at home (later ones
// follow when the plan reinforces), go for the nearest opponent villager red sees, else towards the opponent's home.
// Returns the ids out on the raid (the normal army leaves them alone).
function raid(s:AIState,order:Order,op:Opening,mine:Unit[],explorer:Unit|undefined,foes:Unit[],idle:(u:Unit)=>boolean,home:{x:number;y:number},half:(p:{x:number;y:number})=>number,explored:Set<number>){
 const r=op.plan.raid,out=new Set<number>();if(!r)return out;
 const units=mine.filter(u=>r.kinds.includes(u.kind)&&u!==explorer),away=(u:Unit)=>half(u)<0||!!u.target&&half(u.target)<0||!!s.attacks[u.id]&&dist(u,home)>aiRules.defendRadius;
 const gone=units.filter(away),ready=units.filter(u=>!away(u)&&idle(u)&&!s.attacks[u.id]);
 const leave=ready.length>=r.sendAt||r.reinforce&&gone.length>0&&ready.length>0?ready:[];
 for(const u of [...gone,...leave])out.add(u.id);
 const prey=foes.filter(f=>f.kind==='villager'),target=enemyHome(s,home).at;
 for(const u of [...gone.filter(u=>idle(u)&&!s.attacks[u.id]),...leave]){const v=prey.filter(f=>!targetProblem(s,aiRules.player,{kind:'unit',id:f.id})).sort((a,b)=>dist(a,u)-dist(b,u)||a.id-b.id)[0];
  if(v)order('attack',{unitIds:[u.id],target:{kind:'unit',id:v.id}});}
 const marching=leave.filter(u=>!prey.length);if(marching.length)march(s,order,marching,target);
 // Arrived and nothing in sight: on to unexplored ground near the opponent's home.
 const lost=gone.filter(u=>idle(u)&&!s.attacks[u.id]&&!prey.length&&dist(u,target)<300);if(lost.length)march(s,order,lost,objective(s,home,explored,false));
 return out;}
// The forward villagers of a tower rush or a forward barracks: picked when the plan sends them (at the click), they walk
// to the opponent's resources (the barracks: three fifths of the way there), build there, and stay off the home economy.
function forwardWork(s:AIState,order:Order,op:Opening,villagers:Unit[],own:Building[],idle:(u:Unit)=>boolean,home:{x:number;y:number},half:(p:{x:number;y:number})=>number,explored:Set<number>){
 const P=aiRules.player,plan=op.plan,towers=plan.towers,need=towers?.builders??plan.forwardBarracks??0,out=new Set<number>();if(!need)return out;
 const phase=openingPhase(s,own);if(phase==='dark'&&towers?.leave!=='start')return out;
 const enemy=enemyHome(s,home),farOwn=(k:string)=>own.filter(b=>b.kind===k&&half(centre(boxOf(s,b)!))<0);
 const barracksDone=!plan.forwardBarracks||farOwn('barracks').length>0,towersDone=!towers||farOwn('watch-tower').length>=towers.count;
 const building=(u:Unit)=>{const w=s.works[u.id];if(w?.kind!=='build')return false;const b=own.find(b=>b.id===w.buildingId);return !!b&&half(centre(boxOf(s,b)!))<0;};
 const members=villagers.filter(u=>half(u)<0||!!u.target&&half(u.target)<0||building(u));
 if(barracksDone&&towersDone&&!members.some(building))return out;
 for(const u of members)out.add(u.id);
 // The spot: the opponent's preferred resource near its home (once seen), else its home's direction.
 const res=towers?s.map.resources.filter(r=>r.collectible&&towers.prefer.includes(r.kind)&&explored.has(tileAt(r.x,r.y,s.map.size))&&dist(r,enemy.at)<=800).sort((a,b)=>towers.prefer.indexOf(a.kind)-towers.prefer.indexOf(b.kind)||dist(a,enemy.at)-dist(b,enemy.at)||(a.id<b.id?-1:1))[0]:undefined;
 // A resource in reach of the opponent's town centre is approached from the far side, towerGap out (its arrows).
 const away=(p:{x:number;y:number})=>{if(!enemy.known)return p;const d=Math.hypot(p.x-enemy.at.x,p.y-enemy.at.y)||1;return d>=openingRules.towerGap?p:{x:Math.round(enemy.at.x+(p.x-enemy.at.x)*openingRules.towerGap/d),y:Math.round(enemy.at.y+(p.y-enemy.at.y)*openingRules.towerGap/d)};};
 const spot=!barracksDone?{x:home.x+(enemy.at.x-home.x)*0.6,y:home.y+(enemy.at.y-home.y)*0.6}:away(res?{x:res.x,y:res.y}:{x:(home.x+enemy.at.x*2)/3,y:(home.y+enemy.at.y*2)/3});
 // More walk out until the group is complete (wood and gold gatherers first, lowest id first).
 const yieldOf=(u:Unit)=>{const w=s.works[u.id];const r=w?.kind==='gather'?s.map.resources.find(r=>r.id===w.resourceId):undefined;return r?resourceDefinitions[r.kind].yield:null;};
 const extra=villagers.filter(u=>!out.has(u.id)&&s.works[u.id]?.kind!=='build').sort((a,b)=>Number(yieldOf(b)==='wood'||yieldOf(b)==='gold')-Number(yieldOf(a)==='wood'||yieldOf(a)==='gold')||a.id-b.id).slice(0,Math.max(0,need-members.length));
 if(extra.length){march(s,order,extra,spot);for(const u of extra)out.add(u.id);}
 // Idle ones far from the spot walk on to it (the spot moves from the barracks to the resources, or comes into view).
 const strays=members.filter(u=>idle(u)&&dist(u,spot)>500);if(strays.length)march(s,order,strays,spot);
 const free=members.filter(u=>idle(u)&&dist(u,spot)<=500);if(!free.length)return out;
 // An unfinished forward foundation: everyone free helps.
 const site=own.find(b=>!b.complete&&half(centre(boxOf(s,b)!))<0);
 if(site){order('construct',{unitIds:free.map(u=>u.id),buildingId:site.id});return out;}
 const owner=ownerOf(s,P),kind:BuildKind|null=!barracksDone?'barracks':!towersDone&&s.ages[P]>=2?'watch-tower':null;
 if(kind&&affords(s,costOf(kind,owner))){const at=forwardSite(s,kind,spot,enemy.known?enemy.at:null);
  if(at&&claim(order('build',{unitIds:free.map(u=>u.id),kind,x:at.x,y:at.y}),kind,at.x,at.y))return out;}
 // Nothing to build yet (stone or the age still to come): they wait at the spot, out of the arrows' reach (gathering
 // there would carry every load back across the map and draw a camp and more villagers after it).
 return out;}
// A site for a forward building near a spot: the nearest that passes the placement check, keeping out of the opponent's
// town centre's arrows (towerGap) when it can.
function forwardSite(s:AIState,kind:BuildKind,spot:{x:number;y:number},enemyTc:{x:number;y:number}|null){
 const input=knownInput(s),[x0,y0,x1,y1]=obstacleBounds({kind,x:0,y:0}),world=s.map.size*100,sites:{x:number;y:number;d:number;safe:number}[]=[];
 for(let dy=-400;dy<=400;dy+=50)for(let dx=-400;dx<=400;dx+=50){const x=Math.round((spot.x+dx-(x1+x0)/2)/100)*100,y=Math.round((spot.y+dy-(y1+y0)/2)/100)*100;
  if(x+x0<0||y+y0<0||x+x1>world||y+y1>world)continue;const c={x:x+(x0+x1)/2,y:y+(y0+y1)/2};
  sites.push({x,y,d:dist(c,spot),safe:enemyTc&&dist(c,enemyTc)<openingRules.towerGap?1:0});}
 sites.sort((a,b)=>a.safe-b.safe||a.d-b.d||a.y-b.y||a.x-b.x);
 const seen=new Set<string>();for(const v of sites){const k=v.x+','+v.y;if(seen.has(k))continue;seen.add(k);
  if(!clashes(obstacleBounds({kind,x:v.x,y:v.y}))&&!placementProblem(input,kind,v.x,v.y))return v;}
 return null;}
// towerGap: forward villagers and towers keep this far from the centre of the opponent's town centre when they can (its
// arrows reach 300 from a footprint 150 from the centre, plus a margin).
export const openingRules={provenance:'design_default',towerGap:600} as const;
// A player's progress through an opening, as the coach and the tests read it (packages/content/openings.ts needMet).
export function openingView(s:AIState,player:number):OpeningView{
 const own=s.buildings.filter(b=>b.player===player),tc=own.find(b=>b.kind==='town-center'),box=tc?boxOf(s,tc):null;
 const half=box?sideFrom(s,centre(box)):null,mine=s.units.filter(u=>u.player===player);
 const gather=Object.fromEntries(gatherKinds.map(k=>[k,0])) as Record<Gather,number>,count=(list:{kind:string}[])=>list.reduce((t,v)=>({...t,[v.kind]:(t[v.kind]??0)+1}),{} as Record<string,number>);
 for(const u of mine){const w=s.works[u.id];if(w?.kind!=='gather')continue;
  if(w.prey!==undefined){const a=s.units.find(a=>a.id===w.prey);gather[a?.kind==='sheep'?'sheep':'hunt']++;continue;}
  const r=s.map.resources.find(r=>r.id===w.resourceId);if(!r)continue;
  const k:Gather|null=r.kind==='livestock'?'sheep':r.kind==='hunt'?'hunt':r.kind==='tree'?'wood':r.kind==='berries'||r.kind==='gold'||r.kind==='stone'||r.kind==='farm'?r.kind:null;if(k)gather[k]++;}
 const far=half?{...count(own.filter(b=>half(centre(boxOf(s,b)??[b.x,b.y,b.x,b.y]))<0)),villager:mine.filter(u=>u.kind==='villager'&&half(u)<0).length}:{};
 // Raiding: soldiers on the opponent's half; scouts there count but one (the explorer).
 const fighters=half?mine.filter(u=>soldierKinds.includes(u.kind)&&half(u)<0).length:0,scoutsOut=half?mine.filter(u=>u.kind==='scout'&&half(u)<0).length:0;
 return {age:s.ages[player],clicking:Math.max(0,...own.flatMap(b=>b.queue.map(q=>ageOf(q.entryId)))),villagers:mine.filter(u=>u.kind==='villager').length,gather,
  buildings:count(own),forward:far,units:count(mine),techs:[...s.techs[player]],raiding:fighters+Math.max(0,scoutsOut-1)};}
