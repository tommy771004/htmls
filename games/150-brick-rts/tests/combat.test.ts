import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,hash,serialize,deserialize,replay,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {makeUnit,nodeAt} from '../packages/sim/movement.ts';
import type {UnitKind} from '../packages/sim/movement.ts';
import {clearSegment,position} from '../packages/sim/navigation.ts';
import {combatRules} from '../packages/sim/stats.ts';
import {authoritativeProblem,placeBuilding} from '../packages/sim/buildings.ts';
import {commandAttack,targetProblem} from '../packages/sim/combat.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
function order(s:State,commandType:string,payload:any,playerId=0){submit(s,{protocolVersion:1,rulesetHash,playerId,sequence:s.sequence[playerId]+1,targetTick:s.tick+1,commandType,payload} as any);}
// Place a unit on the free node nearest a point (test fixture; the command log does not know it).
function spawn(s:State,player:number,kind:UnitKind,x:number,y:number,id:number){let best=-1,dist=Infinity;const held=new Set(s.units.map(u=>u.node));
 for(let n=0;n<961;n++){if(s.map.blocked.includes(n)||held.has(n))continue;const p=position({size:16},n),d=Math.abs(p.x-x)+Math.abs(p.y-y);if(d<dist){dist=d;best=n;}}
 const p=position({size:16},best),u=makeUnit({size:16},id,player,p.x,p.y,kind);s.units.push(u);s.units.sort((a,b)=>a.id-b.id);s.accounts[player].populationUsed++;return u;}
function noOverlap(s:State){for(let i=0;i<s.units.length;i++)for(let j=i+1;j<s.units.length;j++){const a=s.units[i],b=s.units[j];assert.ok(Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))>=50,`tick ${s.tick} ${a.id}/${b.id}`);}}
function run(s:State,n:number,stop=(_:State)=>false){for(let i=0;i<n&&!stop(s);i++){const before=s.units.map(u=>({id:u.id,x:u.x,y:u.y}));tick(s);for(const u of s.units){const b=before.find(v=>v.id===u.id);if(b)assert.ok(clearSegment(s.map,b,u));}noOverlap(s);}}
const red=(s:State)=>s.units.find(u=>u.id===4)!;

