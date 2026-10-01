// The 科技 round (packages/content/techs.ts, the University, the gunpowder units, fractional speeds) through the real
// sim: createState with civs, commands by submit, ticks. Fixture shortcuts (stock gifts, finished foundations,
// research finished early, units spawned on a node) only skip the waiting; every effect goes through stepProduction
// (refreshOwner), combat, defense, work, movement and vision.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,hash,serialize,deserialize,replay,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {makeUnit} from '../packages/sim/movement.ts';
import type {UnitKind} from '../packages/sim/movement.ts';
import {position,blockedTable,nodeTotal} from '../packages/sim/navigation.ts';
import {statsOf,maxHpOf,speedOf,buildingHpOf,buildingTargetOf,combatRules} from '../packages/sim/stats.ts';
import type {CombatUnitKind} from '../packages/sim/stats.ts';
import {ownerOf,costOf,timeTicks,producersOf,producedAt,arrowsOf,losBonus,buildRateBonus,garrisonHealScale} from '../packages/sim/civ.ts';
import type {Owner} from '../packages/sim/civ.ts';
import {authoritativeProblem,buildRequirement,placeBuilding,addWork} from '../packages/sim/buildings.ts';
import type {Building,BuildKind} from '../packages/sim/buildings.ts';
import {trainBlocker} from '../packages/sim/production.ts';
import {defenseRules} from '../packages/sim/defense.ts';
import {visionRules} from '../packages/sim/vision.ts';
import {reach} from '../packages/sim/combat.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
import {rules,resources} from '../packages/content/rules.ts';
import {civDefs,neutralCiv} from '../packages/content/civs.ts';
import {castleAgeMatch} from './castle-age-fixture.ts';

const SEED=260925;
function order(s:State,commandType:string,payload:any,playerId=0){submit(s,{protocolVersion:1,rulesetHash,playerId,sequence:s.sequence[playerId]+1,targetTick:s.tick+1,commandType,payload} as any);}
const tiles=(s:State)=>Array.from({length:s.map.size*s.map.size},(_,i)=>i);
// Both sides see the whole map (targets must be visible), renewed before every tick; never used where vision itself is
// under test.
const see=(s:State)=>{for(const v of s.vision){v.visible=tiles(s);v.explored=tiles(s);}};
const run=(s:State,n:number,stop=()=>false)=>{for(let i=0;i<n;i++){see(s);if(stop())return;tick(s);}see(s);};
const own=(civ:string,age=4,techs:string[]=[]):Owner=>({civ,age,techs});
function match(civ:string,red=neutralCiv){const s=createState(SEED,'meadow','idle',[civ,red]);see(s);return s;}
const tcOf=(s:State,p=0)=>s.buildings.find(b=>b.player===p&&b.kind==='town-center')!;
const clearRed=(s:State)=>{s.units=s.units.filter(u=>!(u.player===1&&u.kind==='villager'));};
function freeNode(s:State,x:number,y:number){const closed=blockedTable(s.map),held=new Set(s.units.flatMap(u=>u.next===null?[u.node]:[u.node,u.next]));let best=-1,d=Infinity;
 for(let n=0;n<nodeTotal(s.map);n++){if(closed[n]||held.has(n))continue;const p=position(s.map,n),e=Math.abs(p.x-x)+Math.abs(p.y-y);if(e<d){d=e;best=n;}}return best;}
// A unit at its owner's full health on the free node nearest the point (exact unless told otherwise), counted in population.
function spawn(s:State,player:number,kind:UnitKind,x:number,y:number,exact=true){const p=position(s.map,freeNode(s,x,y)),u=makeUnit(s.map,s.nextUnitId++,player,p.x,p.y,kind);
 if(exact)assert.deepEqual({x:u.x,y:u.y},{x,y},`${kind} stands on the node asked for`);
 u.hp=maxHpOf(kind as CombatUnitKind,ownerOf(s,player));s.units.push(u);s.units.sort((a,b)=>a.id-b.id);s.accounts[player].populationUsed++;return u;}
// Pays the owner's price (fixture gift), queues the entry by command and finishes it early; completion runs through
// stepProduction (refreshOwner), as in a match. The gift is exactly the price, so the stock afterwards equals the stock
// before: the research took its whole price.
function research(s:State,b:Building,entryId:string){const p=b.player,cost=costOf(entryId,ownerOf(s,p)),stock={...s.accounts[p].stock};for(const k of resources)s.accounts[p].stock[k]+=cost[k];
 order(s,'train',{buildingId:b.id,entryId},p);tick(s);const item=b.queue.find(q=>q.entryId===entryId);if(item){assert.equal(b.queue[0],item,'first in the queue');item.work=Math.max(item.work,item.required-1);tick(s);}
 const m=/^age-(\d)$/.exec(entryId);assert.ok(m?s.ages[p]>=Number(m[1]):s.techs[p].includes(entryId),`${entryId} done`);
 assert.deepEqual(s.accounts[p].stock,stock,`${entryId}: the price is taken whole`);see(s);}
function ageTo(s:State,age:number,p=0){for(let a=s.ages[p]+1;a<=age;a++)research(s,tcOf(s,p),`age-${a}`);}
// A finished building on the free site nearest the point (default: beside the town centre); fixture: paid, worked through.
function raise(s:State,p:number,kind:BuildKind,near?:{x:number;y:number}){const t=tcOf(s,p),c=near??{x:t.x+135,y:t.y+135},sites:{x:number;y:number;d:number}[]=[];
 for(let y=50;y<s.map.size*100;y+=50)for(let x=50;x<s.map.size*100;x+=50)if(!authoritativeProblem(s,p,kind,x,y))sites.push({x,y,d:Math.hypot(x-c.x,y-c.y)});
 sites.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);assert.ok(sites.length,'a site for '+kind);
 const cost=costOf(kind,ownerOf(s,p));for(const k of resources)s.accounts[p].stock[k]+=cost[k];
 const b=placeBuilding(s,p,kind,sites[0].x,sites[0].y,`fixture:${s.nextBuildingId}`);while(!b.complete)addWork(s,b);return b;}
