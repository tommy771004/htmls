// The 建築 round's water side: the dock on the shore, its ships on the water layer (fishing, fish traps, transports,
// warships), all through the real sim on the 'lakes' match map: createState, commands by submit, ticks. Fixture
// shortcuts (stock gifts, finished foundations, units spawned on a node, both sides seeing everything) only skip the
// waiting.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,hash,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {makeUnit,layerOf} from '../packages/sim/movement.ts';
import type {UnitKind} from '../packages/sim/movement.ts';
import {position,blockedTable,waterBlockedTable,nodeTotal} from '../packages/sim/navigation.ts';
import {statsOf,maxHpOf,hitDamage} from '../packages/sim/stats.ts';
import type {CombatUnitKind} from '../packages/sim/stats.ts';
import {ownerOf,costOf} from '../packages/sim/civ.ts';
import {authoritativeProblem,placementProblem,placeBuilding,addWork,farmResourceId} from '../packages/sim/buildings.ts';
import type {Building,BuildKind} from '../packages/sim/buildings.ts';
import {workSlots,gatherable} from '../packages/sim/work.ts';
import {capacityOf,passengers} from '../packages/sim/naval.ts';
import {resources} from '../packages/content/rules.ts';
import {neutralCiv} from '../packages/content/civs.ts';
import {settle} from './flight.ts';
import {tileAt} from '../packages/sim/terrain.ts';

const SEED=260925;
function order(s:State,commandType:string,payload:any,playerId=0){submit(s,{protocolVersion:1,rulesetHash,playerId,sequence:s.sequence[playerId]+1,targetTick:s.tick+1,commandType,payload} as any);}
const tiles=(s:State)=>Array.from({length:s.map.size*s.map.size},(_,i)=>i);
const see=(s:State)=>{for(const v of s.vision){v.visible=tiles(s);v.explored=tiles(s);}};
const run=(s:State,n:number,stop=()=>false)=>{for(let i=0;i<n;i++){see(s);if(stop())return i;tick(s);}see(s);return n;};
function lakes(civs:[string,string]=[neutralCiv,neutralCiv]){const s=createState(SEED,'lakes','idle',civs);see(s);return s;}
const tcOf=(s:State,p=0)=>s.buildings.find(b=>b.player===p&&b.kind==='town-center')!;
const wet=(s:State,x:number,y:number)=>s.map.tiles[tileAt(x,y,s.map.size)].terrainType==='water';
// The free node of a layer nearest the point.
function freeNode(s:State,x:number,y:number,layer:'land'|'water'='land'){const closed=layer==='water'?waterBlockedTable(s.map):blockedTable(s.map),held=new Set(s.units.flatMap(u=>u.next===null?[u.node]:[u.node,u.next]));let best=-1,d=Infinity;
 for(let n=0;n<nodeTotal(s.map);n++){if(closed[n]||held.has(n))continue;const p=position(s.map,n),e=Math.abs(p.x-x)+Math.abs(p.y-y);if(e<d){d=e;best=n;}}return best;}
function spawn(s:State,player:number,kind:UnitKind,x:number,y:number){const p=position(s.map,freeNode(s,x,y,layerOf(kind))),u=makeUnit(s.map,s.nextUnitId++,player,p.x,p.y,kind);
 u.hp=maxHpOf(kind as CombatUnitKind,ownerOf(s,player));s.units.push(u);s.units.sort((a,b)=>a.id-b.id);s.accounts[player].populationUsed++;return u;}
const gift=(s:State,p:number,id:string)=>{const cost=costOf(id,ownerOf(s,p));for(const k of resources)s.accounts[p].stock[k]+=cost[k];};
// Dock sites on whole tiles, nearest the player's town centre first.
function dockSites(s:State,p=0){const t=tcOf(s,p),out:{x:number;y:number;d:number}[]=[];
 for(let y=0;y<s.map.size*100;y+=100)for(let x=0;x<s.map.size*100;x+=100)if(!authoritativeProblem(s,p,'dock',x,y))out.push({x,y,d:Math.hypot(x+150-t.x,y+150-t.y)});
 return out.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);}
