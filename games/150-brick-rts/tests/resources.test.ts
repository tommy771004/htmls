import test from 'node:test';
import assert from 'node:assert/strict';
import {makeMap,validateMap,harvestMapResource,clearSegment,isBuilding} from '../packages/sim/navigation.ts';
import {resourceDefinitions,terrainRules} from '../packages/sim/terrain.ts';
import {createVision,updateVision,projectVision} from '../packages/sim/vision.ts';
import {makeCarcass,animalRules} from '../packages/sim/fauna.ts';
test('coastal resources cover five natural kinds with explicit method, yield and finite capacity; animals start as units',()=>{
 const map=makeMap(260925,'coast');// Farms and fish traps are player-built (buildings.ts); hunt and livestock are carcasses of animals (fauna.ts).
 assert.deepEqual([...new Set(map.resources.map(r=>r.kind))].sort(),Object.keys(resourceDefinitions).filter(k=>!['farm','fish-trap','hunt','livestock'].includes(k)).sort());
 assert.deepEqual([...new Set(map.animals!.map(a=>a.kind))].sort(),['deer','sheep']);assert.ok(map.animals!.every(a=>clearSegment(map,a,a)));
 for(const r of map.resources){assert.equal(r.capacity,terrainRules.resourceCapacity[r.kind]);const amount=harvestMapResource(map,r.id,r.capacity+1,10);assert.equal(amount.amount,r.capacity);assert.equal(harvestMapResource(map,r.id,1,11).amount,0);assert.equal(r.collectible,false);}
 assert.deepEqual(validateMap(map),[]);
});
test('carcasses and fish never block navigation; a carcass holds the animal\'s food and runs out like any source',()=>{
 const map=makeMap(7,'coast'),sheep=map.animals!.find(a=>a.kind==='sheep')!,fish=map.resources.find(r=>r.kind==='fish')!;
 makeCarcass(map,{...sheep,id:animalRules.firstId});const carcass=map.resources.at(-1)!;
 assert.equal(carcass.kind,'livestock');assert.equal(carcass.capacity,animalRules.food.sheep);assert.equal(carcass.obstacleId,null);assert.equal(clearSegment(map,carcass,carcass),true);
 assert.equal(harvestMapResource(map,carcass.id,carcass.remaining,1).changedNodes.length,0);assert.equal(carcass.status,'depleted');assert.deepEqual(validateMap(map),[]);
 assert.equal(fish.obstacleId,null);assert.equal(clearSegment(map,fish,fish,'water'),true);
});
test('visible resource projection cannot leak hidden capacity or carcass memory',()=>{
 const map=makeMap(7,'coast'),visions=createVision();makeCarcass(map,{...map.animals!.find(a=>a.kind==='deer')!,id:animalRules.firstId});const animal=map.resources.at(-1)!;map.obstacles=map.obstacles.filter(o=>!isBuilding(o));
 updateVision(visions,map,[{player:0,x:animal.x,y:animal.y}],0);assert.ok(projectVision(visions[0],16).resources.some(r=>r.id===animal.id));
 updateVision(visions,map,[],1);assert.equal(projectVision(visions[0],16).resources.length,0);assert.ok(!visions[0].known.some(k=>k.obstacle.kind==='hunt'||k.obstacle.kind==='livestock'));
 const before=projectVision(visions[0],16);harvestMapResource(map,animal.id,1,2);updateVision(visions,map,[],2);assert.deepEqual(projectVision(visions[0],16),before);
});
test('resource terrain validation catches fish placed on land',()=>{const map=makeMap(7,'coast'),fish=map.resources.find(r=>r.kind==='fish')!;fish.x=350;fish.y=700;assert.ok(validateMap(map).some(e=>e.includes('地形不符')));});