const needs:Partial<Record<BuildKind,BuildKind[]>>={'archery-range':['barracks'],stable:['barracks'],'siege-workshop':['blacksmith']};
function building(s:State,kind:BuildKind,p=0):Building{for(const k of needs[kind]??[])if(!s.buildings.some(b=>b.player===p&&b.kind===k&&b.complete))building(s,k,p);
 return s.buildings.find(b=>b.player===p&&b.kind===kind&&b.complete)??raise(s,p,kind);}
// Trains one unit by command (paid by a gift, finished early) and returns it; the price is taken exactly.
function trainUnit(s:State,b:Building,entryId:string){const p=b.player,cost=costOf(entryId,ownerOf(s,p));for(const k of resources)s.accounts[p].stock[k]+=cost[k];
 const stock={...s.accounts[p].stock},ids=new Set(s.units.map(u=>u.id));order(s,'train',{buildingId:b.id,entryId},p);tick(s);
 const item=b.queue.find(q=>q.entryId===entryId);assert.ok(item,entryId+' queued');item!.work=Math.max(item!.work,item!.required-1);
 const fresh=()=>s.units.find(u=>!ids.has(u.id)&&u.player===p);run(s,10,()=>!!fresh());const u=fresh();assert.ok(u,entryId+' trained');assert.equal(u!.kind,entryId);
 for(const k of resources)assert.equal(s.accounts[p].stock[k],stock[k]-cost[k],`${entryId} costs its ${k}`);return u!;}
const refusal=(s:State,b:Building,entryId:string,message:RegExp)=>assert.throws(()=>order(s,'train',{buildingId:b.id,entryId}),message,`${entryId} at the ${b.kind}`);
const entryOf=(id:string)=>rules.entries.find(e=>e.id===id)!;
const Y=1250;

// The round's technologies: producer, age, prerequisite (aoetw.com's tech pages; rules.ts carries them).
const techTable:[string,BuildKind|'town-center',number,string|null][]=[
 ['masonry','university',3,null],['architecture','university',4,'masonry'],['chemistry','university',4,null],['siege-engineers','university',4,null],
 ['guard-tower','university',3,null],['keep','university',4,'guard-tower'],['treadmill-crane','university',3,null],['arrowslits','university',4,null],
 ['supplies','barracks',2,null],['squires','barracks',3,null],['arson','barracks',3,null],['thumb-ring','archery-range',3,null],['parthian-tactics','archery-range',4,null],
 ['bloodlines','stable',2,null],['husbandry','stable',3,null],['town-watch','town-center',2,null],['town-patrol','town-center',3,'town-watch'],
 ['fervor','monastery',3,null],['herbal-medicine','monastery',3,null],['hoardings','castle',4,null],['sappers','castle',4,null],['conscription','castle',4,null]];
const unitTable:[string,BuildKind,number,string][]=[['hand-cannoneer','archery-range',4,'chemistry'],['bombard-cannon','siege-workshop',4,'chemistry']];
const newIds=['university',...techTable.map(t=>t[0]),...unitTable.map(t=>t[0]),'artillery'];
// The age each building first stands in (a fixture may raise it earlier to show the technology's own age refusal).
const buildingAge=(kind:string)=>{const m=entryOf(kind).requires.map(r=>/^age-(\d)$/.exec(r)).find(Boolean);return m?Number(m[1]):1;};
const civTree=(civ:string)=>rules.civilizations.find(c=>c.id===civ)!;

// ---------------------------------------------------------------------------------------------------------------
// The University and the research table

test('the University: refused before the third age, 350 hit points, researches the University technologies only',()=>{
 assert.deepEqual([entryOf('university').cost,entryOf('university').requires],[{food:0,wood:200,gold:0,stone:0},['age-3']]);
 const s=match(neutralCiv);ageTo(s,2);
 assert.equal(buildRequirement(2,'university',s.buildings.filter(b=>b.player===0)),'需要第三時代');
 assert.throws(()=>order(s,'build',{unitIds:[1],kind:'university',x:700,y:Y}),/需要第三時代/);
 ageTo(s,3);const u=raise(s,0,'university');assert.equal(u.maxHp,350);assert.equal(u.hp,350);assert.equal(buildingHpOf('university'),350);
 // The 建築 round added Heated Shot, Fortified Wall and the Bombard Tower technology.
 assert.deepEqual(producedAt('university',ownerOf(s,0)).sort(),[...techTable.filter(t=>t[1]==='university').map(t=>t[0]),'heated-shot','fortified-wall','bombard-tower-tech'].sort());
 // Every civilization may build it.
 for(const c of rules.civilizations)assert.ok(c.available.includes('university'),c.id);
});

test('every new technology is researched at its building from its age and after its prerequisite, refused before',()=>{
 for(const [id,at,age,before] of techTable){const e=entryOf(id);
  assert.equal(rules.production[id],at,`${id} at the ${at}`);assert.deepEqual(e.requires,before?[`age-${age}`,before]:[`age-${age}`],`${id} requires`);assert.equal(e.kind,'technology');
  // The first civilization whose tree has it (the neutral one unless it has no Castle).
  const civ=[neutralCiv,...civDefs.map(c=>c.id)].find(c=>civTree(c).available.includes(id))!;const s=match(civ);
  ageTo(s,age-1);for(const k of resources)s.accounts[0].stock[k]+=5000;
  // Fixture: the building is raised now even where it needs a later age itself, so the technology's own age is what refuses.
  const real=s.ages[0];s.ages[0]=Math.max(real,buildingAge(at));const b=at==='town-center'?tcOf(s):building(s,at);s.ages[0]=real;
  refusal(s,b,id,new RegExp(`需要${entryOf(`age-${age}`).name}`));
  const wrong=at==='town-center'?building(s,'barracks'):tcOf(s);refusal(s,wrong,id,/這棟建築不能生產這個項目/);
  for(const k of resources)s.accounts[0].stock[k]-=5000;
  ageTo(s,age);
  if(before){for(const k of resources)s.accounts[0].stock[k]+=5000;refusal(s,b,id,new RegExp(`需要先研究「${entryOf(before).name}」`));for(const k of resources)s.accounts[0].stock[k]-=5000;research(s,building(s,rules.production[before] as BuildKind),before);}
  research(s,b,id);for(const k of resources)s.accounts[0].stock[k]+=5000;refusal(s,b,id,/已研究/);
 }
});

