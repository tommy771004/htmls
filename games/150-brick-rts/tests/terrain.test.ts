import test from 'node:test';
import assert from 'node:assert/strict';
import {makeMap,validateMap,clearSegment,harvestMapResource,position} from '../packages/sim/navigation.ts';
import {terrainDefinitions,canTraverse} from '../packages/sim/terrain.ts';
import {hash,createState,serialize,deserialize,rulesetHash} from '../packages/sim/sim.ts';

test('seeded land maps have stable tiles, resource references and connected clear spawns',()=>{
 for(const seed of [0,1,7,42,260925,4294967295,...Array.from({length:24},(_,i)=>i*137)]){
 const a=makeMap(seed);assert.deepEqual(a,makeMap(seed));assert.deepEqual(validateMap(a),[]);assert.equal(a.tiles.length,256);assert.ok(a.resources.some(r=>r.kind==='tree'));assert.ok(a.generationAttempt<8);
 }
 for(const seed of [-1,NaN,1.5,4294967296])assert.throws(()=>makeMap(seed),/seed/);
});
test('terrain passage follows walk class and collider radius, not visual terrain name',()=>{
 const map=makeMap(7);map.obstacles=[];const tile=map.tiles[8*16+8];Object.assign(tile,terrainDefinitions.water,{terrainType:'water'});
 assert.equal(canTraverse(tile,'land'),false);assert.equal(canTraverse(tile,'water'),true);
 assert.equal(clearSegment(map,{x:750,y:850},{x:950,y:850}),false);
 assert.equal(clearSegment(map,{x:780,y:850},{x:780,y:850}),false);
 tile.walkClass='both';assert.equal(clearSegment(map,{x:750,y:850},{x:950,y:850}),true);
 tile.walkClass='blocked';assert.equal(canTraverse(tile,'water'),false);
});
test('finite resource depletion releases only local navigation and retains exhausted state',()=>{
 const map=makeMap(260925),node=map.resources.find(r=>r.kind==='tree')!;
 const before=hash(map);assert.throws(()=>harvestMapResource(map,node.id,-1,0));assert.equal(hash(map),before);
 const first=harvestMapResource(map,node.id,10,1);assert.equal(first.amount,10);assert.deepEqual(first.changedNodes,[]);assert.equal(map.navigationRevision,0);
 const oldBlocked=[...map.blocked],obstacle=node.obstacleId;
 const last=harvestMapResource(map,node.id,10000,2);assert.equal(last.amount,node.capacity-10);assert.equal(node.remaining,0);assert.equal(node.depletedAt,2);assert.equal(node.collectible,false);assert.equal(node.obstacleId,null);assert.equal(map.navigationRevision,1);
 assert.ok(!map.obstacles.some(o=>o.id===obstacle));assert.ok(map.tiles.every(t=>!t.obstacleRefs.includes(obstacle!)));
 assert.deepEqual(map.blocked,Array.from({length:961},(_,i)=>i).filter(i=>!clearSegment(map,position({size:16},i),position({size:16},i))));
 assert.deepEqual(last.changedNodes,oldBlocked.filter(i=>!map.blocked.includes(i)));
 assert.deepEqual(validateMap(map),[]);const depleted=hash(map);assert.deepEqual(harvestMapResource(map,node.id,1,3),{amount:0,changedNodes:[]});assert.equal(hash(map),depleted);
});
test('map validation rejects bad refs, capacities, blocked spawns and disconnected starts',()=>{
 const bad=makeMap(7);bad.tiles[0].resourceRefs.push('missing');bad.resources[0].remaining=-1;assert.ok(validateMap(bad).some(e=>e.includes('參照')));assert.ok(validateMap(bad).some(e=>e.includes('容量')));
 const blocked=makeMap(7);Object.assign(blocked.tiles[7*16+3],terrainDefinitions.water);assert.ok(validateMap(blocked).includes('出生點不可通行'));
 const split=makeMap(7);for(let y=0;y<16;y++)Object.assign(split.tiles[y*16+8],terrainDefinitions.water);split.blocked=Array.from({length:961},(_,i)=>i).filter(i=>!clearSegment(split,position({size:16},i),position({size:16},i)));assert.ok(validateMap(split).includes('玩家出生區互不連通'));
});
test('resource and terrain state are canonical snapshot data; v3 is explicitly rejected',()=>{
 const state=createState(7);assert.deepEqual(deserialize(serialize(state)),state);
 const old=JSON.parse(serialize(state));old.format='brick-sandbox-3';assert.throws(()=>deserialize(JSON.stringify(old)),/版本/);
 const altered=JSON.parse(serialize(state));altered.state.map.resources[0].remaining--;altered.checksum=hash(altered.state);assert.throws(()=>deserialize(JSON.stringify(altered)),/重建/);
 assert.equal(typeof rulesetHash,'string');
});
