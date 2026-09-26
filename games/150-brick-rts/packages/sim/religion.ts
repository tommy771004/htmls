import {routeTo,cancelMovement} from './movement.ts';
import type {Unit} from './movement.ts';
import {approach,reach,killUnit} from './combat.ts';
import type {CombatState} from './combat.ts';
import {maxHpOf} from './stats.ts';
import {tileAt} from './terrain.ts';
import {obstacleBounds} from '../content/footprints.ts';
import {navigationRules,position,blockedTable,nodeTotal} from './navigation.ts';
import type {MapData} from './navigation.ts';
import {recomputeCapacity} from './buildings.ts';
import type {Building} from './buildings.ts';
import {cancelReservation} from './economy.ts';
// Monks, monastery technologies and relics. Reference values (aoe2-rules-research.md):
// - conversion: an attempt every 1.2 s in range; attempts 1-3 always fail, each later one succeeds with 28%, the 10th
//   always does (4-14 with the target owner's Faith: 6th to 14th); buildings (Redemption) take 18-30 s, adjacent;
// - faith recharges in 62 s after a conversion (Illumination: twice as fast);
// - Atonement: monks convert monks; Sanctity: monks +15 hp; Block Printing: +3 conversion range (in the reference's
//   9-tile scale, here 350 -> 467); Theocracy: only the converting monk of a group rests; Heresy: own units that are
//   converted die instead; Redemption: buildings except town centres, monasteries and farms;
// - relics: 5 on the map, only monks carry them, a carrier cannot convert and drops it when killed, a monastery holds
//   up to 10 and each gives 0.5 gold/s; holding all of them for 200 years (16:40) wins.
// design_default: ranges in this map scale, the heal rate, relic placement, relics dropped when their monastery falls.
export const religionRules={provenance:'reference research for timings, costs and effects; design_default for ranges, heal rate and relic placement',
 convertRange:350,printingRange:117,adjacentRange:50,healRange:150,healTicks:20,healSight:400,
 attemptTicks:24,attempts:{min:4,max:10},faithAttempts:{min:6,max:14},attemptChance:28,
 buildingTicks:{min:360,max:600},rechargeTicks:1240,
 unconvertibleBuildings:['town-center','monastery','farm'],
 relics:{count:5,goldTicks:40,perMonastery:10,victoryTicks:20000,baseDistance:900,spacing:600,fairness:400,edge:150}} as const;
export type RiteKind='convert'|'heal'|'relic'|'deposit';
export type Rite={kind:RiteKind;target:number|string;progress:number;needed:number;repath:number;attempt:number};
export type Relic={id:number;x:number;y:number;carrier:number|null;monastery:string|null};
export type RelicVictory={player:number;endsTick:number};
export type ReligionState=CombatState&{rites:Record<number,Rite>;faith:Record<number,number>;rng:number;techs:string[][];relics:Relic[];relicMemory:{id:number;x:number;y:number}[][];relicVictory:RelicVictory|null};
const random=(s:ReligionState)=>{let n=s.rng;n^=n<<13;n^=n>>>17;n^=n<<5;s.rng=n>>>0;return s.rng;};
const has=(s:{techs:string[][]},player:number,tech:string)=>s.techs[player].includes(tech);
const recharge=(s:ReligionState,player:number)=>religionRules.rechargeTicks/(has(s,player,'illumination')?2:1);
// Faith is full once the recharge has passed since the monk's last conversion (a new monk starts full).
export function faithOf(s:ReligionState,monkId:number){const last=s.faith[monkId],m=s.units.find(u=>u.id===monkId);return last===undefined||!m?1:Math.min(1,(s.tick-last)/recharge(s,m.player));}
export const convertRangeOf=(s:{techs:string[][]},player:number)=>religionRules.convertRange+(has(s,player,'block-printing')?religionRules.printingRange:0);
export const carrying=(s:{relics:Relic[]},monkId:number)=>s.relics.some(r=>r.carrier===monkId);
const maxHp=(s:ReligionState,u:Unit)=>maxHpOf(u.kind,s.techs[u.player]);
const seen=(s:ReligionState,player:number,x:number,y:number)=>new Set(s.vision[player].visible).has(tileAt(x,y,s.map.size));
function buildingTiles(s:ReligionState,b:Building){const o=s.map.obstacles.find(o=>o.id===b.id);if(!o)return [];const box=obstacleBounds(o),out:number[]=[];
 for(let ty=Math.floor(box[1]/100);ty<=Math.floor((box[3]-1)/100);ty++)for(let tx=Math.floor(box[0]/100);tx<=Math.floor((box[2]-1)/100);tx++)out.push(ty*s.map.size+tx);return out;}
