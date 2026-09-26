import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,hash,serialize,deserialize,replay,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {aiRules} from '../packages/sim/ai.ts';
import {dropoffNodes} from '../packages/sim/work.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
import {nodeTotal,position} from '../packages/sim/navigation.ts';
function order(s:State,commandType:string,payload:any){submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:s.sequence[0]+1,targetTick:s.tick+1,commandType,payload} as any);}
const run=(s:State,n:number)=>{for(let i=0;i<n&&!s.outcome;i++)tick(s);return s;};
// Blue's own berries: the bush nearest blue's first villager (on the match map the bases are placed at random).
const berries=(s:State)=>{const v=s.map.starts[0][0];return s.map.resources.filter(r=>r.kind==='berries').sort((a,b)=>Math.hypot(a.x-v.x,a.y-v.y)-Math.hypot(b.x-v.x,b.y-v.y))[0];};

test('idle opponent is unchanged: red keeps one villager and never acts',()=>{
 const s=run(createState(260925),3000);
 assert.equal(s.opponent,'idle');assert.equal(s.units.filter(u=>u.player===1).length,1);assert.equal(s.sequence[1],0);
 assert.equal(s.buildings.filter(b=>b.player===1).length,1);assert.deepEqual(s.queue.filter(c=>c.playerId===1),[]);
});

test('computer opponent starts like blue and its orders are admitted but never logged',()=>{
 const s=createState(260925,'open','ai');
 // Three villagers plus the scout on the match map, like blue.
 assert.equal(s.units.filter(u=>u.player===1&&u.kind==='villager').length,3);assert.equal(s.units.filter(u=>u.player===1&&u.kind==='scout').length,1);assert.equal(s.accounts[1].populationUsed,4);
 order(s,'gather',{unitIds:[1,2,3],resourceId:berries(s).id});run(s,1500);
 assert.ok(s.sequence[1]>0,'red issued orders');assert.ok(s.log.every(c=>c.playerId===0),'only the human player is logged');
 assert.ok(s.units.filter(u=>u.player===1&&u.kind==='villager').length>3,'red trained villagers');
});

test('computer opponent is deterministic across save/load and replay',()=>{
 const straight=createState(260925,'open','ai');order(straight,'gather',{unitIds:[1,2,3],resourceId:berries(straight).id});run(straight,1500);
 const restored=deserialize(serialize(straight));run(straight,1500);run(restored,1500);
 assert.equal(hash(restored),hash(straight));
 assert.equal(hash(replay(straight.seed,straight.log,straight.tick,straight.layout,'ai')),hash(straight));
 // Recovery without the opponent flag would rebuild a different match.
 assert.notEqual(hash(replay(straight.seed,straight.log,straight.tick,straight.layout,'idle')),hash(straight));
});

test('computer opponent builds an economy with drop-off camps, ages up to an archery range, attacks only after the grace time and can win',()=>{
 const s=createState(260925,'open','ai'),seen={house:0,barracks:0,farm:0,'lumber-camp':0,'mining-camp':0,'archery-range':0,soldier:0,age2:0,firstBlueLoss:0};
 while(s.tick<20000&&!s.outcome){tick(s);const red=s.buildings.filter(b=>b.player===1);
  for(const k of ['house','barracks','farm','lumber-camp','mining-camp','archery-range'] as const)if(!seen[k]&&red.some(b=>b.kind===k&&b.complete))seen[k]=s.tick;
  if(!seen.soldier&&s.units.some(u=>u.player===1&&u.kind!=='villager'))seen.soldier=s.tick;
  if(!seen.age2&&s.ages[1]>=2)seen.age2=s.tick;
  if(!seen.firstBlueLoss&&s.units.filter(u=>u.player===0).length<3)seen.firstBlueLoss=s.tick;}
 for(const k of ['house','barracks','farm','lumber-camp','mining-camp','archery-range','soldier','age2'] as const)assert.ok(seen[k]>0,`red reached ${k}`);
 assert.ok(seen.firstBlueLoss>=aiRules.firstWaveTick,`no blue losses before the first wave is due (first at ${seen.firstBlueLoss})`);
 assert.equal(s.outcome?.winner,1,'red conquers an idle blue');
 // Red's own buildings never close its drop-off ring, and the barracks sits on red's half.
 assert.ok(dropoffNodes(s.map,1).length>0);
 // Barracks: every corner lies at least halfMargin beyond the centre towards red's own town centre.
 const b=s.buildings.find(b=>b.player===1&&b.kind==='barracks'),tc=s.buildings.find(b=>b.player===1&&b.kind==='town-center');
 if(b&&tc){const box=obstacleBounds(s.map.obstacles.find(o=>o.id===b.id)!),home=obstacleBounds(s.map.obstacles.find(o=>o.id===tc.id)!),mid=s.map.size*50,hx=(home[0]+home[2])/2-mid,hy=(home[1]+home[3])/2-mid,len=Math.hypot(hx,hy);
  for(const [x,y] of [[box[0],box[1]],[box[2],box[1]],[box[0],box[3]],[box[2],box[3]]])assert.ok(((x-mid)*hx+(y-mid)*hy)/len>=aiRules.halfMargin);}
});