test('a civilization whose tree lacks a new technology or unit is refused at its building; every civilization is swept',()=>{
 const producerOf=(id:string)=>rules.production[id]!;assert.deepEqual(rules.civilizations.map(c=>c.id),civDefs.map(c=>c.id));
 for(const c of civDefs){const tree=civTree(c.id);
  for(const id of newIds){if(id==='university'){assert.equal(buildRequirement(4,id,[],c.id),null,`${c.id} builds the University`);continue;}
   // What the civilization's tree (civs.ts) leaves out, the neutral civilization's missing Castle and Turks' own Artillery.
   const lacks=c.missing.includes(id)||producerOf(id)==='castle'&&!c.uniqueUnits.length||id==='artillery'&&c.id!=='turks'||
    !!unitTable.find(u=>u[0]===id)&&c.missing.includes('chemistry')||id==='keep'&&c.missing.includes('guard-tower')||id==='architecture'&&c.missing.includes('masonry')||id==='town-patrol'&&c.missing.includes('town-watch');
   assert.equal(tree.unavailable.includes(id),lacks,`${c.id} ${id}`);
   const e=entryOf(id),at=producerOf(id),input={player:0,civ:c.id,age:4,techs:e.requires.filter(r=>!/^age-/.test(r)),building:{kind:at,complete:true,queue:[]},
    ownBuildings:['town-center','barracks','archery-range','stable','blacksmith','siege-workshop','monastery','university','castle'].map(kind=>({kind,complete:true,queue:[]})),
    stock:{food:9999,wood:9999,gold:9999,stone:9999},populationUsed:0,populationReserved:0,populationCap:40};
   assert.equal(trainBlocker(input,id),lacks?'此文明不能生產':null,`${c.id} ${id} at the ${at}`);}}
 // Byzantines lack Masonry and Architecture: the site's tree page, both tech pages and the Architecture page agree.
 for(const id of ['masonry','architecture'])assert.ok(civTree('byzantines').unavailable.includes(id));
 // Through submit at a real building, one refusal per kind of building.
 const cases:[string,string,BuildKind][]=[['goths','hoardings','castle'],['franks','sappers','castle'],['britons','thumb-ring','archery-range'],['vikings','herbal-medicine','monastery'],
  ['byzantines','siege-engineers','university'],['celts','bombard-cannon','siege-workshop'],['celts','hand-cannoneer','archery-range'],['goths','treadmill-crane','university'],['celts','squires','barracks'],['britons','bloodlines','stable']];
 for(const [civ,id,at] of cases){assert.ok(civDefs.find(c=>c.id===civ)!.missing.includes(id),`${civ} lacks ${id}`);const s=match(civ);ageTo(s,4);const b=building(s,at);for(const k of resources)s.accounts[0].stock[k]+=5000;
  if(id==='bombard-cannon'||id==='hand-cannoneer')research(s,building(s,'university'),'chemistry');
  refusal(s,b,id,/此文明不能生產/);}
 // Artillery: the Turks' Castle offers it in the fourth age; nobody else's.
 {const s=match('turks');ageTo(s,4);const castle=building(s,'castle');research(s,castle,'artillery');assert.equal(statsOf('bombard-cannon',ownerOf(s,0)).range,650+100);}
 {const s=match('franks');ageTo(s,4);const castle=building(s,'castle');for(const k of resources)s.accounts[0].stock[k]+=5000;refusal(s,castle,'artillery',/此文明不能生產/);}
});

// ---------------------------------------------------------------------------------------------------------------
// Each effect changes exactly its targets

const unitKinds=Object.keys(combatRules.units) as CombatUnitKind[];
const buildingKinds=Object.keys(combatRules.buildings);
// Every number an effect could touch, for one owner: unit stats, speed and sight; building health, armor, arrows,
// sight, construction and healing pace; every entry's price and its time at each building that offers it.
function numbers(o:Owner){const out:Record<string,string>={};
 for(const k of unitKinds){const st=statsOf(k,o) as Record<string,unknown>;for(const f of Object.keys(st))out[`${k}.${f}`]=JSON.stringify(st[f]);
  out[`${k}.speed`]=String(speedOf(k,o));out[`${k}.los`]=String(losBonus(o,k,combatRules.units[k].classes));}
 for(const b of buildingKinds){out[`${b}.hp`]=String(buildingHpOf(b,o));out[`${b}.armor`]=JSON.stringify(buildingTargetOf(b,o).armor);out[`${b}.arrows`]=JSON.stringify(arrowsOf(o,b));
  out[`${b}.los`]=String(losBonus(o,b));out[`${b}.buildRate`]=String(buildRateBonus(o,b));out[`${b}.garrisonHeal`]=String(garrisonHealScale(o,b));}
 for(const e of rules.entries){out[`${e.id}.cost`]=JSON.stringify(costOf(e.id,o));for(const p of producersOf(e.id,o))out[`${e.id}.time@${p}`]=String(timeTicks(e.id,o,p));}
 return out;}
const diff=(a:Owner,b:Owner)=>{const x=numbers(a),y=numbers(b);return [...new Set([...Object.keys(x),...Object.keys(y)])].filter(k=>x[k]!==y[k]).sort();};
const at=(kinds:readonly string[],field:string)=>kinds.map(k=>`${k}.${field}`);
const ofClass=(...classes:string[])=>unitKinds.filter(k=>combatRules.units[k].classes.some(c=>classes.includes(c)));