// A finished dock (fixture: paid, then worked through).
function dock(s:State,p=0):Building{const site=dockSites(s,p)[0];gift(s,p,'dock');const b=placeBuilding(s,p,'dock',site.x,site.y,`fixture:${s.nextBuildingId}`);while(!b.complete)addWork(s,b);see(s);return b;}
function research(s:State,b:Building,entryId:string){const p=b.player;gift(s,p,entryId);order(s,'train',{buildingId:b.id,entryId},p);tick(s);const item=b.queue.find(q=>q.entryId===entryId)!;item.work=item.required-1;tick(s);see(s);}
function trainUnit(s:State,b:Building,entryId:string){const p=b.player;gift(s,p,entryId);const ids=new Set(s.units.map(u=>u.id));order(s,'train',{buildingId:b.id,entryId},p);tick(s);
 const item=b.queue.find(q=>q.entryId===entryId);assert.ok(item,entryId+' queued');item!.work=item!.required-1;
 const fresh=()=>s.units.find(u=>!ids.has(u.id)&&u.player===p);run(s,10,()=>!!fresh());const u=fresh();assert.ok(u,entryId+' trained');return u!;}
const deepFish=(s:State)=>s.map.resources.filter(r=>r.kind==='fish'&&r.collectible);

test('the dock stands on water by the shore; a fish trap anywhere on the water; land buildings stay on land',()=>{
 const s=lakes(),t=tcOf(s),input={tiles:s.map.tiles,obstacles:s.map.obstacles,units:s.units,explored:()=>true};
 const sites=dockSites(s);assert.ok(sites.length>10,'docks fit round the lake');
 for(const site of sites){for(let dy=0;dy<300;dy+=100)for(let dx=0;dx<300;dx+=100)assert.ok(wet(s,site.x+dx+50,site.y+dy+50),'every dock tile is water');}
 const landX=Math.round((t.x+400)/100)*100,landY=Math.round((t.y+400)/100)*100;
 assert.equal(placementProblem(input,'dock',landX,landY),'碼頭必須蓋在岸邊的水面上');
 assert.equal(placementProblem(input,'dock',1500,1500),'碼頭必須緊鄰可建造的陸地','the middle of the lake is too far from land');
 assert.equal(placementProblem(input,'fish-trap',1500,1500),null,'a fish trap in open water');
 assert.equal(placementProblem(input,'fish-trap',landX,landY),'魚網必須放在水面上');
 // Never over fish.
 const fish=s.map.resources.find(r=>r.kind==='fish')!;assert.equal(authoritativeProblem(s,0,'fish-trap',fish.x-100,fish.y-100),'與資源重疊');
 assert.match(String(placementProblem(input,'house',1500,1500)),/地形不可建造/);
 // A dock on the shore of the coast test ground too.
 const c=createState(SEED,'coast','idle');let found=false;for(let x=0;x<1600&&!found;x+=100)for(let y=0;y<1600&&!found;y+=100)found=!placementProblem({tiles:c.map.tiles,obstacles:c.map.obstacles,units:c.units,explored:()=>true},'dock',x,y);
 assert.ok(found,'the coast has a dock site');
});

test('villagers build a dock from the shore; it trains a fishing ship that comes out on the water',()=>{
 const s=lakes(),site=dockSites(s)[0],ids=s.units.filter(u=>u.player===0&&u.kind==='villager').map(u=>u.id);
 gift(s,0,'dock');order(s,'build',{unitIds:ids,kind:'dock',x:site.x,y:site.y});
 run(s,3000,()=>s.buildings.some(b=>b.kind==='dock'&&b.complete));
 const d=s.buildings.find(b=>b.kind==='dock')!;assert.ok(d?.complete,'the dock is finished by villagers standing on land');
 for(const id of ids){const u=s.units.find(u=>u.id===id)!;assert.equal(blockedTable(s.map)[u.node],0,'builders stayed on land');}
 const ship=trainUnit(s,d,'fishing-ship');assert.equal(waterBlockedTable(s.map)[ship.node],0,'the ship is on open water');assert.ok(wet(s,ship.x,ship.y));
 // A land unit is never trained at a dock; villagers cannot be ordered onto the lake.
 assert.throws(()=>order(s,'train',{buildingId:d.id,entryId:'villager'}),/不能生產/);
 // The dock's rally point is on the water.
 assert.throws(()=>order(s,'rally',{buildingId:d.id,x:tcOf(s).x+400,y:tcOf(s).y+400}),/碼頭的集結點要設在水面上/);
});

