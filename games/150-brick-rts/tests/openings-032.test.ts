import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,tick,hash,serialize,deserialize,replay} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {openingView,openingRules} from '../packages/sim/ai.ts';
import {openings,unavailableOpenings,openingById,openingChoices,pickOpening,needMet,gatherKinds,standardOpening,randomOpening} from '../packages/content/openings.ts';
import type {OpeningView} from '../packages/content/openings.ts';
import {rules} from '../packages/content/rules.ts';
import {civDefs} from '../packages/content/civs.ts';
import {unitKinds} from '../packages/sim/movement.ts';
import {buildKinds} from '../packages/sim/buildings.ts';
import {producersOf,neutralOwner} from '../packages/sim/civ.ts';
import {terrainRules} from '../packages/sim/terrain.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
// The 戰術技巧 round: the computer's openings (packages/content/openings.ts, packages/sim/ai.ts). Blue never acts here.
const civs=['settlers','settlers'];
const match=(id:string)=>createState(260925,'open','ai',civs,id);
// Runs red until the check holds (true) or the tick limit (false); the check sees red's opening view each 20 ticks.
function until(s:State,ticks:number,check:(v:OpeningView,s:State)=>boolean){for(;s.tick<ticks&&!s.outcome;){tick(s);if(s.tick%20===0&&check(openingView(s,1),s))return true;}return false;}
const blueTc=(s:State)=>{const tc=s.buildings.find(b=>b.player===0&&b.kind==='town-center')!;const [x0,y0,x1,y1]=obstacleBounds(s.map.obstacles.find(o=>o.id===tc.id)!);return {x:(x0+x1)/2,y:(y0+y1)/2};};

test('opening data: every step and plan names things that exist, every civ is a game civ',()=>{
 const units=new Set<string>(unitKinds),buildings=new Set<string>(buildKinds),entries=new Set(rules.entries.map(e=>e.id)),civIds=new Set(civDefs.map(c=>c.id)),resources=new Set(Object.keys(terrainRules.resourceCapacity));
 assert.deepEqual(openings.map(o=>o.id),['scrush','archerstar','armstar','armstower','towerrush','bbrush','brushtof','brushfc','fontrush']);
 assert.deepEqual(unavailableOpenings.map(o=>o.id),['eglerush']);assert.ok(unavailableOpenings[0].reason.includes('鷹斥候'));
 assert.deepEqual(openingChoices,[standardOpening,randomOpening,...openings.map(o=>o.id)]);
 for(const o of openings){
  assert.ok(o.zh&&o.en&&o.page.startsWith('aoetw.com/ar/'),o.id);assert.ok(o.civs.length&&o.civs.every(c=>civIds.has(c)),o.id);assert.ok(o.best.every(c=>o.civs.includes(c)),o.id);
  assert.ok(o.steps.length>=6,o.id);
  for(const st of o.steps){assert.ok(st.label&&!/undefined/.test(st.label),o.id);if(!st.done)continue;const d=st.done;
   for(const k of Object.keys(d.gather??{}))assert.ok((gatherKinds as readonly string[]).includes(k),`${o.id} gather ${k}`);
   for(const k of Object.keys(d.buildings??{}))assert.ok(buildings.has(k),`${o.id} building ${k}`);
   for(const k of Object.keys(d.forward??{}))assert.ok(k==='villager'||buildings.has(k),`${o.id} forward ${k}`);
   for(const k of Object.keys(d.units??{}))assert.ok(units.has(k),`${o.id} unit ${k}`);
   for(const t of d.techs??[])assert.ok(entries.has(t),`${o.id} tech ${t}`);}
  const p=o.plan;assert.ok(p.clickAt>0&&p.villagers>=p.clickAt-3,o.id);
  for(const phase of ['dark','up','feudal'] as const)for(const k of Object.keys(p.train[phase]??{})){assert.ok(units.has(k),`${o.id} trains ${k}`);assert.ok(producersOf(k,neutralOwner).length,`${o.id} ${k} has a producer`);}
  for(const b of p.build)assert.ok(buildings.has(b.kind),`${o.id} builds ${b.kind}`);
  for(const t of p.research)assert.ok(entries.has(t),`${o.id} researches ${t}`);
  for(const k of p.raid?.kinds??[])assert.ok(units.has(k),`${o.id} raids with ${k}`);
  for(const k of p.towers?.prefer??[])assert.ok(resources.has(k),`${o.id} towers by ${k}`);}
 // needMet: every part counts; an advice step has no check.
 const view:OpeningView={age:1,clicking:2,villagers:10,gather:{sheep:3,hunt:1,berries:2,wood:4,gold:0,stone:0,farm:0},buildings:{barracks:1},forward:{villager:2},units:{militia:3},techs:['loom'],raiding:1};
 assert.ok(needMet({villagers:10,clicked:2,gather:{sheep:3},buildings:{barracks:1},forward:{villager:2},units:{militia:3},techs:['loom'],raiding:1},view));
 assert.ok(!needMet({age:2},view));assert.ok(!needMet({gather:{gold:1}},view));assert.ok(!needMet({forward:{'watch-tower':1}},view));assert.ok(!needMet({techs:['loom','man-at-arms']},view));
});

