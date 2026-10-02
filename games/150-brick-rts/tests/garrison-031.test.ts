// The 遊戲元素 round's garrison and repair rules through the real sim: buildings that let everyone out at a fifth of
// their hit points, the castle's faster healing, production buildings that take in their own new units by a rally
// point on themselves, rams that carry infantry, and villagers repairing buildings, siege weapons and ships. Fixture
// shortcuts (stock gifts, finished buildings, units spawned on a node, full sight, damage set by hand) only skip the
// waiting.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {makeUnit,layerOf} from '../packages/sim/movement.ts';
import type {UnitKind,Unit} from '../packages/sim/movement.ts';
import {position,blockedTable,waterBlockedTable,nodeTotal,nodesNear} from '../packages/sim/navigation.ts';
import {maxHpOf,statsOf} from '../packages/sim/stats.ts';
import type {CombatUnitKind} from '../packages/sim/stats.ts';
import {ownerOf,costOf} from '../packages/sim/civ.ts';
import {authoritativeProblem,placeBuilding,addWork} from '../packages/sim/buildings.ts';
import type {Building,BuildKind} from '../packages/sim/buildings.ts';
import {defenseRules,garrisonCapacity} from '../packages/sim/defense.ts';
import {carrierRules,carriedSpeedScale,withCarried} from '../packages/sim/garrison.ts';
import {loadProblem,passengers} from '../packages/sim/naval.ts';
import {repairRules,repairCost} from '../packages/sim/repair.ts';
import {riteProblem} from '../packages/sim/religion.ts';
import {strike} from '../packages/sim/combat.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
import {resources} from '../packages/content/rules.ts';
import {neutralCiv} from '../packages/content/civs.ts';

const SEED=260925;
function order(s:State,commandType:string,payload:any,playerId=0){submit(s,{protocolVersion:1,rulesetHash,playerId,sequence:s.sequence[playerId]+1,targetTick:s.tick+1,commandType,payload} as any);}
const tiles=(s:State)=>Array.from({length:s.map.size*s.map.size},(_,i)=>i);
const see=(s:State)=>{for(const v of s.vision){v.visible=tiles(s);v.explored=tiles(s);}};
const run=(s:State,n:number,stop=()=>false)=>{for(let i=0;i<n;i++){see(s);if(stop())return i;tick(s);}see(s);return n;};
function match(civ=neutralCiv,age=1,layout:'meadow'|'lakes'='meadow'){const s=createState(SEED,layout,'idle',[civ,neutralCiv]);s.ages=[age,age];see(s);return s;}
function freeNode(s:State,x:number,y:number,layer:'land'|'water'='land'){const closed=layer==='water'?waterBlockedTable(s.map):blockedTable(s.map),held=new Set(s.units.flatMap(u=>u.next===null?[u.node]:[u.node,u.next]));let best=-1,d=Infinity;
 for(let n=0;n<nodeTotal(s.map);n++){if(closed[n]||held.has(n))continue;const p=position(s.map,n),e=Math.abs(p.x-x)+Math.abs(p.y-y);if(e<d){d=e;best=n;}}return best;}
function spawnAt(s:State,player:number,kind:UnitKind,node:number){const p=position(s.map,node),u=makeUnit(s.map,s.nextUnitId++,player,p.x,p.y,kind);
 u.hp=maxHpOf(kind as CombatUnitKind,ownerOf(s,player));s.units.push(u);s.units.sort((a,b)=>a.id-b.id);s.accounts[player].populationUsed++;return u;}
const spawn=(s:State,player:number,kind:UnitKind,x:number,y:number)=>spawnAt(s,player,kind,freeNode(s,x,y,layerOf(kind)));
const gift=(s:State,p:number,id:string)=>{const cost=costOf(id,ownerOf(s,p));for(const k of resources)s.accounts[p].stock[k]+=cost[k];};
function raise(s:State,p:number,kind:BuildKind,near:{x:number;y:number},step=50){const sites:{x:number;y:number;d:number}[]=[];
 for(let y=0;y<s.map.size*100;y+=step)for(let x=0;x<s.map.size*100;x+=step)if(!authoritativeProblem(s,p,kind,x,y))sites.push({x,y,d:Math.hypot(x-near.x,y-near.y)});
 sites.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);assert.ok(sites.length,'a site for '+kind);gift(s,p,kind);
 const b=placeBuilding(s,p,kind,sites[0].x,sites[0].y,`fixture:${s.nextBuildingId}`);while(!b.complete)addWork(s,b);see(s);return b;}
