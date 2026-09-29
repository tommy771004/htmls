import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,hash,serialize,deserialize,replay,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {authoritativeProblem,farmResourceId} from '../packages/sim/buildings.ts';
import {trainable} from '../packages/sim/production.ts';
import {terrainRules} from '../packages/sim/terrain.ts';
import {economyRules} from '../packages/sim/economy.ts';
import {rules} from '../packages/content/rules.ts';
import {gatherRate,carryOf,farmFoodOf,techRules} from '../packages/sim/tech.ts';
import {maxHpOf} from '../packages/sim/stats.ts';
function order(s:State,commandType:string,payload:any,playerId=0){submit(s,{protocolVersion:1,rulesetHash,playerId,sequence:s.sequence[playerId]+1,targetTick:s.tick+1,commandType,payload} as any);}
const run=(s:State,n:number,stop=()=>false)=>{for(let i=0;i<n&&!stop();i++)tick(s);};
const tc=(s:State)=>s.buildings.find(b=>b.player===0&&b.kind==='town-center')!;
const nearest=(s:State,kind:string)=>s.map.resources.filter(r=>r.kind===kind&&r.collectible).sort((a,b)=>Math.abs(a.x-400)+Math.abs(a.y-700)-(Math.abs(b.x-400)+Math.abs(b.y-700))||(a.id<b.id?-1:1))[0];
function farm(s:State,unitIds=[1]){for(let y=600;y<=1200;y+=50)for(let x=100;x<=800;x+=50)if(!authoritativeProblem(s,0,'farm',x,y)){order(s,'build',{unitIds,kind:'farm',x,y});tick(s);return s.buildings.find(b=>b.kind==='farm'&&b.player===0)!;}throw Error('no farm site');}

test('thirteen economic technologies sit at the town centre, the camps and the mill, each after its age and predecessor',()=>{
 const producers=Object.fromEntries(Object.entries(rules.production).filter(([id])=>id in {...techRules.gather.wood,...techRules.gather.gold,...techRules.gather.stone,...techRules.carry,...techRules.farmFood,...techRules.villagerHp}));
 assert.equal(Object.keys(producers).length,13);assert.deepEqual([...new Set(Object.values(producers))].sort(),['lumber-camp','mill','mining-camp','town-center']);
 const s=createState(260925);s.accounts[0].stock={food:5000,wood:5000,gold:5000,stone:5000};
 assert.equal(trainable(s,0,tc(s),'loom'),null);assert.match(trainable(s,0,tc(s),'wheelbarrow')??'',/需要第二時代/);
 s.ages[0]=3;assert.match(trainable(s,0,tc(s),'hand-cart')??'',/需要先研究「手推車」/);s.techs[0].push('wheelbarrow');assert.equal(trainable(s,0,tc(s),'hand-cart'),null);
});

test('Loom: villagers in the field and those trained later have 15 more hit points',()=>{
 const s=createState(260925);order(s,'train',{buildingId:tc(s).id,entryId:'loom'});run(s,500,()=>s.techs[0].includes('loom'));
 assert.ok(s.techs[0].includes('loom'));assert.equal(s.accounts[0].stock.gold,economyRules.initialStock.gold-50);
 assert.ok(s.units.filter(u=>u.player===0&&u.kind==='villager').every(u=>u.hp===40&&maxHpOf('villager',s.techs[0])===40));
 order(s,'train',{buildingId:tc(s).id,entryId:'villager'});run(s,600,()=>s.units.some(u=>u.id===5));assert.equal(s.units.find(u=>u.id===5)!.hp,40);
});

