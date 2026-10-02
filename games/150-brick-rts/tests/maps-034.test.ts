// The 地圖 round (aoetw.com's AoK and Conquerors random maps): every new match map generates, deterministically and fairly,
// with land-connected bases, its base kit, relics on land and fish on its water; Ghost Lake's ice is walkable but not
// buildable; wolves and jaguars hunt villagers but leave monks and scouts alone, and soldiers fight them; fighting from
// higher ground does half as much again; the computer plays every new map without errors.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,tick,hash,replay} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {makeMap,validateMap,blockedTable,nodeAt,position,nodeTotal,clearSegment} from '../packages/sim/navigation.ts';
import {matchMapLayouts,tileAt,groundHeight} from '../packages/sim/terrain.ts';
import type {MatchMapLayout} from '../packages/sim/terrain.ts';
import {makeUnit} from '../packages/sim/movement.ts';
import type {UnitKind} from '../packages/sim/movement.ts';
import {strike,elevationRules} from '../packages/sim/combat.ts';
import {placementProblem} from '../packages/sim/buildings.ts';
import {mapCatalog} from '../packages/content/maps.ts';
import {animalRules} from '../packages/sim/fauna.ts';
const SEEDS=[260925,1,42];
// The special-start and island maps (walled towns, no town centre, separate landmasses) have their own tests in
// tests/maps-034b.test.ts; the checks here are for the open-start maps.
const special=new Set<MatchMapLayout>(['fortress','arena','nomad','migration','islands','archipelago','team-islands']),plain=matchMapLayouts.filter(l=>!special.has(l));
const water:MatchMapLayout[]=['coastal','mediterranean','baltic','continental','rivers','highland','oasis','scandinavia','salt-marsh','crater-lake'];
// Generated once per layout and seed (generation takes a tenth of a second or so).
const made=new Map<string,ReturnType<typeof makeMap>>(),map=(seed:number,layout:MatchMapLayout)=>{const k=`${layout}|${seed}`;if(!made.has(k))made.set(k,makeMap(seed,layout));return made.get(k)!;};
const centre=(m:ReturnType<typeof makeMap>,red:boolean)=>{const o=m.obstacles.find(o=>o.kind==='town-center'&&!!o.red===red)!;return {x:o.x+135,y:o.y+135};};
test('every new map is in the catalogue, generates for several seeds, validates and is the same for the same seed',()=>{
 assert.deepEqual(mapCatalog.filter(m=>m.layout).map(m=>m.layout).sort(),[...matchMapLayouts].sort());
 for(const layout of plain)for(const seed of SEEDS){const a=map(seed,layout);
  assert.equal(a.size,32,layout);assert.deepEqual(validateMap(a),[],`${layout} ${seed}`);if(seed===SEEDS[0])assert.equal(hash(a),hash(makeMap(seed,layout)),`${layout} ${seed} deterministic`);
  assert.equal(a.obstacles.filter(o=>o.kind==='town-center').length,2,layout);assert.ok(!a.separate,`${layout}: bases share a landmass`);}
});
test('the maps are fair: resources come in mirrored pairs, each base owns as many sheep and is as near its kit as the other',()=>{
 for(const layout of plain)for(const seed of SEEDS){const m=map(seed,layout),c=[centre(m,false),centre(m,true)];
  for(const kind of ['tree','gold','stone','berries','fish'])assert.equal(m.resources.filter(r=>r.kind===kind).length%2,0,`${layout} ${seed} ${kind} in pairs`);
  const owned=[0,1].map(p=>(m.animals??[]).filter(a=>a.kind==='sheep'&&a.owner===p).length);assert.equal(owned[0],owned[1],`${layout} ${seed} sheep`);assert.ok(owned[0]>=4,`${layout} ${seed} has a flock`);
  for(const kind of ['tree','gold','stone','berries']){const near=c.map(p=>Math.min(...m.resources.filter(r=>r.kind===kind).map(r=>Math.hypot(r.x-p.x,r.y-p.y))));
   assert.ok(near[0]<=1100&&Math.abs(near[0]-near[1])<=120,`${layout} ${seed} ${kind}: ${near.map(Math.round)}`);}}
});
test('relics lie on land the bases can reach; the water maps have fish (deep fish on the seas)',()=>{
 for(const layout of plain){const s=createState(SEEDS[0],layout,'idle'),closed=blockedTable(s.map);assert.equal(s.relics.length,5,layout);
  for(const r of s.relics){const n=nodeAt(s.map,r);assert.ok(n>=0&&!closed[n],`${layout} relic ${r.id} on open ground`);assert.notEqual(s.map.tiles[tileAt(r.x,r.y,s.map.size)].walkClass,'water',`${layout}: on land or a ford`);}}
 for(const layout of water){const m=map(SEEDS[0],layout);assert.ok(m.resources.some(r=>r.kind==='fish'),`${layout} has fish`);}
 for(const layout of ['coastal','mediterranean','baltic'] as const){const m=map(SEEDS[0],layout),size=m.size;
  assert.ok(m.resources.some(r=>{if(r.kind!=='fish')return false;const tx=Math.floor(r.x/100),ty=Math.floor(r.y/100);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(m.tiles[(ty+dy)*size+tx+dx]?.terrainType!=='water')return false;return true;}),`${layout} deep fish`);}
 // Each map's character: Mongolia, Highland and Crater Lake have plateaus; Ghost Lake ice; Gold Rush a gold field.
 for(const layout of ['mongolia','highland','crater-lake'] as const)assert.ok(map(SEEDS[0],layout).tiles.some(t=>t.height===100),`${layout} plateaus`);
 const gold=map(SEEDS[0],'gold-rush'),mid=gold.size*50;assert.ok(gold.resources.filter(r=>r.kind==='gold'&&Math.hypot(r.x-mid,r.y-mid)<600).length>=8,'gold field');
 const forest=map(SEEDS[0],'black-forest');assert.ok(forest.resources.filter(r=>r.kind==='tree').length>=300,'black forest is thick');
});
test('Ghost Lake: the frozen centre is walkable, nothing can be built on it and nothing lies on it',()=>{
 const m=map(SEEDS[0],'ghost-lake'),size=m.size,ice=m.tiles.filter(t=>t.terrainType==='ice');assert.ok(ice.length>=60,'a big frozen lake');
 for(const t of ice){assert.equal(t.walkClass,'land');assert.equal(t.buildability,false);assert.deepEqual(t.resourceRefs,[]);assert.deepEqual(t.obstacleRefs,[]);}
 const t=ice[Math.floor(ice.length/2)],x=(t.id%size)*100,y=Math.floor(t.id/size)*100;
 assert.ok(clearSegment(m,{x:x+50,y:y+50},{x:x+50,y:y+50}),'a unit can stand on the ice');
 assert.match(placementProblem({tiles:m.tiles,obstacles:m.obstacles,units:[],explored:()=>true},'house',x,y)??'',/地形不可建造/);
});
// A unit of the given kind on the free node nearest a point (for the scripted fights below).
function spawn(s:State,kind:UnitKind,player:number,at:{x:number;y:number}){const closed=blockedTable(s.map),held=new Set(s.units.map(u=>u.node));let best=-1,d=Infinity;
 for(let n=0;n<nodeTotal(s.map);n++){if(closed[n]||held.has(n))continue;const p=position(s.map,n),e=Math.abs(p.x-at.x)+Math.abs(p.y-at.y);if(e<d){d=e;best=n;}}
 const p=position(s.map,best),u=makeUnit(s.map,s.nextUnitId++,player,p.x,p.y,kind);s.units.push(u);s.accounts[player].populationUsed++;return u;}