const tcOf=(s:State,p=0)=>s.buildings.find(b=>b.player===p&&b.kind==='town-center')!;
const boxOf=(s:State,b:Building)=>obstacleBounds(s.map.obstacles.find(o=>o.id===b.id)!);
const centre=(s:State,b:Building)=>{const [x0,y0,x1,y1]=boxOf(s,b);return {x:Math.round((x0+x1)/20)*10,y:Math.round((y0+y1)/20)*10};};
// Queue an item and finish its work at once (fixture), then let the sim hand it over.
function trainNow(s:State,b:Building,entryId:string){gift(s,b.player,entryId);order(s,'train',{buildingId:b.id,entryId},b.player);tick(s);const item=b.queue.find(q=>q.entryId===entryId)!;assert.ok(item,entryId+' queued');item.work=item.required-1;run(s,3);}
// Put units straight into a building's garrison (fixture), out of the world like the sim does.
function inside(s:State,b:Building,units:Unit[]){const g=(s.garrison[b.id]??={box:boxOf(s,b),units:[]});for(const u of units){s.units=s.units.filter(v=>v!==u);g.units.push({unit:u,work:null,bell:false});}}

test('a building at a fifth of its hit points lets everyone out and takes nobody in',()=>{
 const s=match(),tc=tcOf(s),v=s.units.find(u=>u.player===0&&u.kind==='villager')!;
 order(s,'garrison',{unitIds:[v.id],buildingId:tc.id});run(s,400,()=>!!s.garrison[tc.id]?.units.length);assert.equal(s.garrison[tc.id]?.units.length,1,'the villager went in');
 tc.hp=Math.floor(tc.maxHp*defenseRules.ejectPercent/100)+1;run(s,3);assert.equal(s.garrison[tc.id]?.units.length,1,'just above a fifth: stays');
 tc.hp=Math.floor(tc.maxHp*defenseRules.ejectPercent/100);run(s,2);assert.equal(s.garrison[tc.id],undefined,'at a fifth: out');assert.ok(s.units.includes(v));
 assert.throws(()=>order(s,'garrison',{unitIds:[v.id],buildingId:tc.id}),/建築受損嚴重（生命 20% 以下），無法進駐/);
 // The town bell skips it too.
 order(s,'bell',{ring:true});run(s,2);assert.equal(Object.keys(s.entering).length,0);
});

test('the castle heals those inside twice as fast as a town centre',()=>{
 const s=match('franks',3),tc=tcOf(s),castle=raise(s,0,'castle',{x:tc.x+500,y:tc.y});
 const a=spawn(s,0,'militia',tc.x,tc.y+400),b=spawn(s,0,'militia',tc.x+100,tc.y+400);a.hp=10;b.hp=10;inside(s,tc,[a]);inside(s,castle,[b]);
 run(s,40,()=>s.tick%defenseRules.healTicks===0);run(s,200);
 assert.deepEqual([a.hp-10,b.hp-10],[5,10]);assert.equal(defenseRules.healRate.castle,2);
});