test('computer opponent defends its base against blue soldiers',()=>{
 const s=createState(260925,'open','ai');run(s,4000);
 const red=s.units.filter(u=>u.player===1&&u.kind!=='villager');assert.ok(red.length>0,'red has a soldier by now');
 // A blue militia appears next to the red town centre: red soldiers engage it.
 const tc=s.buildings.find(b=>b.player===1&&b.kind==='town-center')!,box=obstacleBounds(s.map.obstacles.find(o=>o.id===tc.id)!);
 const spot=[...Array(nodeTotal(s.map)).keys()].map(n=>({...position(s.map,n),n})).find(p=>!s.map.blocked.includes(p.n)&&!s.units.some(u=>u.node===p.n)&&p.y>box[3]+50&&p.y<box[3]+200&&p.x>box[0]&&p.x<box[2])!;
 s.units.push({...structuredClone(s.units.find(u=>u.player===0)!),id:s.nextUnitId++,kind:'militia',hp:45,x:spot.x,y:spot.y,node:spot.n,next:null,path:[],goal:null,target:null,navigation:'idle'});s.accounts[0].populationUsed++;
 const intruder=s.nextUnitId-1;run(s,aiRules.thinkTicks*2);
 assert.ok(red.some(u=>s.attacks[u.id]?.target.kind==='unit'&&(s.attacks[u.id]!.target as {id:number}).id===intruder)||!s.units.some(u=>u.id===intruder),'red soldiers engage the intruder');
});

test('a player may resign: the match ends at once, later orders are refused, replay agrees',()=>{
 const s=createState(260925,'open','ai');run(s,300);order(s,'resign',{});tick(s);
 assert.deepEqual(s.outcome,{winner:1,defeated:[0],tick:301,reason:'resign'});
 assert.throws(()=>order(s,'move',{unitIds:[1],x:s.map.starts[0][0].x,y:s.map.starts[0][0].y}),/對局已結束/);
 assert.equal(hash(replay(s.seed,s.log,s.tick,s.layout,'ai')),hash(s));
});

test('the computer concedes once it has no town centre and no soldiers (it cannot rebuild one)',()=>{
 const s=createState(260925,'open','ai');run(s,100);assert.equal(s.outcome,null);
 const tc=s.buildings.find(b=>b.player===1&&b.kind==='town-center')!;
 s.buildings=s.buildings.filter(b=>b!==tc);s.map.obstacles=s.map.obstacles.filter(o=>o.id!==tc.id);
 run(s,aiRules.thinkTicks*2);
 const outcome=s.outcome as {winner:number|null;reason?:string}|null;assert.equal(outcome?.winner,0);assert.equal(outcome?.reason,'resign');
});

test('in the third age the computer builds a monastery; its monks store relics and convert intruders near its base',()=>{
 const s=createState(260925,'open','ai');
 while(s.tick<20000&&!s.outcome&&!s.relics.some(r=>r.monastery!==null&&s.buildings.find(b=>b.id===r.monastery)?.player===1))tick(s);
 assert.ok(s.ages[1]>=3,'third age');assert.ok(s.buildings.some(b=>b.player===1&&b.kind==='monastery'&&b.complete),'monastery');
 assert.ok(s.relics.some(r=>r.monastery!==null),'a relic stored by a red monk');
 // An intruder next to red's town centre; red's soldiers are kept off the field (fixture) so only the monk responds.
 const monk=s.units.find(u=>u.player===1&&u.kind==='monk')!;s.faith[monk.id]=-1e6;
 s.units=s.units.filter(u=>!(u.player===1&&(u.kind==='militia'||u.kind==='archer')));
 const tc=s.buildings.find(b=>b.player===1&&b.kind==='town-center')!,box=obstacleBounds(s.map.obstacles.find(o=>o.id===tc.id)!);
 const spot=[...Array(nodeTotal(s.map)).keys()].map(n=>({...position(s.map,n),n})).find(p=>!s.map.blocked.includes(p.n)&&!s.units.some(u=>u.node===p.n)&&p.y>box[3]+50&&p.y<box[3]+200&&p.x>box[0]&&p.x<box[2])!;
 s.units.push({...structuredClone(s.units.find(u=>u.kind==='villager')!),id:s.nextUnitId++,player:0,kind:'militia',hp:45,x:spot.x,y:spot.y,node:spot.n,next:null,path:[],goal:null,target:null,navigation:'idle'});
 const intruder=s.nextUnitId-1;let converted=false,targeted=false;
 for(let i=0;i<1200&&!converted&&s.units.some(u=>u.id===intruder);i++){s.units=s.units.filter(u=>!(u.player===1&&(u.kind==='militia'||u.kind==='archer')));tick(s);targeted||=Object.values(s.rites).some(r=>r.kind==='convert'&&r.target===intruder);converted=s.units.find(u=>u.id===intruder)?.player===1;}
 assert.ok(targeted,'a red monk went to convert it');assert.ok(converted,`converted by the red monk (${s.units.some(u=>u.id===intruder)?'alive':'killed first'})`);
});