test('the opening choice: standard by default, random resolved from the seed, unknown refused, kept by save and replay',()=>{
 assert.equal(createState(260925,'open','ai').aiOpening,standardOpening);
 assert.throws(()=>createState(260925,'open','ai',civs,'eglerush'),/未知的電腦開局/);assert.throws(()=>createState(260925,'open','ai',civs,'rush'),/未知的電腦開局/);
 const r=createState(260925,'open','ai',['settlers','mongols'],randomOpening);assert.equal(r.aiOpening,pickOpening(260925,'mongols'));assert.ok(openingById(r.aiOpening));
 // A civ the site singles out picks among its own openings; the pick is the seed's.
 for(let seed=1;seed<30;seed++){const id=pickOpening(seed,'mongols');assert.ok(openingById(id)!.best.includes('mongols'),id);assert.equal(pickOpening(seed,'mongols'),id);}
 assert.equal(new Set(Array.from({length:40},(_,i)=>pickOpening(i,'settlers'))).size>3,true,'the neutral civ draws from every opening');
 const s=match('armstar');for(let i=0;i<3200;i++)tick(s);
 const back=deserialize(serialize(s));assert.equal(back.aiOpening,'armstar');assert.equal(hash(back),hash(s));
 assert.equal(hash(replay(s.seed,s.log,s.tick,'open','ai',civs,'armstar')),hash(s));
 assert.notEqual(hash(replay(s.seed,s.log,s.tick,'open','ai',civs,'scrush')),hash(s),'another opening plays another match');
});

test('肉馬開局: no militia; a stable in the Feudal Age, scouts sent at blue',()=>{
 const s=match('scrush');
 assert.ok(until(s,9600,v=>v.units.scout>=3&&v.raiding>=1),'scouts trained and raiding');
 assert.equal(s.ages[1],2);assert.ok(s.buildings.some(b=>b.player===1&&b.kind==='stable'));assert.ok(!s.units.some(u=>u.player===1&&u.kind==='militia'),'no militia');
 assert.ok(s.techs[1].includes('loom'),'Loom before clicking up');
});

test('小弓開局: two archery ranges and archers, a spearman first',()=>{
 const s=match('archerstar');
 assert.ok(until(s,9600,v=>v.buildings['archery-range']>=2&&v.units.archer>=3),'two ranges and archers');
 assert.equal(s.units.filter(u=>u.player===1&&u.kind==='spearman').length,1);
});