test('each new technology changes exactly its targets (every unit, building and entry number compared)',()=>{
 const infantry=ofClass('infantry'),mounted=ofClass('cavalry','camel'),sighted=['town-center','house','barracks','watch-tower','castle',
  // The 建築 round's buildings with their own sight (vision.ts).
  'bombard-tower','dock','gate','market','outpost','palisade-gate','palisade-wall','stone-wall','wonder'];
 assert.deepEqual(mounted.sort(),['camel','cataphract','cavalry-archer','knight','mameluke','mangudai','scout','war-elephant']);
 const timed=(bs:string[])=>rules.entries.filter(e=>bs.includes(rules.production[e.id]??'')).map(e=>`${e.id}.time@${rules.production[e.id]}`);
 const expected:Record<string,string[]>={
  masonry:[...at(buildingKinds,'hp'),...at(buildingKinds,'armor')],architecture:[...at(buildingKinds,'hp'),...at(buildingKinds,'armor')],
  // Missile units and stone throwers, not gunpowder, rams or petards (the scorpion's bolt counts); the buildings that shoot.
  chemistry:[...at(['archer','skirmisher','longbowman','chu-ko-nu','mangudai','cavalry-archer','mangonel','scorpion','trebuchet','galley','longboat'],'damage'),...at(['town-center','watch-tower','castle'],'arrows')],
  // Range for siege but rams; the bonus against buildings x1.2 for every siege unit with one (the scorpion's 1 stays 1).
  'siege-engineers':[...at(['mangonel','scorpion','trebuchet','bombard-cannon'],'range'),...at(['ram','mangonel','trebuchet','bombard-cannon'],'bonus')],
  'guard-tower':['watch-tower.arrows','watch-tower.hp'],keep:['watch-tower.arrows','watch-tower.hp'],arrowslits:['watch-tower.arrows'],
  'treadmill-crane':at(buildingKinds,'buildRate'),supplies:['militia.cost'],squires:at(infantry,'speed'),arson:at(infantry,'bonus'),
  'thumb-ring':at(['archer','longbowman','chu-ko-nu','mangudai','cavalry-archer'],'cooldown'),
  'parthian-tactics':[...at(['mangudai','cavalry-archer'],'armor'),...at(['mangudai','cavalry-archer'],'bonus')],
  bloodlines:at(mounted,'hp'),husbandry:at(mounted,'speed'),'town-watch':at(sighted,'los'),'town-patrol':at(sighted,'los'),fervor:['monk.speed'],
  'herbal-medicine':at(buildingKinds,'garrisonHeal'),hoardings:['castle.hp'],sappers:['villager.bonus'],
  // Everything trained or researched at the four military buildings (research too, as implemented: see the report).
  // Conscription speeds training only (research at those buildings keeps its time).
 conscription:timed(['barracks','archery-range','stable','castle']).filter(k=>rules.entries.find(e=>e.id===k.split('.')[0])?.kind==='unit')};
 assert.deepEqual(Object.keys(expected).sort(),techTable.map(t=>t[0]).sort());
 for(const [id,keys] of Object.entries(expected))for(const age of [3,4])assert.deepEqual(diff(own(neutralCiv,age,[id]),own(neutralCiv,age)),[...keys].sort(),`${id} in age ${age}`);
 // A civilization's own bonuses stay on top (Britons' longbowman range with Chemistry, Turks' gunpowder health with nothing).
 assert.deepEqual(diff(own('turks',4,['chemistry']),own('turks',4)),expected.chemistry.slice().sort());
});

test('the new technologies\' numbers',()=>{
 const n=(techs:string[])=>own(neutralCiv,4,techs);
 assert.deepEqual(['town-center','house','castle','watch-tower','university'].map(b=>[buildingHpOf(b,n(['masonry'])),buildingHpOf(b,n(['masonry','architecture']))]),[[440,484],[165,182],[880,968],[275,303],[385,424]]);
 assert.deepEqual([buildingTargetOf('house',n(['masonry'])).armor,buildingTargetOf('house',n(['masonry','architecture'])).armor],[[1,3],[2,4]]);
 assert.deepEqual([buildingHpOf('watch-tower',n(['guard-tower'])),buildingHpOf('watch-tower',n(['guard-tower','keep'])),buildingHpOf('castle',n(['hoardings']))],[368,551,968]);
 assert.equal(arrowsOf(n(['guard-tower','keep','arrowslits','chemistry']),'watch-tower').damage,5);assert.equal(arrowsOf(n(['chemistry']),'town-center').damage,1);assert.equal(arrowsOf(n(['chemistry']),'castle').damage,1);
 assert.deepEqual(['archer','skirmisher','mangonel','scorpion','trebuchet'].map(k=>statsOf(k as CombatUnitKind,n(['chemistry'])).damage),[5,3,41,13,26]);
 assert.deepEqual(['janissary','hand-cannoneer','bombard-cannon','ram','petard'].map(k=>statsOf(k as CombatUnitKind,n(['chemistry'])).damage),[17,17,40,2,25]);
 const se=n(['siege-engineers']);
 assert.deepEqual(['mangonel','scorpion','trebuchet','bombard-cannon','ram'].map(k=>statsOf(k as CombatUnitKind,se).range),[450,450,900,700,50]);
 assert.deepEqual(['ram','mangonel','trebuchet','bombard-cannon','scorpion','petard'].map(k=>statsOf(k as CombatUnitKind,se).bonus.building),[48,13,60,77,1,55]);
 assert.equal(statsOf('bombard-cannon',own('turks',4,['siege-engineers','artillery'])).range,800);
 assert.deepEqual(costOf('militia',n(['supplies'])),{food:45,wood:0,gold:20,stone:0});
 assert.deepEqual(['militia','spearman','woad-raider','huskarl','teutonic-knight'].map(k=>speedOf(k as CombatUnitKind,n(['squires']))),[5.5,5.5,7.7,6.6,4.4]);
 assert.deepEqual(['militia','huskarl'].map(k=>statsOf(k as CombatUnitKind,n(['arson'])).bonus.building),[2,4]);
 assert.deepEqual(['archer','longbowman','cavalry-archer','mangudai','chu-ko-nu','skirmisher','hand-cannoneer'].map(k=>statsOf(k as CombatUnitKind,n(['thumb-ring'])).cooldown),[25,25,27,27,44,30,52]);
 assert.deepEqual([statsOf('cavalry-archer',n(['parthian-tactics'])).armor,statsOf('cavalry-archer',n(['parthian-tactics'])).bonus.spear,statsOf('mangudai',n(['parthian-tactics'])).bonus.spear],[[1,2],6,3]);
 assert.deepEqual(['scout','knight','camel','cavalry-archer','war-elephant'].map(k=>maxHpOf(k as CombatUnitKind,n(['bloodlines']))),[65,120,120,70,470]);
 assert.deepEqual(['scout','knight','war-elephant'].map(k=>speedOf(k as CombatUnitKind,n(['husbandry']))),[11,11,4.4]);
 assert.deepEqual([losBonus(n(['town-watch']),'town-center'),losBonus(n(['town-watch','town-patrol']),'house'),losBonus(n(['town-watch']),'stable'),losBonus(n(['town-watch']),'archer',['archer'])],[400,800,0,0]);
 assert.equal(speedOf('monk',n(['fervor'])),5.75);assert.equal(garrisonHealScale(n(['herbal-medicine']),'town-center'),6);
 assert.equal(statsOf('villager',n(['sappers'])).bonus.building,15);assert.equal(buildRateBonus(n(['treadmill-crane']),'house'),20);
 assert.deepEqual([timeTicks('militia',n(['conscription']),'barracks'),timeTicks('militia',n([]),'barracks'),timeTicks('masonry',n(['conscription']),'university'),timeTicks('villager',n(['conscription']),'town-center')],[301,400,1000,400]);
 // Gunpowder: the site's numbers; Turks' health, free Chemistry and faster training.
 assert.deepEqual([costOf('hand-cannoneer',n([])),costOf('bombard-cannon',n([]))],[{food:45,wood:0,gold:50,stone:0},{food:0,wood:225,gold:225,stone:0}]);
 assert.deepEqual([maxHpOf('hand-cannoneer',own('turks')),maxHpOf('bombard-cannon',own('turks'))],[44,100]);
 assert.deepEqual([timeTicks('hand-cannoneer',own('turks'),'archery-range'),timeTicks('bombard-cannon',own('turks'),'siege-workshop'),timeTicks('hand-cannoneer',n([]),'archery-range')],[544,896,680]);
 assert.deepEqual([costOf('chemistry',own('turks')),costOf('herbal-medicine',own('teutons')),costOf('town-watch',own('byzantines'))],Array(3).fill({food:0,wood:0,gold:0,stone:0}));
});

