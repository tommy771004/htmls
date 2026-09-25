import test from 'node:test';
import assert from 'node:assert/strict';
import {createVision,updateVision,projectVision,unitVisible} from '../packages/sim/vision.ts';
import {makeMap} from '../packages/sim/navigation.ts';
import {createState,hash,serialize,deserialize,replay,submit,tick,rulesetHash} from '../packages/sim/sim.ts';
import {createService,decodeView} from '../packages/sim/protocol.ts';

test('unexplored, visible and explored-unseen are distinct and enemy movement leaves no live projection',()=>{
 const map=makeMap(7);map.obstacles=[];const visions=createVision();
 updateVision(visions,map,[{player:0,x:350,y:700}],0);const initial=projectVision(visions[0]);assert.ok(initial.fog.includes(0));assert.ok(initial.fog.includes(2));assert.ok(!initial.fog.includes(1));
 const enemy={player:1,x:400,y:700};assert.ok(unitVisible(visions[0],enemy,0));
 updateVision(visions,map,[{player:0,x:1400,y:1400}],1);assert.equal(projectVision(visions[0]).fog[7*16+4],1);assert.equal(unitVisible(visions[0],enemy,0),false);
 const frozen=projectVision(visions[0]);enemy.x=500;updateVision(visions,map,[{player:0,x:1400,y:1400},enemy],2);assert.deepEqual(projectVision(visions[0]),frozen);
});
test('last-seen static objects freeze and disappear only upon revisiting their cell',()=>{
 const map=makeMap(7);map.obstacles=map.obstacles.filter(o=>o.kind!=='house');const object=map.obstacles[0],visions=createVision();
 updateVision(visions,map,[{player:0,x:object.x,y:object.y}],10);const remembered=visions[0].known.find(k=>k.obstacle.id===object.id)!;assert.equal(remembered.lastSeenTick,10);
 updateVision(visions,map,[],11);map.obstacles=map.obstacles.filter(o=>o!==object);updateVision(visions,map,[],12);assert.deepEqual(visions[0].known.find(k=>k.obstacle.id===object.id),remembered);
 updateVision(visions,map,[{player:0,x:object.x,y:object.y}],13);assert.equal(visions[0].known.some(k=>k.obstacle.id===object.id),false);
});
test('vision sharing is opt-in and revocation removes current visibility without erasing exploration',()=>{
 const map=makeMap(7);map.obstacles=[];const visions=createVision(),units=[{player:0,x:100,y:100},{player:1,x:1400,y:1400}];
 updateVision(visions,map,units,0);assert.equal(projectVision(visions[0]).fog[14*16+14],0);
 updateVision(visions,map,units,1,[[0,1],[1,0]]);assert.equal(projectVision(visions[0]).fog[14*16+14],2);
 updateVision(visions,map,units,2);assert.equal(projectVision(visions[0]).fog[14*16+14],1);const before=hash(visions);assert.throws(()=>updateVision(visions,map,units,3,[[2],[1]]));assert.equal(hash(visions),before);
});
test('Worker view excludes unseen enemy and unknown enemy buildings',()=>{
 const response=createService()({protocol:1,id:1,operation:{kind:'reset',seed:260925}});assert.ok(response.ok);const view=decodeView(response);assert.deepEqual(view.units.map(u=>u.id),[1,2,3]);assert.ok(view.known.every(k=>!k.obstacle.red));assert.ok(view.fog.includes(0));
});
test('exploration survives saves and command replay; old snapshot version is rejected',()=>{
 const s=createState(7);submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:1,targetTick:1,commandType:'move',payload:{unitId:1,x:1100,y:900}});for(let i=0;i<220;i++)tick(s);
 assert.deepEqual(deserialize(serialize(s)).vision,s.vision);assert.equal(hash(replay(s.seed,s.log,s.tick)),hash(s));
 const old=JSON.parse(serialize(s));old.format='brick-sandbox-4';assert.throws(()=>deserialize(JSON.stringify(old)),/版本/);
});
