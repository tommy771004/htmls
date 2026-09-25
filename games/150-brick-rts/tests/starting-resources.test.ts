import test from 'node:test';
import assert from 'node:assert/strict';
import {makeMap,validateStartingResources,clearSegment,createPathJob,advancePathJob} from '../packages/sim/navigation.ts';
import {createState,serialize,deserialize} from '../packages/sim/sim.ts';
test('all map modes provide bounded reachable starting supplies over varied seeds',()=>{
 for(const layout of ['meadow','coast','acceptance'] as const)for(const seed of [0,1,7,42,260925,4294967295]){
 const map=makeMap(seed,layout),report=validateStartingResources(map);assert.deepEqual(report.errors,[],`${layout}/${seed}`);
 for(const player of report.players)for(const access of player.access){assert.ok(access.available>=access.minimum);const node=access.nodes.reduce((a,b)=>a.distance<b.distance?a:b);assert.ok(node.approach);assert.ok(clearSegment(map,node.approach,node.approach));const job=createPathJob(map,1,player.spawn,node.approach);advancePathJob(map,job,961);assert.equal(job.status,'found');}
 }
});
test('missing stock fails generation-only fairness without declaring depleted runtime data invalid',()=>{
 const map=makeMap(7);for(const r of map.resources)if(r.kind==='gold')r.remaining=0;
 const result=validateStartingResources(map);assert.ok(result.errors.some(e=>e.includes('玩家 0 起始 gold')));assert.ok(result.errors.some(e=>e.includes('玩家 1 起始 gold')));
});
test('stock sealed behind blocking geometry is not counted as accessible supply',()=>{
 const map=makeMap(7);for(const r of map.resources)if(r.kind==='berries'){map.obstacles.push({id:`seal-${r.id}`,kind:'house',x:r.x-70,y:r.y-70});}
 const report=validateStartingResources(map);assert.ok(report.errors.some(e=>e.includes('berries')));
});
test('previous snapshot format fails explicitly after generation rules change',()=>{const snapshot=JSON.parse(serialize(createState(7)));snapshot.format='brick-sandbox-6';assert.throws(()=>deserialize(JSON.stringify(snapshot)),/版本/);});