test('裝甲開局: militia from the click-up (none before), three sent at blue, then Man-at-Arms',()=>{
 const s=match('armstar');
 const seen:{first?:OpeningView}={};assert.ok(until(s,9000,v=>{if(!seen.first&&v.units.militia)seen.first=v;return v.units.militia>=3;}),'three militia');
 assert.ok(seen.first!.clicking===2||seen.first!.age===2,'the first militia comes once the Feudal Age is clicked');
 assert.ok(until(s,9600,v=>v.raiding>=1),'they go');
 assert.ok(until(s,9600,v=>v.techs.includes('man-at-arms')),'Man-at-Arms researched');
});

test('裝甲塔 and 純塔: forward villagers raise watch towers by blue\'s base, out of its town centre\'s arrows',()=>{
 for(const [id,towers] of [['armstower',1],['towerrush',2]] as const){const s=match(id);
  assert.ok(until(s,9600,v=>(v.forward['watch-tower']??0)>=towers),`${id}: ${towers} forward towers`);
  const home=blueTc(s),mine=s.buildings.filter(b=>b.player===1&&b.kind==='watch-tower');
  for(const b of mine){const [x0,y0,x1,y1]=obstacleBounds(s.map.obstacles.find(o=>o.id===b.id)!);const d=Math.max(Math.abs((x0+x1)/2-home.x),Math.abs((y0+y1)/2-home.y));
   assert.ok(d>=openingRules.towerGap-50&&d<=1100,`${id}: tower ${d} from blue's town centre`);}
  if(id==='towerrush')assert.ok(!s.buildings.some(b=>b.player===1&&b.kind==='barracks'),'純塔 builds no barracks');
  assert.ok(s.units.filter(u=>u.player===1&&u.kind==='villager').length>=9,`${id}: the villagers live`);}
});

test('黑暗爆民兵 and 黑快轉封: militia from the Dark Age, raiding',()=>{
 // 黑暗爆民兵 stays in the Dark Age with its raid out.
 assert.ok(until(match('bbrush'),6000,v=>v.age===1&&v.clicking===0&&v.units.militia>=3&&v.raiding>=1),'bbrush: Dark Age militia out');
 // 黑快轉封: its militia come before the click-up, which waits for 12 villagers; then the raid goes.
 const s=match('brushtof'),seen:{first?:OpeningView}={};
 assert.ok(until(s,9600,v=>{if(!seen.first&&v.units.militia)seen.first=v;return v.clicking===2||v.age>=2;}),'clicked up');
 assert.ok(seen.first&&seen.first.age===1&&seen.first.clicking===0,'militia trained in the Dark Age');assert.ok(s.units.filter(u=>u.player===1&&u.kind==='villager').length>=12);
 assert.ok(until(s,9600,v=>v.raiding>=1),'brushtof: the raid goes');
});

test('黑快搶城: the Castle Age without a Feudal army',()=>{
 const s=match('brushfc');
 assert.ok(until(s,14400,v=>v.age>=3||v.clicking===3),'Castle Age researched');
 assert.ok(!s.buildings.some(b=>b.player===1&&(b.kind==='archery-range'||b.kind==='stable')),'no range or stable before it');
});

test('前置槍矛: a forward barracks, spearmen and skirmishers',()=>{
 const s=match('fontrush');
 assert.ok(until(s,9600,v=>(v.forward.barracks??0)>=1&&v.units.spearman>=1),'forward barracks and spearmen');
 assert.ok(until(s,9600,v=>v.buildings['archery-range']>=2&&v.units.skirmisher>=1),'two ranges and skirmishers');
});

test('after the opening the normal plan takes over',()=>{
 const s=match('scrush');assert.ok(!until(s,openingById('scrush')!.plan.until.tick+400,()=>false));
 // Past its tick the normal plan builds what the opening held back (the archery range, the blacksmith).
 assert.ok(until(s,16000,(_,s)=>s.buildings.some(b=>b.player===1&&b.kind==='archery-range')),'the normal plan builds a range');
});
