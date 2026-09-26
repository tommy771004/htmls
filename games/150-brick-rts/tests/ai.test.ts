import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,hash,serialize,deserialize,replay,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {aiRules} from '../packages/sim/ai.ts';
import {dropoffNodes} from '../packages/sim/work.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
function order(s:State,commandType:string,payload:any){submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:s.sequence[0]+1,targetTick:s.tick+1,commandType,payload} as any);}
const run=(s:State,n:number)=>{for(let i=0;i<n&&!s.outcome;i++)tick(s);return s;};
const berries=(s:State)=>s.map.resources.filter(r=>r.kind==='berries').sort((a,b)=>a.x-b.x)[0];

test('idle opponent is unchanged: red keeps one villager and never acts',()=>{
 const s=run(createState(260925),3000);
 assert.equal(s.opponent,'idle');assert.equal(s.units.filter(u=>u.player===1).length,1);assert.equal(s.sequence[1],0);
 assert.equal(s.buildings.filter(b=>b.player===1).length,1);assert.deepEqual(s.queue.filter(c=>c.playerId===1),[]);
});

test('computer opponent starts like blue and its orders are admitted but never logged',()=>{
 const s=createState(260925,'meadow','ai');
 assert.equal(s.units.filter(u=>u.player===1).length,3);assert.equal(s.accounts[1].populationUsed,3);
 order(s,'gather',{unitIds:[1,2,3],resourceId:berries(s).id});run(s,1500);
 assert.ok(s.sequence[1]>0,'red issued orders');assert.ok(s.log.every(c=>c.playerId===0),'only the human player is logged');
 assert.ok(s.units.filter(u=>u.player===1&&u.kind==='villager').length>3,'red trained villagers');
});

test('computer opponent is deterministic across save/load and replay',()=>{
 const straight=createState(260925,'meadow','ai');order(straight,'gather',{unitIds:[1,2,3],resourceId:berries(straight).id});run(straight,1500);
 const restored=deserialize(serialize(straight));run(straight,1500);run(restored,1500);
 assert.equal(hash(restored),hash(straight));
 assert.equal(hash(replay(straight.seed,straight.log,straight.tick,straight.layout,'ai')),hash(straight));
 // Recovery without the opponent flag would rebuild a different match.
 assert.notEqual(hash(replay(straight.seed,straight.log,straight.tick,straight.layout,'idle')),hash(straight));
});

test('computer opponent builds an economy, ages up, attacks only after the grace time and can win',()=>{
 const s=createState(260925,'meadow','ai'),seen={house:0,barracks:0,farm:0,soldier:0,age2:0,firstBlueLoss:0};
 while(s.tick<20000&&!s.outcome){tick(s);const red=s.buildings.filter(b=>b.player===1);
  for(const k of ['house','barracks','farm'] as const)if(!seen[k]&&red.some(b=>b.kind===k&&b.complete))seen[k]=s.tick;
  if(!seen.soldier&&s.units.some(u=>u.player===1&&u.kind!=='villager'))seen.soldier=s.tick;
  if(!seen.age2&&s.ages[1]>=2)seen.age2=s.tick;
  if(!seen.firstBlueLoss&&s.units.filter(u=>u.player===0).length<3)seen.firstBlueLoss=s.tick;}
 for(const k of ['house','barracks','farm','soldier','age2'] as const)assert.ok(seen[k]>0,`red reached ${k}`);
 assert.ok(seen.firstBlueLoss>=aiRules.firstWaveTick,`no blue losses before the first wave is due (first at ${seen.firstBlueLoss})`);
 assert.equal(s.outcome?.winner,1,'red conquers an idle blue');
 // Red's own buildings never close its drop-off ring, and the barracks sits on red's half.
 assert.ok(dropoffNodes(s.map,1).length>0);
 const b=s.buildings.find(b=>b.player===1&&b.kind==='barracks');if(b){const box=obstacleBounds(s.map.obstacles.find(o=>o.id===b.id)!);assert.ok(box[0]>=800+aiRules.halfMargin);}
});

test('computer opponent defends its base against blue soldiers',()=>{
 const s=createState(260925,'meadow','ai');run(s,4000);
 const red=s.units.filter(u=>u.player===1&&u.kind!=='villager');assert.ok(red.length>0,'red has a soldier by now');
 // A blue militia appears next to the red town centre: red soldiers engage it.
 const tc=s.buildings.find(b=>b.player===1&&b.kind==='town-center')!,box=obstacleBounds(s.map.obstacles.find(o=>o.id===tc.id)!);
 const spot=[...Array(961).keys()].map(n=>({x:50+(n%31)*50,y:50+Math.floor(n/31)*50,n})).find(p=>!s.map.blocked.includes(p.n)&&!s.units.some(u=>u.node===p.n)&&p.y>box[3]+50&&p.y<box[3]+200&&p.x>box[0]&&p.x<box[2])!;
 s.units.push({...structuredClone(s.units.find(u=>u.player===0)!),id:s.nextUnitId++,kind:'militia',hp:45,x:spot.x,y:spot.y,node:spot.n,next:null,path:[],goal:null,target:null,navigation:'idle'});s.accounts[0].populationUsed++;
 const intruder=s.nextUnitId-1;run(s,aiRules.thinkTicks*2);
 assert.ok(red.some(u=>s.attacks[u.id]?.target.kind==='unit'&&(s.attacks[u.id]!.target as {id:number}).id===intruder)||!s.units.some(u=>u.id===intruder),'red soldiers engage the intruder');
});
