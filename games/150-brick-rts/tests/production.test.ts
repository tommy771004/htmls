import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,hash,serialize,deserialize,replay,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {authoritativeProblem} from '../packages/sim/buildings.ts';
import {makeUnit} from '../packages/sim/movement.ts';
import {position,navigationRules} from '../packages/sim/navigation.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
function order(s:State,commandType:string,payload:any){submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:s.sequence[0]+1,targetTick:s.tick+1,commandType,payload} as any);}
const tc=(s:State)=>s.buildings.find(b=>b.kind==='town-center'&&b.player===0)!;
function barracks(s:State){s.vision[0].explored=Array.from({length:256},(_,i)=>i);s.accounts[0].stock.wood+=150;
 for(let y=650;y<=1200;y+=50)for(let x=500;x<=1100;x+=50)if(!authoritativeProblem(s,0,'barracks',x,y)){order(s,'build',{unitIds:[1,2,3],kind:'barracks',x,y});for(let i=0;i<3000&&!s.buildings.some(b=>b.kind==='barracks'&&b.complete);i++)tick(s);return s.buildings.find(b=>b.kind==='barracks')!;}
 throw Error('no barracks spot');}
const run=(s:State,n:number)=>{for(let i=0;i<n;i++)tick(s);};

test('a villager is paid and housed when queued, then walks out of the town center',()=>{
 const s=createState(260925);order(s,'train',{buildingId:tc(s).id,entryId:'villager'});tick(s);
 const a=s.accounts[0];assert.equal(a.stock.food,150);assert.equal(a.populationReserved,1);assert.equal(tc(s).queue.length,1);
 run(s,400);const v=s.units.find(u=>u.id===5)!;assert.ok(v,'spawned');assert.equal(v.kind,'villager');assert.equal(v.player,0);
 assert.equal(a.populationUsed,4);assert.equal(a.populationReserved,0);assert.equal(tc(s).queue.length,0);
 const box=obstacleBounds(s.map.obstacles.find(o=>o.id===tc(s).id)!,navigationRules.radius);assert.ok(!(v.x>box[0]&&v.x<box[2]&&v.y>box[1]&&v.y<box[3]),'outside the footprint');
});
test('housing limits the queue; only the first item advances; cancelling refunds',()=>{
 const s=createState(260925),id=tc(s).id;order(s,'train',{buildingId:id,entryId:'villager'});order(s,'train',{buildingId:id,entryId:'villager'});tick(s);
 assert.throws(()=>order(s,'train',{buildingId:id,entryId:'villager'}),/人口已滿（5\/5）/);
 run(s,100);const [first,second]=tc(s).queue;assert.equal(first.work,101);assert.equal(second.work,0);
 order(s,'cancelTrain',{buildingId:id,itemId:second.id});tick(s);assert.equal(s.accounts[0].stock.food,150);assert.equal(s.accounts[0].populationReserved,1);assert.equal(tc(s).queue.length,1);
 assert.throws(()=>order(s,'cancelTrain',{buildingId:id,itemId:second.id}),/不存在/);
});
test('militia need a finished barracks and cannot gather or build',()=>{
 const s=createState(260925);assert.throws(()=>order(s,'train',{buildingId:tc(s).id,entryId:'militia'}),/不能生產/);
 const b=barracks(s);assert.ok(b.complete);order(s,'train',{buildingId:b.id,entryId:'militia'});run(s,420);
 const m=s.units.find(u=>u.kind==='militia')!;assert.ok(m);assert.equal(s.accounts[0].stock.gold,80);
 const tree=s.map.resources.find(r=>r.kind==='tree'&&r.collectible)!;assert.throws(()=>order(s,'gather',{unitIds:[m.id],resourceId:tree.id}),/只有村民/);
 assert.throws(()=>order(s,'train',{buildingId:b.id,entryId:'archer'}),/需要第二時代/);
});
test('advancing to the second age is researched once, unlocks archers and restyles own buildings',()=>{
 const s=createState(260925);s.accounts[0].stock.food=800;const id=tc(s).id;order(s,'train',{buildingId:id,entryId:'age-2'});tick(s);
 assert.throws(()=>order(s,'train',{buildingId:id,entryId:'age-2'}),/已在研究中/);assert.throws(()=>order(s,'train',{buildingId:id,entryId:'age-3'}),/需要第二時代/);
 run(s,400);assert.equal(s.ages[0],2);assert.equal(s.ages[1],1);assert.throws(()=>order(s,'train',{buildingId:id,entryId:'age-2'}),/已研究/);
 assert.equal(s.map.obstacles.find(o=>o.id===id)!.age,2);assert.equal(s.map.obstacles.find(o=>o.kind==='town-center'&&o.red)!.age,1);
 const b=barracks(s);assert.equal(s.map.obstacles.find(o=>o.id===b.id)!.age,2);s.accounts[0].populationCap=10;order(s,'train',{buildingId:b.id,entryId:'archer'});tick(s);assert.equal(b.queue[0].entryId,'archer');
});
test('a finished unit waits at a blocked exit and walks out once a spot frees up',()=>{
 const s=createState(260925),t=tc(s),box=obstacleBounds(s.map.obstacles.find(o=>o.id===t.id)!,navigationRules.radius);
 let id=100;const held=new Set(s.units.map(u=>u.node));
 for(let n=0;n<961;n++){if(s.map.blocked.includes(n)||held.has(n))continue;const p=position(n),g=Math.max(box[0]-p.x,0,p.x-box[2])+Math.max(box[1]-p.y,0,p.y-box[3]);if(g>0&&g<=50)s.units.push(makeUnit(id++,0,p.x,p.y));}
 order(s,'train',{buildingId:t.id,entryId:'villager'});run(s,450);assert.equal(t.queue.length,1);assert.equal(t.queue[0].work,t.queue[0].required);assert.equal(s.units.some(u=>u.id===5),false);
 const gone=s.units.find(u=>u.id===100)!;s.units=s.units.filter(u=>u!==gone);tick(s);assert.ok(s.units.some(u=>u.id===5));assert.equal(t.queue.length,0);
});
test('a rally point sends new units there',()=>{
 const s=createState(260925),t=tc(s);order(s,'rally',{buildingId:t.id,x:700,y:900});order(s,'train',{buildingId:t.id,entryId:'villager'});run(s,700);
 const v=s.units.find(u=>u.id===5)!;assert.equal(v.navigation,'idle');assert.ok(Math.abs(v.x-700)+Math.abs(v.y-900)<=100,JSON.stringify(v));
});
test('production survives save/load and replays to the same hash',()=>{
 const s=createState(260925),id=tc(s).id;order(s,'train',{buildingId:id,entryId:'villager'});order(s,'train',{buildingId:id,entryId:'villager'});run(s,300);
 const restored=deserialize(serialize(s));run(s,600);run(restored,600);assert.equal(hash(s),hash(restored));assert.equal(hash(s),hash(replay(s.seed,s.log,s.tick)));assert.equal(s.units.filter(u=>u.player===0).length,5);
});

test('a rally point on a building is refused; one covered later by a new building is skipped without error',()=>{
 const s=createState(260925),t=tc(s),other=s.map.obstacles.find(o=>o.kind==='town-center'&&o.red)!;
 assert.throws(()=>order(s,'rally',{buildingId:t.id,x:t.x+50,y:t.y+100}),/集結點不能設在/);
 // Set a valid rally point, then place a house over it before the villager comes out.
 s.vision[0].explored=Array.from({length:256},(_,i)=>i);let spot=null as null|{x:number;y:number};
 for(let y=650;y<=1100&&!spot;y+=50)for(let x=500;x<=1000;x+=50)if(!authoritativeProblem(s,0,'house',x,y)){spot={x,y};break;}
 order(s,'rally',{buildingId:t.id,x:spot!.x+100,y:spot!.y+100});order(s,'train',{buildingId:t.id,entryId:'villager'});tick(s);
 order(s,'build',{unitIds:[1],kind:'house',x:spot!.x,y:spot!.y});run(s,450);
 assert.ok(s.units.some(u=>u.id===5),'the villager came out');assert.ok(other);
});
