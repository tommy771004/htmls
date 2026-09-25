import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,hash,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {makeUnit,nodeAt} from '../packages/sim/movement.ts';
import {clearSegment,position} from '../packages/sim/navigation.ts';
import type {Obstacle} from '../packages/sim/navigation.ts';
import {createTiles} from '../packages/sim/terrain.ts';
let sequence=0;
function order(s:State,unitIds:number[],x:number,y:number,commandType:'move'|'stop'='move'){
 sequence=s.sequence[0]+1;
 submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence,targetTick:s.tick+1,commandType,payload:commandType==='move'?{unitIds,x,y}:{unitIds}} as any);
}
function addUnits(s:State,nodes:[number,number][],firstId=10){
 const taken=new Set(s.units.map(u=>u.node));let id=firstId;
 for(const [x,y] of nodes){const n=nodeAt({x,y});if(n<0||s.map.blocked.includes(n)||taken.has(n))continue;taken.add(n);s.units.push(makeUnit(id++,0,x,y));}
 s.units.sort((a,b)=>a.id-b.id);return s.units.filter(u=>u.id>=firstId).map(u=>u.id);
}
// Unit bodies are 50x50 squares on the nav grid: centres must stay at least 50 apart on some axis.
function assertNoOverlap(s:State){for(let i=0;i<s.units.length;i++)for(let j=i+1;j<s.units.length;j++){const a=s.units[i],b=s.units[j];assert.ok(Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))>=50,`tick ${s.tick}: units ${a.id} and ${b.id} overlap at (${a.x},${a.y}) (${b.x},${b.y})`);}}
function run(s:State,limit:number,done:(s:State)=>boolean){const log={waitTicks:0,maxExpanded:0};for(let i=0;i<limit;i++){const before=s.units.map(u=>({x:u.x,y:u.y}));const stats=tick(s);log.maxExpanded=Math.max(log.maxExpanded,stats.expanded);s.units.forEach((u,k)=>assert.ok(clearSegment(s.map,before[k],u)));assertNoOverlap(s);log.waitTicks+=s.units.filter(u=>u.navigation==='waiting').length;if(done(s))return {...log,ticks:i+1};}assert.fail(`not settled after ${limit} ticks: `+JSON.stringify(s.units.map(u=>[u.id,u.x,u.y,u.navigation])));}
const settled=(ids:number[])=>(s:State)=>s.pathJobs.length===0&&ids.every(id=>{const u=s.units.find(u=>u.id===id)!;return u.next===null&&!u.path.length&&u.navigation!=='searching';});
const blockSouthOfHall:[number,number][]=[250,300,500,550].flatMap(x=>[750,800,850].map(y=>[x,y] as [number,number]));

