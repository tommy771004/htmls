import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,hash,serialize,deserialize,replay,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {makeUnit} from '../packages/sim/movement.ts';
import type {UnitKind} from '../packages/sim/movement.ts';
import {position,blockedTable,nodeTotal} from '../packages/sim/navigation.ts';
import {animalRules,carcassId,GAIA,isAnimal} from '../packages/sim/fauna.ts';
import {combatRules} from '../packages/sim/stats.ts';
import {economyRules} from '../packages/sim/economy.ts';
import {resources} from '../packages/content/rules.ts';
import {workSlots,huntProblem} from '../packages/sim/work.ts';
import {createService,decodeView} from '../packages/sim/protocol.ts';
function order(s:State,commandType:string,payload:any,playerId=0){submit(s,{protocolVersion:1,rulesetHash,playerId,sequence:s.sequence[playerId]+1,targetTick:s.tick+1,commandType,payload} as any);}
const run=(s:State,n:number,stop=(_:State)=>false)=>{for(let i=0;i<n&&!stop(s);i++)tick(s);};
const animals=(s:State,kind:string)=>s.units.filter(u=>u.kind===kind).sort((a,b)=>a.id-b.id);
// A unit on the free node nearest a point (fixture: the command log does not know it).
function spawn(s:State,player:number,kind:UnitKind,x:number,y:number,id=s.nextUnitId++){const closed=blockedTable(s.map),held=new Set(s.units.map(u=>u.node));let best=-1,d=Infinity;
 for(let n=0;n<nodeTotal(s.map);n++){if(closed[n]||held.has(n))continue;const p=position(s.map,n),e=Math.abs(p.x-x)+Math.abs(p.y-y);if(e<d){d=e;best=n;}}
 const p=position(s.map,best),u=makeUnit(s.map,id,player,p.x,p.y,kind);s.units.push(u);s.units.sort((a,b)=>a.id-b.id);if(!isAnimal(kind))s.accounts[player].populationUsed++;return u;}
// Every extracted unit is deposited, still carried, or lost with a dead carrier.
function assertLedger(s:State,p=0){const a=s.accounts[p];for(const k of resources){const carried=Object.entries(s.cargo).filter(([id])=>s.units.find(u=>u.id===Number(id))?.player===p).reduce((t,[,c])=>t+(c.resource===k?c.amount:0),0);
 assert.equal(a.ledger.extracted[k],a.ledger.deposited[k]+carried+a.ledger.lost[k],`tick ${s.tick} ${k}`);}}

test('every map starts with each side\'s own sheep and wild deer (and on the match map wild sheep, boar and a fishing pond)',()=>{
 const s=createState(260925);
 assert.equal(animals(s,'sheep').length,8);assert.deepEqual(animals(s,'sheep').map(u=>u.player),[0,0,0,0,1,1,1,1]);assert.equal(animals(s,'deer').length,8);assert.ok(s.units.filter(u=>isAnimal(u.kind)).every(u=>u.id>=animalRules.firstId));
 // Trained units keep the ids they always had: the animals never take one.
 assert.equal(s.nextUnitId,5);assert.equal(s.accounts[0].populationUsed,3);
 // Already at tick 0: the starting flock is the player's before anything moves.
 assert.deepEqual(animals(s,'sheep').filter(u=>u.player===0).map(u=>u.id),[900001,900002,900003,900004]);
 assert.ok(animals(s,'deer').every(u=>u.player===GAIA));
 const open=createState(260925,'open','ai');
 for(const kind of ['sheep','deer','boar'])assert.ok(open.units.some(u=>u.kind===kind),kind);
 assert.deepEqual([0,1,GAIA].map(p=>open.units.filter(u=>u.kind==='sheep'&&u.player===p).length),[4,4,4],'4 own sheep per base, 2 wild ones farther out per base');
 assert.ok(open.map.resources.some(r=>r.kind==='fish'),'the open map has a pond with shore fish');
});

test('a sheep changes hands when only the other side is near it; with both sides near, or by its owner\'s buildings, it stays',()=>{
 const s=createState(260925);tick(s);const sheep=animals(s,'sheep').find(u=>u.player===0)!;
 // Red's villager stands next to the sheep while blue's villagers are still there: blue keeps it.
 spawn(s,1,'villager',sheep.x+100,sheep.y+100);tick(s);assert.equal(sheep.player,0);
 // Blue's villagers walk away north: by blue's town centre the sheep still stays blue's.
 order(s,'move',{unitIds:[1,2,3],x:400,y:250});run(s,400);assert.equal(sheep.player,0);
 // Driven away from blue's buildings to where a red villager waits, it changes hands.
 spawn(s,1,'villager',950,1250);order(s,'move',{unitIds:[sheep.id],x:900,y:1200});run(s,600,t=>sheep.player===1);
 assert.equal(sheep.player,1);assert.equal(huntProblem(s,1,sheep.id),null);
 // A stolen sheep can no longer be hunted by blue.
 assert.throws(()=>order(s,'hunt',{unitIds:[1],animalId:sheep.id}),/(屬於對手|找不到)/);
});