test('a production building takes in its own new units by a rally point on itself; out once, never back',()=>{
 const s=match(),tc=tcOf(s),barracks=raise(s,0,'barracks',{x:tc.x+400,y:tc.y}),house=raise(s,0,'house',{x:tc.x-400,y:tc.y});
 assert.equal(garrisonCapacity(s,barracks),10);
 assert.throws(()=>order(s,'rally',{buildingId:house.id,...centre(s,house)}),/集結點不能設在建築/,'a house has no garrison of its own');
 order(s,'rally',{buildingId:barracks.id,...centre(s,barracks)});tick(s);assert.equal(barracks.rally?.inside,true);
 const before=s.units.length;trainNow(s,barracks,'militia');
 assert.equal(s.units.length,before,'the new militia did not come out');const g=s.garrison[barracks.id];assert.equal(g?.units.length,1);
 const m=g!.units[0].unit;assert.equal(m.kind,'militia');m.hp-=20;run(s,defenseRules.healTicks*4);assert.ok(m.hp>maxHpOf('militia',ownerOf(s,0))-20,'it heals inside');
 order(s,'ungarrison',{buildingId:barracks.id});run(s,2);assert.ok(s.units.includes(m),'out');assert.equal(s.garrison[barracks.id],undefined);
 assert.throws(()=>order(s,'garrison',{unitIds:[m.id],buildingId:barracks.id}),/只收自己訓練的單位/);
 // A rally point off the building again: new units come out as before.
 const spot=position(s.map,freeNode(s,tc.x+400,tc.y+400));order(s,'rally',{buildingId:barracks.id,x:spot.x,y:spot.y});tick(s);assert.equal(barracks.rally?.inside,undefined);
 const n=s.units.length;trainNow(s,barracks,'militia');assert.equal(s.units.length,n+1);
});

test('a dock keeps the ships it trains with its rally point on itself; they come out on the water',()=>{
 const s=match(neutralCiv,1,'lakes'),tc=tcOf(s);
 const sites:{x:number;y:number;d:number}[]=[];for(let y=0;y<s.map.size*100;y+=100)for(let x=0;x<s.map.size*100;x+=100)if(!authoritativeProblem(s,0,'dock',x,y))sites.push({x,y,d:Math.hypot(x+150-tc.x,y+150-tc.y)});
 sites.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);gift(s,0,'dock');const dock=placeBuilding(s,0,'dock',sites[0].x,sites[0].y,'fixture:dock');while(!dock.complete)addWork(s,dock);see(s);
 order(s,'rally',{buildingId:dock.id,...centre(s,dock)});tick(s);assert.equal(dock.rally?.inside,true);
 trainNow(s,dock,'fishing-ship');const ship=s.garrison[dock.id]?.units[0]?.unit;assert.equal(ship?.kind,'fishing-ship');
 order(s,'ungarrison',{buildingId:dock.id});run(s,2);assert.ok(s.units.includes(ship!));assert.equal(waterBlockedTable(s.map)[ship!.node],0,'on open water');
});

test('rams carry infantry and foot archers: only infantry push it faster and hit buildings harder, up to the cap',()=>{
 const s=match(neutralCiv,3),tc=tcOf(s),ram=spawn(s,0,'ram',tc.x+600,tc.y+600);
 const men=[0,1,2,3].map(i=>spawn(s,0,i<3?'militia':'archer',ram.x+50*(i-1),ram.y+100)),villager=spawn(s,0,'villager',ram.x,ram.y-100);
 assert.equal(loadProblem(s,0,ram.id,[villager.id]),'只有步兵與徒步弓兵能進駐衝撞車');
 assert.equal(loadProblem(s,0,ram.id,[...men,spawn(s,0,'militia',ram.x-100,ram.y)].map(u=>u.id).sort((a,b)=>a-b)),'空位不足：還能登船 4 名');
 order(s,'load',{unitIds:men.map(u=>u.id),transportId:ram.id});run(s,200,()=>passengers(s,ram.id).length===4);assert.equal(passengers(s,ram.id).length,4);
 assert.equal(carriedSpeedScale(s,ram),1+3*carrierRules.ram.speedPerInfantry,'three infantry: the archer does not push');
 const base=statsOf('ram',ownerOf(s,0)).bonus.building!;assert.equal(withCarried(s,ram,statsOf('ram',ownerOf(s,0))).bonus.building,base+3*carrierRules.ram.buildingPerInfantry);
 // The cap per line step (a fixture overfills a plain ram).
 for(let i=0;i<3;i++)s.transports[ram.id].push(spawn(s,0,'militia',ram.x-200,ram.y-200));s.units=s.units.filter(u=>!s.transports[ram.id].includes(u));
 assert.equal(withCarried(s,ram,statsOf('ram',ownerOf(s,0))).bonus.building,base+carrierRules.ram.buildingCap.ram);
 // It moves farther in the same time than an empty ram.
 // It moves farther in the same time than an empty ram (same start, same goal, a fresh match each).
 const trip=(loaded:boolean)=>{const t=match(neutralCiv,3),r=spawn(t,0,'ram',300,1100),start={x:r.x,y:r.y};
  if(loaded)for(let i=0;i<4;i++)(t.transports[r.id]??=[]).push(makeUnit(t.map,t.nextUnitId++,0,r.x,r.y,'militia'));
  order(t,'move',{unitIds:[r.id],x:1300,y:1100});run(t,150);return Math.hypot(r.x-start.x,r.y-start.y);};
 const d1=trip(true),d2=trip(false);assert.ok(d2>100&&d1>d2*1.3,`loaded ${d1} against empty ${d2}`);
 // Out again where it stands.
 order(s,'ungarrison',{unitId:ram.id});run(s,2);assert.equal(passengers(s,ram.id).length,0);
});

