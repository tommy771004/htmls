import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {makeUnit} from '../packages/sim/movement.ts';
import type {UnitKind} from '../packages/sim/movement.ts';
import {position,nodeTotal,blockedTable,nodeAt} from '../packages/sim/navigation.ts';
import {authoritativeProblem} from '../packages/sim/buildings.ts';
import {religionRules} from '../packages/sim/religion.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
import {commandAttack} from '../packages/sim/combat.ts';
function order(s:State,commandType:string,payload:any,playerId=0){submit(s,{protocolVersion:1,rulesetHash,playerId,sequence:s.sequence[playerId]+1,targetTick:s.tick+1,commandType,payload} as any);}
const run=(s:State,n:number,stop=(_:State)=>false)=>{for(let i=0;i<n&&!stop(s);i++)tick(s);};
// Test fixtures (not in the command log): units placed by hand, relics moved next to the base.
function freeNode(s:State,x:number,y:number){let best=-1,dist=Infinity;const held=new Set(s.units.map(u=>u.node)),closed=blockedTable(s.map);
 for(let n=0;n<nodeTotal(s.map);n++){if(closed[n]||held.has(n))continue;const p=position(s.map,n),d=Math.abs(p.x-x)+Math.abs(p.y-y);if(d<dist){dist=d;best=n;}}return position(s.map,best);}
function spawn(s:State,player:number,kind:UnitKind,x:number,y:number){const p=freeNode(s,x,y),u=makeUnit(s.map,s.nextUnitId++,player,p.x,p.y,kind);s.units.push(u);s.units.sort((a,b)=>a.id-b.id);s.accounts[player].populationUsed++;return u;}
const tcOf=(s:State,player:number)=>{const b=obstacleBounds(s.map.obstacles.find(o=>o.kind==='town-center'&&!!o.red===(player===1))!);return {x:(b[0]+b[2])/2,y:(b[1]+b[3])/2,box:b};};
// Blue in the third age with a finished monastery near its town centre and a monk beside it.
function withMonastery(seed=260925){const s=createState(seed,'open','idle'),tc=tcOf(s,0);s.ages[0]=3;Object.assign(s.accounts[0].stock,{wood:1000,gold:0});
 const seen=new Set(s.vision[0].explored);for(let t=0;t<s.map.size*s.map.size;t++)seen.add(t);s.vision[0].explored=[...seen];
 let site:{x:number;y:number}|null=null;for(let r=350;r<=900&&!site;r+=50)for(let a=0;a<24&&!site;a++){const x=Math.round((tc.x+Math.cos(a*Math.PI/12)*r)/10)*10,y=Math.round((tc.y+Math.sin(a*Math.PI/12)*r)/10)*10;if(!authoritativeProblem(s,0,'monastery',x,y))site={x,y};}
 order(s,'build',{unitIds:[1,2,3],kind:'monastery',...site});run(s,3000,s=>s.buildings.some(b=>b.kind==='monastery'&&b.complete));
 const monastery=s.buildings.find(b=>b.kind==='monastery')!,box=obstacleBounds(s.map.obstacles.find(o=>o.id===monastery.id)!),monk=spawn(s,0,'monk',box[2]+100,box[3]+100);run(s,2);
 return {s,monastery,box,monk};}
const place=(s:State,id:number,x:number,y:number)=>{const p=freeNode(s,x,y),r=s.relics.find(r=>r.id===id)!;r.x=p.x;r.y=p.y;return r;};

test('the open map scatters 5 relics far from both bases and at a similar distance from each; the 16x16 maps have none',()=>{
 assert.equal(createState(260925).relics.length,0);const layouts=new Set<string>();
 for(const seed of [260925,1,7,99,31337]){const s=createState(seed,'open','idle'),[a,b]=[tcOf(s,0),tcOf(s,1)],closed=blockedTable(s.map);
  assert.equal(s.relics.length,religionRules.relics.count,`seed ${seed}`);
  for(const r of s.relics){const [d0,d1]=[a,b].map(c=>Math.hypot(r.x-c.x,r.y-c.y));assert.ok(Math.min(d0,d1)>=900&&Math.abs(d0-d1)<=400);
   assert.equal(closed[nodeAt(s.map,r)],0,'on an open node');assert.ok(s.relics.every(o=>o===r||Math.hypot(o.x-r.x,o.y-r.y)>=300));}
  assert.deepEqual(createState(seed,'open','idle').relics,s.relics,'deterministic');layouts.add(JSON.stringify(s.relics));}
 assert.equal(layouts.size,5,'each seed places them differently');
});