const boxOf=(s:ReligionState,b:Building)=>{const o=s.map.obstacles.find(o=>o.id===b.id);return o?obstacleBounds(o):null;};
// Why the rite cannot be ordered or continued (null when it can). Monk-specific conditions (carrying) are checked
// by the caller; this looks at the target only.
export function riteProblem(s:ReligionState,player:number,kind:RiteKind,target:number|string):string|null{
 // A relic the player can see on the ground, or remembers lying somewhere (the monk then walks to that spot).
 if(kind==='relic'){const r=s.relics.find(r=>r.id===target);if(!r)return '找不到聖物';
  if(s.relicMemory[player].some(m=>m.id===target))return null;
  return r.monastery===null&&r.carrier===null&&seen(s,player,r.x,r.y)?null:'找不到聖物';}
 if(kind==='deposit'){const b=s.buildings.find(b=>b.id===target);if(!b||b.player!==player||b.kind!=='monastery')return '只能把聖物放進己方修道院';if(!b.complete)return '修道院尚未完工';
  if(s.relics.filter(r=>r.monastery===b.id).length>=religionRules.relics.perMonastery)return `這座修道院已放滿 ${religionRules.relics.perMonastery} 個聖物`;return null;}
 if(typeof target==='string'){
  if(kind!=='convert')return '只能治療單位';
  const b=s.buildings.find(b=>b.id===target);if(!b||!buildingTiles(s,b).some(t=>new Set(s.vision[player].visible).has(t)))return '找不到目標';
  if(b.player===player)return '不能轉化己方建築';if(!has(s,player,'redemption'))return '需要研究「救贖」才能轉化建築';
  if((religionRules.unconvertibleBuildings as readonly string[]).includes(b.kind))return '城鎮中心、修道院與農田不能被轉化';
  if(!b.complete)return '只能轉化完工的建築';return null;}
 const t=s.units.find(u=>u.id===target);if(!t)return '找不到目標';
 if(kind==='heal'){if(t.player!==player)return '只能治療己方單位';if(t.kind==='monk')return '僧侶不能被治療';return null;}
 if(t.player===player)return '不能轉化己方單位';
 if(!seen(s,player,t.x,t.y))return '找不到目標';
 if(t.kind==='monk'&&!has(s,player,'atonement'))return '需要研究「贖罪」才能轉化僧侶';
 return null;
}
export function commandRite(s:ReligionState,monkIds:number[],kind:RiteKind,target:number|string){
 for(const id of monkIds){cancelMovement(s,id);delete s.works[id];delete s.attacks[id];s.rites[id]={kind,target,progress:0,needed:0,repath:0,attempt:0};}
}
export function clearRites(s:ReligionState,unitIds:number[]){for(const id of unitIds)delete s.rites[id];}
// After a conversion the converting monk rests; without Theocracy so does every monk of that side on the same target.
function rest(s:ReligionState,monk:Unit,target:number|string){
 s.faith[monk.id]=s.tick;if(has(s,monk.player,'theocracy'))return;
 for(const [id,r] of Object.entries(s.rites))if(r.kind==='convert'&&r.target===target){const other=s.units.find(u=>u.id===Number(id));if(other&&other.player===monk.player)s.faith[other.id]=s.tick;}
}
function convertUnit(s:ReligionState,monk:Unit,t:Unit){
 rest(s,monk,t.id);
 // Heresy: the target's owner would rather lose the unit than see it change sides.
 if(has(s,t.player,'heresy')){killUnit(s,t);return;}
 const from=s.accounts[t.player],to=s.accounts[monk.player],c=s.cargo[t.id];
 if(c){from.ledger.lost[c.resource]+=c.amount;delete s.cargo[t.id];}
 delete s.works[t.id];delete s.attacks[t.id];delete s.rites[t.id];cancelMovement(s,t.id);
 Object.assign(t,{path:[],goal:null,target:null,navigation:t.next===null?'idle':'moving'});
 // The unit changes sides with its hit points (clamped to its new owner's maximum); population moves with it and
 // may exceed the cap (a design choice).
 from.populationUsed--;to.populationUsed++;t.player=monk.player;t.hp=Math.min(t.hp,maxHp(s,t));
}
function convertBuilding(s:ReligionState,monk:Unit,b:Building){
 rest(s,monk,b.id);const old=b.player,a=s.accounts[old];
 // Its queue is refunded to the old owner; the rally point is dropped.
 for(const q of b.queue)cancelReservation(a,q.reservationId);
 b.queue=[];b.rally=null;b.player=monk.player;
 const o=s.map.obstacles.find(o=>o.id===b.id);if(o){if(monk.player===1)o.red=true;else delete o.red;o.age=s.ages[monk.player];}
 recomputeCapacity(s,old);recomputeCapacity(s,monk.player);
}
// Relic placement for the open map: away from both town centres by about the same distance, spread apart.
export function placeRelics(map:MapData,seed:number):Relic[]{
 const R=religionRules.relics,centres=[false,true].map(red=>{const o=map.obstacles.find(o=>o.kind==='town-center'&&!!o.red===red)!,b=obstacleBounds(o);return {x:(b[0]+b[2])/2,y:(b[1]+b[3])/2};});
 const closed=blockedTable(map),world=map.size*100;let n=(seed^0x5bd1e995)>>>0||1;const next=()=>{n^=n<<13;n^=n>>>17;n^=n<<5;n>>>=0;return n;};
 const candidates:{x:number;y:number}[]=[];
 for(let id=0;id<nodeTotal(map);id++){if(closed[id])continue;const p=position(map,id);if(p.x<R.edge||p.y<R.edge||p.x>world-R.edge||p.y>world-R.edge)continue;
  const [d0,d1]=centres.map(c=>Math.hypot(p.x-c.x,p.y-c.y));if(Math.min(d0,d1)>=R.baseDistance&&Math.abs(d0-d1)<=R.fairness)candidates.push(p);}
 // Seeded shuffle, then greedy picks; the spacing relaxes step by step until all relics fit.
 for(let i=candidates.length-1;i>0;i--){const j=next()%(i+1);[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
 for(let spacing=R.spacing;spacing>=100;spacing-=100){const relics:Relic[]=[];
  for(const p of candidates){if(relics.length===R.count)break;if(relics.every(r=>Math.hypot(r.x-p.x,r.y-p.y)>=spacing))relics.push({id:relics.length+1,x:p.x,y:p.y,carrier:null,monastery:null});}
  if(relics.length===R.count)return relics;}
 return [];
}
function stepRelics(s:ReligionState){
 const R=religionRules.relics;
 for(const r of s.relics){
  if(r.carrier!==null){const m=s.units.find(u=>u.id===r.carrier);if(m&&m.kind==='monk'){r.x=m.x;r.y=m.y;}else r.carrier=null;}
  // A monastery that falls leaves its relics on the ground where it stood.
  if(r.monastery!==null&&!s.buildings.some(b=>b.id===r.monastery))r.monastery=null;
 }
 // Each side remembers relics it has seen lying on the ground (and forgets them when the spot is seen empty).
 for(let p=0;p<s.relicMemory.length;p++){const visible=new Set(s.vision[p].visible),ground=s.relics.filter(r=>r.carrier===null&&r.monastery===null);
  const memory=s.relicMemory[p].filter(m=>!visible.has(tileAt(m.x,m.y,s.map.size)));
  for(const r of ground)if(visible.has(tileAt(r.x,r.y,s.map.size)))memory.push({id:r.id,x:r.x,y:r.y});
  s.relicMemory[p]=memory.sort((a,b)=>a.id-b.id);}
 const held=s.relics.map(r=>r.monastery===null?null:s.buildings.find(b=>b.id===r.monastery)!);
 if(s.tick%R.goldTicks===0)for(const b of held)if(b){const a=s.accounts[b.player];a.stock.gold++;a.ledger.relic.gold++;}
 // Relic victory: one side holds every relic in its monasteries for the countdown.
 const owners=new Set(held.map(b=>b?b.player:-1));
 if(s.relics.length&&owners.size===1&&!owners.has(-1)){const player=[...owners][0];
  if(!s.relicVictory||s.relicVictory.player!==player)s.relicVictory={player,endsTick:s.tick+R.victoryTicks};
  if(!s.outcome&&s.tick>=s.relicVictory.endsTick)s.outcome={winner:player,defeated:[1-player],tick:s.tick,reason:'relic'};}
 else s.relicVictory=null;
}
export function stepReligion(s:ReligionState){
 const monks=s.units.filter(u=>u.kind==='monk').sort((a,b)=>a.id-b.id),busy=new Set(s.pathJobs.flatMap(j=>j.kind==='group'?j.unitIds:[j.unitId]));
 for(const id of Object.keys(s.rites).map(Number))if(!monks.some(m=>m.id===id))delete s.rites[id];
 for(const id of Object.keys(s.faith).map(Number))if(!monks.some(m=>m.id===id))delete s.faith[id];
 // An idle monk heals the nearest wounded own unit it can see (lowest id on ties); conversion is by order only.
 for(const m of monks){if(s.rites[m.id]||s.attacks[m.id]||m.next!==null||m.path.length||busy.has(m.id))continue;
  let best:Unit|null=null,dist=Infinity;
  for(const u of s.units)if(u!==m&&u.player===m.player&&u.kind!=='monk'&&u.hp<maxHp(s,u)){const d=reach(m,u);if(d<=religionRules.healSight&&(d<dist||d===dist&&best&&u.id<best.id)){best=u;dist=d;}}
  if(best)s.rites[m.id]={kind:'heal',target:best.id,progress:0,needed:0,repath:0,attempt:0};}
 for(const m of monks){const r=s.rites[m.id];if(!r)continue;
  const done=()=>{delete s.rites[m.id];cancelMovement(s,m.id);Object.assign(m,{path:[],goal:null,target:null,navigation:m.next===null?'idle':'moving'});};
  if(riteProblem(s,m.player,r.kind,r.target)){done();continue;}
  // Where the rite happens and how close the monk must be.
  let shape:{x:number;y:number}|number[],range:number;
  if(r.kind==='relic'){const spot=s.relicMemory[m.player].find(x=>x.id===r.target)??s.relics.find(x=>x.id===r.target)!;
   if(carrying(s,m.id)){done();continue;}
   shape={x:spot.x,y:spot.y};range=religionRules.adjacentRange;}
  else if(r.kind==='deposit'){const b=s.buildings.find(b=>b.id===r.target)!,box=boxOf(s,b);if(!box||!carrying(s,m.id)){done();continue;}shape=box;range=religionRules.adjacentRange+navigationRules.radius;}
  else if(typeof r.target==='string'){const b=s.buildings.find(b=>b.id===r.target)!,box=boxOf(s,b);if(!box||carrying(s,m.id)){done();continue;}shape=box;range=religionRules.adjacentRange+navigationRules.radius;}
  else{const t=s.units.find(u=>u.id===r.target)!;
   if(r.kind==='heal'&&t.hp>=maxHp(s,t)){done();continue;}
   if(r.kind==='convert'&&(carrying(s,m.id)||r.attempt===0&&r.progress===0&&faithOf(s,m.id)<1)){done();continue;}
   shape={x:t.x,y:t.y};range=r.kind==='convert'?convertRangeOf(s,m.player):religionRules.healRange;}
  if(reach(m,shape)<=range){
   if(m.next!==null)continue;
   if(m.path.length||busy.has(m.id)){cancelMovement(s,m.id);m.path=[];m.goal=null;m.target=null;}
   m.navigation='idle';
   // At the spot: pick the relic up if it still lies there (a remembered one may be gone; the memory then clears).
   if(r.kind==='relic'){const relic=s.relics.find(x=>x.id===r.target)!,{x,y}=shape as {x:number;y:number};
    if(relic.carrier===null&&relic.monastery===null&&relic.x===x&&relic.y===y){relic.carrier=m.id;relic.x=m.x;relic.y=m.y;}done();continue;}
   if(r.kind==='deposit'){const relic=s.relics.find(x=>x.carrier===m.id)!,b=s.buildings.find(b=>b.id===r.target)!,box=shape as number[];
    relic.carrier=null;relic.monastery=b.id;relic.x=Math.round((box[0]+box[2])/2);relic.y=Math.round((box[1]+box[3])/2);done();continue;}
   if(r.kind==='heal'){const t=s.units.find(u=>u.id===r.target)!;if(++r.progress%religionRules.healTicks===0)t.hp=Math.min(maxHp(s,t),t.hp+1);continue;}
   if(typeof r.target==='string'){if(r.needed===0){const {min,max}=religionRules.buildingTicks;r.needed=min+random(s)%(max-min+1);}
    if(++r.progress>=r.needed){convertBuilding(s,m,s.buildings.find(b=>b.id===r.target)!);delete s.rites[m.id];}continue;}
   // A unit: one attempt per interval; the first ones never succeed, the last one always does.
   if(++r.progress%religionRules.attemptTicks!==0)continue;
   const t=s.units.find(u=>u.id===r.target)!,{min,max}=has(s,t.player,'faith')?religionRules.faithAttempts:religionRules.attempts;r.attempt++;
   if(r.attempt>=min&&(r.attempt>=max||random(s)%100<religionRules.attemptChance)){convertUnit(s,m,t);delete s.rites[m.id];}
   continue;
  }
  if(m.next!==null)continue;
  if(r.repath>0&&(m.path.length||busy.has(m.id))){r.repath--;continue;}
  const nodes=approach(s,m,shape,range);if(!nodes.length){done();continue;}
  routeTo(s,m,nodes);r.repath=20;
 }
 stepRelics(s);
}