test('a group order assigns distinct stations and every unit arrives without overlap',()=>{
 const s=createState(260925);order(s,[1,2,3],800,900);
 const r=run(s,1500,settled([1,2,3]));
 const stations=s.units.filter(u=>u.player===0).map(u=>u.node);assert.equal(new Set(stations).size,3);
 assert.ok(s.units.filter(u=>u.player===0).every(u=>u.navigation==='idle'&&Math.abs(u.x-800)+Math.abs(u.y-900)<=150),JSON.stringify(s.units));
 assert.ok(r.maxExpanded<=32);
});
test('fifteen villagers queue single file through the town-center gate and nobody gets stuck',()=>{
 const s=createState(260925),extra=addUnits(s,blockSouthOfHall),ids=[1,2,3,...extra];assert.ok(extra.length>=10);
 order(s,ids,400,400);let throughGate=new Set<number>();
 const r=run(s,6000,t=>{for(const u of t.units)if(u.x===400&&u.y>=500&&u.y<=525)throughGate.add(u.id);return settled(ids)(t);});
 assert.ok(throughGate.size>=3,`only ${throughGate.size} crossed the arch`);
 assert.equal(s.units.filter(u=>u.navigation==='stuck').length,0);
 assert.ok(r.waitTicks>0,'a real queue formed');
 assert.equal(new Set(s.units.map(u=>u.node)).size,s.units.length);
});
test('two villagers meeting head-on in the gate resolve by one rerouting around the hall',()=>{
 const s=createState(260925);s.units=[makeUnit(1,0,400,400),makeUnit(2,0,400,750),makeUnit(4,1,1150,700)];
 order(s,[1],400,850);order(s,[2],400,250);
 run(s,3000,settled([1,2]));
 const [a,b]=s.units;assert.deepEqual([a.x,a.y,a.navigation],[400,850,'idle']);assert.deepEqual([b.x,b.y,b.navigation],[400,250,'idle']);
});
test('a dead-end corridor reports stuck instead of jittering, and the rest of the group still arrives',()=>{
 const s=createState(260925);
 // Rock walls leave one lane at y=700 from x=550, closed at the east end.
 const walls:Obstacle[]=[];for(let x=500;x<=1100;x+=100)walls.push({kind:'rock',x,y:600},{kind:'rock',x,y:730});walls.push({kind:'rock',x:1180,y:660});
 walls.forEach((o,i)=>o.id=`wall-${i}`);s.map.obstacles.push(...walls);s.map.blocked=[];for(let i=0;i<961;i++)if(!clearSegment(s.map,position(i),position(i)))s.map.blocked.push(i);s.map.navigationRevision++;
 s.units=[makeUnit(1,0,600,700),makeUnit(2,0,1050,700),makeUnit(3,0,350,1100),makeUnit(4,1,1450,1450)];
 order(s,[1],1050,700);order(s,[2,3],350,700);
 run(s,4000,settled([1,2,3]));
 const [a,b,c]=s.units;
 assert.equal(c.navigation,'idle');assert.ok(Math.abs(c.x-350)+Math.abs(c.y-700)<=100,'free member arrives');
 assert.ok([a,b].some(u=>u.navigation==='stuck'),JSON.stringify(s.units.map(u=>[u.id,u.x,u.y,u.navigation])));
});
test('stop ends movement at the next node and clears pending search',()=>{
 const s=createState(7);order(s,[1],1200,1000);for(let i=0;i<23;i++)tick(s);
 order(s,[1],0,0,'stop');run(s,20,settled([1]));
 const u=s.units[0];assert.equal(u.navigation,'idle');assert.ok(nodeAt(u)>=0);assert.equal(s.pathJobs.length,0);
});
test('a member sealed in a pocket reports unreachable without stalling the others',()=>{
 const s=createState(260925);
 const ring:Obstacle[]=[{kind:'rock',x:830,y:1150},{kind:'rock',x:700,y:1150},{kind:'rock',x:750,y:1060},{kind:'rock',x:750,y:1240}];
 ring.forEach((o,i)=>o.id=`ring-${i}`);s.map.obstacles.push(...ring);s.map.blocked=[];for(let i=0;i<961;i++)if(!clearSegment(s.map,position(i),position(i)))s.map.blocked.push(i);s.map.navigationRevision++;
 assert.equal(s.map.blocked.includes(nodeAt({x:800,y:1200})),false);
 s.units=[makeUnit(1,0,800,1200),makeUnit(2,0,450,700),makeUnit(3,0,400,800),makeUnit(4,1,1150,700)];
 order(s,[1,2,3],700,900);run(s,1500,settled([1,2,3]));
 assert.deepEqual(s.units.map(u=>u.navigation),['unreachable','idle','idle','idle']);assert.deepEqual([s.units[0].x,s.units[0].y],[800,1200]);
});
test('crowded movement is deterministic across snapshot continuation and replay',()=>{
 const make=()=>{const s=createState(260925);addUnits(s,blockSouthOfHall);return s;};
 const a=make(),ids=a.units.filter(u=>u.player===0).map(u=>u.id);order(a,ids,400,400);for(let i=0;i<120;i++)tick(a);
 // Extra units are injected outside the command log, so continue from a JSON copy rather than a replayed save.
 const restored=JSON.parse(JSON.stringify(a)) as State;for(let i=0;i<400;i++){tick(a);tick(restored);}
 assert.equal(hash(a),hash(restored));
 const b=make();order(b,ids,400,400);for(let i=0;i<520;i++)tick(b);assert.equal(hash(a),hash(b));
});
test('group commands reject empty, unsorted, duplicate, oversized or enemy unit lists without side effects',()=>{
 const s=createState(7),before=hash(s);
 for(const unitIds of [[],[2,1],[1,1],[4],[1,99],Array.from({length:41},(_,i)=>i+1)])assert.throws(()=>submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:1,targetTick:1,commandType:'move',payload:{unitIds,x:800,y:900}}));
 assert.equal(hash(s),before);
});