test('a fishing ship fishes deep-sea fish villagers cannot reach and brings the food to the dock',()=>{
 const s=lakes(),d=dock(s),ship=trainUnit(s,d,'fishing-ship');
 const fish=deepFish(s).sort((a,b)=>Math.hypot(a.x-ship.x,a.y-ship.y)-Math.hypot(b.x-ship.x,b.y-ship.y))[0];
 assert.equal(workSlots(s.map,fish.id).length,0,'no villager reaches it');assert.ok(workSlots(s.map,fish.id,'water').length,'ships do');
 assert.match(String(gatherable(s.map,fish.id)),/岸邊/);
 const villager=s.units.find(u=>u.player===0&&u.kind==='villager')!;
 assert.throws(()=>order(s,'gather',{unitIds:[villager.id,ship.id].sort((a,b)=>a-b),resourceId:fish.id}),/漁船與村民不能一起/);
 assert.throws(()=>order(s,'gather',{unitIds:[ship.id],resourceId:s.map.resources.find(r=>r.kind==='tree')!.id}),/漁船只能捕魚/);
 const food=s.accounts[0].ledger.deposited.food,before=fish.remaining;order(s,'gather',{unitIds:[ship.id],resourceId:fish.id});
 run(s,4000,()=>s.accounts[0].ledger.deposited.food>food);
 assert.equal(s.accounts[0].ledger.deposited.food-food,10,'a full load (10) delivered');assert.ok(fish.remaining<=before-10);
 assert.equal(waterBlockedTable(s.map)[s.units.find(u=>u.id===ship.id)!.node],0,'it delivered from the water');
 assert.equal(s.works[ship.id]?.kind,'gather','and goes back for more');
 // Fishing ships never fight.
 assert.throws(()=>order(s,'attack',{unitIds:[ship.id],target:{kind:'unit',id:s.units.find(u=>u.player===1)!.id}}),/不能攻擊/);
});

test('a fish trap is laid by a fishing ship, worked by it, and only its owner fishes it',()=>{
 const s=lakes(),d=dock(s);research(s,tcOf(s),'age-2');const ship=trainUnit(s,d,'fishing-ship');
 const villager=s.units.find(u=>u.player===0&&u.kind==='villager')!;
 // A trap site in open water near the ship.
 let site:{x:number;y:number}|null=null;for(let r=200;r<800&&!site;r+=100)for(const [dx,dy] of [[0,r],[r,0],[0,-r],[-r,0],[r,r],[-r,-r],[r,-r],[-r,r]]){const x=Math.round((ship.x+dx)/100)*100,y=Math.round((ship.y+dy)/100)*100;if(!authoritativeProblem(s,0,'fish-trap',x,y)){site={x,y};break;}}
 assert.ok(site,'a trap site');gift(s,0,'fish-trap');
 assert.throws(()=>order(s,'build',{unitIds:[villager.id],kind:'fish-trap',x:site!.x,y:site!.y}),/魚網只能由漁船放置/);
 assert.throws(()=>order(s,'build',{unitIds:[ship.id],kind:'house',x:Math.round((tcOf(s).x+400)/100)*100,y:Math.round((tcOf(s).y+400)/100)*100}),/漁船只能放置魚網/);
 order(s,'build',{unitIds:[ship.id],kind:'fish-trap',x:site!.x,y:site!.y});
 run(s,3000,()=>s.buildings.some(b=>b.kind==='fish-trap'&&b.complete));
 const trap=s.buildings.find(b=>b.kind==='fish-trap')!;assert.ok(trap.complete,'the ship built its trap');
 const food=s.map.resources.find(r=>r.id===farmResourceId(trap.id))!;assert.equal(food.kind,'fish-trap');assert.equal(food.capacity,1000);
 const deposited=s.accounts[0].ledger.deposited.food;run(s,3000,()=>s.accounts[0].ledger.deposited.food>deposited);
 assert.ok(s.accounts[0].ledger.deposited.food>deposited,'the trap feeds the dock');assert.ok(food.remaining<1000);
 // Villagers cannot work it; the other player's ships cannot either.
 assert.throws(()=>order(s,'gather',{unitIds:[villager.id],resourceId:food.id}),/魚網只能由漁船收成/);
 const red=spawn(s,1,'fishing-ship',ship.x+100,ship.y);assert.throws(()=>order(s,'gather',{unitIds:[red.id],resourceId:food.id},1),/只能收成己方的魚網/);
 // Ships sail over a trap: it has no blocking rectangle on the water.
 assert.equal(waterBlockedTable(s.map)[freeNode(s,trap.x+100,trap.y+100,'water')],0);
});