test('villagers hunt a sheep, gather its carcass and bring the food home; the ledger balances',()=>{
 const s=createState(260925);tick(s);const sheep=animals(s,'sheep')[0];
 order(s,'hunt',{unitIds:[1],animalId:sheep.id});
 run(s,400,t=>!t.units.includes(sheep));assert.ok(!s.units.includes(sheep),'the sheep was slaughtered');
 const carcass=s.map.resources.find(r=>r.id===carcassId(sheep.id))!;assert.equal(carcass.kind,'livestock');assert.equal(carcass.capacity,animalRules.food.sheep);
 // No corpse, no population change: animals never counted.
 assert.equal(s.accounts[0].populationUsed,3);assert.ok(!s.corpses.some(c=>c.id===sheep.id));
 run(s,1500,t=>t.accounts[0].ledger.deposited.food>=20);
 assert.ok(s.accounts[0].ledger.deposited.food>=20,'two loads delivered');assertLedger(s);
 assert.equal(s.accounts[0].stock.food,economyRules.initialStock.food+s.accounts[0].ledger.deposited.food);
});

test('a shepherd moves on to the next own sheep when a carcass runs out',()=>{
 const s=createState(260925);tick(s);const [first,second]=animals(s,'sheep');
 order(s,'hunt',{unitIds:[1],animalId:first.id});run(s,300,t=>!t.units.includes(first));
 const carcass=s.map.resources.find(r=>r.id===carcassId(first.id))!;carcass.remaining=1;// fixture: nearly eaten
 run(s,800,t=>!t.units.includes(second));
 assert.ok(!s.units.includes(second),'the next sheep was taken without a new order');
});

test('a struck deer runs from its hunter; the hunter follows and brings it down',()=>{
 const s=createState(260925);tick(s);s.vision[0].visible=Array.from({length:256},(_,i)=>i);
 const deer=animals(s,'deer')[0],start={x:deer.x,y:deer.y},hunter=spawn(s,0,'villager',deer.x-200,deer.y);
 order(s,'hunt',{unitIds:[hunter.id],animalId:deer.id});let fled=false;
 for(let i=0;i<1500&&s.units.includes(deer);i++){s.vision[0].visible=Array.from({length:256},(_,i)=>i);tick(s);if(Math.abs(deer.x-start.x)+Math.abs(deer.y-start.y)>=150)fled=true;}
 assert.ok(fled,'the deer ran after the first strike');assert.ok(!s.units.includes(deer),'and was caught');
 assert.equal(s.map.resources.find(r=>r.id===carcassId(deer.id))?.capacity,animalRules.food.deer);
});

test('a boar charges its hunter: a lone villager dies, the boar keeps its food',()=>{
 const s=createState(260925,'open','ai');s.opponent='idle';const boar=animals(s,'boar')[0];s.vision[0].visible=Array.from({length:s.map.size**2},(_,i)=>i);
 const hunter=spawn(s,0,'villager',boar.x-150,boar.y);order(s,'hunt',{unitIds:[hunter.id],animalId:boar.id});
 for(let i=0;i<800&&s.units.includes(hunter);i++){s.vision[0].visible=Array.from({length:s.map.size**2},(_,i)=>i);tick(s);}
 assert.ok(!s.units.includes(hunter),'the boar killed the villager');assert.ok(s.units.includes(boar)&&boar.hp<combatRules.units.boar.hp,'after taking some hits');
 tick(s);assert.equal(s.beasts[boar.id],undefined,'and calmed down with nobody left hunting it');
 assert.ok(s.corpses.some(c=>c.id===hunter.id));
});

test('soldiers never pick animals by themselves, and animals never keep a side alive',()=>{
 const s=createState(260925);spawn(s,0,'militia',500,950,50);run(s,200);
 assert.equal(s.attacks[50],undefined,'no automatic attack on the deer next to it');
 // Red loses its villager and town centre: its sheep do not keep it in the match.
 run(s,1);s.units=s.units.filter(u=>!(u.player===1&&!isAnimal(u.kind)));s.buildings=s.buildings.filter(b=>b.player!==1);
 const redSheep=animals(s,'sheep').find(u=>u.player===1);assert.ok(redSheep,'red owns a sheep');
 tick(s);assert.equal(s.outcome?.winner,0);
});