test('gathering upgrades speed up work already under way; the rate stays exact over time',()=>{
 assert.equal(gatherRate([],'wood'),100);assert.equal(gatherRate(['double-bit-axe','bow-saw'],'wood'),140);assert.equal(gatherRate(['gold-mining'],'wood'),100);
 const plain=createState(260925),axe=createState(260925);
 for(const s of [plain,axe])order(s,'gather',{unitIds:[1,2,3],resourceId:nearest(s,'tree').id});
 run(plain,1);run(axe,1);axe.techs[0].push('double-bit-axe');// fixture: researched as the work begins
 run(plain,2000);run(axe,2000);const a=plain.accounts[0].ledger.extracted.wood,b=axe.accounts[0].ledger.extracted.wood;
 assert.ok(b>a*1.1,`wood ${a} -> ${b}`);
});

test('Wheelbarrow and Hand Cart: villagers carry 12, then 15, before walking home; Heavy Plow adds 1 for farmers',()=>{
 assert.equal(carryOf([],10),10);assert.equal(carryOf(['wheelbarrow'],10),12);assert.equal(carryOf(['wheelbarrow','hand-cart'],10),15);assert.equal(carryOf(['heavy-plow'],10,true),11);assert.equal(carryOf(['heavy-plow'],10),10);
 const s=createState(260925);s.techs[0].push('wheelbarrow');order(s,'gather',{unitIds:[1],resourceId:nearest(s,'tree').id});
 let most=0;run(s,2500,()=>{most=Math.max(most,s.cargo[1]?.amount??0);return s.accounts[0].ledger.deposited.wood>0;});
 assert.equal(most,12);assert.equal(s.accounts[0].ledger.deposited.wood,12);
});

test('Horse Collar: farms built afterwards hold 75 more food; the villager who builds a farm then farms it',()=>{
 const s=createState(260925);s.techs[0].push('horse-collar');const b=farm(s);run(s,1500,()=>b.complete);
 const field=s.map.resources.find(r=>r.id===farmResourceId(b.id))!;assert.equal(field.capacity,farmFoodOf(['horse-collar'],terrainRules.resourceCapacity.farm));assert.equal(field.capacity,325);
 run(s,5);const w=s.works[1];assert.equal(w?.kind==='gather'?w.resourceId:null,field.id,'the builder farms its field');
 run(s,1500,()=>s.accounts[0].ledger.extracted.food>0);assert.ok(s.accounts[0].ledger.extracted.food>0);
});

test('automatic reseeding: a worked-out farm is laid again by its farmer for 60 wood; switched off, it is not',()=>{
 for(const on of [true,false]){
  const s=createState(260925),b=farm(s);run(s,1500,()=>b.complete);if(!on){order(s,'reseed',{enabled:false});tick(s);}
  run(s,20);const field=s.map.resources.find(r=>r.id===farmResourceId(b.id))!;field.remaining=1;const wood=s.accounts[0].stock.wood;
  run(s,200,()=>field.status==='depleted');run(s,2);
  const next=s.buildings.find(v=>v.kind==='farm'&&v.id!==b.id);
  if(!on){assert.equal(next,undefined);assert.equal(s.accounts[0].stock.wood,wood);continue;}
  assert.ok(next,'a new foundation on the same spot');assert.deepEqual([next!.x,next!.y],[b.x,b.y]);assert.equal(s.accounts[0].stock.wood,wood-60);
  run(s,1500,()=>next!.complete);assert.ok(next!.complete);run(s,5);const w=s.works[1];assert.equal(w?.kind==='gather'?w.resourceId:null,farmResourceId(next!.id),'and farms it again');
 }
});

test('research, reseeding and upgraded work survive save/load and replay',()=>{
 const s=createState(260925);order(s,'train',{buildingId:tc(s).id,entryId:'loom'});order(s,'reseed',{enabled:false});order(s,'gather',{unitIds:[2,3],resourceId:nearest(s,'tree').id});run(s,300);
 const copy=deserialize(serialize(s));run(s,400);run(copy,400);assert.equal(hash(copy),hash(s));assert.equal(hash(replay(s.seed,s.log,s.tick)),hash(s));
 assert.equal(s.reseed[0],false);assert.ok(s.techs[0].includes('loom'));
 assert.throws(()=>order(s,'reseed',{enabled:'yes'}),/自動補種設定無效/);
});
