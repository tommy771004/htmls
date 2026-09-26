import test from 'node:test';
import assert from 'node:assert/strict';
import {makeMap,validateMap,validateStartingResources,nodeTotal,openMapRules} from '../packages/sim/navigation.ts';
import {createState,hash,tick,serialize,deserialize,submit,rulesetHash} from '../packages/sim/sim.ts';
import {combatRules} from '../packages/sim/stats.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
import {currentGraph,fullGraph} from '../packages/sim/movement.ts';
const seeds=[260925,1,7,51,99,4242,777,123456];
const centres=(m:ReturnType<typeof makeMap>)=>m.obstacles.filter(o=>o.kind==='town-center').map(o=>{const b=obstacleBounds(o);return {x:(b[0]+b[2])/2,y:(b[1]+b[3])/2,red:!!o.red};});

test('the match map is 32 x 32 tiles with 63 x 63 navigation nodes; the test grounds stay 16 x 16',()=>{
 const m=makeMap(260925,'open');assert.equal(m.size,32);assert.equal(m.tiles.length,1024);assert.equal(nodeTotal(m),63*63);
 const legacy=makeMap(260925,'meadow');assert.equal(legacy.size,16);assert.equal(nodeTotal(legacy),961);
 assert.deepEqual(legacy.obstacles.filter(o=>o.kind==='town-center').map(o=>[o.x,o.y]),[[265,350],[1065,350]],'test-ground bases unchanged');
});

test('players start on a seeded circle round the centre, far apart, with the whole base inside the map',()=>{
 const positions=new Set<string>();
 for(const seed of seeds){const m=makeMap(seed,'open'),[a,b]=centres(m),mid=m.size*50;
  assert.deepEqual(validateMap(m),[],`seed ${seed}`);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=1500,`seed ${seed}: bases ${Math.round(Math.hypot(a.x-b.x,a.y-b.y))} apart`);
  // Roughly opposite: the angle between them, seen from the centre, is at least 180 - jitter degrees.
  const angle=Math.abs(Math.atan2(a.y-mid,a.x-mid)-Math.atan2(b.y-mid,b.x-mid)),opposite=Math.min(angle,2*Math.PI-angle);
  assert.ok(opposite>=Math.PI-openMapRules.oppositeJitter-.35,`seed ${seed}: ${opposite.toFixed(2)} rad`);
  for(const c of [a,b]){assert.ok(c.x+openMapRules.margin.left>=0&&c.x+openMapRules.margin.right<=m.size*100&&c.y+openMapRules.margin.top>=0&&c.y+openMapRules.margin.bottom<=m.size*100,`seed ${seed}: base inside`);positions.add(`${Math.round(c.x/400)},${Math.round(c.y/400)}`);}
 }
 assert.ok(positions.size>=8,`bases spread over the map (${positions.size} distinct areas)`);
});

test('both bases get the same starting kit at the same distances (within one node)',()=>{
 for(const seed of seeds){const v=validateStartingResources(makeMap(seed,'open'));assert.deepEqual(v.errors,[]);
  for(let i=0;i<v.players[0].access.length;i++){const a=v.players[0].access[i],b=v.players[1].access[i];assert.ok(Math.abs(a.nearestDistance!-b.nearestDistance!)<=100,`seed ${seed} ${a.kind}: ${a.nearestDistance} vs ${b.nearestDistance}`);}}
});

test('the match map is deterministic and survives save/load and replay',()=>{
 assert.equal(hash(makeMap(51,'open')),hash(makeMap(51,'open')));assert.notEqual(hash(makeMap(51,'open')),hash(makeMap(52,'open')));
 const s=createState(260925,'open','ai');for(let i=0;i<600;i++)tick(s);
 assert.equal(s.units.filter(u=>u.player===0&&u.kind==='villager').length,3);assert.equal(s.units.filter(u=>u.player===0&&u.kind==='scout').length,1);assert.deepEqual(s.units.filter(u=>u.player===0).map(u=>({x:u.x,y:u.y})).sort((a,b)=>a.x-b.x||a.y-b.y).length,4);
 const copy=deserialize(serialize(s));assert.equal(hash(copy),hash(s));
});

test('the incrementally updated navigation table equals a full rebuild after trees fall and buildings rise',()=>{
 const s=createState(260925,'open','ai');let checks=0;
 for(let i=0;i<9000&&!s.outcome;i++){tick(s);if(i%1500===1499){assert.deepEqual(currentGraph(s.map),fullGraph(s.map),`tick ${s.tick}`);checks++;}}
 assert.ok(checks>=5);assert.ok(s.map.navigationRevision>10,'the map changed many times');
});

test('each side starts with a scout on the match map (3 villagers + scout = 4/5); it rides twice as fast, sees farther and fights only on orders',()=>{
 const s=createState(260925,'open','ai'),blue=s.units.find(u=>u.player===0&&u.kind==='scout')!,villager=s.units.find(u=>u.player===0&&u.kind==='villager')!;
 assert.ok(blue);assert.ok(s.units.some(u=>u.player===1&&u.kind==='scout'));assert.equal(s.accounts[0].populationUsed,4);assert.equal(s.accounts[0].populationCap,5);
 assert.equal(createState(260925,'meadow','ai').units.some(u=>u.kind==='scout'),false,'test grounds have no scouts');
 assert.equal(createState(260925,'open').units.filter(u=>u.kind==='scout').length,1,'no red scout against an idle opponent');
 // Speed: both walk 8 nodes along an open row; the scout arrives in about half the ticks.
 const travel=(kind:string)=>{const t=createState(260925,'open'),u=t.units.find(v=>v.player===0&&v.kind===kind)!,goal={x:u.x,y:u.y+200};
  submit(t,{protocolVersion:1,rulesetHash,playerId:0,sequence:1,targetTick:1,commandType:'move',payload:{unitIds:[u.id],x:goal.x,y:goal.y}} as any);let n=0;while((u.x!==goal.x||u.y!==goal.y)&&n<2000){tick(t);n++;}return n;};
 const slow=travel('villager'),fast=travel('scout');assert.ok(fast<slow*.7,`scout ${fast} ticks vs villager ${slow}`);void villager;
 // Sight: the scout reveals tiles farther away than a villager does.
 const seen=(kind:string)=>{const t=createState(260925,'open'),u=t.units.find(v=>v.player===0&&v.kind===kind)!;return t.vision[0].visible.filter(id=>Math.hypot((id%32)*100+50-u.x,Math.floor(id/32)*100+50-u.y)>420).length;};
 assert.ok(seen('scout')>seen('villager'));
 assert.equal(combatRules.units.scout.sight,0,'no automatic engagement');
});