test('a militia walks up to an enemy villager and kills it on a fixed schedule',()=>{
 const s=createState(260925),m=spawn(s,0,'militia',1000,700,50);tick(s);
 order(s,'attack',{unitIds:[50],target:{kind:'unit',id:4}});const hp:number[]=[];
 run(s,600,t=>{const v=t.units.find(u=>u.id===4);if(v&&hp.at(-1)!==v.hp)hp.push(v.hp);return !v;});
 assert.equal(s.units.some(u=>u.id===4),false);assert.deepEqual(hp,[25,19,13,7,1]);
 assert.equal(s.accounts[1].populationUsed,0);assert.equal(s.corpses.length,1);assert.equal(s.corpses[0].id,4);tick(s);assert.equal(s.attacks[50],undefined);assert.equal(s.units.find(u=>u.id===50)!.navigation,'idle');
 run(s,combatRules.corpseTicks+1);assert.equal(s.corpses.length,0);
});
test('an archer stops at range and shoots; four militia surround one target without overlap',()=>{
 const s=createState(260925);spawn(s,0,'archer',800,700,50);tick(s);order(s,'attack',{unitIds:[50],target:{kind:'unit',id:4}});
 let fired=-1,d=-1;run(s,400,t=>{const a=t.attacks[50];if(a&&a.firedTick>=0&&fired<0){fired=a.firedTick;const u=t.units.find(u=>u.id===50)!,v=red(t);d=Math.max(Math.abs(u.x-v.x),Math.abs(u.y-v.y));}return fired>=0;});
 assert.ok(d>50&&d<=combatRules.units.archer.range,`shot from ${d}`);
 // A sturdy target (fixture hp) so every attacker has time to find its own position.
 const t=createState(260925);red(t).hp=1000;for(let i=0;i<4;i++)spawn(t,0,'militia',950+i*50,850,60+i);tick(t);order(t,'attack',{unitIds:[60,61,62,63],target:{kind:'unit',id:4}});
 run(t,400,x=>Object.values(x.attacks).filter(a=>a.firedTick>=0).length===4);
 assert.equal(Object.values(t.attacks).filter(a=>a.firedTick>=0).length,4,'all four reached their own attack positions');
 const spots=t.units.filter(u=>u.id>=60).map(u=>u.node);assert.equal(new Set(spots).size,4);assert.ok(t.units.filter(u=>u.id>=60).every(u=>Math.max(Math.abs(u.x-red(t).x),Math.abs(u.y-red(t).y))<=50));
});
test('idle soldiers engage visible enemies on their own; villagers do not',()=>{
 const s=createState(260925);spawn(s,0,'militia',900,700,50);spawn(s,0,'villager',950,850,51);run(s,500,t=>!t.units.some(u=>u.id===4));
 assert.equal(s.units.some(u=>u.id===4),false,'militia auto-attacked');assert.equal(s.attacks[51],undefined);
});
test('destroying buildings frees ground, cuts housing, keeps foundation money spent, and ends the match',()=>{
 const s=createState(260925);s.vision[0].explored=Array.from({length:256},(_,i)=>i);
 let spot=null as null|{x:number;y:number};for(let y=650;y<=1200&&!spot;y+=50)for(let x=500;x<=1000;x+=50)if(!authoritativeProblem(s,0,'house',x,y)){spot={x,y};break;}
 order(s,'build',{unitIds:[1],kind:'house',x:spot!.x,y:spot!.y});run(s,40);const house=s.buildings.find(b=>b.kind==='house')!;assert.ok(!house.complete&&house.hp>=1);
 // Red militia razes the blue foundation: the wood stays spent.
 spawn(s,1,'militia',spot!.x+350,spot!.y+100,70);order(s,'stop',{unitIds:[1]});tick(s);order(s,'attack',{unitIds:[70],target:{kind:'building',id:house.id}},1);
 run(s,600,t=>!t.buildings.includes(house));assert.equal(s.buildings.includes(house),false);assert.equal(s.accounts[0].stock.wood,170);
 assert.equal(s.accounts[0].reservations.find(r=>r.id===house.reservationId)!.status,'forfeited');
 const centre={x:spot!.x+100,y:spot!.y+100};assert.equal(clearSegment(s.map,centre,centre),true);
 // Blue army razes the red town center and kills the red units: blue wins, then orders are refused.
 const t=createState(260925),tc=t.buildings.find(b=>b.kind==='town-center'&&b.player===1)!;for(let i=0;i<6;i++)spawn(t,0,'militia',1000+i*50,650,80+i);t.accounts[0].populationCap=40;tick(t);
 order(t,'attack',{unitIds:[80,81,82],target:{kind:'building',id:tc.id}});run(t,3000,x=>!!x.outcome);
 assert.equal(t.buildings.includes(tc),false);assert.equal(t.accounts[1].populationCap,0);assert.deepEqual(t.outcome&&{winner:t.outcome.winner,defeated:t.outcome.defeated},{winner:0,defeated:[1]});
 assert.throws(()=>order(t,'move',{unitIds:[1],x:800,y:900}),/對局已結束/);
});
test('a villager killed while carrying loses its cargo into the ledger',()=>{
 const s=createState(260925);const tree=s.map.resources.filter(r=>r.kind==='tree'&&r.collectible).sort((a,b)=>Math.abs(a.x-400)+Math.abs(a.y-700)-(Math.abs(b.x-400)+Math.abs(b.y-700)))[0];
 order(s,'gather',{unitIds:[1],resourceId:tree.id});run(s,1500,t=>(t.cargo[1]?.amount??0)>=5);const carried=s.cargo[1].amount;
 const v=s.units.find(u=>u.id===1)!;spawn(s,1,'militia',v.x+100,v.y,70);tick(s);order(s,'attack',{unitIds:[70],target:{kind:'unit',id:1}},1);run(s,400,t=>!t.units.some(u=>u.id===1));
 const a=s.accounts[0];assert.equal(s.units.some(u=>u.id===1),false);assert.ok(a.ledger.lost.wood>=carried);assert.equal(a.ledger.extracted.wood,a.ledger.deposited.wood+a.ledger.lost.wood+(Object.values(s.cargo).reduce((n,c)=>n+(c.resource==='wood'?c.amount:0),0)));
});
test('hidden, own and missing targets are refused without side effects',()=>{
 const s=createState(260925),before=hash(s);
 assert.throws(()=>order(s,'attack',{unitIds:[1],target:{kind:'unit',id:4}}),/找不到目標/);
 assert.throws(()=>order(s,'attack',{unitIds:[1],target:{kind:'unit',id:2}}),/不能攻擊己方/);
 assert.throws(()=>order(s,'attack',{unitIds:[1],target:{kind:'building',id:'nope'}}),/找不到目標/);assert.equal(hash(s),before);
});
test('combat replays and survives save/load',()=>{
 const s=createState(260925);order(s,'move',{unitIds:[1,2,3],x:1000,y:800});run(s,200);order(s,'attack',{unitIds:[1,2,3],target:{kind:'unit',id:4}});run(s,150);
 const restored=deserialize(serialize(s));run(s,300);for(let i=0;i<300;i++)tick(restored);assert.equal(hash(s),hash(restored));assert.equal(hash(s),hash(replay(s.seed,s.log,s.tick)));
});
test('every building position on the 10-unit grid can be attacked by melee (regression: unreachable house)',()=>{
 // A house whose footprint edges fall between navigation nodes: with range measured from the unit centre no free
 // node was close enough, so attackers gave up. It must now be reachable and take damage.
 // Left edge 725 (≡ 25 mod 50) and top edge 1005 (≡ 5 mod 50): no node sat in the 25–50 band on any side.
 for(const offset of [0,10,20,30,40].map(o=>o===0?[40,20]:[o,o])){
  const s=createState(260925);s.vision[0].visible=Array.from({length:256},(_,i)=>i);s.vision[0].explored=[...s.vision[0].visible];
  s.vision[1].explored=[...s.vision[0].visible];
  const x=700+offset[0],y=1000+offset[1];assert.equal(authoritativeProblem(s,1,'house',x,y),null,`site ${x},${y}`);
  const b=placeBuilding(s,1,'house',x,y,'1:test');
  const m=makeUnit({size:16},s.nextUnitId++,0,400,1000,'militia');s.units.push(m);s.accounts[0].populationUsed++;
  commandAttack(s,[m.id],{kind:'building',id:b.id});
  for(let i=0;i<400&&b.hp===1;i++)tick(s);
  assert.ok(s.buildings.every(v=>v.id!==b.id)||b.hp<1||s.attacks[m.id],`offset ${offset}: attacker still engaged or target hit`);
  assert.ok(!s.buildings.some(v=>v.id===b.id),`offset ${offset}: foundation destroyed`);
 }
});