test('a ram that falls lets its passengers out alive',()=>{
 const s=match(neutralCiv,3),tc=tcOf(s),ram=spawn(s,0,'ram',tc.x+600,tc.y+600),men=[0,1,2,3].map(i=>spawn(s,0,'militia',ram.x+50*(i-1),ram.y+100));
 order(s,'load',{unitIds:men.map(u=>u.id),transportId:ram.id});run(s,200,()=>passengers(s,ram.id).length===4);
 strike(s,{kind:'unit',id:ram.id},ram.hp,-1);assert.ok(!s.units.includes(ram),'the ram is gone');
 for(const m of men)assert.ok(s.units.includes(m)&&m.hp>0,`militia ${m.id} is out`);assert.equal(s.transports[ram.id],undefined);
});

test('villagers repair a house for half its cost, hit point by hit point; two work faster than one',()=>{
 const s=match(),tc=tcOf(s),house=raise(s,0,'house',{x:tc.x+400,y:tc.y+300}),[v1,v2]=s.units.filter(u=>u.player===0&&u.kind==='villager');
 house.hp=house.maxHp-120;const wood=s.accounts[0].stock.wood;
 order(s,'repair',{unitIds:[v1.id],target:{kind:'building',id:house.id}});const one=run(s,2000,()=>house.hp>=house.maxHp);assert.equal(house.hp,house.maxHp);
 const paid=wood-s.accounts[0].stock.wood,expect=Math.floor(costOf('house',ownerOf(s,0)).wood*120/(house.maxHp/repairRules.costShare));
 assert.equal(paid,expect);assert.equal(s.accounts[0].ledger.repair.wood,expect);assert.equal(s.works[v1.id],undefined,'done: idle');
 house.hp=house.maxHp-120;order(s,'repair',{unitIds:[v1.id,v2.id].sort((a,b)=>a-b),target:{kind:'building',id:house.id}});const two=run(s,2000,()=>house.hp>=house.maxHp);
 assert.ok(two<one,`two villagers ${two} ticks, one ${one}`);
 assert.throws(()=>order(s,'repair',{unitIds:[v1.id],target:{kind:'building',id:house.id}}),/沒有受損/);
 assert.throws(()=>order(s,'repair',{unitIds:[spawn(s,0,'militia',tc.x,tc.y+400).id],target:{kind:'building',id:house.id}}),/只有村民能修理/);
});

test('a town centre is repaired with twice the wood and no stone; with nothing to pay the villager stops',()=>{
 const s=match(),tc=tcOf(s),v=s.units.find(u=>u.player===0&&u.kind==='villager')!;
 tc.hp=tc.maxHp-40;s.accounts[0].stock.wood=1000;s.accounts[0].stock.stone=100;
 order(s,'repair',{unitIds:[v.id],target:{kind:'building',id:tc.id}});run(s,2000,()=>tc.hp>=tc.maxHp);assert.equal(tc.hp,tc.maxHp);
 const cost=costOf('town-center',ownerOf(s,0));assert.deepEqual([1000-s.accounts[0].stock.wood,100-s.accounts[0].stock.stone],[Math.floor(cost.wood*2*40/(tc.maxHp/repairRules.costShare)),0]);
 assert.deepEqual(repairCost(s,0,'town-center'),{food:0,wood:cost.wood,gold:0,stone:0});
 tc.hp=tc.maxHp-40;s.accounts[0].stock.wood=0;order(s,'repair',{unitIds:[v.id],target:{kind:'building',id:tc.id}});run(s,300);
 // The first point's share of wood is under one unit (it is paid with the next): at most that one point goes up.
 assert.ok(tc.hp<=tc.maxHp-39,'no wood: nothing more repaired');assert.equal(s.works[v.id],undefined,'and the villager stopped');
});

