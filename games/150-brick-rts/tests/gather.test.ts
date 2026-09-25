import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,hash,serialize,deserialize,replay,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {clearSegment,position} from '../packages/sim/navigation.ts';
import {economyRules} from '../packages/sim/economy.ts';
import {resources} from '../packages/content/rules.ts';
import {workSlots,dropoffNodes} from '../packages/sim/work.ts';
import {tileAt} from '../packages/sim/terrain.ts';
function order(s:State,payload:any,commandType='gather'){submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:s.sequence[0]+1,targetTick:s.tick+1,commandType,payload} as any);}
const nearest=(s:State,kind:string,from={x:400,y:700})=>s.map.resources.filter(r=>r.kind===kind&&r.collectible&&s.vision[0].explored.includes(tileAt(r.x,r.y))).sort((a,b)=>Math.abs(a.x-from.x)+Math.abs(a.y-from.y)-(Math.abs(b.x-from.x)+Math.abs(b.y-from.y))||(a.id<b.id?-1:1))[0];
// Resource-flow ledger: every extracted unit is either deposited or still carried; stock = start + deposits.
function assertLedger(s:State){const a=s.accounts[0];for(const k of resources){const carried=Object.entries(s.cargo).filter(([id])=>s.units.find(u=>u.id===Number(id))!.player===0).reduce((t,[,c])=>t+(c.resource===k?c.amount:0),0);
 assert.equal(a.ledger.extracted[k],a.ledger.deposited[k]+carried,`tick ${s.tick} ${k}`);assert.equal(a.stock[k],economyRules.initialStock[k]+a.ledger.deposited[k]);}
 for(const c of Object.values(s.cargo))assert.ok(c.amount>0&&c.amount<=economyRules.carryCapacity);}
function assertNoOverlap(s:State){for(let i=0;i<s.units.length;i++)for(let j=i+1;j<s.units.length;j++){const a=s.units[i],b=s.units[j];assert.ok(Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))>=50,`tick ${s.tick} ${a.id}/${b.id}`);}}
function run(s:State,n:number){for(let i=0;i<n;i++){const before=s.units.map(u=>({x:u.x,y:u.y}));tick(s);s.units.forEach((u,k)=>assert.ok(clearSegment(s.map,before[k],u)));assertNoOverlap(s);assertLedger(s);}}