// ---------------------------------------------------------------------------------------------------------------
// The effects in a running match

test('Masonry and Architecture: a militia hits a red house for 6, then 5, then 4; the house keeps its share of health',()=>{
 const s=match(neutralCiv);clearRed(s);ageTo(s,4,1);const school=raise(s,1,'university'),house=raise(s,1,'house',{x:800,y:1100});
 const box=obstacleBounds(s.map.obstacles.find(o=>o.id===house.id)!),m=spawn(s,0,'militia',(box[0]+box[2])/2,box[3]+50,false);
 order(s,'attack',{unitIds:[m.id],target:{kind:'building',id:house.id}});
 const nextHit=()=>{const hp=house.hp;run(s,200,()=>house.hp!==hp);return hp-house.hp;};
 assert.equal(nextHit(),6,'6 melee against melee armor 0');assert.equal(house.hp,144);
 research(s,school,'masonry');assert.equal(house.maxHp,165);assert.equal(house.hp,Math.round(144*165/150),'the same share of a larger maximum');
 assert.equal(nextHit(),5,'melee armor 1');
 const hp=house.hp;research(s,school,'architecture');assert.equal(house.maxHp,182);assert.equal(house.hp,Math.round(hp*182/165));
 assert.equal(nextHit(),4,'melee armor 2');
 // Blue's own buildings are untouched by red's research.
 assert.equal(tcOf(s,0).maxHp,400);assert.deepEqual(buildingTargetOf('house',ownerOf(s,0)).armor,[0,2]);
});

test('Guard Tower, Keep, Arrowslits and Chemistry: a tower\'s arrow hits for 5 + 1 + 1 + 2 + 1; Arson and Sappers against buildings',()=>{
 const s=match(neutralCiv);clearRed(s);ageTo(s,4);const school=raise(s,0,'university'),tower=raise(s,0,'watch-tower',{x:800,y:1150});
 const box=obstacleBounds(s.map.obstacles.find(o=>o.id===tower.id)!);
 const volley=(techs:string[])=>{for(const id of techs)research(s,school,id);const v=spawn(s,1,'villager',(box[0]+box[2])/2,box[3]+200,false);
  assert.ok(reach(v,box)<=350&&reach(v,obstacleBounds(s.map.obstacles.find(o=>o.id===tcOf(s).id)!))>300,'in the tower\'s reach only');
  run(s,60,()=>v.hp<25);const hit=25-v.hp;s.units=s.units.filter(u=>u!==v);s.accounts[1].populationUsed--;run(s,45);return hit;};
 assert.equal(volley([]),5);assert.equal(volley(['guard-tower']),6);assert.equal(tower.maxHp,368);assert.equal(volley(['keep']),7);assert.equal(tower.maxHp,551);
 assert.equal(volley(['arrowslits']),9);assert.equal(volley(['chemistry']),10);
 // Arson: a militia hits a red house for 6 + 2; Sappers: a villager for 1 + 15 (Britons have both and a Castle).
 // The Castle first: the meadow has few sites big enough for it.
 const t=match('britons');clearRed(t);ageTo(t,4);building(t,'castle');building(t,'barracks');const red=raise(t,1,'house',{x:800,y:1100}),rbox=obstacleBounds(t.map.obstacles.find(o=>o.id===red.id)!);
 const hit=(kind:UnitKind,tech:string,at:BuildKind)=>{const before=hitOf(kind);research(t,building(t,at),tech);return [before,hitOf(kind)];};
 const hitOf=(kind:UnitKind)=>{const u=spawn(t,0,kind,(rbox[0]+rbox[2])/2,rbox[3]+50,false);order(t,'attack',{unitIds:[u.id],target:{kind:'building',id:red.id}});
  const hp=red.hp;run(t,200,()=>red.hp!==hp);const d=hp-red.hp;t.units=t.units.filter(v=>v!==u);delete t.attacks[u.id];t.accounts[0].populationUsed--;return d;};
 assert.deepEqual(hit('militia','arson','barracks'),[6,8]);assert.deepEqual(hit('villager','sappers','castle'),[1,16]);
});


