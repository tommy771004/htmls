import test from 'node:test';
import assert from 'node:assert/strict';
import {makeMap,clearSegment,position,createPathJob,advancePathJob} from '../packages/sim/navigation.ts';
import type {MapData,Obstacle} from '../packages/sim/navigation.ts';
import {createTiles} from '../packages/sim/terrain.ts';
import {createState,submit,tick,hash,serialize,deserialize,rulesetHash,replay} from '../packages/sim/sim.ts';
function mapWith(obstacles:Obstacle[]):MapData{const m:MapData={obstacles,blocked:[],tiles:createTiles(),resources:[],navigationRevision:0,generationAttempt:0};for(let i=0;i<961;i++)if(!clearSegment(m,position(i),position(i)))m.blocked.push(i);return m;}
test('fixed-budget search preserves frontier across snapshots and routes around a house',()=>{
 const s=createState(260925);submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:1,targetTick:1,commandType:'move',payload:{unitId:1,x:350,y:300}});tick(s);assert.ok(s.pathJobs.length);assert.ok(s.pathJobs[0].head<=32);
 const restored=deserialize(serialize(s));let wentAround=false;
 for(let i=0;i<1500;i++){const before={...s.units[0]};tick(s);tick(restored);assert.ok(clearSegment(s.map,before,s.units[0]));if(s.units[0].x<260||s.units[0].x>560)wentAround=true;}
 assert.equal(s.units[0].x,350);assert.equal(s.units[0].y,300);assert.equal(s.units[0].navigation,'idle');assert.equal(wentAround,true);assert.equal(hash(s),hash(restored));assert.equal(hash(s),hash(replay(s.seed,s.log,s.tick)));
});
test('blocked command is rejected before changing sequence, log or current work',()=>{const s=createState(42),before=hash(s);assert.throws(()=>submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:1,targetTick:1,commandType:'move',payload:{unitId:1,x:400,y:500}}),/占地/);assert.equal(hash(s),before);});
test('unreachable search terminates; serialized work produces identical path',()=>{
 const wall=mapWith(Array.from({length:16},(_,i)=>({kind:'rock' as const,x:750,y:i*100-20}))); // Expand rocks enough to close 30-unit gaps with unit radius.
 const job=createPathJob(wall,1,{x:350,y:700},{x:1100,y:700});for(let i=0;i<2000&&job.status==='searching';i++)assert.ok(advancePathJob(wall,job,1)<=1);assert.equal(job.status,'unreachable');
 const map=makeMap(7),a=createPathJob(map,1,{x:350,y:700},{x:800,y:800});advancePathJob(map,a,5);const b=JSON.parse(JSON.stringify(a));while(a.status==='searching')advancePathJob(map,a,32);while(b.status==='searching')advancePathJob(map,b,7);assert.deepEqual(a.path,b.path);
});
test('all moving units share a 32-node budget, and replacement commands cancel old jobs',()=>{
 const s=createState(7);for(let id=1;id<=3;id++)submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:id,targetTick:1,commandType:'move',payload:{unitId:id,x:1200,y:1000}});tick(s);assert.equal(s.pathJobs.reduce((n,j)=>n+j.head,0),32);assert.ok(s.pathJobs.every(j=>j.head>0));
 submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:4,targetTick:2,commandType:'move',payload:{unitId:1,x:600,y:900}});tick(s);assert.equal(s.pathJobs.filter(j=>j.unitId===1).length,1);assert.deepEqual(s.units[0].target,{x:600,y:900});
});
test('arbitrary non-grid destinations stay clear through successive orders',()=>{
 const s=createState(9);for(const [i,p] of [{x:611,y:913},{x:323,y:283},{x:723,y:817}].entries()){
 submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:i+1,targetTick:s.tick+1,commandType:'move',payload:{unitId:1,...p}});
 for(let n=0;n<2000;n++){const before={...s.units[0]};tick(s);assert.ok(clearSegment(s.map,before,s.units[0]));if(s.units[0].navigation==='idle')break;}
 assert.equal(s.units[0].x,p.x);assert.equal(s.units[0].y,p.y);
 }
});

test('old snapshot version is rejected explicitly without mutating current state',()=>{const s=createState(7);const before=hash(s);assert.throws(()=>deserialize(JSON.stringify({format:'brick-sandbox-1',rulesetHash,state:s,checksum:hash(s)})),/版本/);assert.equal(hash(s),before);});