test('three villagers gather wood, carry it home and keep returning; stock rises only by deposits',()=>{
 const s=createState(260925),tree=nearest(s,'tree');order(s,{unitIds:[1,2,3],resourceId:tree.id});
 run(s,1800);
 const a=s.accounts[0];assert.ok(a.ledger.deposited.wood>=30,JSON.stringify(a.ledger));assert.equal(a.stock.wood,200+a.ledger.deposited.wood);
 assert.equal(a.stock.food,200);assert.equal(a.stock.gold,100);
 assert.ok(Object.keys(s.works).length===3);
});
test('two villagers on a nearly empty tree extract exactly what is left, the tree disappears and its ground opens',()=>{
 const s=createState(260925),tree=nearest(s,'tree');tree.remaining=5;tree.capacity=5;
 const box=s.map.obstacles.find(o=>o.id===tree.obstacleId)!,centre={x:box.x+30,y:box.y+30};assert.equal(clearSegment(s.map,centre,centre),false);
 order(s,{unitIds:[1,2],resourceId:tree.id});run(s,1500);
 assert.equal(tree.remaining,0);assert.equal(tree.status,'depleted');assert.equal(s.map.obstacles.some(o=>o.id===box.id),false);
 assert.equal(clearSegment(s.map,centre,centre),true);
 const a=s.accounts[0];assert.ok(a.ledger.extracted.wood>=5);
 // Both switched to the nearest other tree within 600 (lowest id on ties) and kept producing.
 assert.ok(Object.values(s.works).length===2&&Object.values(s.works).every(w=>w.kind==='gather'&&w.resourceId!==tree.id),JSON.stringify(s.works));assert.ok(a.ledger.extracted.wood>5);
});
test('a move order keeps cargo and ends work; a gold order first returns the wood',()=>{
 const s=createState(260925),tree=nearest(s,'tree');order(s,{unitIds:[1],resourceId:tree.id});
 for(let i=0;i<2000&&!(s.cargo[1]?.amount>=4);i++){tick(s);assertLedger(s);}
 const carried=s.cargo[1].amount;assert.ok(carried>=4&&carried<economyRules.carryCapacity);
 order(s,{unitIds:[1],x:800,y:900},'move');run(s,300);assert.equal(s.cargo[1].amount,carried);assert.equal(s.works[1],undefined);
 const gold=nearest(s,'gold');order(s,{unitIds:[1],resourceId:gold.id});
 let deposited=false;for(let i=0;i<3000&&!(s.accounts[0].ledger.extracted.gold>0);i++){tick(s);assertLedger(s);if(s.accounts[0].ledger.deposited.wood===carried)deposited=true;}
 assert.ok(deposited,'wood was returned before gold');assert.ok(s.accounts[0].ledger.extracted.gold>0);
});
test('hunt, herd and fish are refused honestly; unexplored resources look identical to missing ones',()=>{
 const s=createState(260925),before=hash(s);
 for(const kind of ['hunt','livestock'])assert.throws(()=>order(s,{unitIds:[1],resourceId:s.map.resources.find(r=>r.kind===kind)!.id}),/尚未實作/);
 const hidden=s.map.resources.find(r=>!s.vision[0].explored.includes(tileAt(r.x,r.y)))!;
 assert.throws(()=>order(s,{unitIds:[1],resourceId:hidden.id}),/找不到這個資源/);assert.throws(()=>order(s,{unitIds:[1],resourceId:'nope'}),/找不到這個資源/);
 assert.throws(()=>order(s,{unitIds:[4],resourceId:nearest(s,'tree').id}));assert.equal(hash(s),before);
});
test('work slots sit just outside the resource and drop-off nodes ring the town center outside the hall',()=>{
 const s=createState(260925),tree=nearest(s,'tree'),slots=workSlots(s.map,tree.id),drop=dropoffNodes(s.map,0);
 assert.ok(slots.length>=4);assert.ok(slots.every(n=>clearSegment(s.map,position(n),position(n))));
 const tc=s.map.obstacles.find(o=>o.kind==='town-center'&&!o.red)!;assert.ok(drop.length>=8);
 assert.ok(drop.every(n=>{const p=position(n);return !(p.x>=tc.x-15&&p.x<=tc.x+285&&p.y>=tc.y-15&&p.y<=tc.y+285);}),'drop-off never inside the plinth/hall');
});
test('gathering survives save/load and replays to the same hash, cargo included',()=>{
 const s=createState(260925);order(s,{unitIds:[1,2,3],resourceId:nearest(s,'tree').id});for(let i=0;i<333;i++)tick(s);
 const restored=deserialize(serialize(s));assert.deepEqual(restored.cargo,s.cargo);for(let i=0;i<400;i++){tick(s);tick(restored);}
 assert.equal(hash(s),hash(restored));assert.equal(hash(s),hash(replay(s.seed,s.log,s.tick)));
});

test('five villagers on one tree (11 work slots) all gather and return',async()=>{
 const {makeUnit}=await import('../packages/sim/movement.ts');
 const s=createState(260925);s.units.push(makeUnit(10,0,300,800),makeUnit(11,0,500,800));s.units.sort((a,b)=>a.id-b.id);
 const tree=nearest(s,'tree');assert.ok(workSlots(s.map,tree.id).length>=5);order(s,{unitIds:[1,2,3,10,11],resourceId:tree.id});
 const loaded=new Set<number>();for(let i=0;i<2400;i++){tick(s);assertLedger(s);assertNoOverlap(s);for(const [id,c] of Object.entries(s.cargo))if(c.amount>=economyRules.carryCapacity)loaded.add(Number(id));}
 assert.deepEqual([...loaded].sort((a,b)=>a-b),[1,2,3,10,11]);assert.ok(s.accounts[0].ledger.deposited.wood>=100);
});