test('Siege Engineers in a fight: a ram strikes 2 + 48, a mangonel throws from 450; Thumb Ring: an archer shoots every 25 ticks',()=>{
 const s=match(neutralCiv);clearRed(s);ageTo(s,4);const school=raise(s,0,'university');research(s,school,'siege-engineers');
 const red=tcOf(s,1),box=obstacleBounds(s.map.obstacles.find(o=>o.id===red.id)!),ram=spawn(s,0,'ram',(box[0]+box[2])/2,box[3]+50,false);
 order(s,'attack',{unitIds:[ram.id],target:{kind:'building',id:red.id}});run(s,200,()=>red.hp<400);assert.equal(red.hp,400-(2+48));
 // A mangonel 450 from a red ram (beyond its old 400) throws at once, for its 40 (no bonus against siege).
 const m=spawn(s,0,'mangonel',300,Y),foe=spawn(s,1,'ram',750,Y);order(s,'attack',{unitIds:[m.id],target:{kind:'unit',id:foe.id}});run(s,1);
 assert.equal(reach(m,foe),450);assert.equal(foe.hp,175-40);
 // Thumb Ring: fired ticks of a real archer before and after.
 const interval=(techs:string[])=>{const t=match(neutralCiv);clearRed(t);ageTo(t,3);if(techs.length)research(t,building(t,'archery-range'),techs[0]);
  // A ram never strikes back (the archer takes 1 off it a shot).
  const a=spawn(t,0,'archer',300,Y),target=spawn(t,1,'ram',500,Y);order(t,'attack',{unitIds:[a.id],target:{kind:'unit',id:target.id}});const fired:number[]=[];
  run(t,200,()=>{const f=t.attacks[a.id]?.firedTick;if(f!==undefined&&f>=0&&!fired.includes(f))fired.push(f);return fired.length===3;});return [fired[1]-fired[0],fired[2]-fired[1]];};
 assert.deepEqual(interval([]),[30,30]);assert.deepEqual(interval(['thumb-ring']),[25,25]);
});

test('Treadmill Crane: one villager raises a house in 334 ticks instead of 400 (every fifth tick of work counts twice)',()=>{
 const raiseHouse=(crane:boolean)=>{const s=match(neutralCiv);ageTo(s,3);if(crane)research(s,building(s,'university'),'treadmill-crane');
  for(const k of resources)s.accounts[0].stock[k]+=100;const ids=new Set(s.buildings.map(b=>b.id));order(s,'build',{unitIds:[1],kind:'house',x:700,y:Y});
  const house=()=>s.buildings.find(b=>!ids.has(b.id)&&b.kind==='house')!;let first=-1;
  run(s,1500,()=>{const h=house();if(first<0&&h&&h.work>0)first=s.tick;return !!h&&h.complete;});assert.ok(house()?.complete,'built');
  // first: the tick on whose stepping the first work point was added; the house completes on the last builder tick.
  return {ticks:s.tick-first+1,maxHp:house().maxHp,hp:house().hp};};
 const plain=raiseHouse(false),crane=raiseHouse(true);
 assert.equal(plain.ticks,400);assert.equal(crane.ticks,334,'334 + 66 bonus work points = 400');assert.deepEqual([crane.hp,crane.maxHp],[150,150]);
});

test('Herbal Medicine: a unit inside a town centre regains 6 hit points every 40 ticks instead of 1',()=>{
 const s=match(neutralCiv);ageTo(s,3);const monastery=building(s,'monastery'),tc=tcOf(s),m=spawn(s,0,'militia',600,Y,false);m.hp=10;
 order(s,'garrison',{unitIds:[m.id],buildingId:tc.id});run(s,400,()=>!!s.garrison[tc.id]?.units.some(e=>e.unit===m));assert.ok(s.garrison[tc.id].units.some(e=>e.unit===m),'inside');
 const window=()=>{const hp=m.hp;for(let i=0;i<defenseRules.healTicks;i++)tick(s);return m.hp-hp;};
 assert.equal(window(),1);assert.equal(window(),1);
 research(s,monastery,'herbal-medicine');assert.equal(window(),6);assert.equal(window(),6);
 // Up to its maximum only.
 for(let i=0;i<400;i++)tick(s);assert.equal(m.hp,45);
});

test('Town Watch and Town Patrol: the town centre reveals 4 and then 8 tiles farther (vision, no units of blue\'s own)',()=>{
 // Vision is under test: no see(); blue's units (sheep too) are taken off so only its buildings reveal.
 const s=createState(SEED,'meadow','idle',[neutralCiv,neutralCiv]);s.units=s.units.filter(u=>u.player!==0);
 const o=s.map.obstacles.find(o=>o.id===tcOf(s).id)!,cx=o.x+135,cy=o.y+135;
 const disc=(r:number)=>tiles(s).filter(t=>{const dx=(t%s.map.size)*100+50-cx,dy=Math.floor(t/s.map.size)*100+50-cy;return dx*dx+dy*dy<=r*r;});
 const step=()=>{tick(s);return s.vision[0].visible;};
 const go=(id:string)=>{const cost=costOf(id,ownerOf(s,0));for(const k of resources)s.accounts[0].stock[k]+=cost[k];order(s,'train',{buildingId:tcOf(s).id,entryId:id});tick(s);tcOf(s).queue[0].work=tcOf(s).queue[0].required-1;tick(s);};
 assert.deepEqual(step(),disc(visionRules.townCenterRadius));const red=s.vision[1].visible;
 go('age-2');go('town-watch');assert.ok(s.techs[0].includes('town-watch'));assert.deepEqual(step(),disc(visionRules.townCenterRadius+400));
 assert.ok(!disc(600).includes(Math.floor((cy+800)/100)*s.map.size+Math.floor(cx/100))&&step().includes(Math.floor((cy+800)/100)*s.map.size+Math.floor(cx/100)),'a tile 8 below the centre');
 go('age-3');go('town-patrol');assert.deepEqual(step(),disc(visionRules.townCenterRadius+800));
 assert.deepEqual(s.vision[1].visible,red,'red sees as before');
});

test('Conscription: training queued after it takes 301 ticks instead of 400 at the barracks; the University and the town centre are as before',()=>{
 const s=match('britons');ageTo(s,4);const castle=building(s,'castle'),barracks=building(s,'barracks'),school=building(s,'university');
 for(const k of resources)s.accounts[0].stock[k]+=2000;for(let i=0;i<3;i++)raise(s,0,'house');
 order(s,'train',{buildingId:barracks.id,entryId:'militia'});tick(s);const early=barracks.queue[0];assert.equal(early.required,400);
 research(s,castle,'conscription');
 order(s,'train',{buildingId:barracks.id,entryId:'militia'});tick(s);const late=barracks.queue[1];assert.equal(late.required,301);assert.equal(early.required,400,'queued before: unchanged');
 order(s,'train',{buildingId:school.id,entryId:'masonry'});tick(s);assert.equal(school.queue[0].required,1000);
 order(s,'train',{buildingId:tcOf(s).id,entryId:'villager'});tick(s);assert.equal(tcOf(s).queue[0].required,timeTicks('villager',ownerOf(s,0),'town-center'));assert.equal(tcOf(s).queue[0].required,400);
 // The second militia comes out 301 ticks after the first.
 const count=()=>s.units.filter(u=>u.player===0&&u.kind==='militia').length;let one=-1,two=-1;
 for(let i=0;i<1000&&two<0;i++){tick(s);if(one<0&&count()===1)one=s.tick;if(count()===2)two=s.tick;}
 assert.ok(one>0&&two>0);assert.equal(two-one,301);
});

