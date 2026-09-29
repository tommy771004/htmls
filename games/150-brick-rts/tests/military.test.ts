import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,hash,serialize,deserialize,replay,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {makeUnit} from '../packages/sim/movement.ts';
import type {UnitKind} from '../packages/sim/movement.ts';
import {position,blockedTable,nodeTotal} from '../packages/sim/navigation.ts';
import {statsOf,hitDamage,buildingTarget,lineName,maxHpOf} from '../packages/sim/stats.ts';
import {authoritativeProblem} from '../packages/sim/buildings.ts';
import {trainable} from '../packages/sim/production.ts';
import {isAnimal} from '../packages/sim/fauna.ts';
function order(s:State,commandType:string,payload:any,playerId=0){submit(s,{protocolVersion:1,rulesetHash,playerId,sequence:s.sequence[playerId]+1,targetTick:s.tick+1,commandType,payload} as any);}
const run=(s:State,n:number,stop=()=>false)=>{for(let i=0;i<n&&!stop();i++)tick(s);};
function spawn(s:State,player:number,kind:UnitKind,x:number,y:number){const closed=blockedTable(s.map),held=new Set(s.units.map(u=>u.node));let best=-1,d=Infinity;
 for(let n=0;n<nodeTotal(s.map);n++){if(closed[n]||held.has(n))continue;const p=position(s.map,n),e=Math.abs(p.x-x)+Math.abs(p.y-y);if(e<d){d=e;best=n;}}
 const p=position(s.map,best),u=makeUnit(s.map,s.nextUnitId++,player,p.x,p.y,kind);u.hp=maxHpOf(kind,s.techs[player]);s.units.push(u);s.units.sort((a,b)=>a.id-b.id);s.accounts[player].populationUsed++;return u;}
// A quiet test ground: no animals in the way, both sides see everything.
function arena(){const s=createState(260925);s.units=s.units.filter(u=>!isAnimal(u.kind));for(const v of s.vision){v.visible=Array.from({length:256},(_,i)=>i);v.explored=[...v.visible];}return s;}

test('damage is attack minus the matching armor plus class bonuses, never below 1',()=>{
 assert.equal(hitDamage(statsOf('spearman'),statsOf('knight')),4+12-2,'spearman against a knight');
 assert.equal(hitDamage(statsOf('archer'),statsOf('militia')),4-1,'arrows meet pierce armor');
 assert.equal(hitDamage(statsOf('skirmisher'),statsOf('archer')),2+4,'skirmisher against an archer');
 assert.equal(hitDamage(statsOf('archer'),statsOf('spearman')),4+3,'archer against a spearman');
 assert.equal(hitDamage(statsOf('archer'),buildingTarget),2,'buildings shrug off arrows');assert.equal(hitDamage(statsOf('militia'),buildingTarget),6);
 assert.equal(hitDamage(statsOf('villager'),statsOf('knight')),1,'at least 1');
});

test('blacksmith research raises only the classes it names; line upgrades change numbers and names',()=>{
 assert.equal(statsOf('militia',['forging']).damage,7);assert.equal(statsOf('archer',['forging']).damage,4);assert.equal(statsOf('knight',['forging','iron-casting']).damage,12);
 assert.deepEqual([statsOf('archer',['fletching']).damage,statsOf('archer',['fletching']).range],[5,300]);assert.equal(statsOf('militia',['fletching']).range,50);
 assert.deepEqual(statsOf('militia',['scale-mail-armor']).armor,[1,2]);assert.deepEqual(statsOf('knight',['scale-mail-armor']).armor,[2,2]);assert.deepEqual(statsOf('knight',['scale-barding-armor']).armor,[3,3]);
 assert.deepEqual([statsOf('militia',['man-at-arms']).hp,statsOf('militia',['man-at-arms']).damage],[55,8]);assert.equal(lineName('militia',['man-at-arms','long-swordsman']),'長劍士');
 assert.equal(statsOf('militia',['man-at-arms','long-swordsman','forging']).damage,10,'upgrade first, then the blacksmith');
 assert.equal(statsOf('spearman',['pikeman']).bonus.cavalry,18);assert.equal(statsOf('archer',['crossbowman','fletching']).range,350);
});

