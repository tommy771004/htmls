import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,hash,serialize,deserialize,replay,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {makeUnit} from '../packages/sim/movement.ts';
import type {UnitKind} from '../packages/sim/movement.ts';
import {position,blockedTable,nodeTotal} from '../packages/sim/navigation.ts';
import {maxHpOf,statsOf,hitDamage} from '../packages/sim/stats.ts';
import {defenseRules} from '../packages/sim/defense.ts';
import {authoritativeProblem} from '../packages/sim/buildings.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
import {isAnimal} from '../packages/sim/fauna.ts';
function order(s:State,commandType:string,payload:any,playerId=0){submit(s,{protocolVersion:1,rulesetHash,playerId,sequence:s.sequence[playerId]+1,targetTick:s.tick+1,commandType,payload} as any);}
const run=(s:State,n:number,stop=()=>false)=>{for(let i=0;i<n&&!stop();i++)tick(s);};
function spawn(s:State,player:number,kind:UnitKind,x:number,y:number){const closed=blockedTable(s.map),held=new Set(s.units.map(u=>u.node));let best=-1,d=Infinity;
 for(let n=0;n<nodeTotal(s.map);n++){if(closed[n]||held.has(n))continue;const p=position(s.map,n),e=Math.abs(p.x-x)+Math.abs(p.y-y);if(e<d){d=e;best=n;}}
 const p=position(s.map,best),u=makeUnit(s.map,s.nextUnitId++,player,p.x,p.y,kind);u.hp=maxHpOf(kind,s.techs[player]);s.units.push(u);s.units.sort((a,b)=>a.id-b.id);s.accounts[player].populationUsed++;return u;}
const tcOf=(s:State,p:number)=>s.buildings.find(b=>b.player===p&&b.kind==='town-center')!;
const boxOf=(s:State,id:string)=>obstacleBounds(s.map.obstacles.find(o=>o.id===id)!);
const see=(s:State)=>{for(const v of s.vision){v.visible=Array.from({length:256},(_,i)=>i);v.explored=[...v.visible];}};

test('a town centre shoots the nearest visible enemy in range and nothing out of range',()=>{
 const s=createState(260925);s.units=s.units.filter(u=>!isAnimal(u.kind));const box=boxOf(s,tcOf(s,0).id);
 const near=spawn(s,1,'militia',box[2]+150,(box[1]+box[3])/2),far=spawn(s,1,'militia',box[2]+450,(box[1]+box[3])/2);see(s);
 run(s,defenseRules.arrows['town-center'].cooldown+2,()=>{see(s);return false;});
 assert.equal(near.hp,45-2*(5-1),'two volleys of one arrow, 5 pierce against armor 1');assert.equal(far.hp,45);
 assert.ok(s.shots.length<=1&&s.shots.every(v=>v.player===0));
});

test('villagers and archers inside add arrows; cavalry and relic carriers cannot go in; the building has room for 15',()=>{
 const s=createState(260925);s.units=s.units.filter(u=>!isAnimal(u.kind));const tc=tcOf(s,0),box=boxOf(s,tc.id);
 order(s,'garrison',{unitIds:[1,2,3],buildingId:tc.id});run(s,200,()=>s.garrison[tc.id]?.units.length===3);
 assert.equal(s.garrison[tc.id].units.length,3);assert.ok(![1,2,3].some(id=>s.units.some(u=>u.id===id)),'inside means out of the world');assert.equal(s.accounts[0].populationUsed,3,'still counted');
 const knight=spawn(s,0,'knight',box[2]+100,box[3]+100);assert.throws(()=>order(s,'garrison',{unitIds:[knight.id],buildingId:tc.id}),/只有村民、步兵、弓兵與僧侶/);
 const foe=spawn(s,1,'militia',box[2]+150,(box[1]+box[3])/2);see(s);s.volleys[tc.id]=0;tick(s);
 assert.equal(foe.hp,45-4*4,'one arrow plus one per villager inside');
 assert.equal(defenseRules.capacity['town-center'],15);
});