test('a ram is repaired at the siege rate for half its cost; monks heal neither siege weapons nor ships',()=>{
 const s=match(neutralCiv,3),tc=tcOf(s),ram=spawn(s,0,'ram',tc.x+600,tc.y+600),v=spawn(s,0,'villager',ram.x,ram.y+150),monk=spawn(s,0,'monk',ram.x+100,ram.y+150);
 const max=ram.hp;ram.hp=max-75;const stock={...s.accounts[0].stock};
 assert.equal(riteProblem(s,0,'heal',ram.id),'攻城器與船隻不能被治療：派村民修理');
 run(s,100);assert.equal(ram.hp,max-75,'the idle monk did not heal it');assert.equal(s.rites[monk.id],undefined);
 order(s,'repair',{unitIds:[v.id],target:{kind:'unit',id:ram.id}});const n=run(s,3000,()=>ram.hp>=max);assert.equal(ram.hp,max);
 assert.ok(n>=Math.floor(75*100/repairRules.unitRate),'no faster than the unit rate');
 const cost=costOf('ram',ownerOf(s,0)),unit=max/repairRules.costShare;
 assert.deepEqual([stock.wood-s.accounts[0].stock.wood,stock.gold-s.accounts[0].stock.gold],[Math.floor(cost.wood*75/unit),Math.floor(cost.gold*75/unit)]);
 assert.throws(()=>order(s,'repair',{unitIds:[v.id],target:{kind:'unit',id:monk.id}}),/只能修理建築、攻城器與船隻/);
});

test('villagers repair a ship from the shore on the lake map',()=>{
 const s=match(neutralCiv,1,'lakes'),tc=tcOf(s),land=blockedTable(s.map),water=waterBlockedTable(s.map);
 // A water node with open land within reach, nearest the town centre.
 let best=-1,d=Infinity;for(let n=0;n<nodeTotal(s.map);n++){if(water[n])continue;const p=position(s.map,n);if(!nodesNear(s.map,[p.x,p.y,p.x,p.y],repairRules.shipReach).some(m=>!land[m]))continue;const e=Math.hypot(p.x-tc.x,p.y-tc.y);if(e<d){d=e;best=n;}}
 assert.ok(best>=0);const ship=spawnAt(s,0,'transport-ship',best),v=spawn(s,0,'villager',ship.x,ship.y);
 assert.equal(riteProblem(s,0,'heal',ship.id),'攻城器與船隻不能被治療：派村民修理');
 ship.hp-=30;order(s,'repair',{unitIds:[v.id],target:{kind:'unit',id:ship.id}});run(s,1500,()=>ship.hp>=maxHpOf('transport-ship',ownerOf(s,0)));
 assert.equal(ship.hp,maxHpOf('transport-ship',ownerOf(s,0)));assert.equal(land[v.node],0,'from the land');
});

test('the computer sends villagers to repair its damaged town centre',()=>{
 const s=createState(SEED,'open','ai');for(let i=0;i<600;i++)tick(s);
 const tc=s.buildings.find(b=>b.player===1&&b.kind==='town-center')!;tc.hp=Math.floor(tc.maxHp/2);
 let seen=0;for(let i=0;i<3000&&tc.hp*100<tc.maxHp*70;i++){tick(s);seen=Math.max(seen,Object.values(s.works).filter(w=>w.kind==='repair').length);}
 assert.ok(tc.hp*100>=tc.maxHp*70,`town centre back to ${tc.hp}/${tc.maxHp}`);assert.ok(seen>=1&&seen<=2);assert.ok(s.accounts[1].ledger.repair.wood>0,'and paid for it');
});