test('shore fish are worked from the sand and delivered like any food',()=>{
 const s=createState(260925,'coast');const fish=s.map.resources.filter(r=>r.kind==='fish').sort((a,b)=>a.x-b.x)[0];
 assert.ok(workSlots(s.map,fish.id).length>0,'there is land next to the fish');
 s.vision[0].explored=Array.from({length:256},(_,i)=>i);
 order(s,'gather',{unitIds:[1],resourceId:fish.id});run(s,2500,t=>t.accounts[0].ledger.deposited.food>=10);
 assert.ok(s.accounts[0].ledger.deposited.food>=10);assert.ok(fish.remaining<fish.capacity);assertLedger(s);
});

test('a carcass spoils slowly (one food per decayTicks)',()=>{
 const s=createState(260925);tick(s);const sheep=animals(s,'sheep')[0];
 order(s,'hunt',{unitIds:[1],animalId:sheep.id});run(s,300,t=>!t.units.includes(sheep));order(s,'stop',{unitIds:[1]});tick(s);
 const carcass=s.map.resources.find(r=>r.id===carcassId(sheep.id))!,before=carcass.remaining;
 run(s,animalRules.decayTicks*3);assert.ok(carcass.remaining<=before-2&&carcass.remaining>=before-3,`${before} -> ${carcass.remaining}`);
});

test('hunting orders are validated: villagers only, visible animals only, own sheep only',()=>{
 const s=createState(260925);tick(s);const [mine,other]=animals(s,'sheep').filter(u=>u.player===0),theirs=animals(s,'sheep').find(u=>u.player===1)!;
 other.player=GAIA;// fixture: a sheep nobody has found yet
 const before=hash(s);
 assert.throws(()=>order(s,'hunt',{unitIds:[1],animalId:other.id}),/沒有主人/);
 assert.throws(()=>order(s,'hunt',{unitIds:[1],animalId:theirs.id}),/(屬於對手|找不到)/);
 assert.throws(()=>order(s,'hunt',{unitIds:[1],animalId:123456}),/找不到這隻動物/);
 assert.throws(()=>order(s,'gather',{unitIds:[1],resourceId:carcassId(mine.id)}),/找不到這個資源/);
 assert.throws(()=>order(s,'attack',{unitIds:[mine.id],target:{kind:'unit',id:4}}),/動物不能攻擊/);
 assert.throws(()=>order(s,'hunt',{unitIds:[mine.id],animalId:mine.id}),/只有村民/);
 assert.equal(hash(s),before);
 // A sheep of one's own may be walked somewhere.
 order(s,'move',{unitIds:[mine.id],x:600,y:700});run(s,200);assert.ok(Math.abs(mine.x-600)+Math.abs(mine.y-700)<=150);
});

test('a hunt in progress survives save/load and replays to the same state',()=>{
 const s=createState(260925);tick(s);order(s,'hunt',{unitIds:[1,2],animalId:animals(s,'sheep')[0].id});run(s,150);
 const restored=deserialize(serialize(s));run(s,500);run(restored,500);
 assert.equal(hash(s),hash(restored));assert.equal(hash(replay(s.seed,s.log,s.tick)),hash(s));
});

test('the Worker projects animals with their owner and the hunter\'s work',()=>{
 const service=createService();let id=0;const call=(operation:any)=>{const r=service({protocol:1,id:++id,operation});assert.equal(r.ok,true,JSON.stringify(r));return r as any;};
 call({kind:'reset',seed:260925});call({kind:'advance',count:1});
 const view=decodeView(call({kind:'hunt',unitIds:[1],animalId:900001}));
 assert.ok(view.units.some(u=>u.kind==='sheep'&&u.player===0));assert.ok(view.units.some(u=>u.kind==='deer'&&u.player===GAIA));
 const later=decodeView(call({kind:'advance',count:40}));assert.equal(later.units.find(u=>u.id===1)!.workResource,'food');
});

test('the computer herds and hunts: its villagers eat sheep before any farm',()=>{
 const s=createState(260925,'open','ai');let hunted=false;
 run(s,3000,t=>{hunted||=Object.values(t.works).some(w=>w.kind==='gather'&&w.prey!==undefined&&t.units.find(u=>u.id===w.prey)?.kind==='sheep');return hunted&&t.accounts[1].ledger.extracted.food>0;});
 assert.ok(hunted,'a red villager went for a sheep');assert.ok(!s.buildings.some(b=>b.player===1&&b.kind==='farm'),'no farm yet');
 assert.ok(s.accounts[1].ledger.extracted.food>0);
});