test('a transport carries villagers across the lake and sets them down on the far shore',()=>{
 const s=lakes(),d=dock(s),t=trainUnit(s,d,'transport-ship'),ids=s.units.filter(u=>u.player===0&&u.kind==='villager').map(u=>u.id);
 assert.equal(capacityOf(s,t),5);
 assert.throws(()=>order(s,'load',{unitIds:[t.id],transportId:t.id}),/只有陸上單位能登船/);
 order(s,'load',{unitIds:ids,transportId:t.id});
 run(s,4000,()=>passengers(s,t.id).length===3);
 assert.equal(passengers(s,t.id).length,3,'all three aboard');assert.ok(ids.every(id=>!s.units.some(u=>u.id===id)),'out of the world while aboard');
 assert.equal(s.accounts[0].populationUsed,5,'still counted (3 villagers, the scout and the transport)');
 const start=s.units.find(u=>u.id===t.id)!,from={x:start.x,y:start.y};
 // The far shore: the land point opposite across the lake's centre.
 const aim={x:3200-from.x,y:3200-from.y},target=position(s.map,freeNode(s,aim.x,aim.y,'land'));
 order(s,'unload',{transportId:t.id,x:target.x,y:target.y});
 run(s,6000,()=>passengers(s,t.id).length===0);
 assert.equal(passengers(s,t.id).length,0,'everyone off');
 for(const id of ids){const u=s.units.find(u=>u.id===id);assert.ok(u,'back in the world');assert.equal(blockedTable(s.map)[u!.node],0,'on land');
  assert.ok(Math.hypot(u!.x-from.x,u!.y-from.y)>800,'across the lake');}
 assert.throws(()=>order(s,'unload',{transportId:t.id,x:target.x,y:target.y}),/運輸船上沒有單位/);
});

test('a sunk transport takes its passengers with it',()=>{
 const s=lakes(),d=dock(s),t=trainUnit(s,d,'transport-ship'),ids=s.units.filter(u=>u.player===0&&u.kind==='villager').map(u=>u.id);
 order(s,'load',{unitIds:ids,transportId:t.id});run(s,4000,()=>passengers(s,t.id).length===3);
 const pop=s.accounts[0].populationUsed;const g=spawn(s,1,'galley',t.x,t.y+300);g.hp=500;
 run(s,4000,()=>!s.units.some(u=>u.id===t.id));
 assert.ok(!s.units.some(u=>u.id===t.id),'the galley sank it');assert.equal(s.accounts[0].populationUsed,pop-4,'the transport and its three passengers are gone');
 assert.equal(passengers(s,t.id).length,0);
});

test('ships fight from the water: galley against galley, and a galley against a villager on the shore',()=>{
 const s=lakes(),d=dock(s);research(s,tcOf(s),'age-2');const a=trainUnit(s,d,'galley'),b=spawn(s,1,'galley',a.x+300,a.y);
 const st=statsOf('galley',ownerOf(s,0)),hit=hitDamage(st,statsOf('galley',ownerOf(s,1)));assert.equal(hit,6-6+8,'6 attack, 6 pierce armor, +8 against ships');
 run(s,600,()=>b.hp<maxHpOf('galley',ownerOf(s,1)));assert.equal((maxHpOf('galley',ownerOf(s,1))-b.hp)%hit,0,'hits of 8');
 run(s,3000,()=>!s.units.includes(a)||!s.units.includes(b));
 assert.ok(!s.units.includes(a)||!s.units.includes(b),'one galley sank');
 // Shots still in the air land after their galley sank (the 戰術技巧 round's flying shots): both may go down.
 settle(s,see);const g=[a,b].find(x=>s.units.includes(x))??spawn(s,0,'galley',a.x,a.y);g.hp=500;
 // A villager of the other side on the first free land node within the galley's range.
 const land=blockedTable(s.map);let shore=-1;
 for(let n=0;n<nodeTotal(s.map)&&shore<0;n++){if(land[n]||s.units.some(u=>u.node===n))continue;const p=position(s.map,n);if(Math.max(Math.abs(p.x-g.x),Math.abs(p.y-g.y))<=250)shore=n;}
 if(shore<0){const p=position(s.map,freeNode(s,g.x,g.y,'land'));order(s,'move',{unitIds:[g.id],x:p.x,y:p.y},g.player);run(s,2000,()=>g.navigation==='idle');
  for(let n=0;n<nodeTotal(s.map)&&shore<0;n++){if(land[n]||s.units.some(u=>u.node===n))continue;const q=position(s.map,n);if(Math.max(Math.abs(q.x-g.x),Math.abs(q.y-g.y))<=250)shore=n;}}
 assert.ok(shore>=0,'a shore node within range');
 const p=position(s.map,shore),v=makeUnit(s.map,s.nextUnitId++,1-g.player,p.x,p.y,'villager');v.hp=25;s.units.push(v);s.units.sort((x,y)=>x.id-y.id);s.accounts[1-g.player].populationUsed++;
 run(s,1500,()=>!s.units.includes(v));assert.ok(!s.units.includes(v),'the galley kills the villager on the shore');
 assert.equal(waterBlockedTable(s.map)[g.node],0,'firing from the water');
});