test('wolves and jaguars hunt villagers but leave monks and scouts alone; soldiers fight them; they leave no food',()=>{
 for(const [layout,kind] of [['gold-rush','wolf'],['ghost-lake','wolf'],['yucatan','jaguar']] as const)assert.ok(createState(SEEDS[0],layout,'idle').units.some(u=>u.kind===kind),`${layout} has ${kind}`);
 const s=createState(SEEDS[0],'gold-rush','idle'),wolf=s.units.find(u=>u.kind==='wolf')!;
 // Everyone else far away: only these units are within the wolf's sight.
 for(const u of s.units)if(u.kind==='wolf'&&u!==wolf)s.units=s.units.filter(v=>v!==u);
 const monk=spawn(s,'monk',0,{x:wolf.x+150,y:wolf.y}),scout=spawn(s,'scout',0,{x:wolf.x-150,y:wolf.y}),full=[monk.hp,scout.hp];
 for(let i=0;i<200;i++)tick(s);assert.deepEqual([monk.hp,scout.hp],full,'the monk and the scout are left alone');assert.ok(!s.beasts[wolf.id],'no prey picked');
 const villager=spawn(s,'villager',0,{x:wolf.x,y:wolf.y+150}),before=villager.hp;
 for(let i=0;i<200&&s.units.includes(villager)&&villager.hp===before;i++)tick(s);assert.ok(!s.units.includes(villager)||villager.hp<before,'the wolf attacks the villager');
 // A soldier on its own engages the wolf and kills it; the wolf leaves no carcass.
 const militia=spawn(s,'militia',0,{x:wolf.x+100,y:wolf.y+100});
 for(let i=0;i<600&&s.units.includes(wolf);i++)tick(s);assert.ok(!s.units.includes(wolf),'the militia kills the wolf');
 assert.ok(!s.map.resources.some(r=>r.id===`resource-carcass-${wolf.id}`),'no food');assert.equal(animalRules.food.wolf,0);void militia;
});
test('the wolf\'s sight follows the difficulty: 4 tiles on 簡單, 6 on 標準, 12 on 困難 and 最難',()=>{
 assert.deepEqual(animalRules.hostileSight,{easy:400,standard:600,hard:1200,hardest:1200});
 for(const [difficulty,near] of [['easy',false],['standard',true]] as const){const s=createState(SEEDS[0],{layout:'gold-rush',opponent:'idle',difficulty}),wolf=s.units.find(u=>u.kind==='wolf')!;
  for(const u of s.units)if(u.kind==='wolf'&&u!==wolf)s.units=s.units.filter(v=>v!==u);
  spawn(s,'villager',0,{x:wolf.x+500,y:wolf.y});tick(s);assert.equal(!!s.beasts[wolf.id],near,difficulty);}
});
test('a blow or shot from higher ground does half as much again; from lower or level ground, the plain hit',()=>{
 assert.equal(elevationRules.bonus,1.5);
 // The acceptance ground has a highland (height 100) at tiles 2-5 by 11-14 (one corner is a cliff).
 const s=createState(SEEDS[0],'acceptance','idle'),high={x:350,y:1250},low={x:800,y:300};
 assert.equal(groundHeight(s.map.tiles,high.x,high.y),100);assert.equal(groundHeight(s.map.tiles,low.x,low.y),0);
 const target=spawn(s,'militia',1,low),uphill=spawn(s,'militia',1,high);
 let hp=target.hp;strike(s,{kind:'unit',id:target.id},10,-1,high);assert.equal(hp-target.hp,15,'from above');
 hp=target.hp;strike(s,{kind:'unit',id:target.id},10,-1,{x:low.x+100,y:low.y});assert.equal(hp-target.hp,10,'level');
 hp=uphill.hp;strike(s,{kind:'unit',id:uphill.id},10,-1,low);assert.equal(hp-uphill.hp,10,'from below: no penalty, no bonus');
});
test('the computer plays every new map without errors; a match on one replays the same',()=>{
 const long=new Set<MatchMapLayout>(['arabia','gold-rush']);
 for(const layout of plain){const s=createState(SEEDS[0],layout,'ai'),ticks=long.has(layout)?6000:1500;
  for(let i=0;i<ticks&&!s.outcome;i++)tick(s);
  assert.ok(s.units.some(u=>u.player===1&&u.kind==='villager'),`${layout}: the computer still has villagers`);
  assert.ok(s.buildings.filter(b=>b.player===1).length>=3,`${layout}: the computer built`);
  if(layout==='arabia')assert.equal(hash(replay(SEEDS[0],s.log,s.tick,'arabia','ai')),hash(s),'replay');}
});
test('every match map is fair per base: each resource has its twin on the mirrored tile, and each base has as many boar, deer, sheep, wolves and jaguars',()=>{
 // A resource counts by its tile (the generator places every one on a tile and its mirror, the map turned half round or
 // reflected left to right: whichever pairs them). Animals are counted against the first base and the exact mirror of
 // it (the second base's town centre snaps up to half a node off that mirror); exact ties are left out. Fields are the
 // prebuilt farms' (mirrored as whole footprints), checked with the buildings.
 for(const layout of matchMapLayouts)for(const seed of [260925,1,42,7]){const m=map(seed,layout),n=m.size,W=n*100;
  const tiles=m.resources.filter(r=>r.kind!=='farm').map(r=>({kind:r.kind,t:Math.floor(r.y/100)*n+Math.floor(r.x/100)})),key=(k:string,t:number)=>`${k}@${t}`;
  const twin=(t:number,rot:boolean)=>{const x=t%n,y=Math.floor(t/n);return rot?(n-1-y)*n+(n-1-x):y*n+(n-1-x);};
  const count=new Map<string,number>();for(const r of tiles)count.set(key(r.kind,r.t),(count.get(key(r.kind,r.t))??0)+1);
  const unpaired=(rot:boolean)=>tiles.filter(r=>count.get(key(r.kind,twin(r.t,rot)))!==count.get(key(r.kind,r.t)));
  const rot=unpaired(true).length<=unpaired(false).length,odd=unpaired(rot);assert.deepEqual(odd.map(r=>key(r.kind,r.t)),[],`${layout} ${seed}: resources without a twin`);
  const first=m.obstacles.find(o=>o.kind==='town-center'&&!o.red),c0=first?{x:first.x+135,y:first.y+135}:m.starts[0][0],c1=rot?{x:W-c0.x,y:W-c0.y}:{x:W-c0.x,y:c0.y};
  for(const kind of ['boar','deer','sheep','wolf','jaguar']){const per=[0,0];for(const a of (m.animals??[]).filter(a=>a.kind===kind)){const d0=Math.hypot(a.x-c0.x,a.y-c0.y),d1=Math.hypot(a.x-c1.x,a.y-c1.y);if(d0!==d1)per[d0<d1?0:1]++;}
   assert.equal(per[0],per[1],`${layout} ${seed}: ${kind} per base ${per}`);}}
});
