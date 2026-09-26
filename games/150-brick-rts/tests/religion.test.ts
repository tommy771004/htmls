import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,hash,serialize,deserialize,replay,rulesetHash} from '../packages/sim/sim.ts';
import {castleAgeMatch} from './castle-age-fixture.ts';
import type {State} from '../packages/sim/sim.ts';
import {makeUnit} from '../packages/sim/movement.ts';
import type {UnitKind} from '../packages/sim/movement.ts';
import {position,nodeTotal} from '../packages/sim/navigation.ts';
import {authoritativeProblem} from '../packages/sim/buildings.ts';
import {religionRules,faithOf} from '../packages/sim/religion.ts';
import {combatRules} from '../packages/sim/stats.ts';
function order(s:State,commandType:string,payload:any,playerId=0){submit(s,{protocolVersion:1,rulesetHash,playerId,sequence:s.sequence[playerId]+1,targetTick:s.tick+1,commandType,payload} as any);}
// Place a unit on the free node nearest a point (test fixture; the command log does not know it).
function spawn(s:State,player:number,kind:UnitKind,x:number,y:number){let best=-1,dist=Infinity;const held=new Set(s.units.map(u=>u.node)),closed=new Set(s.map.blocked);
 for(let n=0;n<nodeTotal(s.map);n++){if(closed.has(n)||held.has(n))continue;const p=position(s.map,n),d=Math.abs(p.x-x)+Math.abs(p.y-y);if(d<dist){dist=d;best=n;}}
 const p=position(s.map,best),u=makeUnit(s.map,s.nextUnitId++,player,p.x,p.y,kind);s.units.push(u);s.units.sort((a,b)=>a.id-b.id);s.accounts[player].populationUsed++;return u;}
const run=(s:State,n:number,stop=(_:State)=>false)=>{for(let i=0;i<n&&!stop(s);i++)tick(s);};
const redVillager=(s:State)=>s.units.find(u=>u.id===4)!;

test('the monastery needs the third age; monks train only there',()=>{
 const s=createState(260925);s.vision[0].explored=Array.from({length:256},(_,i)=>i);s.accounts[0].stock.food=2000;s.accounts[0].stock.gold=1000;s.accounts[0].stock.wood=1000;
 let site:{x:number;y:number}|null=null;for(let y=650;y<=1200&&!site;y+=50)for(let x=500;x<=1100&&!site;x+=50)if(!authoritativeProblem(s,0,'monastery',x,y))site={x,y};
 assert.throws(()=>order(s,'build',{unitIds:[1,2,3],kind:'monastery',...site}),/需要第二時代|需要第三時代/);
 const tc=s.buildings.find(b=>b.kind==='town-center'&&b.player===0)!;assert.throws(()=>order(s,'train',{buildingId:tc.id,entryId:'monk'}),/不能生產/);
 order(s,'train',{buildingId:tc.id,entryId:'age-2'});run(s,401);assert.throws(()=>order(s,'build',{unitIds:[1,2,3],kind:'monastery',...site}),/需要第三時代/);
 order(s,'train',{buildingId:tc.id,entryId:'age-3'});run(s,401);assert.equal(s.ages[0],3);
 order(s,'build',{unitIds:[1,2,3],kind:'monastery',...site});run(s,3000,s=>s.buildings.some(b=>b.kind==='monastery'&&b.complete));
 const m=s.buildings.find(b=>b.kind==='monastery'&&b.complete)!;assert.ok(m,'monastery built');const gold=s.accounts[0].stock.gold;
 order(s,'train',{buildingId:m.id,entryId:'monk'});tick(s);assert.equal(s.accounts[0].stock.gold,gold-100);run(s,420);
 const monk=s.units.find(u=>u.kind==='monk'&&u.player===0)!;assert.ok(monk,'a monk walked out');assert.equal(monk.hp,30);assert.equal(faithOf(s,monk.id),1,'a new monk starts with full faith');
});