test('the new units come from their buildings in their ages: spearman and skirmisher in the second, knight in the third',()=>{
 const s=createState(260925);s.accounts[0].stock={food:5000,wood:5000,gold:5000,stone:5000};s.vision[0].explored=Array.from({length:256},(_,i)=>i);
 const build=(kind:string)=>{for(let y=650;y<=1250;y+=50)for(let x=100;x<=1200;x+=50)if(!authoritativeProblem(s,0,kind as any,x,y)){order(s,'build',{unitIds:[1,2,3],kind,x,y});run(s,3000,()=>s.buildings.some(b=>b.kind===kind&&b.complete));return s.buildings.find(b=>b.kind===kind)!;}throw Error('no site '+kind);};
 const barracks=build('barracks');assert.match(trainable(s,0,barracks,'spearman')??'',/第二時代/);
 s.ages[0]=2;assert.equal(trainable(s,0,barracks,'spearman'),null);assert.match(trainable(s,0,barracks,'long-swordsman')??'',/第三時代/);
 const stable=build('stable');assert.match(trainable(s,0,stable,'knight')??'',/第三時代/);const smith=build('blacksmith');assert.equal(trainable(s,0,smith,'forging'),null);assert.match(trainable(s,0,smith,'iron-casting')??'',/第三時代/);
 s.ages[0]=3;assert.match(trainable(s,0,smith,'iron-casting')??'',/需要先研究「鍛造」/);
 order(s,'train',{buildingId:stable.id,entryId:'knight'});order(s,'train',{buildingId:smith.id,entryId:'forging'});run(s,800,()=>s.units.some(u=>u.kind==='knight')&&s.techs[0].includes('forging'));
 const knight=s.units.find(u=>u.kind==='knight')!;assert.equal(knight.hp,100);assert.ok(s.techs[0].includes('forging'));
});

test('a blacksmith built by command survives save/load and replays to the same state',()=>{
 const s=createState(260925);for(let y=650;y<=1250&&!s.log.length;y+=50)for(let x=100;x<=1200;x+=50)if(!authoritativeProblem(s,0,'blacksmith',x,y)){order(s,'build',{unitIds:[1,2,3],kind:'blacksmith',x,y});break;}
 run(s,1000,()=>s.buildings.some(b=>b.kind==='blacksmith'&&b.complete));assert.ok(s.buildings.some(b=>b.kind==='blacksmith'&&b.complete));
 const copy=deserialize(serialize(s));run(s,100);run(copy,100);assert.equal(hash(copy),hash(s));assert.equal(hash(replay(s.seed,s.log,s.tick)),hash(s));
});

test('an upgrade reaches units already in the field: a hurt militia keeps its wound and gains the new health',()=>{
 const s=createState(260925);const m=spawn(s,0,'militia',600,1000);m.hp=30;s.techs[0].push('man-at-arms');
 // Research completes through production: the same health rule as Loom and Sanctity.
 s.techs[0].pop();const tc=s.buildings.find(b=>b.kind==='town-center'&&b.player===0)!;s.ages[0]=2;
 s.buildings.push({...structuredClone(tc),id:'building-test',kind:'barracks',queue:[{id:99,entryId:'man-at-arms',reservationId:'0:test',work:399,required:400}]});
 s.accounts[0].reservations.push({id:'0:test',entryId:'man-at-arms',cost:{food:100,wood:0,gold:40,stone:0},population:0,status:'reserved'});
 tick(s);assert.ok(s.techs[0].includes('man-at-arms'));assert.equal(m.hp,40);
});

test('counters win: a spearman beats a scout, a skirmisher beats an archer, archers beat spearmen',()=>{
 for(const [a,b] of [['spearman','scout'],['skirmisher','archer'],['archer','spearman']] as const){
  const s=arena(),x=spawn(s,0,a,700,900),y=spawn(s,1,b,850,900);
  order(s,'attack',{unitIds:[x.id],target:{kind:'unit',id:y.id}},0);order(s,'attack',{unitIds:[y.id],target:{kind:'unit',id:x.id}},1);
  run(s,2000,()=>!s.units.includes(x)||!s.units.includes(y));
  assert.ok(s.units.includes(x)&&!s.units.includes(y),`${a} beats ${b} (${x.hp} hp left)`);
 }
});