test('a demolition raft blows up a cluster of ships and itself',()=>{
 const s=lakes(),d=dock(s),fish=trainUnit(s,d,'fishing-ship');
 const red=[spawn(s,1,'fishing-ship',fish.x+600,fish.y),spawn(s,1,'fishing-ship',fish.x+650,fish.y),spawn(s,1,'fishing-ship',fish.x+600,fish.y+50)];
 research(s,tcOf(s),'age-2');s.accounts[0].populationCap=20;const raft=trainUnit(s,d,'demolition-raft');
 assert.equal(statsOf('demolition-raft',ownerOf(s,0)).sight,0,'ordered only');
 order(s,'attack',{unitIds:[raft.id],target:{kind:'unit',id:red[0].id}});
 run(s,3000,()=>!s.units.includes(raft));
 assert.ok(!s.units.includes(raft),'spent by its blast');
 assert.equal(red.filter(u=>s.units.includes(u)).length,0,'all three red ships sank (90 against 60 hit points, within 125)');
 assert.ok(s.units.includes(fish),'its own fishing ship is spared');
});

test('ships stay on the water and land units on land',()=>{
 const s=lakes(),d=dock(s);research(s,tcOf(s),'age-2');const g=trainUnit(s,d,'galley'),t=tcOf(s);
 order(s,'move',{unitIds:[g.id],x:t.x+100,y:t.y+100});run(s,3000,()=>g.navigation==='idle'||g.navigation==='unreachable');
 assert.equal(waterBlockedTable(s.map)[g.node],0,'the galley stopped on the water nearest the town centre');
 const v=s.units.find(u=>u.player===0&&u.kind==='villager')!;order(s,'move',{unitIds:[v.id],x:1600,y:1600});
 run(s,3000,()=>v.navigation==='idle'||v.navigation==='unreachable');assert.equal(blockedTable(s.map)[v.node],0,'the villager stopped on the shore');
 assert.ok(!wet(s,v.x,v.y));
 // Ships never garrison a building.
 assert.throws(()=>order(s,'garrison',{unitIds:[g.id],buildingId:t.id}),/只有/);
});

test('civilizations on the water: Saracen transports carry 10 with double hit points, Japanese fishing ships are tougher',()=>{
 const s=lakes(['saracens','japanese']);
 const t=spawn(s,0,'transport-ship',1500,1500),f=spawn(s,1,'fishing-ship',1500,1700);
 assert.equal(capacityOf(s,t),10);assert.equal(t.hp,200);
 assert.equal(f.hp,120);assert.deepEqual(statsOf('fishing-ship',ownerOf(s,1)).armor,[0,6]);
 // Careening adds 5 more; Dry Dock 10 more (Saracens 25 in all).
 s.techs[0].push('careening','dry-dock');assert.equal(capacityOf(s,t),25);
});

test('the water side replays deterministically',()=>{
 const play=()=>{const s=lakes(),d=dock(s),ship=trainUnit(s,d,'fishing-ship'),fish=deepFish(s).sort((a,b)=>Math.hypot(a.x-ship.x,a.y-ship.y)-Math.hypot(b.x-ship.x,b.y-ship.y)||(a.id<b.id?-1:1))[0];
  order(s,'gather',{unitIds:[ship.id],resourceId:fish.id});run(s,800);return hash(s);};
 assert.equal(play(),play());
});