test('Supplies and Bloodlines in a match: a militia costs 45 food; a knight in the field gains 20 hit points',()=>{
 const s=match(neutralCiv);clearRed(s);ageTo(s,3);const barracks=building(s,'barracks'),stable=building(s,'stable');for(let i=0;i<2;i++)raise(s,0,'house');
 research(s,barracks,'supplies');trainUnit(s,barracks,'militia');assert.deepEqual(costOf('militia',ownerOf(s,0)),{food:45,wood:0,gold:20,stone:0});
 const k=trainUnit(s,stable,'knight');k.hp-=30;research(s,stable,'bloodlines');assert.equal(k.hp,120-30);assert.equal(trainUnit(s,stable,'knight').hp,120);
});

// ---------------------------------------------------------------------------------------------------------------
// Gunpowder

test('the hand cannoneer and the bombard cannon are trained only after Chemistry, and fight with their numbers',()=>{
 const s=match(neutralCiv);clearRed(s);ageTo(s,3);const range=building(s,'archery-range'),ws=building(s,'siege-workshop');for(const k of resources)s.accounts[0].stock[k]+=5000;
 for(const [id,at] of [['hand-cannoneer',range],['bombard-cannon',ws]] as const){assert.deepEqual(entryOf(id).requires,['age-4','chemistry']);assert.equal(rules.production[id],at.kind);refusal(s,at,id,/需要第四時代/);}
 for(const k of resources)s.accounts[0].stock[k]-=5000;ageTo(s,4);for(const k of resources)s.accounts[0].stock[k]+=5000;
 for(const [id,at] of [['hand-cannoneer',range],['bombard-cannon',ws]] as const)refusal(s,at,id,/需要先研究「化學」/);
 for(const k of resources)s.accounts[0].stock[k]-=5000;research(s,building(s,'university'),'chemistry');
 for(let i=0;i<2;i++)raise(s,0,'house');const hc=trainUnit(s,range,'hand-cannoneer'),bc=trainUnit(s,ws,'bombard-cannon');assert.equal(hc.hp,35);assert.equal(bc.hp,80);
 assert.equal(speedOf('bombard-cannon',ownerOf(s,0)),4.4);assert.equal(speedOf('hand-cannoneer',ownerOf(s,0)),5);
});

test('gunpowder fights: the hand cannoneer\'s 26 against infantry, the bombard cannon\'s minimum range, one-node blast and 104 against buildings',()=>{
 // The fights on the open band south of the bases, in a match without buildings there (Chemistry given: its research is above).
 const s=match(neutralCiv);clearRed(s);s.ages[0]=4;s.techs[0].push('chemistry');
 // Hand cannoneer: 17 pierce - 1 + 10 against infantry, from 400, every 52 ticks.
 {const a=spawn(s,0,'hand-cannoneer',300,Y),foe=spawn(s,1,'militia',700,Y);order(s,'attack',{unitIds:[a.id],target:{kind:'unit',id:foe.id}});run(s,1);
  assert.equal(reach(a,foe),400);assert.equal(foe.hp,45-26);run(s,51);assert.equal(foe.hp,45-26);run(s,1);assert.ok(!s.units.includes(foe),'the second ball kills it');s.units=s.units.filter(v=>v!==a);}
 // Bombard cannon: 40 melee + 6 against siege; the enemy one node away takes the blast too (50), the one beyond does not.
 {const b=spawn(s,0,'bombard-cannon',200,Y),foe=spawn(s,1,'ram',800,Y),next=spawn(s,1,'ram',850,Y),side=spawn(s,1,'ram',900,Y);
  assert.equal(statsOf('bombard-cannon',ownerOf(s,0)).blast,50);order(s,'attack',{unitIds:[b.id],target:{kind:'unit',id:foe.id}});run(s,1);
  assert.equal(foe.hp,175-46);assert.equal(next.hp,175-46);assert.equal(side.hp,175);run(s,64);assert.equal(foe.hp,175-46);run(s,1);assert.equal(foe.hp,175-92,'every 65 ticks');
  for(const u of [b,foe,next,side])s.units=s.units.filter(v=>v!==u);}
 // Its minimum range: a target 200 away is never picked automatically; ordered, it walks out to 250 or more first.
 {const b=spawn(s,0,'bombard-cannon',300,Y),foe=spawn(s,1,'ram',500,Y);run(s,60);assert.equal(s.attacks[b.id],undefined);assert.equal(foe.hp,175);
  order(s,'attack',{unitIds:[b.id],target:{kind:'unit',id:foe.id}});let from=-1;run(s,600,()=>{if(foe.hp<175){from=reach(b,foe);return true;}return false;});
  assert.equal(foe.hp,175-46);assert.ok(from>=250&&from<=650,`shot from ${from}`);for(const u of [b,foe])s.units=s.units.filter(v=>v!==u);}
 // Against a building: 40 + 64 (melee armor 0 without Masonry), from 650 (+ the footprint allowance).
 {const red=tcOf(s,1),b=spawn(s,0,'bombard-cannon',1200,Y);order(s,'attack',{unitIds:[b.id],target:{kind:'building',id:red.id}});run(s,300,()=>red.hp<400);assert.equal(red.hp,400-104);}
});

