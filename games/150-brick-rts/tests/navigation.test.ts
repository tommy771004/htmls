import test from 'node:test';
import assert from 'node:assert/strict';
import {makeMap,clearSegment,position,createPathJob,advancePathJob,navigationRules} from '../packages/sim/navigation.ts';
import type {MapData,Obstacle} from '../packages/sim/navigation.ts';
import {createTiles} from '../packages/sim/terrain.ts';
import {createState,submit,tick,hash,serialize,deserialize,rulesetHash,replay} from '../packages/sim/sim.ts';
function mapWith(obstacles:Obstacle[]):MapData{const m:MapData={obstacles,blocked:[],tiles:createTiles(),resources:[],navigationRevision:0,generationAttempt:0};for(let i=0;i<961;i++)if(!clearSegment(m,position(i),position(i)))m.blocked.push(i);return m;}
test('fixed-budget search preserves frontier across snapshots and routes through the town-center gate',()=>{
 // Blue town center at (265,350): gate centre x=400, arch band y 500-525, hall behind it.
 const s=createState(260925);submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:1,targetTick:1,commandType:'move',payload:{unitIds:[1],x:400,y:420}});assert.ok(tick(s).expanded<=navigationRules.expansionsPerTick);
 const restored=deserialize(serialize(s));let throughGate=false;
 for(let i=0;i<1500;i++){const before={...s.units[0]};tick(s);tick(restored);assert.ok(clearSegment(s.map,before,s.units[0]));if(s.units[0].y>=500&&s.units[0].y<=525){assert.equal(s.units[0].x,400);throughGate=true;}}
 // Standing positions snap to the nearest reachable navigation node.
 assert.equal(s.units[0].x,400);assert.equal(s.units[0].y,400);assert.equal(s.units[0].navigation,'idle');assert.equal(throughGate,true);assert.equal(hash(s),hash(restored));assert.equal(hash(s),hash(replay(s.seed,s.log,s.tick)));
});
test('a solid house footprint still forces a detour',()=>{
 const map=mapWith([{kind:'house',x:300,y:400}]),job=createPathJob(map,1,{x:350,y:700},{x:350,y:300});advancePathJob(map,job,961);
 assert.equal(job.status,'found');assert.ok(job.path.some(p=>p.x<260||p.x>560));assert.ok(job.path.every((p,i)=>i===0||clearSegment(map,job.path[i-1],p)));
});
test('blocked command is rejected before changing sequence, log or current work',()=>{const s=createState(42),before=hash(s);assert.throws(()=>submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:1,targetTick:1,commandType:'move',payload:{unitIds:[1],x:300,y:450}}),/占地/);assert.equal(hash(s),before);});
test('unreachable search terminates; serialized work produces identical path',()=>{
 const wall=mapWith(Array.from({length:16},(_,i)=>({kind:'rock' as const,x:750,y:i*100-20}))); // Expand rocks enough to close 30-unit gaps with unit radius.
 const job=createPathJob(wall,1,{x:350,y:700},{x:1100,y:700});for(let i=0;i<2000&&job.status==='searching';i++)assert.ok(advancePathJob(wall,job,1)<=1);assert.equal(job.status,'unreachable');
 const map=makeMap(7),a=createPathJob(map,1,{x:350,y:700},{x:800,y:800});advancePathJob(map,a,5);const b=JSON.parse(JSON.stringify(a));while(a.status==='searching')advancePathJob(map,a,32);while(b.status==='searching')advancePathJob(map,b,7);assert.deepEqual(a.path,b.path);
});
test('a replacement order takes a unit out of its old group while the rest keep the first order',()=>{
 const s=createState(7);submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:1,targetTick:1,commandType:'move',payload:{unitIds:[1,2,3],x:1200,y:1000}});assert.ok(tick(s).expanded<=navigationRules.expansionsPerTick);
 submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:2,targetTick:2,commandType:'move',payload:{unitIds:[1],x:600,y:900}});
 for(let i=0;i<2000&&!(i>2&&s.pathJobs.length===0&&s.units.every(u=>u.next===null&&!u.path.length));i++)tick(s);
 const near=(u:{x:number;y:number},x:number,y:number)=>Math.abs(u.x-x)+Math.abs(u.y-y)<=150;
 assert.ok(near(s.units[0],600,900));assert.ok(near(s.units[1],1200,1000)&&near(s.units[2],1200,1000));
});
test('non-grid destinations snap to the nearest reachable node and every step stays clear',()=>{
 const s=createState(9);for(const [i,[p,node]] of [[{x:611,y:913},{x:600,y:900}],[{x:323,y:283},{x:300,y:300}],[{x:723,y:817},{x:700,y:800}]].entries()){
 submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:i+1,targetTick:s.tick+1,commandType:'move',payload:{unitIds:[1],...p}});
 for(let n=0;n<2000;n++){const before={...s.units[0]};tick(s);assert.ok(clearSegment(s.map,before,s.units[0]));if(n>2&&s.units[0].navigation==='idle')break;}
 assert.equal(s.units[0].x,node.x);assert.equal(s.units[0].y,node.y);
 }
});

test('old snapshot version is rejected explicitly without mutating current state',()=>{const s=createState(7);const before=hash(s);assert.throws(()=>deserialize(JSON.stringify({format:'brick-sandbox-1',rulesetHash,state:s,checksum:hash(s)})),/版本/);assert.equal(hash(s),before);});
