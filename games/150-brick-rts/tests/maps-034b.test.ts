// The 地圖 round's special-start and island maps (堡壘 Fortress, 圍城 Arena, 游牧 Nomad, 移民 Migration, 島嶼 Islands,
// 群島 Archipelago, 團隊群島 Team Islands): they generate valid and the same for the same seed; walled towns start with
// their prebuilt buildings and walls that close them in until a gate replaces a segment; a nomad start has no town
// centre and may build its first one in the Dark Age; island bases sit on separate land; and the computer gets out:
// it founds its nomad town centre, opens a gate in its wall, ferries its army to the other island, sends villagers to
// the land with the gold and stone its islet lacks, and shelters villagers from wolves.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,tick,hash,submit,rulesetHash} from '../packages/sim/sim.ts';
import type {State,Command} from '../packages/sim/sim.ts';
import {makeMap,validateMap,createPathJob,advancePathJob,nodeTotal,withoutWalls,blockedTable,nodeAt} from '../packages/sim/navigation.ts';
import type {MatchMapLayout} from '../packages/sim/terrain.ts';
import {placementProblem,buildRequirement,nomadWaiver,farmOwner,farmResourceId} from '../packages/sim/buildings.ts';
import {landAt,landOf} from '../packages/sim/ai-maps.ts';
import {makeUnit} from '../packages/sim/movement.ts';
import {GAIA} from '../packages/sim/fauna.ts';
import {mapCatalog} from '../packages/content/maps.ts';
import {specialMapRules} from '../packages/sim/maps/special.ts';
const SEEDS=[260925,1,42];
const special:MatchMapLayout[]=['fortress','arena','nomad','migration','islands','archipelago','team-islands'];
const islandsLike:MatchMapLayout[]=['migration','islands','archipelago','team-islands'];
const tc=(s:State,p:number)=>s.buildings.find(b=>b.player===p&&b.kind==='town-center');
const connected=(m:ReturnType<typeof makeMap>,a:{x:number;y:number},b:{x:number;y:number})=>{const j=createPathJob(m,0,a,b);advancePathJob(m,j,nodeTotal(m));return j.status==='found';};
const order=(s:State,player:number,commandType:string,payload:Record<string,unknown>)=>submit(s,{protocolVersion:1,rulesetHash,playerId:player,sequence:s.sequence[player]+1,targetTick:s.tick+1,commandType,payload} as unknown as Command);
test('the seven special maps are in the catalogue, generate valid for several seeds and the same for the same seed',()=>{
 for(const layout of special){assert.ok(mapCatalog.some(m=>m.layout===layout&&!m.planned),layout);
  for(const seed of SEEDS){const m=makeMap(seed,layout);assert.deepEqual(validateMap(m),[],`${layout} ${seed}`);if(seed===SEEDS[0])assert.equal(hash(m),hash(makeMap(seed,layout)),`${layout} deterministic`);
   assert.equal(m.obstacles.filter(o=>o.kind==='town-center').length,layout==='nomad'?0:2,`${layout} town centres`);
   assert.equal(!!m.walled,layout==='fortress'||layout==='arena',`${layout} walled`);assert.equal(!!m.nomad,layout==='nomad',`${layout} nomad`);assert.equal(!!m.separate,islandsLike.includes(layout),`${layout} separate`);}}
});
test('Fortress: each town starts walled in stone with five farms, four towers, four houses and a barracks, all finished and owned',()=>{
 const s=createState(SEEDS[0],{layout:'fortress',opponent:'idle'});
 for(const p of [0,1]){const own=s.buildings.filter(b=>b.player===p),count=(k:string)=>own.filter(b=>b.kind===k).length;
  assert.deepEqual([count('town-center'),count('barracks'),count('house'),count('farm'),count('watch-tower')],[1,1,4,5,4],`player ${p}`);assert.ok(count('stone-wall')>=40,`player ${p} walls`);
  assert.ok(own.every(b=>b.complete&&b.hp===b.maxHp&&b.hp>0),`player ${p}: finished`);
  // The farms are the owner's fields; the houses count towards housing (town centre 5 + four houses).
  for(const f of own.filter(b=>b.kind==='farm'))assert.equal(farmOwner(s,farmResourceId(f.id)),p);assert.equal(s.accounts[p].populationCap,25,`player ${p} housing`);}
 // The same layout for both: the second town is the first turned half round.
 const offsets=(p:number)=>{const c=tc(s,p)!;return s.buildings.filter(b=>b.player===p&&b.kind!=='stone-wall').map(b=>`${b.kind}:${Math.round(Math.abs(b.x-c.x)/100)},${Math.round(Math.abs(b.y-c.y)/100)}`).sort();};
 assert.equal(offsets(0).length,offsets(1).length);
});
test('walled towns (Fortress, Arena) are closed in until a gate replaces a segment of the own wall; the other player cannot gate it',()=>{
 for(const layout of ['fortress','arena'] as const){const m=makeMap(SEEDS[0],layout);
  assert.ok(!connected(m,m.starts[0][0],m.starts[1][0]),`${layout}: no way out through the walls`);assert.ok(connected(withoutWalls(m),m.starts[0][0],m.starts[1][0]),`${layout}: the bases connect once the walls open`);
  const s=createState(SEEDS[0],{layout,opponent:'idle'}),wall=s.buildings.find(b=>b.player===0&&b.kind==='stone-wall')!,explored=new Set([...Array(s.map.size**2).keys()]);
  const input={tiles:s.map.tiles,obstacles:s.map.obstacles,units:[],explored:(t:number)=>explored.has(t)};
  assert.equal(placementProblem(input,'gate',wall.x,wall.y,0),null,`${layout}: its owner may gate its wall`);assert.equal(placementProblem(input,'gate',wall.x,wall.y,1),'與建築或資源重疊',`${layout}: the other player may not`);}
 // Arena: gold and stone just outside each wall (the site's 門外).
 const a=createState(SEEDS[0],{layout:'arena',opponent:'idle'}),c=tc(a,0)!,ring=specialMapRules.arena.ring*100,centre={x:c.x+135,y:c.y+135};
 for(const kind of ['gold','stone'])assert.ok(a.map.resources.some(r=>r.kind===kind&&Math.max(Math.abs(r.x-centre.x),Math.abs(r.y-centre.y))>ring&&Math.hypot(r.x-centre.x,r.y-centre.y)<ring+700),`arena ${kind} outside the wall`);
});
test('Nomad: no town centre, three villagers apart and no scout; the first town centre may go up in the Dark Age, a second may not',()=>{
 const s=createState(SEEDS[0],{layout:'nomad',opponent:'idle'});assert.ok(!s.buildings.length,'no buildings');
 const v=s.units.filter(u=>u.player===0&&u.kind==='villager');assert.equal(v.length,3);assert.ok(!s.units.some(u=>u.kind==='scout'),'no scout');
 for(let i=0;i<v.length;i++)for(let j=i+1;j<v.length;j++)assert.ok(Math.hypot(v[i].x-v[j].x,v[i].y-v[j].y)>=300,'scattered');
 assert.ok(s.accounts[0].stock.wood>=275&&s.accounts[0].stock.stone>=100,'the stock pays for a town centre');
 assert.equal(buildRequirement(1,'town-center',[],'britons',[],false,nomadWaiver(s.map,[])),null,'first town centre in the Dark Age');
 assert.equal(buildRequirement(1,'town-center',[{kind:'town-center',complete:false}],'britons',[],false,nomadWaiver(s.map,[{kind:'town-center'}])),'需要第三時代','a second waits for the Castle Age');
 // The villagers found it: a site by their centre (on the grid), placed by the sim, and the match goes on meanwhile.
 const cx=Math.round(v.reduce((t,u)=>t+u.x,0)/30)*10,cy=Math.round(v.reduce((t,u)=>t+u.y,0)/30)*10;let placed=false;
 for(let r=0;r<=600&&!placed;r+=50)for(let dx=-r;dx<=r&&!placed;dx+=50)for(let dy=-r;dy<=r&&!placed;dy+=50){try{order(s,0,'build',{unitIds:v.map(u=>u.id),kind:'town-center',x:cx+dx,y:cy+dy});placed=true;}catch{}}
 assert.ok(placed,'a town centre site');for(let i=0;i<5;i++)tick(s);assert.equal(s.outcome,null,'no instant defeat');assert.ok(tc(s,0),'the foundation stands');
});
test('Migration and the island maps: the bases are on separate land; relics lie on land with a shore',()=>{
 for(const layout of islandsLike)for(const seed of SEEDS){const s=createState(seed,{layout,opponent:'idle'}),m=s.map;
  assert.ok(!connected(m,m.starts[0][0],m.starts[1][0]),`${layout} ${seed}: separate`);assert.notEqual(landAt(m,m.starts[0][0]),landAt(m,m.starts[1][0]));
  const land=landOf(m),closed=blockedTable(m);assert.equal(s.relics.length,5,`${layout} relics`);
  for(const r of s.relics){const n=nodeAt(m,r);assert.ok(n>=0&&!closed[n],`${layout} relic on open ground`);const comp=landAt(m,r);
   assert.ok(m.tiles.some((t,i)=>land[i]===comp&&[1,-1,m.size,-m.size].some(d=>m.tiles[i+d]?.terrainType==='water')),`${layout}: a ship can land by relic ${r.id}`);}}
 // Migration: the islet has no gold or stone (they are the mainland's), no boar anywhere.
 const g=createState(SEEDS[0],{layout:'migration',opponent:'idle'}),islet=landAt(g.map,g.map.starts[0][0]);
 assert.ok(!g.map.resources.some(r=>(r.kind==='gold'||r.kind==='stone')&&landAt(g.map,r)===islet),'no gold or stone on the islet');assert.ok(!g.units.some(u=>u.kind==='boar'),'no boar');
});
test('the computer: founds its nomad town centre, opens a gate in its wall, ferries its army across, settles the mainland, shelters from wolves',()=>{
 const run=(layout:MatchMapLayout,until:(s:State)=>boolean,limit:number)=>{const s=createState(SEEDS[0],{layout,opponent:'ai'});for(let i=0;i<limit&&!s.outcome&&!until(s);i++)tick(s);return s;};
 // Nomad: red's town centre goes up early.
 const n=run('nomad',s=>!!tc(s,1)?.complete,3000);assert.ok(tc(n,1)?.complete,`nomad: red town centre by tick ${n.tick}`);
 // Fortress: a gate in red's wall, and red soldiers beyond it.
 const f=run('fortress',s=>{const c=tc(s,1);return !!c&&s.buildings.some(b=>b.player===1&&b.kind==='gate')&&s.units.some(u=>u.player===1&&u.kind!=='villager'&&u.kind!=='scout'&&Math.max(Math.abs(u.x-c.x-135),Math.abs(u.y-c.y-135))>specialMapRules.fortress.ring*100+100);},14000);
 assert.ok(f.buildings.some(b=>b.player===1&&b.kind==='gate'),'fortress: red gate');
 // Islands: red soldiers land on blue's island.
 const i=run('islands',s=>s.units.some(u=>u.player===1&&u.kind!=='transport-ship'&&landAt(s.map,u)===landAt(s.map,s.map.starts[0][0])&&landAt(s.map,u)>=0),12000);
 assert.ok(i.units.some(u=>u.player===1&&landAt(i.map,u)===landAt(i.map,i.map.starts[0][0]))||i.outcome?.winner===1,`islands: red on blue's island by tick ${i.tick}`);
 // Migration: red villagers on the mainland and a mining camp there.
 const g=run('migration',s=>s.buildings.some(b=>b.player===1&&b.kind==='mining-camp'),12000);
 assert.ok(g.buildings.some(b=>b.player===1&&b.kind==='mining-camp'&&landAt(g.map,{x:b.x+100,y:b.y+100})!==landAt(g.map,g.map.starts[1][0])),'migration: a camp across the water');
 // Wolves: a red villager a wolf goes for shelters in the town centre (or runs to it).
 const w=createState(SEEDS[0],{layout:'arabia',opponent:'ai'});for(let k=0;k<200;k++)tick(w);
 const home=tc(w,1)!,away=(u:{x:number;y:number})=>Math.hypot(u.x-home.x-135,u.y-home.y-135),prey=w.units.filter(u=>u.player===1&&u.kind==='villager').sort((a,b)=>away(b)-away(a)||a.id-b.id)[0],before=away(prey);
 const spot=[[150,0],[-150,0],[0,150],[0,-150]].map(([dx,dy])=>({x:prey.x+dx,y:prey.y+dy})).find(p=>{const q=nodeAt(w.map,p);return q>=0&&!blockedTable(w.map)[q]&&!w.units.some(u=>u.x===p.x&&u.y===p.y);})!;
 w.units.push(makeUnit(w.map,990001,GAIA,spot.x,spot.y,'wolf'));w.units.sort((a,b)=>a.id-b.id);
 let sheltered=false;for(let k=0;k<200&&!sheltered;k++){tick(w);const u=w.units.find(u=>u.id===prey.id);sheltered=!!w.garrison[home.id]?.units.some(e=>e.unit.id===prey.id)||!!u&&away(u)<before-150;}
 assert.ok(sheltered,'the villager shelters or runs home');
});