test('Turks: free Chemistry at the University, hand cannoneers with 44 hit points trained 25% faster',()=>{
 const s=match('turks');clearRed(s);ageTo(s,4);const range=building(s,'archery-range'),school=building(s,'university'),stock={...s.accounts[0].stock};
 research(s,school,'chemistry');assert.deepEqual(s.accounts[0].stock,stock,'paid nothing');assert.ok(s.techs[0].includes('chemistry'));
 assert.deepEqual(costOf('chemistry',ownerOf(s,0)),{food:0,wood:0,gold:0,stone:0});
 for(const k of resources)s.accounts[0].stock[k]+=100;order(s,'train',{buildingId:range.id,entryId:'hand-cannoneer'});tick(s);assert.equal(range.queue[0].required,544);
 range.queue[0].work=range.queue[0].required-1;run(s,10,()=>s.units.some(u=>u.player===0&&u.kind==='hand-cannoneer'));
 assert.equal(s.units.find(u=>u.player===0&&u.kind==='hand-cannoneer')!.hp,44);
});

// ---------------------------------------------------------------------------------------------------------------
// Fractional speeds

// A walk along the open band south of both bases; returns the distance covered after each tick from the first step.
function walk(civ:string,kind:UnitKind,techs:string[],age:number,from:number,to:number){
 const s=match(civ);clearRed(s);s.ages[0]=age;s.techs[0].push(...techs);// fixture: the research itself is covered above
 const u=spawn(s,0,kind,from,Y);order(s,'move',{unitIds:[u.id],x:to,y:Y});const covered:number[]=[];let started=false;
 run(s,2000,()=>{if(u.x!==from)started=true;if(started){covered.push(u.x-from);assert.equal(u.y,Y,'straight along the band');}return u.x===to&&u.next===null;});
 assert.equal(u.x,to);assert.equal(u.stride,undefined,'nothing carried once it stops');return covered;}

test('Squires: a militia covers 5.5 a tick over a long walk (1200 in 219 ticks, plain 240); Husbandry knights 11 (110 vs 120)',()=>{
 for(const [kind,techs,speed] of [['militia',['squires'],5.5],['militia',[],5],['knight',['husbandry'],11],['knight',[],10],['monk',['fervor'],5.75]] as [UnitKind,string[],number][]){
  assert.equal(speedOf(kind as CombatUnitKind,own(neutralCiv,4,techs)),speed);
  const covered=walk(neutralCiv,kind,techs,4,100,1300);
  assert.equal(covered.length,Math.ceil(1200/speed),`${kind} ${techs}: ticks`);
  // Never ahead of speed x ticks, never a whole step behind it.
  covered.slice(0,-1).forEach((d,i)=>assert.ok(d<=speed*(i+1)+1e-9&&d>speed*(i+1)-Math.ceil(speed),`${kind} ${techs} tick ${i+1}: ${d}`));
 }
});

// ---------------------------------------------------------------------------------------------------------------
// Save, load and replay

test('a logged match with researched technologies and a Squires militia mid-walk survives save, load and replay',()=>{
 const s=castleAgeMatch(SEED),stock=s.accounts[0].stock,tcB=tcOf(s),tc=s.map.obstacles.find(o=>o.id===tcB.id)!;
 const command=(t:string,p:unknown)=>order(s,t,p);
 const until=(done:()=>boolean,limit=40000)=>{const end=s.tick+limit;while(!done()){if(s.tick>=end)throw Error(`fixture stalled at tick ${s.tick}: ${JSON.stringify(stock)}`);tick(s);}};
 const explored=()=>new Set(s.vision[0].explored);
 const nearest=(kind:string)=>{const seen=explored();return s.map.resources.filter(r=>r.kind===kind&&r.collectible&&seen.has(Math.floor(r.y/100)*s.map.size+Math.floor(r.x/100))).sort((a,b)=>Math.hypot(a.x-tc.x,a.y-tc.y)-Math.hypot(b.x-tc.x,b.y-tc.y))[0];};
 const idle=(id:number)=>!s.works[id]&&!s.units.find(u=>u.id===id)?.path.length;
 const working=(done:()=>boolean)=>until(()=>{if(s.tick%20===0)for(const id of [2,3])if(idle(id))command('gather',{unitIds:[id],resourceId:nearest('tree').id});return done();},60000);
 function site(kind:BuildKind){for(let r=300;r<=900;r+=50)for(let a=0;a<24;a++){const x=Math.round((tc.x+Math.cos(a*Math.PI/12)*r)/10)*10,y=Math.round((tc.y+Math.sin(a*Math.PI/12)*r)/10)*10;if(!authoritativeProblem(s,0,kind,x,y))return {x,y};}throw Error('no site for '+kind);}
 for(const kind of ['house','barracks','university'] as BuildKind[]){command('build',{unitIds:[3],kind,...site(kind)});until(()=>s.buildings.some(b=>b.player===0&&b.kind===kind&&b.complete));}
 const barracks=s.buildings.find(b=>b.player===0&&b.kind==='barracks')!,school=s.buildings.find(b=>b.player===0&&b.kind==='university')!;
 working(()=>stock.food>=100);command('train',{buildingId:barracks.id,entryId:'squires'});working(()=>s.techs[0].includes('squires'));
 working(()=>stock.food>=60&&stock.gold>=20);command('train',{buildingId:barracks.id,entryId:'militia'});working(()=>s.units.some(u=>u.player===0&&u.kind==='militia'));
 working(()=>stock.food>=150&&stock.wood>=175);command('train',{buildingId:school.id,entryId:'masonry'});working(()=>s.techs[0].includes('masonry'));
 assert.equal(tcB.maxHp,440);assert.deepEqual(buildingTargetOf('town-center',ownerOf(s,0)).armor,[1,3]);
 const m=s.units.find(u=>u.player===0&&u.kind==='militia')!;assert.equal(speedOf('militia',ownerOf(s,0)),5.5);
 command('move',{unitIds:[m.id],x:m.x>800?m.x-700:m.x+700,y:m.y});until(()=>m.next!==null&&m.stride!==undefined,400);
 const raw=serialize(s);assert.ok(JSON.parse(raw).state.units.find((u:{id:number})=>u.id===m.id).stride>0,'the save carries the stride');
 const copy=deserialize(raw);assert.equal(hash(copy),hash(s));
 for(let i=0;i<300;i++){tick(s);tick(copy);}assert.equal(hash(copy),hash(s));
 assert.equal(hash(replay(s.seed,s.log,s.tick,s.layout,s.opponent,s.civs)),hash(s));
});