test('on the 32x32 map a building is a valid target exactly when its own tiles are visible (not tiles of a 16-wide grid)',()=>{
 const s=createState(260925,'open','idle'),tc=s.map.obstacles.find(o=>o.kind==='town-center'&&o.red)!,box=obstacleBounds(tc),size=s.map.size,own:number[]=[],stale:number[]=[];
 for(let ty=Math.floor(box[1]/100);ty<=Math.floor((box[3]-1)/100);ty++)for(let tx=Math.floor(box[0]/100);tx<=Math.floor((box[2]-1)/100);tx++){own.push(ty*size+tx);stale.push(ty*16+tx);}
 const target={kind:'building' as const,id:tc.id!};
 s.vision[0].visible=own;assert.equal(targetProblem(s,0,target),null,'visible footprint: attackable');
 s.vision[0].visible=stale.filter(t=>!own.includes(t));assert.equal(targetProblem(s,0,target),'找不到目標','unrelated tiles do not make it attackable');
});

test('a remembered enemy building in the fog can be attacked; if it is gone the units walk to its spot and stop',()=>{
 const s=createState(260925),tc=s.buildings.find(b=>b.player===1&&b.kind==='town-center')!,box=obstacleBounds(s.map.obstacles.find(o=>o.id===tc.id)!);
 const tiles:number[]=[];for(let ty=Math.floor(box[1]/100);ty<=Math.floor((box[3]-1)/100);ty++)for(let tx=Math.floor(box[0]/100);tx<=Math.floor((box[2]-1)/100);tx++)tiles.push(ty*16+tx);
 const seen=()=>s.vision[0].visible.some(t=>tiles.includes(t)),known=()=>s.vision[0].known.some(k=>k.obstacle.id===tc.id);
 // Villager 1 walks close enough to see red's town centre, then back home: the centre is remembered, not visible.
 const home={x:s.units[0].x,y:s.units[0].y};order(s,'move',{unitIds:[1],x:box[0]-150,y:box[1]+100});run(s,1500,()=>seen());assert.ok(known(),'remembered');
 order(s,'move',{unitIds:[1],x:home.x,y:home.y});run(s,1500,()=>!seen()&&!s.units.find(u=>u.id===1)!.path.length);assert.ok(!seen()&&known());
 const archer=spawn(s,0,'archer',home.x+100,home.y,60);tick(s);
 order(s,'attack',{unitIds:[archer.id],target:{kind:'building',id:tc.id}});const hp=tc.hp;run(s,1500,()=>tc.hp<hp);assert.ok(tc.hp<hp,'the archer walked into the fog and hit the remembered town centre');
 // Now a remembered building that no longer stands (removed out of sight): the order is still accepted, nothing leaks.
 order(s,'move',{unitIds:[archer.id],x:home.x,y:home.y});run(s,1500,()=>!seen()&&!s.units.find(u=>u.id===archer.id)!.path.length);
 s.buildings=s.buildings.filter(b=>b!==tc);s.map.obstacles=s.map.obstacles.filter(o=>o.id!==tc.id);assert.ok(known(),'still remembered');
 order(s,'attack',{unitIds:[archer.id],target:{kind:'building',id:tc.id}});run(s,1500,()=>seen());assert.ok(seen(),'walked to where it stood');run(s,5);
 assert.equal(s.attacks[archer.id],undefined);assert.ok(!known(),'the memory clears once the spot is seen');
});
