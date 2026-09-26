import {obstacleBounds} from '../content/footprints.ts';
import {rules} from '../content/rules.ts';
import type {Resource} from '../content/rules.ts';
import {resourceDefinitions,tileAt} from './terrain.ts';
import {clearSegment,isBuilding,position} from './navigation.ts';
import {placementProblem,buildKinds,farmOwner,buildingRules,buildRequirement} from './buildings.ts';
import type {Building,BuildKind} from './buildings.ts';
import {trainable} from './production.ts';
import type {ProductionState} from './production.ts';
import {gatherable,dropoffRules} from './work.ts';
import {targetProblem} from './combat.ts';
import type {CombatState,Target} from './combat.ts';
import type {Unit} from './movement.ts';
import type {PlayerVision} from './vision.ts';
import {faithOf,carrying,riteProblem} from './religion.ts';
import type {ReligionState} from './religion.ts';
// Computer opponent (design_default engineering values, not the reference game's AI).
// It sees only its own player's vision, and every order goes through the same validation as a human's
// (sim.ts admits it without writing the replay log, because replay re-derives it from the same state).
// thinkTicks: one decision pass per second at 20 Hz. firstWaveTick: no attack wave before 4 minutes.
export const aiRules={provenance:'design_default',player:1,thinkTicks:20,thinkOffset:7,villagerTarget:12,
 gatherWeights:{food:4,wood:3,gold:2,stone:0},houseMargin:2,barracksAtVillagers:3,ageUpAtVillagers:9,
 waveSize:5,firstWaveTick:4800,engageRange:500,defendRadius:700,baseMargin:50,siteRange:900,siteStep:20,halfMargin:100,spill:100,sourceMargin:100,campDistance:350,campWorkers:2,monkTarget:2} as const;
