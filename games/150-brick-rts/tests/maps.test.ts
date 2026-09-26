import test from 'node:test';
import assert from 'node:assert/strict';
import {makeMap,validateMap,clearSegment,createPathJob,advancePathJob,position} from '../packages/sim/navigation.ts';
import {terrainDefinitions} from '../packages/sim/terrain.ts';
import type {MapData,Point} from '../packages/sim/navigation.ts';
function route(map:MapData,a:Point,b:Point,movement:'land'|'water'){
 const job=createPathJob(map,1,a,b,movement);for(let i=0;i<32&&job.status==='searching';i++)advancePathJob(map,job,32);return job;
}
test('coastal generation reproduces connected land, sea and explicit shore tiles over seeds',()=>{
 for(const seed of [0,1,7,42,260925,4294967295]){const map=makeMap(seed,'coast');assert.deepEqual(map,makeMap(seed,'coast'));assert.deepEqual(validateMap(map),[]);
 assert.ok(map.tiles.some(t=>t.terrainType==='sand'));assert.ok(map.tiles.some(t=>t.terrainType==='water'));
 assert.ok(map.obstacles.every(o=>map.tiles[Math.floor(o.y/100)*16+Math.floor(o.x/100)].walkClass==='land'));
 assert.equal(route(map,{x:200,y:1450},{x:1400,y:1450},'water').status,'found');
 assert.equal(clearSegment(map,{x:800,y:1450},{x:800,y:1450}),false);
 }
});
test('hand-built acceptance map supports land crossing and a continuous water route',()=>{
 const map=makeMap(0,'acceptance');assert.deepEqual(map,makeMap(42,'acceptance'));assert.deepEqual(validateMap(map),[]);
 const land=route(map,{x:350,y:700},{x:1150,y:700},'land');assert.equal(land.status,'found');assert.ok(land.path.some(p=>p.x>=725&&p.x<=875&&p.y>=725&&p.y<=975));
 const water=route(map,{x:800,y:200},{x:800,y:1400},'water');assert.equal(water.status,'found');
 for(let i=1;i<water.path.length;i++)assert.equal(clearSegment(map,water.path[i-1],water.path[i],'water'),true);
 assert.equal(clearSegment(map,{x:800,y:600},{x:800,y:600}),false);assert.equal(clearSegment(map,{x:800,y:800},{x:800,y:800}),true);
 assert.equal(clearSegment(map,{x:600,y:800},{x:600,y:800},'water'),false);
});
test('closing the shallow passage terminates search and fails spawn connectivity',()=>{
 const map=makeMap(0,'acceptance');for(const tile of map.tiles)if(tile.terrainType==='shallow')Object.assign(tile,terrainDefinitions.water,{terrainType:'water'});
 map.blocked=Array.from({length:961},(_,i)=>i).filter(i=>!clearSegment(map,position({size:16},i),position({size:16},i)));
 assert.equal(route(map,{x:350,y:700},{x:1150,y:700},'land').status,'unreachable');assert.ok(validateMap(map).includes('玩家出生區互不連通'));
});
test('water movement respects radius at a one-cell shore and survives serialized path work',()=>{
 const map=makeMap(0,'acceptance');assert.equal(clearSegment(map,{x:720,y:200},{x:720,y:600},'water'),false);assert.equal(clearSegment(map,{x:750,y:200},{x:750,y:600},'water'),true);
 const a=createPathJob(map,1,{x:800,y:200},{x:800,y:1400},'water');advancePathJob(map,a,2);const b=JSON.parse(JSON.stringify(a));while(a.status==='searching')advancePathJob(map,a,32);while(b.status==='searching')advancePathJob(map,b,1);assert.deepEqual(a,b);
});