test('the town bell sends every villager inside with its work remembered; rung again they go back to that work',()=>{
 const s=createState(260925);const tree=s.map.resources.filter(r=>r.kind==='tree'&&r.collectible).sort((a,b)=>Math.abs(a.x-400)+Math.abs(a.y-700)-Math.abs(b.x-400)-Math.abs(b.y-700))[0];
 order(s,'gather',{unitIds:[1,2,3],resourceId:tree.id});run(s,300);
 order(s,'bell',{ring:true});run(s,400,()=>s.units.filter(u=>u.player===0&&u.kind==='villager').length===0);
 const tc=tcOf(s,0);assert.equal(s.garrison[tc.id].units.length,3);assert.ok(s.garrison[tc.id].units.every(e=>e.bell&&e.work?.kind==='gather'));
 order(s,'bell',{ring:false});tick(s);tick(s);
 assert.equal(s.units.filter(u=>u.player===0&&u.kind==='villager').length,3,'out again');assert.ok([1,2,3].every(id=>{const w=s.works[id];return w?.kind==='gather'&&w.resourceId===tree.id;}),'back on the same tree');
 const copy=deserialize(serialize(s));run(s,100);run(copy,100);assert.equal(hash(copy),hash(s));assert.equal(hash(replay(s.seed,s.log,s.tick)),hash(s));
});

test('units inside heal; when the building falls they come out where it stood',()=>{
 const s=createState(260925);const tc=tcOf(s,0);s.units.find(u=>u.id===1)!.hp=10;
 order(s,'garrison',{unitIds:[1],buildingId:tc.id});run(s,200,()=>!!s.garrison[tc.id]);const inside=s.garrison[tc.id].units[0].unit;const hp=inside.hp;
 run(s,defenseRules.healTicks*3);assert.ok(inside.hp>=hp+2,'healing inside');
 s.buildings=s.buildings.filter(b=>b!==tc);s.map.obstacles=s.map.obstacles.filter(o=>o.id!==tc.id);tick(s);
 assert.ok(s.units.includes(inside),'ejected when the town centre is gone');assert.equal(s.garrison[tc.id],undefined);
});

test('a battering ram breaks buildings, cannot be ordered at units, and shrugs off arrows',()=>{
 const s=createState(260925);s.units=s.units.filter(u=>!isAnimal(u.kind));const red=tcOf(s,1),box=boxOf(s,red.id);
 const ram=spawn(s,0,'ram',box[0]-150,box[3]+100);see(s);
 assert.throws(()=>order(s,'attack',{unitIds:[ram.id],target:{kind:'unit',id:4}}),/攻城槌只能攻擊建築/);
 order(s,'attack',{unitIds:[ram.id],target:{kind:'building',id:red.id}});const hp=red.hp;run(s,400,()=>{see(s);return red.hp<=hp-84;});
 assert.ok(red.hp<=hp-84,'two strikes of 42');
 // Arrows barely scratch it (red is idle here, so its town centre is passive; the number comes from the same formula).
 assert.equal(hitDamage({...statsOf('archer'),damage:defenseRules.arrows['town-center'].damage},statsOf('ram')),1);
});

test('a watch tower needs the second age, costs stone, and shoots once built',()=>{
 const s=createState(260925);s.units=s.units.filter(u=>!isAnimal(u.kind));s.vision[0].explored=Array.from({length:256},(_,i)=>i);
 let site=null as null|{x:number;y:number};for(let y=700;y<=1100&&!site;y+=50)for(let x=500;x<=800&&!site;x+=50)if(!authoritativeProblem(s,0,'watch-tower',x,y))site={x,y};
 assert.throws(()=>order(s,'build',{unitIds:[1],kind:'watch-tower',...site}),/需要第二時代/);
 s.ages[0]=2;s.accounts[0].stock.stone=200;order(s,'build',{unitIds:[1,2,3],kind:'watch-tower',...site});run(s,2000,()=>s.buildings.some(b=>b.kind==='watch-tower'&&b.complete));
 const tower=s.buildings.find(b=>b.kind==='watch-tower'&&b.complete)!;assert.ok(tower);assert.equal(s.accounts[0].stock.stone,75);
 const foe=spawn(s,1,'militia',site!.x+300,site!.y+50);see(s);run(s,defenseRules.arrows['watch-tower'].cooldown+2,()=>{see(s);return false;});assert.ok(foe.hp<45,'the tower shot');
});

test('practice mode: with red idle its town centre does not shoot; against the computer it does',()=>{
 for(const opponent of ['idle','ai'] as const){const s=createState(260925,'meadow',opponent);s.units=s.units.filter(u=>!isAnimal(u.kind));const box=boxOf(s,tcOf(s,1).id);
  const blue=spawn(s,0,'militia',box[0]-150,(box[1]+box[3])/2);see(s);run(s,defenseRules.arrows['town-center'].cooldown+2,()=>{see(s);return false;});
  if(opponent==='idle')assert.equal(blue.hp,45);else assert.ok(blue.hp<45);}
});