test('a monk carries a relic (it cannot convert meanwhile) into a monastery, which then yields 0.5 gold per second',()=>{
 const {s,monastery,monk}=withMonastery(),relic=place(s,1,monk.x+300,monk.y);run(s,2);
 order(s,'relic',{unitIds:[monk.id],relicId:relic.id});run(s,400,()=>relic.carrier===monk.id);assert.equal(relic.carrier,monk.id);
 const foe=spawn(s,1,'villager',monk.x+150,monk.y+100);run(s,2);
 assert.throws(()=>order(s,'convert',{unitIds:[monk.id],targetId:foe.id}),/攜帶聖物的僧侶不能轉化/);
 assert.throws(()=>order(s,'relic',{unitIds:[monk.id],relicId:2}),/已經攜帶聖物|找不到聖物/);
 order(s,'deposit',{unitIds:[monk.id],buildingId:monastery.id});run(s,600,()=>relic.monastery!==null);assert.equal(relic.monastery,monastery.id);assert.equal(relic.carrier,null);
 const gold=s.accounts[0].stock.gold;run(s,religionRules.relics.goldTicks*30);
 assert.equal(s.accounts[0].stock.gold-gold,30,'30 gold a minute');assert.ok(s.accounts[0].ledger.relic.gold>=30);
});

test('a carrier that dies drops the relic where it fell; a fallen monastery leaves its relics on the ground',()=>{
 const {s,monastery,monk}=withMonastery(),relic=place(s,1,monk.x+300,monk.y);run(s,2);
 order(s,'relic',{unitIds:[monk.id],relicId:relic.id});run(s,400,()=>relic.carrier===monk.id);
 const killer=spawn(s,1,'militia',monk.x+100,monk.y);run(s,1);commandAttack(s,[killer.id],{kind:'unit',id:monk.id});const at={x:monk.x,y:monk.y};run(s,600,()=>!s.units.includes(monk));
 assert.ok(!s.units.includes(monk));assert.equal(relic.carrier,null);assert.ok(Math.hypot(relic.x-at.x,relic.y-at.y)<=100,'dropped where the monk was');
 // Another monk picks it up and stores it; the monastery is then razed.
 s.units=s.units.filter(u=>u!==killer);s.accounts[1].populationUsed--;
 const second=spawn(s,0,'monk',relic.x-100,relic.y);run(s,2);order(s,'relic',{unitIds:[second.id],relicId:relic.id});run(s,400,()=>relic.carrier===second.id);
 order(s,'deposit',{unitIds:[second.id],buildingId:monastery.id});run(s,800,()=>relic.monastery!==null);assert.equal(relic.monastery,monastery.id);
 monastery.hp=1;const razer=spawn(s,1,'militia',relic.x+200,relic.y+200);run(s,1);commandAttack(s,[razer.id],{kind:'building',id:monastery.id});run(s,600,()=>!s.buildings.includes(monastery));
 assert.ok(!s.buildings.includes(monastery));assert.equal(relic.monastery,null);assert.equal(relic.carrier,null);
});

test('holding every relic starts a 200-year countdown; losing one stops it; keeping them all wins',()=>{
 const {s,monastery}=withMonastery();
 for(const r of s.relics)Object.assign(r,{carrier:null,monastery:monastery.id});run(s,1);
 assert.equal(s.relicVictory?.player,0);assert.equal(s.relicVictory!.endsTick-s.tick,religionRules.relics.victoryTicks);
 const kept=s.relics[0];kept.monastery=null;run(s,1);assert.equal(s.relicVictory,null,'one relic out: no countdown');
 kept.monastery=monastery.id;run(s,1);const ends=(s.relicVictory as {endsTick:number}|null)!.endsTick;run(s,religionRules.relics.victoryTicks+5,s=>!!s.outcome);
 assert.deepEqual(s.outcome,{winner:0,defeated:[1],tick:ends,reason:'relic'});
});

test('a remembered relic that was taken in the fog: the order is accepted, the monk walks there and finds nothing',()=>{
 const {s,monk}=withMonastery(),relic=s.relics[0],home={x:monk.x,y:monk.y};
 // The monk walks near the (far) relic until it sees it, then back home, out of sight of it.
 const spot=freeNode(s,relic.x-250,relic.y);order(s,'move',{unitIds:[monk.id],...spot});run(s,3000,()=>s.relicMemory[0].some(m=>m.id===relic.id));assert.ok(s.relicMemory[0].some(m=>m.id===relic.id),'seen');
 order(s,'move',{unitIds:[monk.id],...home});run(s,3000,()=>!monk.path.length&&monk.next===null&&Math.hypot(monk.x-home.x,monk.y-home.y)<200);
 // Red takes the relic out of blue's sight (fixture).
 const thief=spawn(s,1,'monk',relic.x,relic.y+50);relic.carrier=thief.id;run(s,1);
 assert.ok(s.relicMemory[0].some(m=>m.id===relic.id),'still remembered where it lay');
 order(s,'relic',{unitIds:[monk.id],relicId:relic.id});tick(s);assert.equal(s.rites[monk.id]?.kind,'relic','the monk sets off');run(s,4000,()=>!s.rites[monk.id]);
 assert.equal(s.rites[monk.id],undefined);assert.equal(relic.carrier,thief.id);assert.ok(!s.relicMemory[0].some(m=>m.id===relic.id),'the memory clears once the spot is seen');
});

test('nothing can be built over a relic',()=>{
 const {s}=withMonastery(),relic=place(s,1,s.map.size*50,s.map.size*50);
 const x=Math.round((relic.x-100)/10)*10,y=Math.round((relic.y-100)/10)*10;assert.equal(authoritativeProblem(s,0,'house',x,y),'聖物所在的位置不能建造');
});