export type AIState=ReligionState&ProductionState&{tick:number;ages:number[];vision:PlayerVision[]};
export type Order=(commandType:'move'|'gather'|'build'|'construct'|'train'|'attack'|'resign'|'convert'|'relic'|'deposit',payload:Record<string,unknown>)=>boolean;
type Box=number[];
const gap=(a:Box,b:Box)=>Math.max(a[0]-b[2],b[0]-a[2],a[1]-b[3],b[1]-a[3],0);
const centre=(b:Box)=>({x:(b[0]+b[2])/2,y:(b[1]+b[3])/2});
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
export function stepAI(s:AIState,order:Order){
 if(s.outcome||s.tick%aiRules.thinkTicks!==aiRules.thinkOffset)return;
 const P=aiRules.player,vision=s.vision[P],seen=new Set(vision.visible),explored=new Set(vision.explored);
 const busy=new Set(s.pathJobs.flatMap(j=>j.kind==='group'?j.unitIds:[j.unitId]));
 const idle=(u:Unit)=>!s.works[u.id]&&!s.attacks[u.id]&&u.next===null&&!u.path.length&&!busy.has(u.id);
 const mine=s.units.filter(u=>u.player===P).sort((a,b)=>a.id-b.id),villagers=mine.filter(u=>u.kind==='villager'),soldiers=mine.filter(u=>u.kind==='militia'||u.kind==='archer'),scout=mine.find(u=>u.kind==='scout');
 const own=s.buildings.filter(b=>b.player===P),tc=own.find(b=>b.kind==='town-center'),tcBox=tc?boxOf(s,tc):null;
 const foes=s.units.filter(u=>u.player!==P&&seen.has(tileAt(u.x,u.y,s.map.size))).sort((a,b)=>a.id-b.id);
 // Concede when nothing can turn the game: no town centre (it cannot be rebuilt) and no soldiers left.
 if(!tc&&!soldiers.length){order('resign',{});return;}
 army(s,order,soldiers,foes,tcBox,idle,explored);
 // The scout explores: whenever idle it rides to the nearest tile red has never seen, so waves can aim at
 // buildings it actually found (the point reflection stays the fallback when nothing is known).
 if(scout&&idle(scout)){const size=s.map.size;let best=-1,far=Infinity;for(let t=0;t<size*size;t++){if(explored.has(t))continue;const d=Math.hypot((t%size)*100+50-scout.x,Math.floor(t/size)*100+50-scout.y);if(d<far){far=d;best=t;}}
  if(best>=0)march(s,order,[scout],{x:(best%size)*100+50,y:Math.floor(best/size)*100+50});}
 if(!tc||!tcBox)return;
 const account=s.accounts[P],stock=account.stock;
 // Unfinished foundations with nobody working on them get one builder.
 for(const b of own.filter(b=>!b.complete)){if(villagers.some(u=>{const w=s.works[u.id];return w?.kind==='build'&&w.buildingId===b.id;}))continue;
  const builder=pickBuilder(s,villagers,idle,centre(boxOf(s,b)!));if(builder)order('construct',{unitIds:[builder.id],buildingId:b.id});}
 const pending=(k:BuildKind)=>own.some(b=>b.kind===k&&!b.complete);
 const room=account.populationCap-account.populationUsed-account.populationReserved;
 // The barracks goes down first: it needs the larger site, and houses would otherwise take those spots.
 const barracksDue=villagers.length>=aiRules.barracksAtVillagers&&!own.some(b=>b.kind==='barracks');
 if(barracksDue)place(s,order,'barracks',villagers,idle,tcBox,own);
 // In the second age an archery range follows (it needs the finished barracks).
 if(s.ages[P]>=3&&!own.some(b=>b.kind==='monastery')&&stock.wood>=rules.entries.find(e=>e.id==='monastery')!.cost.wood)place(s,order,'monastery',villagers,idle,tcBox,own);
 if(s.ages[P]>=2&&!own.some(b=>b.kind==='archery-range')&&!buildRequirement(s.ages[P],'archery-range',own)&&stock.wood>=rules.entries.find(e=>e.id==='archery-range')!.cost.wood)place(s,order,'archery-range',villagers,idle,tcBox,own);
 if(room<=aiRules.houseMargin&&account.populationCap<rules.settings.populationCap&&!pending('house')&&(!barracksDue||room<=0))place(s,order,'house',villagers,idle,tcBox,own);
 // Drop-off camps: when two or more villagers carry wood (or gold/stone) from farther than campDistance to the
 // nearest drop-off that takes it, a camp goes up next to that source.
 const accepts=dropoffRules.accepts as Record<string,readonly string[]>,drops=own.filter(b=>b.complete&&accepts[b.kind]).map(b=>({kinds:accepts[b.kind],box:boxOf(s,b)!})).filter(d=>d.box);
 for(const [camp,kinds] of [['lumber-camp',['wood']],['mining-camp',['gold','stone']]] as const){if(own.some(b=>b.kind===camp&&!b.complete))continue;
  const far=villagers.map(u=>s.works[u.id]).filter(w=>w?.kind==='gather').map(w=>s.map.resources.find(r=>r.id===(w as {resourceId:string}).resourceId)).filter((r):r is NonNullable<typeof r>=>!!r&&(kinds as readonly string[]).includes(resourceDefinitions[r.kind].yield)&&Math.min(...drops.filter(d=>d.kinds.includes(resourceDefinitions[r.kind].yield)).map(d=>gap([r.x,r.y,r.x,r.y],d.box)))>aiRules.campDistance);
  if(far.length>=aiRules.campWorkers){place(s,order,camp,villagers,idle,tcBox,own,undefined,{x:far[0].x,y:far[0].y});break;}}
 // Town centre: villagers up to the target, then the second age once the barracks exists.
 const queued=(id:string)=>own.reduce((t,b)=>t+b.queue.filter(q=>q.entryId===id).length,0);
 if(tc.complete&&!tc.queue.length){
  if(villagers.length+queued('villager')<aiRules.villagerTarget&&!trainable(s,P,tc,'villager'))order('train',{buildingId:tc.id,entryId:'villager'});
  else if(s.ages[P]<2&&villagers.length>=aiRules.ageUpAtVillagers&&own.some(b=>b.kind==='barracks'&&b.complete)&&!trainable(s,P,tc,'age-2'))order('train',{buildingId:tc.id,entryId:'age-2'});
  // The third age once the villagers are complete and the archery range stands (for the monastery and its monks).
  else if(s.ages[P]===2&&villagers.length>=aiRules.villagerTarget&&own.some(b=>b.kind==='archery-range'&&b.complete)&&!trainable(s,P,tc,'age-3'))order('train',{buildingId:tc.id,entryId:'age-3'});
 }
 // Barracks: militia, but food is kept for the age-up when it is due. Archery range: archers.
 const cost=(id:string)=>rules.entries.find(e=>e.id===id)!.cost;
 const savingForAge=s.ages[P]<2&&villagers.length>=aiRules.ageUpAtVillagers&&stock.food<cost('age-2').food+60;
 // Saving for the third age: soldiers wait while food or gold is short of it (plus one soldier's worth).
 const savingForCastle=s.ages[P]===2&&villagers.length>=aiRules.villagerTarget&&own.some(b=>b.kind==='archery-range'&&b.complete)&&!own.some(b=>b.queue.some(q=>q.entryId==='age-3'))&&(stock.food<cost('age-3').food+60||stock.gold<cost('age-3').gold+30);
 const monks=mine.filter(u=>u.kind==='monk');
 for(const b of own.filter(b=>b.complete&&b.queue.length<2)){
  const pick=savingForCastle&&b.kind!=='monastery'?null:b.kind==='barracks'&&!savingForAge?'militia':b.kind==='archery-range'?'archer':b.kind==='monastery'&&monks.length+queued('monk')<aiRules.monkTarget?'monk':null;
  if(pick&&!trainable(s,P,b,pick))order('train',{buildingId:b.id,entryId:pick});}
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
 for(const u of villagers){const w=s.works[u.id];if(w?.kind==='gather'){const r=s.map.resources.find(r=>r.id===w.resourceId);if(r){staff[resourceDefinitions[r.kind].yield]++;if(r.kind==='farm')farmers.add(r.id);}}}
 for(const u of villagers.filter(idle)){
  const kinds=(Object.keys(aiRules.gatherWeights) as Resource[]).filter(k=>aiRules.gatherWeights[k]>0).sort((a,b)=>staff[a]/aiRules.gatherWeights[a]-staff[b]/aiRules.gatherWeights[b]);
  // Food counts only within reach of the own town centre (otherwise villagers would walk to the opponent's
  // berries once the scout has seen them); beyond that a farm is laid out instead.
  for(const kind of kinds){const source=s.map.resources.filter(r=>resourceDefinitions[r.kind].yield===kind&&explored.has(tileAt(r.x,r.y,s.map.size))&&(kind!=='food'||dist(r,centre(tcBox))<=aiRules.siteRange)&&!gatherable(s.map,r.id)&&(r.kind!=='farm'||farmOwner(s,r.id)===P&&!farmers.has(r.id))).sort((a,b)=>dist(u,a)-dist(u,b)||(a.id<b.id?-1:1))[0];
   if(source&&order('gather',{unitIds:[u.id],resourceId:source.id})){staff[kind]++;if(source.kind==='farm')farmers.add(source.id);break;}
   // No natural food left in sight: this villager lays out a farm (one farmer per field).
   if(kind==='food'&&!source&&!own.some(b=>b.kind==='farm'&&!b.complete)&&place(s,order,'farm',villagers,idle,tcBox,own,u))break;}
 }
}
function boxOf(s:AIState,b:Building){const o=s.map.obstacles.find(o=>o.id===b.id);return o?obstacleBounds(o):null;}
function pickBuilder(s:AIState,villagers:Unit[],idle:(u:Unit)=>boolean,near:{x:number;y:number}){
 const free=villagers.filter(idle).sort((a,b)=>dist(a,near)-dist(b,near)||a.id-b.id)[0];if(free)return free;
 // Otherwise the nearest villager that is not already building.
 return villagers.filter(u=>s.works[u.id]?.kind!=='build').sort((a,b)=>dist(a,near)-dist(b,near)||a.id-b.id)[0];
}
// Sites: anywhere on the own half, nearest to the town centre first, keeping a margin around the town centre
// and other own buildings (drop-off ring and gates stay open). Same placement rule as a human's order.
// near: centre of the search (default the town centre); camps search round the resource they serve.
function place(s:AIState,order:Order,kind:BuildKind,villagers:Unit[],idle:(u:Unit)=>boolean,tcBox:Box,own:Building[],worker?:Unit,near?:{x:number;y:number}):boolean{
 const cost=rules.entries.find(e=>e.id===kind)!.cost,stock=s.accounts[aiRules.player].stock;
 if((Object.keys(cost) as Resource[]).some(r=>stock[r]<cost[r])||!buildKinds.includes(kind))return false;
 const home=centre(tcBox),c=near??home,others=own.filter(b=>b.kind!=='farm'&&b.kind!=='town-center').map(b=>boxOf(s,b)).filter(b=>b!==null) as Box[],[x0,y0,x1,y1]=obstacleBounds({kind,x:0,y:0}),world=s.map.size*100,
  // Mines, berries and animals keep room round them, so a building never boxes in their work slots.
  sources=s.map.obstacles.filter(o=>o.kind==='gold'||o.kind==='rock'||o.kind==='berries'||o.kind==='hunt'||o.kind==='livestock').map(o=>obstacleBounds(o)),middle=world/2,axis=Math.hypot(home.x-middle,home.y-middle)||1,ux=(home.x-middle)/axis,uy=(home.y-middle)/axis;
 // Own side: how far a point lies from the map centre towards the own town centre (negative = the far side).
 const side=(x:number,y:number)=>(x-middle)*ux+(y-middle)*uy;
 const explored=new Set(s.vision[aiRules.player].explored),bodies=[...s.units.flatMap(u=>[{x:u.x,y:u.y},...(u.next===null?[]:[position(s.map,u.next)])]),...s.relics.filter(r=>r.carrier===null&&r.monastery===null).map(r=>({x:r.x,y:r.y}))];
 const input={tiles:s.map.tiles,obstacles:s.map.obstacles,units:bodies,explored:(t:number)=>explored.has(t)},sites:{x:number;y:number;d:number}[]=[];
 const g=buildingRules.grid,from=(v:number)=>Math.ceil(-v/g)*g;
 // Only the window within siteRange of the town centre is scanned.
 const lo=(v:number,o:number)=>Math.max(from(o),Math.ceil((v-aiRules.siteRange)/g)*g),hi=(v:number,o:number)=>Math.min(world-o,v+aiRules.siteRange);
 for(let x=lo(c.x,x0);x<=hi(c.x,x1);x+=aiRules.siteStep)for(let y=lo(c.y,y0);y<=hi(c.y,y1);y+=aiRules.siteStep){const box=[x+x0,y+y0,x+x1,y+y1],mid=centre(box);
  // Buildings that train soldiers keep a buffer from the centre line so fresh soldiers do not start inside enemy sight;
  // houses and farms may reach a little past it (the 16x16 map leaves little room once a base grows).
  const margin=kind==='barracks'||kind==='archery-range'||kind==='monastery'?aiRules.halfMargin:-aiRules.spill,ownHalf=Math.min(side(box[0],box[1]),side(box[2],box[1]),side(box[0],box[3]),side(box[2],box[3]))>=margin;
  if(!ownHalf||dist(mid,c)>aiRules.siteRange||gap(box,tcBox)<(kind==='farm'?50:aiRules.baseMargin)||(kind!=='farm'&&(others.some(o=>gap(box,o)<50)||sources.some(o=>gap(box,o)<aiRules.sourceMargin))))continue;sites.push({x,y,d:dist(mid,c)});}
 sites.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);
 for(const site of sites){if(placementProblem(input,kind,site.x,site.y))continue;
  const builder=worker??pickBuilder(s,villagers,idle,site);if(!builder)return false;
  return order('build',{unitIds:[builder.id],kind,x:site.x,y:site.y});}
 return false;
}
function army(s:AIState,order:Order,soldiers:Unit[],foes:Unit[],tcBox:Box|null,idle:(u:Unit)=>boolean,explored:Set<number>){
 const P=aiRules.player,attackers=new Map<string,{target:Target;ids:number[]}>();
 const assign=(u:Unit,target:Target)=>{const key=target.kind+':'+target.id;if(!attackers.has(key))attackers.set(key,{target,ids:[]});attackers.get(key)!.ids.push(u.id);};
 const home=tcBox?centre(tcBox):null,intruder=home?foes.filter(f=>dist(f,home)<=aiRules.defendRadius).sort((a,b)=>dist(a,home!)-dist(b,home!)||a.id-b.id)[0]:undefined;
 const enemyBuildings=s.buildings.filter(b=>b.player!==P).map(b=>({b,box:boxOf(s,b)})).filter(v=>v.box&&!targetProblem(s,P,{kind:'building',id:v.b.id}));
 const free:Unit[]=[],offensive=s.tick>=aiRules.firstWaveTick;
 for(const u of soldiers){if(s.attacks[u.id])continue;
  // Defend the base first, then the nearest enemy in reach (marching soldiers do not auto-engage).
  // Before the first wave is due, soldiers only fight inside the home area.
  const foe=intruder??foes.filter(f=>dist(f,u)<=aiRules.engageRange&&(offensive||home&&dist(f,home)<=aiRules.defendRadius)).sort((a,b)=>dist(a,u)-dist(b,u)||a.id-b.id)[0];
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
 if(s.tick>=aiRules.firstWaveTick&&atHome.length>=aiRules.waveSize)march(s,order,atHome,objective(s,home,explored,true));
 // Before the first wave is due, stragglers (e.g. fresh soldiers spawned on the far side) return home.
 if(away.length)march(s,order,away,offensive?objective(s,home,explored,false):{x:home.x,y:home.y+250});
}
function objective(s:AIState,home:{x:number;y:number},explored:Set<number>,wave:boolean){
 const P=aiRules.player,known=s.vision[P].known.map(k=>k.obstacle).filter(o=>isBuilding(o)&&!o.red).map(o=>centre(obstacleBounds(o)));
 if(known.length)return known.sort((a,b)=>dist(a,home)-dist(b,home))[0];
 // The opponent is assumed to start roughly opposite (players are placed round the centre): the point reflection.
 const middle=s.map.size*50,mirror={x:2*middle-home.x,y:2*middle-home.y};if(wave&&!explored.has(tileAt(mirror.x,mirror.y,s.map.size)))return mirror;
 const size=s.map.size,count=size*size;for(let t=0;t<count;t++){const id=(t*97)%count;if(!explored.has(id))return {x:(id%size)*100+50,y:Math.floor(id/size)*100+50};}
 return mirror;
}
// Moves a group to the nearest standable point around the goal (the same check a human move order gets).
function march(s:AIState,order:Order,units:Unit[],goal:{x:number;y:number}){
 for(let r=0;r<=400;r+=50)for(let dy=-r;dy<=r;dy+=50)for(let dx=-r;dx<=r;dx+=50){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
  const p={x:Math.round((goal.x+dx)/50)*50,y:Math.round((goal.y+dy)/50)*50};const edge=s.map.size*100-50;if(p.x<50||p.y<50||p.x>edge||p.y>edge||!clearSegment(s.map,p,p))continue;
  if(order('move',{unitIds:units.map(u=>u.id).sort((a,b)=>a-b).slice(0,40),x:p.x,y:p.y}))return;}
}
