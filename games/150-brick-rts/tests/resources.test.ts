import test from 'node:test';
import assert from 'node:assert/strict';
import {makeMap,validateMap,harvestMapResource,clearSegment,isBuilding} from '../packages/sim/navigation.ts';
import {resourceDefinitions,terrainRules} from '../packages/sim/terrain.ts';
import {createVision,updateVision,projectVision} from '../packages/sim/vision.ts';
test('coastal resources cover seven kinds with explicit method, yield and finite capacity',()=>{
 const map=makeMap(260925,'coast');// Farms are player-built (buildings.ts); the generator places the seven natural kinds.
 assert.deepEqual([...new Set(map.resources.map(r=>r.kind))].sort(),Object.keys(resourceDefinitions).filter(k=>k!=='farm').sort());
 for(const r of map.resources){assert.equal(r.capacity,terrainRules.resourceCapacity[r.kind]);const amount=harvestMapResource(map,r.id,r.capacity+1,10);assert.equal(amount.amount,r.capacity);assert.equal(harvestMapResource(map,r.id,1,11).amount,0);assert.equal(r.collectible,false);}
 assert.deepEqual(validateMap(map),[]);
});
test('animal proxies block movement until depleted; fish do not block navigation',()=>{
 const map=makeMap(7,'coast'),animal=map.resources.find(r=>r.kind==='livestock')!,fish=map.resources.find(r=>r.kind==='fish')!;
 assert.equal(clearSegment(map,animal,animal),false);const result=harvestMapResource(map,animal.id,animal.remaining,1);assert.ok(result.changedNodes.length>0);assert.equal(clearSegment(map,animal,animal),true);
 assert.equal(fish.obstacleId,null);assert.equal(clearSegment(map,fish,fish,'water'),true);
});
test('visible resource projection cannot leak hidden capacity or living-animal memory',()=>{
 const map=makeMap(7,'coast'),visions=createVision(),animal=map.resources.find(r=>r.kind==='hunt')!;map.obstacles=map.obstacles.filter(o=>!isBuilding(o));
 updateVision(visions,map,[{player:0,x:animal.x,y:animal.y}],0);assert.ok(projectVision(visions[0]).resources.some(r=>r.id===animal.id));
 updateVision(visions,map,[],1);assert.equal(projectVision(visions[0]).resources.length,0);assert.ok(!visions[0].known.some(k=>k.obstacle.kind==='hunt'||k.obstacle.kind==='livestock'));
 const before=projectVision(visions[0]);harvestMapResource(map,animal.id,1,2);updateVision(visions,map,[],2);assert.deepEqual(projectVision(visions[0]),before);
});
test('resource terrain validation catches fish placed on land',()=>{const map=makeMap(7,'coast'),fish=map.resources.find(r=>r.kind==='fish')!;fish.x=350;fish.y=700;assert.ok(validateMap(map).some(e=>e.includes('地形不符')));});