test('a monk converts a visible enemy unit after 5-15 s; faith then recharges for 62 s',()=>{
 const s=createState(260925),v=redVillager(s),monk=spawn(s,0,'monk',v.x-300,v.y);run(s,2);
 assert.throws(()=>order(s,'attack',{unitIds:[monk.id],target:{kind:'unit',id:v.id}}),/僧侶不能攻擊/);
 assert.throws(()=>order(s,'convert',{unitIds:[1],targetId:v.id}),/只有僧侶/);
 const [bluePop,redPop]=[s.accounts[0].populationUsed,s.accounts[1].populationUsed];
 order(s,'convert',{unitIds:[monk.id],targetId:v.id});const start=s.tick;run(s,1000,s=>redVillager(s).player===0);
 const took=s.tick-start;assert.equal(v.player,0,'converted');
 assert.ok(took>=religionRules.conversionTicks.min&&took<=religionRules.conversionTicks.max+60,`took ${took} ticks`);
 assert.deepEqual([s.accounts[0].populationUsed,s.accounts[1].populationUsed],[bluePop+1,redPop-1],'population moves with the unit');
 assert.equal(s.rites[monk.id],undefined);assert.ok(faithOf(s,monk.id)<.01);
 // The converted villager now obeys blue.
 order(s,'move',{unitIds:[v.id],x:v.x,y:v.y+100});
 // No faith for another conversion until the recharge completes.
 const other=spawn(s,1,'villager',monk.x+150,monk.y);run(s,2);
 assert.throws(()=>order(s,'convert',{unitIds:[monk.id],targetId:other.id}),/信仰尚未恢復/);
 run(s,religionRules.rechargeTicks);assert.equal(faithOf(s,monk.id),1);order(s,'convert',{unitIds:[monk.id],targetId:other.id});
});

test('an order accepted for a unit that is converted before it runs does not move the converted unit',()=>{
 const s=createState(260925),v=redVillager(s),monk=spawn(s,0,'monk',v.x-300,v.y);run(s,2);
 order(s,'convert',{unitIds:[monk.id],targetId:v.id});run(s,1000,s=>s.rites[monk.id]?.needed>0&&s.rites[monk.id].progress>=s.rites[monk.id].needed-1);
 // Red's move is accepted now and would run next tick, the same tick the conversion completes.
 submit(s,{protocolVersion:1,rulesetHash,playerId:1,sequence:s.sequence[1]+1,targetTick:s.tick+2,commandType:'move',payload:{unitIds:[v.id],x:v.x,y:v.y-400}} as any);
 run(s,40);assert.equal(v.player,0);assert.equal(v.goal,null,'red can no longer steer it');
});
test('monks, own units and unseen units cannot be converted',()=>{
 const s=createState(260925),v=redVillager(s),monk=spawn(s,0,'monk',v.x-300,v.y),enemyMonk=spawn(s,1,'monk',v.x-200,v.y+100);run(s,2);
 assert.throws(()=>order(s,'convert',{unitIds:[monk.id],targetId:enemyMonk.id}),/僧侶不能轉化僧侶/);
 assert.throws(()=>order(s,'convert',{unitIds:[monk.id],targetId:1}),/不能轉化己方/);
 const far=createState(260925),m2=spawn(far,0,'monk',400,700);run(far,2);
 assert.throws(()=>order(far,'convert',{unitIds:[m2.id],targetId:4}),/找不到目標/,'the red villager is in the fog');
});

test('an idle monk heals wounded own units nearby, 1 hit point per second, up to full health',()=>{
 const s=createState(260925),villager=s.units.find(u=>u.id===1)!,monk=spawn(s,0,'monk',villager.x+100,villager.y);
 villager.hp=10;run(s,3);assert.equal(s.rites[monk.id]?.kind,'heal','heals without an order');
 run(s,religionRules.healTicks*5+40);assert.ok(villager.hp>=14&&villager.hp<=17,`hp ${villager.hp}`);
 run(s,religionRules.healTicks*20);assert.equal(villager.hp,combatRules.units.villager.hp);assert.equal(s.rites[monk.id],undefined,'stops at full health');
 // A monk does not heal a monk.
 monk.hp=5;run(s,40);assert.equal(monk.hp,5);assert.throws(()=>order(s,'heal',{unitIds:[monk.id],targetId:monk.id}),/僧侶不能被治療/);
});

test('a conversion in a real match survives save/load and replays to the same state',()=>{
 // Every command logged (the fixture plays to the third age), so deserialize and replay re-derive the match.
 const s=castleAgeMatch(),monk=s.units.find(u=>u.player===0&&u.kind==='monk')!,red=redVillager(s);
 order(s,'move',{unitIds:[monk.id],x:red.x-200,y:red.y});run(s,3000,s=>new Set(s.vision[0].visible).has(Math.floor(red.y/100)*s.map.size+Math.floor(red.x/100))&&!s.units.find(u=>u.id===monk.id)!.path.length);
 order(s,'convert',{unitIds:[monk.id],targetId:red.id});run(s,60);assert.equal(s.rites[monk.id]?.kind,'convert');
 const copy=deserialize(serialize(s));run(s,500);run(copy,500);
 assert.equal(redVillager(s).player,0,'converted');assert.equal(hash(copy),hash(s));
 assert.equal(hash(replay(s.seed,s.log,s.tick,s.layout,s.opponent)),hash(s));
});
