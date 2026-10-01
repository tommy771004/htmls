// The 單位 round (state v28): the new land units, their line upgrades, the siege mechanics (minimum range, blast,
// pass-through, buildings only, the petard's charge, the trebuchet's setup), the camel class and the civilization
// effects aimed at them, all through the real sim: createState with civs, commands by submit, ticks. Fixture shortcuts
// (stock gifts, finished foundations, research finished early, units spawned on a node) only skip the waiting.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,hash,serialize,deserialize,replay,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {makeUnit} from '../packages/sim/movement.ts';
import type {Unit,UnitKind} from '../packages/sim/movement.ts';
import {position,blockedTable,nodeTotal} from '../packages/sim/navigation.ts';
import {statsOf,maxHpOf,speedOf,combatRules,hitDamage,lineName,lineUpgrades,buildingTarget} from '../packages/sim/stats.ts';
import type {CombatUnitKind} from '../packages/sim/stats.ts';
import {ownerOf,costOf,unitMatches} from '../packages/sim/civ.ts';
import type {Owner} from '../packages/sim/civ.ts';
import {authoritativeProblem,buildRequirement,placeBuilding,addWork} from '../packages/sim/buildings.ts';
import type {Building,BuildKind} from '../packages/sim/buildings.ts';
import {trainBlocker} from '../packages/sim/production.ts';
import {reach} from '../packages/sim/combat.ts';
import {createService,decodeView} from '../packages/sim/protocol.ts';
import {rules,resources} from '../packages/content/rules.ts';
import {civDefs,neutralCiv} from '../packages/content/civs.ts';
import {castleAgeMatch} from './castle-age-fixture.ts';

const SEED=260925;
function order(s:State,commandType:string,payload:any,playerId=0){submit(s,{protocolVersion:1,rulesetHash,playerId,sequence:s.sequence[playerId]+1,targetTick:s.tick+1,commandType,payload} as any);}
const tiles=(s:State)=>Array.from({length:s.map.size*s.map.size},(_,i)=>i);
// Both sides see the whole map (targets must be visible to be ordered and to stay targets); renewed before every tick
// because each tick's vision update replaces it. Never used on the logged matches (it is not a command).
const see=(s:State)=>{for(const v of s.vision){v.visible=tiles(s);v.explored=tiles(s);}};
const run=(s:State,n:number,stop=()=>false)=>{for(let i=0;i<n;i++){see(s);if(stop())return;tick(s);}see(s);};
const own=(civ:string,age=1,techs:string[]=[]):Owner=>({civ,age,techs});
// Blue plays civ on the small meadow, red the neutral civilization and idle (its town centre never shoots).
function match(civ:string,red=neutralCiv){const s=createState(SEED,'meadow','idle',[civ,red]);see(s);return s;}
const tcOf=(s:State,p=0)=>s.buildings.find(b=>b.player===p&&b.kind==='town-center')!;
// Red's starting villager out of the way (it would be the nearest enemy of anything placed near red's base).
const clearRed=(s:State)=>{s.units=s.units.filter(u=>!(u.player===1&&u.kind==='villager'));};
function freeNode(s:State,x:number,y:number){const closed=blockedTable(s.map),held=new Set(s.units.flatMap(u=>u.next===null?[u.node]:[u.node,u.next]));let best=-1,d=Infinity;
 for(let n=0;n<nodeTotal(s.map);n++){if(closed[n]||held.has(n))continue;const p=position(s.map,n),e=Math.abs(p.x-x)+Math.abs(p.y-y);if(e<d){d=e;best=n;}}return best;}
// A unit at its owner's full health on the free node nearest the point (exact: asserted), counted in population.
function spawn(s:State,player:number,kind:UnitKind,x:number,y:number,exact=true){const p=position(s.map,freeNode(s,x,y)),u=makeUnit(s.map,s.nextUnitId++,player,p.x,p.y,kind);
 if(exact)assert.deepEqual({x:u.x,y:u.y},{x,y},`${kind} stands on the node asked for`);
 u.hp=maxHpOf(kind as CombatUnitKind,ownerOf(s,player));s.units.push(u);s.units.sort((a,b)=>a.id-b.id);s.accounts[player].populationUsed++;return u;}
// Pays the owner's price (fixture gift), queues the entry by command and finishes it early; completion runs through
// stepProduction (refreshOwner), as in a match.
function research(s:State,b:Building,entryId:string){const p=b.player,cost=costOf(entryId,ownerOf(s,p));for(const k of resources)s.accounts[p].stock[k]+=cost[k];
 order(s,'train',{buildingId:b.id,entryId},p);tick(s);const item=b.queue.find(q=>q.entryId===entryId);if(item){assert.equal(b.queue[0],item,'first in the queue');item.work=Math.max(item.work,item.required-1);tick(s);}
 const m=/^age-(\d)$/.exec(entryId);assert.ok(m?s.ages[p]>=Number(m[1]):s.techs[p].includes(entryId),`${entryId} done`);see(s);}
function ageTo(s:State,age:number,p=0){for(let a=s.ages[p]+1;a<=age;a++)research(s,tcOf(s,p),`age-${a}`);}
// A finished building on the free site nearest the town centre (fixture: paid, then worked through).
function raise(s:State,p:number,kind:BuildKind){const t=tcOf(s,p),c={x:t.x+135,y:t.y+135},sites:{x:number;y:number;d:number}[]=[];
 for(let y=50;y<s.map.size*100;y+=50)for(let x=50;x<s.map.size*100;x+=50)if(!authoritativeProblem(s,p,kind,x,y))sites.push({x,y,d:Math.hypot(x-c.x,y-c.y)});
 sites.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);assert.ok(sites.length,'a site for '+kind);
 const cost=costOf(kind,ownerOf(s,p));for(const k of resources)s.accounts[p].stock[k]+=cost[k];
 const b=placeBuilding(s,p,kind,sites[0].x,sites[0].y,`fixture:${s.nextBuildingId}`);while(!b.complete)addWork(s,b);return b;}
const needs:Partial<Record<BuildKind,BuildKind[]>>={'archery-range':['barracks'],stable:['barracks'],'siege-workshop':['blacksmith']};
// The building with whatever it needs first (the archery range after a barracks, the workshop after a blacksmith).
function building(s:State,kind:BuildKind,p=0):Building{for(const k of needs[kind]??[])if(!s.buildings.some(b=>b.player===p&&b.kind===k&&b.complete))building(s,k,p);
 return s.buildings.find(b=>b.player===p&&b.kind===kind&&b.complete)??raise(s,p,kind);}
// Trains one unit by command (paid by a gift, finished early) and returns it; the price is taken exactly.
function trainUnit(s:State,b:Building,entryId:string){const p=b.player,cost=costOf(entryId,ownerOf(s,p));for(const k of resources)s.accounts[p].stock[k]+=cost[k];
 const stock={...s.accounts[p].stock},ids=new Set(s.units.map(u=>u.id));order(s,'train',{buildingId:b.id,entryId},p);tick(s);
 const item=b.queue.find(q=>q.entryId===entryId);assert.ok(item,entryId+' queued');item!.work=Math.max(item!.work,item!.required-1);
 const fresh=()=>s.units.find(u=>!ids.has(u.id)&&u.player===p);run(s,10,()=>!!fresh());const u=fresh();assert.ok(u,entryId+' trained');assert.equal(u!.kind,entryId);
 for(const k of resources)assert.equal(s.accounts[p].stock[k],stock[k]-cost[k],`${entryId} costs its ${k}`);return u!;}
const refusal=(s:State,b:Building,entryId:string,message:RegExp)=>assert.throws(()=>order(s,'train',{buildingId:b.id,entryId}),message,`${entryId} at the ${b.kind}`);
// Blue's trebuchet numbers (setup is always set for it).
const trebuchetOf=(s:State)=>{const st=statsOf('trebuchet',ownerOf(s,0));assert.ok(st.setup);return {...st,setup:st.setup!};};
const entryName=(id:string)=>rules.entries.find(e=>e.id===id)!.name;
const kinds=Object.keys(combatRules.units) as CombatUnitKind[];
// Which unit kinds differ between two owners, and in which fields (speed included).
function changed(a:Owner,b:Owner){const out:Record<string,string[]>={};
 for(const k of kinds){const x=statsOf(k,a) as Record<string,unknown>,y=statsOf(k,b) as Record<string,unknown>;
  const f=[...new Set([...Object.keys(x),...Object.keys(y)])].filter(f=>JSON.stringify(x[f])!==JSON.stringify(y[f]));if(speedOf(k,a)!==speedOf(k,b))f.push('speed');if(f.length)out[k]=f.sort();}
 return out;}
const entriesCosting=(a:Owner,b:Owner)=>rules.entries.filter(e=>e.kind!=='building'&&JSON.stringify(costOf(e.id,a))!==JSON.stringify(costOf(e.id,b))).map(e=>e.id).sort();
// The open band of the meadow south of both bases (rows y 1200-1350 hold no obstacle), out of the blue town centre's
// reach; red's town centre stays passive (idle red).
const Y=1250;

// ---------------------------------------------------------------------------------------------------------------
// Training and the civilization trees

test('every new unit is trained at its own building from its age by a civilization that has it',()=>{
 const table:[UnitKind,BuildKind,number,string][]=[['cavalry-archer','archery-range',3,neutralCiv],['camel','stable',3,'saracens'],['mangonel','siege-workshop',3,neutralCiv],
  ['scorpion','siege-workshop',3,'byzantines'],['petard','castle',3,'franks'],['trebuchet','castle',4,'franks']];
 for(const [kind,at,age,civ] of table){const s=match(civ);
  // The age before, where the building already stands (the range and the stable from the second age, the Castle
  // from the third): the unit waits for its age.
  if(at==='archery-range'||at==='stable'||at==='castle'&&age===4){ageTo(s,age-1);refusal(s,building(s,at),kind,new RegExp(`需要${entryName(`age-${age}`)}`));}
  ageTo(s,age);const b=building(s,at),pop=s.accounts[0].populationUsed;
  const u=trainUnit(s,b,kind);assert.equal(u.hp,maxHpOf(kind as CombatUnitKind,ownerOf(s,0)),`${kind} at full health`);assert.equal(s.accounts[0].populationUsed,pop+1,'one population');
  assert.equal(rules.production[kind],at);
 }
 // The wrong building says so.
 const s=match('franks');ageTo(s,4);const castle=building(s,'castle'),ws=building(s,'siege-workshop'),stable=building(s,'stable');
 refusal(s,ws,'trebuchet',/這棟建築不能生產這個項目/);refusal(s,castle,'mangonel',/這棟建築不能生產這個項目/);refusal(s,stable,'cavalry-archer',/這棟建築不能生產這個項目/);
});

test('a civilization whose tree lacks a unit or an upgrade is refused at the building',()=>{
 const table:[string,string,BuildKind][]=[['britons','paladin','stable'],['britons','hussar','stable'],['britons','camel','stable'],['franks','arbalest','archery-range'],
  ['teutons','hussar','stable'],['teutons','heavy-cavalry-archer','archery-range'],['turks','onager','siege-workshop'],['persians','champion','barracks'],['persians','two-handed-swordsman','barracks'],
  ['saracens','cavalier','stable'],['saracens','heavy-scorpion','siege-workshop'],['byzantines','siege-onager','siege-workshop'],['vikings','halberdier','barracks'],['celts','camel','stable']];
 for(const [civ,entry,at] of table){const s=match(civ);ageTo(s,4);const b=building(s,at);for(const k of resources)s.accounts[0].stock[k]+=5000;
  refusal(s,b,entry,/此文明不能生產/);
  // The same entry is offered to the neutral civilization (the refusal is the tree, not the building).
  assert.ok(rules.civilizations.find(c=>c.id===neutralCiv)!.available.includes(entry),`${entry} exists for the neutral civilization`);}
 // Every civilization's tree from civs.ts: what it lacks is unavailable; the Castle's trebuchet and petard go with a Castle.
 for(const c of civDefs){const tree=rules.civilizations.find(t=>t.id===c.id)!;
  for(const id of c.missing)if(rules.entries.some(e=>e.id===id))assert.ok(tree.unavailable.includes(id),`${c.id} lacks ${id}`);
  for(const id of ['trebuchet','petard'])assert.equal(tree.available.includes(id),c.uniqueUnits.length>0,`${c.id} ${id}`);
  for(const id of ['cavalry-archer','mangonel','scorpion'])assert.ok(tree.available.includes(id),`${c.id} has ${id}`);}
});

test('the neutral civilization has no Castle, so no trebuchet and no petard',()=>{
 const s=match(neutralCiv);ageTo(s,4);const tree=rules.civilizations.find(c=>c.id===neutralCiv)!;
 for(const id of ['castle','trebuchet','petard','warwolf','kataparuto','sipahi'])assert.ok(tree.unavailable.includes(id),id);
 assert.equal(buildRequirement(4,'castle',s.buildings.filter(b=>b.player===0),neutralCiv),'此文明不能建造');
 const site={x:700,y:Y};assert.throws(()=>order(s,'build',{unitIds:[1],kind:'castle',...site}),/此文明不能建造/);
 // Even a Castle (as a civ with one would have) offers it neither.
 const input={player:0,civ:neutralCiv,age:4,techs:[],building:{kind:'castle',complete:true,queue:[]},ownBuildings:[{kind:'castle',complete:true,queue:[]}],stock:{food:9999,wood:9999,gold:9999,stone:9999},populationUsed:0,populationReserved:0,populationCap:40};
 for(const id of ['trebuchet','petard'])assert.equal(trainBlocker(input,id),'此文明不能生產');
 assert.equal(trainBlocker({...input,civ:'franks'},'trebuchet'),null,'the same Castle trains it for the Franks');
});

test('each line upgrade needs the fourth age and the step before it',()=>{
 const s=match(neutralCiv);ageTo(s,3);
 // The dock's lines (the 建築 round) are checked as data below; tests/naval.test.ts researches them on the lakes map.
 const lines=lineUpgrades.filter(l=>rules.entries.find(e=>e.id===l.id)?.requires.includes('age-4')&&rules.production[l.id]!=='castle'&&rules.production[l.id]!=='dock');
 const dock=Object.fromEntries(lineUpgrades.filter(l=>rules.production[l.id]==='dock').map(l=>[l.id,rules.entries.find(e=>e.id===l.id)!.requires]));
 assert.deepEqual(dock,{'war-galley':['age-3'],galleon:['age-4','war-galley'],'fast-fire-ship':['age-4','war-galley'],'heavy-demolition-ship':['age-4','war-galley'],'elite-cannon-galleon':['age-4','chemistry'],'elite-longboat':['age-4']});
 assert.deepEqual(lines.map(l=>l.id).sort(),['arbalest','capped-ram','cavalier','champion','halberdier','heavy-camel','heavy-cavalry-archer','heavy-scorpion','hussar','onager','paladin','siege-onager','siege-ram','two-handed-swordsman']);
 for(const l of lines){const b=building(s,rules.production[l.id] as BuildKind);for(const k of resources)s.accounts[0].stock[k]+=5000;refusal(s,b,l.id,/需要第四時代/);}
 ageTo(s,4);
 const previous:Record<string,string>={'two-handed-swordsman':'long-swordsman',champion:'two-handed-swordsman',halberdier:'pikeman',arbalest:'crossbowman',hussar:'light-cavalry',paladin:'cavalier','siege-ram':'capped-ram','siege-onager':'onager'};
 for(const l of lines){const b=building(s,rules.production[l.id] as BuildKind),before=previous[l.id];
  assert.deepEqual(rules.entries.find(e=>e.id===l.id)!.requires,before?['age-4',before]:['age-4'],l.id);
  if(before)refusal(s,b,l.id,new RegExp(`需要先研究「${entryName(before)}」`));}
});

test('line upgrades restat and rename the units already in the field and the ones trained later',()=>{
 const s=match(neutralCiv);clearRed(s);ageTo(s,3);for(const k of ['siege-workshop','stable','archery-range'] as BuildKind[])building(s,k);for(let i=0;i<4;i++)raise(s,0,'house');
 for(const [id,at] of [['man-at-arms','barracks'],['long-swordsman','barracks'],['pikeman','barracks'],['crossbowman','archery-range'],['light-cavalry','stable']] as [string,BuildKind][])research(s,building(s,at),id);
 ageTo(s,4);
 const order_=['two-handed-swordsman','champion','halberdier','arbalest','heavy-cavalry-archer','hussar','cavalier','paladin','heavy-camel','capped-ram','siege-ram','onager','siege-onager','heavy-scorpion'];
 // One wounded unit of each line in the field.
 const field=new Map<string,Unit>();let x=100;for(const id of order_){const kind=lineUpgrades.find(l=>l.id===id)!.kind;if(field.has(kind))continue;const u=spawn(s,0,kind,x,Y,false);u.hp-=5;field.set(kind,u);x+=100;}
 for(const id of order_){const up=lineUpgrades.find(l=>l.id===id)!,u=field.get(up.kind)!,o0=ownerOf(s,0),hp0=u.hp,max0=maxHpOf(up.kind,o0);
  research(s,building(s,rules.production[id] as BuildKind),id);const o1=ownerOf(s,0);
  assert.equal(lineName(up.kind,o1.techs),up.name,`${id}: renamed`);
  for(const [k,v] of Object.entries(up.set))assert.deepEqual((statsOf(up.kind,o1) as Record<string,unknown>)[k],v,`${id}: ${k}`);
  assert.equal(maxHpOf(up.kind,o1),up.set.hp??max0);assert.equal(u.hp,hp0+maxHpOf(up.kind,o1)-max0,`${id}: the unit in the field keeps its wound and gains the difference`);}
 assert.equal(field.get('knight')!.hp,160-5);assert.equal(field.get('militia')!.hp,75-5);assert.equal(field.get('ram')!.hp,270-5);assert.equal(field.get('mangonel')!.hp,70-5);
 // Trained afterwards: the new numbers from the start.
 assert.equal(trainUnit(s,building(s,'stable'),'knight').hp,160);assert.equal(trainUnit(s,building(s,'siege-workshop'),'mangonel').hp,70);
 assert.equal(trainUnit(s,building(s,'archery-range'),'cavalry-archer').hp,60);
});

// ---------------------------------------------------------------------------------------------------------------
// Siege mechanics

test('a mangonel stone hits every enemy unit within the blast of the impact and spares its own (onager and siege onager reach farther)',()=>{
 for(const [techs,blast,damage] of [[[],75,40],[['onager'],90,50],[['onager','siege-onager'],110,75]] as [string[],number,number][]){
  const s=match(neutralCiv);clearRed(s);s.techs[0].push(...techs);// fixture: the research itself is covered above
  const st=statsOf('mangonel',ownerOf(s,0));assert.equal(st.blast,blast);assert.equal(st.damage,damage);
  const m=spawn(s,0,'mangonel',300,Y),target=spawn(s,1,'trebuchet',600,Y),near=spawn(s,1,'ram',650,Y),diagonal=spawn(s,1,'ram',650,Y+50),two=spawn(s,1,'ram',700,Y),three=spawn(s,1,'ram',750,Y),mine=spawn(s,0,'ram',550,Y);
  order(s,'attack',{unitIds:[m.id],target:{kind:'unit',id:target.id}});run(s,1);
  assert.equal(target.hp,150-(damage-1),'the target: attack minus its melee armor 1');
  assert.equal(near.hp,175-damage,'50 away');assert.equal(diagonal.hp,175-damage,'50 away diagonally (Chebyshev)');
  assert.equal(two.hp,blast>=100?175-damage:175,'100 away: only inside the siege onager blast');assert.equal(three.hp,175,'150 away: outside every blast');
  assert.equal(mine.hp,175,'own units are spared');
  // The next stone after the cooldown, not before.
  run(s,st.cooldown-1);assert.equal(target.hp,150-(damage-1));run(s,1);assert.equal(target.hp,150-2*(damage-1));
 }
});

test('a scorpion bolt flies on through its target: enemies along the path take half, beyond 200 or off the line none',()=>{
 for(const [civ,techs,damage] of [[neutralCiv,[],12],[neutralCiv,['heavy-scorpion'],16],['chinese',['rocketry'],16],['chinese',['heavy-scorpion','rocketry'],20]] as [string,string[],number][]){
  const s=match(civ);clearRed(s);s.ages[0]=4;s.techs[0].push(...techs);
  assert.equal(statsOf('scorpion',ownerOf(s,0)).damage,damage);const half=Math.round(damage/2);
  const sc=spawn(s,0,'scorpion',300,Y),between=spawn(s,1,'villager',400,Y),target=spawn(s,1,'villager',500,Y),behind=spawn(s,1,'villager',550,Y),mine=spawn(s,0,'villager',600,Y),
   edge=spawn(s,1,'villager',700,Y),beyond=spawn(s,1,'villager',750,Y),aside=spawn(s,1,'villager',550,Y+50),back=spawn(s,1,'villager',250,Y);
  order(s,'attack',{unitIds:[sc.id],target:{kind:'unit',id:target.id}});run(s,1);
  assert.equal(target.hp,25-damage,'the target takes the whole bolt (villager pierce armor 0)');
  assert.equal(behind.hp,25-half,'one node behind: half');assert.equal(edge.hp,25-half,'200 behind the target: still on the bolt');
  assert.equal(beyond.hp,25,'250 behind: the bolt has stopped');assert.equal(aside.hp,25,'one node off the line');assert.equal(back.hp,25,'behind the shooter');
  assert.equal(mine.hp,25,'own units on the line are spared');
  // The bolt's path starts at the shooter: an enemy between it and the target is hit too (half), as the code documents.
  assert.equal(between.hp,25-half,'between the scorpion and its target');
 }
});

test('minimum range: no shot inside it, automatic fights skip or drop such targets, an order walks back out to shoot',()=>{
 // Automatic: a red ram 100 from a mangonel (minimum 150) is never picked; nor is a villager 50 from a scorpion (100).
 {const s=match(neutralCiv);clearRed(s);const m=spawn(s,0,'mangonel',300,Y),ram=spawn(s,1,'ram',400,Y);run(s,100);assert.equal(s.attacks[m.id],undefined);assert.equal(ram.hp,175);}
 {const s=match(neutralCiv);clearRed(s);const sc=spawn(s,0,'scorpion',300,Y),v=spawn(s,1,'villager',350,Y);run(s,100);assert.equal(s.attacks[sc.id],undefined);assert.equal(v.hp,25);
  // From 100 (its minimum) on, it picks the villager.
  const w=spawn(s,1,'villager',400,Y+100);run(s,2);assert.equal(s.attacks[sc.id]?.target.id,w.id);assert.equal(w.hp,25-12);}
 // An automatic fight whose target comes inside the minimum range is dropped (and no stone is thrown at it there).
 {const s=match(neutralCiv);clearRed(s);const m=spawn(s,0,'mangonel',300,Y),ram=spawn(s,1,'ram',600,Y);run(s,2);
  assert.equal(s.attacks[m.id]?.auto,true,'picked at 300');assert.equal(ram.hp,135,'and hit');
  order(s,'move',{unitIds:[ram.id],x:350,y:Y},1);let inside=-1,hpInside=-1;
  run(s,400,()=>{if(inside<0&&reach(m,ram)<150){inside=s.tick;hpInside=ram.hp;}return inside>=0&&s.tick>inside+150;});
  assert.ok(inside>0,'the ram came inside');assert.equal(s.attacks[m.id],undefined,'the fight is dropped');assert.equal(ram.hp,hpInside,'no stone inside the minimum range');assert.ok(ram.hp>0);}
 // Ordered at a target inside the minimum range: the mangonel walks back out and shoots from 150 or more.
 {const s=match(neutralCiv);clearRed(s);const m=spawn(s,0,'mangonel',300,Y),ram=spawn(s,1,'ram',400,Y),start={x:m.x,y:m.y};
  order(s,'attack',{unitIds:[m.id],target:{kind:'unit',id:ram.id}});let from=-1;
  run(s,600,()=>{if(ram.hp<175){from=reach(m,ram);return true;}return false;});
  assert.equal(ram.hp,135,'one stone');assert.ok(from>=150&&from<=500,`shot from ${from}`);assert.notDeepEqual({x:m.x,y:m.y},start,'it moved away first');}
});

test('a trebuchet unpacks before its first shot and packs before its first step',()=>{
 const s=match('franks');clearRed(s);const red=tcOf(s,1),tre=spawn(s,0,'trebuchet',1200,Y),st=trebuchetOf(s);
 assert.equal(st.setup,150);assert.equal(st.cooldown,100);const hit=hitDamage(st,buildingTarget);assert.equal(hit,75,'25 melee + 50 against buildings');
 order(s,'attack',{unitIds:[tre.id],target:{kind:'building',id:red.id}});
 run(s,st.setup-1);assert.equal(red.hp,400,'no damage while it unpacks');assert.equal(s.setups[tre.id]?.unpacked,false);assert.equal(s.setups[tre.id].progress,st.setup-1);
 run(s,1);assert.equal(red.hp,400-hit,'the first shot on the last setup tick');assert.deepEqual(s.setups[tre.id],{unpacked:true,progress:0});
 run(s,st.cooldown-1);assert.equal(red.hp,400-hit);run(s,1);assert.equal(red.hp,400-2*hit,'then every cooldown');
 // Moving: it stands still for the setup ticks after its route is ready, then steps; packed afterwards.
 const at={x:tre.x,y:tre.y},hp=red.hp;order(s,'move',{unitIds:[tre.id],x:1200,y:Y+150});let ready=-1,moved=-1;
 run(s,400,()=>{if(ready<0&&tre.path.length)ready=s.tick;if(tre.x!==at.x||tre.y!==at.y){moved=s.tick;return true;}return false;});
 assert.ok(ready>0&&moved>0);assert.equal(moved-ready,st.setup-1,'the first step on the setup-th tick of a ready route');assert.equal(s.setups[tre.id],undefined,'packed');assert.equal(red.hp,hp,'no shots while packing');
 // Back in range after the walk: it unpacks again before shooting.
 run(s,200,()=>tre.x===1200&&tre.y===Y+150&&tre.next===null);order(s,'attack',{unitIds:[tre.id],target:{kind:'building',id:red.id}});
 run(s,st.setup-1);assert.equal(red.hp,hp);run(s,1);assert.equal(red.hp,hp-hit);
});

test('a trebuchet that stops packing to shoot again packs from the start the next time',()=>{
 const s=match('franks');clearRed(s);const red=tcOf(s,1),tre=spawn(s,0,'trebuchet',1200,Y),st=trebuchetOf(s);
 order(s,'attack',{unitIds:[tre.id],target:{kind:'building',id:red.id}});run(s,st.setup);assert.equal(s.setups[tre.id].unpacked,true);
 order(s,'move',{unitIds:[tre.id],x:1200,y:Y+150});run(s,100);assert.ok(s.setups[tre.id].progress>50,'half packed');
 order(s,'attack',{unitIds:[tre.id],target:{kind:'building',id:red.id}});const hp=red.hp;run(s,2);assert.equal(red.hp,hp-75,'still unpacked: it shoots at once');
 const at={x:tre.x,y:tre.y};order(s,'move',{unitIds:[tre.id],x:1200,y:Y+150});let ready=-1,moved=-1;
 run(s,400,()=>{if(ready<0&&tre.path.length)ready=s.tick;if(tre.x!==at.x||tre.y!==at.y){moved=s.tick;return true;}return false;});
 assert.equal(moved-ready,st.setup-1,'a whole packing time again');
});

test('an unpacked trebuchet sent at a building out of its range packs, walks, unpacks and shoots',()=>{
 const s=match('franks');clearRed(s);const red=tcOf(s,1),tre=spawn(s,0,'trebuchet',1500,Y),st=trebuchetOf(s);
 // A red house in the far south-west corner, 1215 from the trebuchet (range 850 + 25 against a footprint).
 let site:{x:number;y:number}|null=null;for(let y=1550;y>=1000&&!site;y-=10)for(let x=50;x<=400&&!site;x+=10)if(!authoritativeProblem(s,1,'house',x,y))site={x,y};
 for(const k of resources)s.accounts[1].stock[k]+=100;const house=placeBuilding(s,1,'house',site!.x,site!.y,'fixture:house');while(!house.complete)addWork(s,house);
 order(s,'attack',{unitIds:[tre.id],target:{kind:'building',id:red.id}});run(s,st.setup);assert.equal(s.setups[tre.id].unpacked,true);
 const t0=s.tick,at={x:tre.x,y:tre.y};order(s,'attack',{unitIds:[tre.id],target:{kind:'building',id:house.id}});let moved=-1,arrived=-1,hit=-1;
 run(s,1500,()=>{if(moved<0&&(tre.x!==at.x||tre.y!==at.y))moved=s.tick;if(arrived<0&&moved>0&&s.setups[tre.id]?.unpacked===false)arrived=s.tick;if(house.hp<house.maxHp){hit=s.tick;return true;}return false;});
 assert.ok(moved-t0>=st.setup&&moved-t0<=st.setup+3,`packed first (first step ${moved-t0} ticks after the order)`);
 assert.ok(arrived>moved,'unpacking again once in range');assert.equal(hit-arrived,st.setup-1,'a whole setup before the shot');assert.equal(house.hp,house.maxHp-75);
});

test('Kataparuto (Japanese): the trebuchet sets up in a quarter of the time and shoots a third faster',()=>{
 const s=match('japanese');clearRed(s);ageTo(s,4);const castle=building(s,'castle'),before=statsOf('trebuchet',ownerOf(s,0));research(s,castle,'kataparuto');
 const st=trebuchetOf(s);assert.equal(before.setup,150);assert.equal(st.setup,38,'150 x 0.25 = 37.5, rounded');assert.equal(st.cooldown,75);
 const red=tcOf(s,1),tre=spawn(s,0,'trebuchet',1200,Y);order(s,'attack',{unitIds:[tre.id],target:{kind:'building',id:red.id}});
 run(s,st.setup-1);assert.equal(red.hp,400);run(s,1);assert.equal(red.hp,325);run(s,st.cooldown);assert.equal(red.hp,250);
 const at={x:tre.x,y:tre.y};order(s,'move',{unitIds:[tre.id],x:1200,y:Y+150});let ready=-1,moved=-1;
 run(s,200,()=>{if(ready<0&&tre.path.length)ready=s.tick;if(tre.x!==at.x||tre.y!==at.y){moved=s.tick;return true;}return false;});assert.equal(moved-ready,st.setup-1);
});

test('rams and trebuchets only attack buildings: the order is refused and they never pick a fight',()=>{
 const s=match('franks');clearRed(s);const tre=spawn(s,0,'trebuchet',300,Y),ram=spawn(s,0,'ram',300,Y+100),mil=spawn(s,0,'militia',300,Y+50),foe=spawn(s,1,'trebuchet',600,Y);
 assert.throws(()=>order(s,'attack',{unitIds:[tre.id],target:{kind:'unit',id:foe.id}}),/巨型投石機只能攻擊建築/);
 assert.throws(()=>order(s,'attack',{unitIds:[ram.id],target:{kind:'unit',id:foe.id}}),/攻城槌只能攻擊建築/);
 assert.throws(()=>order(s,'attack',{unitIds:[tre.id,mil.id].sort((a,b)=>a-b),target:{kind:'unit',id:foe.id}}),/巨型投石機只能攻擊建築/,'a mixed group is refused as a whole');
 const before=s.sequence[0];assert.equal(before,0,'nothing was accepted');
 s.units=s.units.filter(u=>u!==mil);run(s,100);
 assert.equal(s.attacks[tre.id],undefined);assert.equal(s.attacks[ram.id],undefined);assert.equal(foe.hp,150);assert.equal(s.setups[tre.id],undefined,'it did not unpack either');
});

test('a petard is spent by its charge: it blows a hole in a building and dies',()=>{
 const s=match('franks');clearRed(s);const red=tcOf(s,1),p=spawn(s,0,'petard',1200,700),pop=s.accounts[0].populationUsed,st=statsOf('petard',ownerOf(s,0));
 assert.equal(hitDamage(st,buildingTarget),80,'25 melee + 55 against buildings');
 order(s,'attack',{unitIds:[p.id],target:{kind:'building',id:red.id}});run(s,1);
 assert.equal(red.hp,400-80);assert.equal(s.units.includes(p),false,'spent');assert.equal(s.attacks[p.id],undefined);assert.equal(s.accounts[0].populationUsed,pop-1);
 assert.ok(s.corpses.some(c=>c.id===p.id&&c.kind==='petard'));
 // Against siege it has its bonus too, and it is spent all the same.
 const q=spawn(s,0,'petard',300,Y),target=spawn(s,1,'ram',350,Y);order(s,'attack',{unitIds:[q.id],target:{kind:'unit',id:target.id}});run(s,1);
 assert.equal(target.hp,175-(25+19),'25 + 19 against siege, melee armor 0');assert.equal(s.units.includes(q),false);
 // It never goes off on its own: no automatic fight.
 const r=spawn(s,0,'petard',300,Y+100),near=spawn(s,1,'villager',350,Y+100);run(s,60);assert.equal(s.attacks[r.id],undefined);assert.equal(near.hp,25);assert.ok(s.units.includes(r));
});

test('camels: their bonus against cavalry, and the spear line\'s against camels',()=>{
 {const s=match('saracens');clearRed(s);const camel=spawn(s,0,'camel',1000,Y),knight=spawn(s,1,'knight',1050,Y);
  order(s,'attack',{unitIds:[camel.id],target:{kind:'unit',id:knight.id}});run(s,1);
  assert.equal(knight.hp,100-(6+9-2),'camel 6 + 9 against cavalry - knight melee armor 2');assert.equal(camel.hp,100-10,'the knight strikes back: 10 - 0, no bonus against camels');
  assert.deepEqual(combatRules.units.camel.classes,['camel'],'a camel is not cavalry');}
 for(const [techs,vsCamel,vsKnight] of [[[],14,14],[['pikeman'],19,20],[['pikeman','halberdier'],27,30]] as [string[],number,number][]){
  const s=match(neutralCiv);clearRed(s);s.techs[0].push(...techs);
  const a=spawn(s,0,'spearman',1000,Y),camel=spawn(s,1,'camel',1050,Y),b=spawn(s,0,'spearman',1000,Y+100),knight=spawn(s,1,'knight',1050,Y+100);
  order(s,'attack',{unitIds:[a.id],target:{kind:'unit',id:camel.id}});order(s,'attack',{unitIds:[b.id],target:{kind:'unit',id:knight.id}});run(s,1);
  assert.equal(camel.hp,100-vsCamel,`${techs.join('+')||'spearman'} vs camel`);assert.equal(knight.hp,100-vsKnight,`${techs.join('+')||'spearman'} vs knight`);}
 // A camel against another camel: 6 + 5.
 assert.equal(hitDamage(statsOf('camel'),statsOf('camel')),11);assert.equal(hitDamage(statsOf('camel',['heavy-camel']),statsOf('knight')),7+18-2);
});

// ---------------------------------------------------------------------------------------------------------------
// Civilization effects aimed at the new units: each changes its target only

test('Byzantines: camels cost a quarter less; nothing else of the round changes price',()=>{
 // Town Watch (the 科技 round) is free for them in every age.
 for(const age of [1,3,4]){assert.deepEqual(entriesCosting(own('byzantines',age),own(neutralCiv,age)),['age-4','camel','skirmisher','spearman','town-watch'],`age ${age}`);
  assert.deepEqual(costOf('town-watch',own('byzantines',age)),{food:0,wood:0,gold:0,stone:0});assert.deepEqual(costOf('town-watch',own(neutralCiv,age)),{food:75,wood:0,gold:0,stone:0});}
 assert.deepEqual(costOf('camel',own('byzantines',3)),{food:41,wood:0,gold:45,stone:0},'55 and 60 x 0.75');
 const s=match('byzantines');ageTo(s,3);trainUnit(s,building(s,'stable'),'camel');
});

test('Vikings: Chieftains adds +4 against camels (and +5 against cavalry) to infantry only',()=>{
 const infantry=kinds.filter(k=>combatRules.units[k].classes.includes('infantry'));
 assert.deepEqual(changed(own('vikings',3,['chieftains']),own('vikings',3)),Object.fromEntries(infantry.map(k=>[k,['bonus']])));
 assert.equal(statsOf('militia',own('vikings',3,['chieftains'])).bonus.camel,4);assert.equal(statsOf('spearman',own('vikings',3,['chieftains'])).bonus.camel,10+4);
 // The tech is given (fixture): a Castle's arrows would reach the test's camel; Castle research is covered below.
 const s=match('vikings');clearRed(s);ageTo(s,3);s.techs[0].push('chieftains');
 const m=spawn(s,0,'militia',1000,Y),camel=spawn(s,1,'camel',1050,Y);order(s,'attack',{unitIds:[m.id],target:{kind:'unit',id:camel.id}});run(s,1);assert.equal(camel.hp,100-(6+4));
});

test('Saracens: cavalry archers +2/+3/+4 against buildings from the second age; foot archers keep theirs',()=>{
 const footArchers=kinds.filter(k=>unitMatches({classes:['archer'],exclude:['skirmisher','gunpowder','cavalry-archer']},k,combatRules.units[k].classes));
 const horseArchers=kinds.filter(k=>combatRules.units[k].classes.includes('cavalry-archer'));assert.deepEqual(horseArchers,['mangudai','cavalry-archer']);
 for(const age of [1,2,3,4]){const diff=changed(own('saracens',age),own(neutralCiv,age));
  // The 建築 round's naval bonuses: the galley line fires faster, transports have twice the hit points.
  assert.deepEqual([diff.galley,diff['transport-ship']],[['cooldown'],['hp']],`age ${age} ships`);delete diff.galley;delete diff['transport-ship'];
  assert.deepEqual(Object.keys(diff).sort(),[...footArchers,...(age>1?horseArchers:[])].sort(),`age ${age}`);for(const f of Object.values(diff))assert.deepEqual(f,['bonus']);
  assert.equal(statsOf('cavalry-archer',own('saracens',age)).bonus.building,age>1?[0,2,3,4][age-1]:undefined);
  assert.equal(statsOf('archer',own('saracens',age)).bonus.building,[0,1,2,3][age-1]+2,'foot archers: age bonus + team bonus');}
 // Through the sim: a Saracen cavalry archer against a house in the third age: 6 + 3 - 2 pierce armor = 7.
 const s=match('saracens');clearRed(s);ageTo(s,3);const ca=trainUnit(s,building(s,'archery-range'),'cavalry-archer');
 assert.equal(hitDamage(statsOf('cavalry-archer',ownerOf(s,0)),buildingTarget),7);assert.equal(ca.hp,50);
});

test('Saracens: Zealotry gives camels (and Mamelukes) +30 hit points, in the field too',()=>{
 assert.deepEqual(changed(own('saracens',4,['zealotry']),own('saracens',4)),{camel:['hp'],mameluke:['hp']});
 assert.equal(maxHpOf('camel',own('saracens',4,['zealotry'])),130);assert.equal(maxHpOf('camel',own('saracens',4,['heavy-camel','zealotry'])),150);
 const s=match('saracens');ageTo(s,4);const castle=building(s,'castle'),camel=trainUnit(s,building(s,'stable'),'camel');camel.hp-=10;research(s,castle,'zealotry');assert.equal(camel.hp,120);
});

test('Turks: the Hussar upgrade is free; Sipahi gives cavalry archers +20 hit points',()=>{
 // Chemistry (the 科技 round) is free for them too.
 // The 建築 round: gunpowder technologies half price (Elite Cannon Galleon, Bombard Tower).
 assert.deepEqual(entriesCosting(own('turks',4),own(neutralCiv,4)),['bombard-tower-tech','chemistry','elite-cannon-galleon','hussar','light-cavalry']);
 assert.deepEqual(costOf('chemistry',own('turks',4)),{food:0,wood:0,gold:0,stone:0});assert.deepEqual(costOf('chemistry',own(neutralCiv,4)),{food:300,wood:0,gold:200,stone:0});
 assert.deepEqual(costOf('hussar',own('turks',4)),{food:0,wood:0,gold:0,stone:0});
 assert.deepEqual(changed(own('turks',3,['sipahi']),own('turks',3)),{'cavalry-archer':['hp'],mangudai:['hp']});
 assert.equal(maxHpOf('cavalry-archer',own('turks',3,['sipahi'])),70);assert.equal(maxHpOf('cavalry-archer',own('turks',4,['heavy-cavalry-archer','sipahi'])),80);
 const s=match('turks');ageTo(s,4);const castle=building(s,'castle'),stock={...s.accounts[0].stock};
 research(s,building(s,'stable'),'light-cavalry');research(s,building(s,'stable'),'hussar');assert.deepEqual(s.accounts[0].stock,stock,'paid nothing');
 const school={...s.accounts[0].stock};research(s,building(s,'university'),'chemistry');assert.deepEqual(s.accounts[0].stock,school,'Chemistry paid nothing');
 const ca=trainUnit(s,building(s,'archery-range'),'cavalry-archer');assert.equal(ca.hp,50);research(s,castle,'sipahi');assert.equal(ca.hp,70);
});

test('Chinese: Rocketry gives scorpions +4 (and the Chu Ko Nu +2), nothing else',()=>{
 assert.deepEqual(changed(own('chinese',4,['rocketry']),own('chinese',4)),{'chu-ko-nu':['damage'],scorpion:['damage']});
 assert.equal(statsOf('scorpion',own('chinese',4,['rocketry'])).damage,16);assert.equal(statsOf('scorpion',own('chinese',4,['heavy-scorpion','rocketry'])).damage,20);
});

test('Britons: Warwolf gives the trebuchet a blast around the building it strikes',()=>{
 assert.deepEqual(changed(own('britons',4,['warwolf']),own('britons',4)),{trebuchet:['blast']});assert.equal(statsOf('trebuchet',own('britons',4,['warwolf'])).blast,75);
 // The tech is given (fixture): a Castle's arrows would reach the rams next to red's town centre.
 for(const warwolf of [false,true]){const s=match('britons');clearRed(s);ageTo(s,4);if(warwolf)s.techs[0].push('warwolf');
  const red=tcOf(s,1),tre=spawn(s,0,'trebuchet',1200,Y),next=spawn(s,1,'ram',1200,700),farther=spawn(s,1,'ram',1200,750),mine=spawn(s,0,'ram',1100,700);
  order(s,'attack',{unitIds:[tre.id],target:{kind:'building',id:red.id}});run(s,150);
  assert.equal(red.hp,400-75);assert.equal(next.hp,warwolf?175-25:175,'65 from the footprint: 25 melee, no bonus against units');assert.equal(farther.hp,175,'115 from the footprint');assert.equal(mine.hp,175,'own units spared');}
});

test('Japanese: Kataparuto touches the trebuchet\'s setup and rate only',()=>{
 assert.deepEqual(changed(own('japanese',4,['kataparuto']),own('japanese',4)),{trebuchet:['cooldown','setup']});
});

test('Celts: Furor Celtica and Mongols: Drill now reach the siege workshop\'s units only',()=>{
 // The bombard cannon (the 科技 round) is on both lists, though neither tree has it (questionable but harmless).
 assert.deepEqual(changed(own('celts',4,['furor-celtica']),own('celts',4)),{'bombard-cannon':['hp'],mangonel:['hp'],ram:['hp'],scorpion:['hp']});assert.equal(maxHpOf('bombard-cannon',own('celts',4,['furor-celtica'])),112);
 assert.equal(maxHpOf('ram',own('celts',4,['furor-celtica'])),245);assert.equal(maxHpOf('mangonel',own('celts',4,['furor-celtica'])),70);assert.equal(maxHpOf('scorpion',own('celts',4,['furor-celtica'])),56);
 assert.equal(maxHpOf('trebuchet',own('celts',4,['furor-celtica'])),150);assert.equal(maxHpOf('petard',own('celts',4,['furor-celtica'])),50);
 assert.deepEqual(changed(own('mongols',4,['drill']),own('mongols',4)),{'bombard-cannon':['speed'],mangonel:['speed'],ram:['speed'],scorpion:['speed']});assert.equal(speedOf('bombard-cannon',own('mongols',4,['drill'])),6.6);
 for(const civ of ['celts','mongols'])assert.ok(rules.civilizations.find(c=>c.id===civ)!.unavailable.includes('bombard-cannon'),`${civ} have no bombard cannon`);
 assert.equal(speedOf('ram',own('mongols',4,['drill'])),3);assert.equal(speedOf('mangonel',own('mongols',4,['drill'])),6);assert.equal(speedOf('scorpion',own('mongols',4,['drill'])),6);
 assert.equal(speedOf('trebuchet',own('mongols',4,['drill'])),5);assert.equal(speedOf('petard',own('mongols',4,['drill'])),5);
});

// ---------------------------------------------------------------------------------------------------------------
// Save, load, replay and the Worker

// A logged match (every command recorded, so save/load and replay re-derive it): the castle-age fixture with the
// scout's exploration, then a house, a blacksmith, a siege workshop and a mangonel.
function siegeMatch(){const s=castleAgeMatch(SEED,{explore:true});
 const stock=s.accounts[0].stock,tcB=tcOf(s),tc=s.map.obstacles.find(o=>o.id===tcB.id)!;
 const until=(done:()=>boolean,limit=30000)=>{const end=s.tick+limit;while(!done()){if(s.tick>=end)throw Error(`fixture stalled at tick ${s.tick}`);tick(s);}};
 function site(kind:BuildKind){for(let r=300;r<=900;r+=50)for(let a=0;a<24;a++){const x=Math.round((tc.x+Math.cos(a*Math.PI/12)*r)/10)*10,y=Math.round((tc.y+Math.sin(a*Math.PI/12)*r)/10)*10;if(!authoritativeProblem(s,0,kind,x,y))return {x,y};}throw Error('no site for '+kind);}
 for(const kind of ['house','blacksmith','siege-workshop'] as BuildKind[]){order(s,'build',{unitIds:[3],kind,...site(kind)});until(()=>s.buildings.some(b=>b.player===0&&b.kind===kind&&b.complete));}
 assert.ok(stock.wood>=160&&stock.gold>=135,'the mangonel is paid from gathered stock');
 order(s,'train',{buildingId:s.buildings.find(b=>b.player===0&&b.kind==='siege-workshop')!.id,entryId:'mangonel'});until(()=>s.units.some(u=>u.player===0&&u.kind==='mangonel'));
 return s;}
const play=(s:State,n:number,stop=()=>false)=>{for(let i=0;i<n&&!stop();i++)tick(s);};

test('a logged mangonel fight survives save, load and replay',()=>{
 const s=siegeMatch(),m=s.units.find(u=>u.player===0&&u.kind==='mangonel')!,foe=s.units.find(u=>u.player===1&&u.kind==='villager')!,redTc=tcOf(s,1);
 order(s,'move',{unitIds:[m.id],x:foe.x+300,y:foe.y});play(s,3000,()=>!s.units.includes(foe));
 assert.equal(s.units.includes(foe),false,'the mangonel found and crushed red\'s villager (40 against 25 hit points)');assert.ok(s.corpses.some(c=>c.id===foe.id));
 order(s,'attack',{unitIds:[m.id],target:{kind:'building',id:redTc.id}});play(s,3000,()=>redTc.hp<400);
 const hit=hitDamage(statsOf('mangonel',ownerOf(s,0)),buildingTarget);assert.equal(hit,51,'40 + 11 against buildings');assert.equal(redTc.hp,400-hit);
 play(s,30);// mid-cooldown
 const copy=deserialize(serialize(s));assert.equal(hash(copy),hash(s));
 play(s,300);play(copy,300);assert.equal(hash(copy),hash(s));assert.ok(redTc.hp<=400-3*hit,'still firing');
 assert.equal(hash(replay(s.seed,s.log,s.tick,s.layout,s.opponent,s.civs)),hash(s));
});

// A fixture state (spawned units: not log-derived) with an unpacked trebuchet shooting red's town centre.
function trebuchetAtWork(){const s=match('franks');clearRed(s);const red=tcOf(s,1),tre=spawn(s,0,'trebuchet',1200,Y),packed=spawn(s,0,'trebuchet',1100,Y+50),m=spawn(s,0,'mangonel',1000,Y);
 order(s,'attack',{unitIds:[tre.id],target:{kind:'building',id:red.id}});run(s,160);assert.equal(s.setups[tre.id]?.unpacked,true);return {s,tre,packed,m,red};}

test('an unpacked trebuchet\'s state saves and loads with the match and plays on identically',()=>{
 const a=trebuchetAtWork(),b=trebuchetAtWork();assert.equal(hash(a.s),hash(b.s),'the same fixture twice is the same state');
 const raw=serialize(a.s),v=JSON.parse(raw);assert.equal(v.checksum,hash(v.state));assert.deepEqual(v.state.setups,{[a.tre.id]:{unpacked:true,progress:0}});
 // deserialize also replays the log, which cannot rebuild spawned units (the logged attack names one): the wire
 // format is checked directly here, the full load path by the logged mangonel match above.
 assert.throws(()=>deserialize(raw),/不存在的單位|無法由命令重建/);
 const copy=v.state as State;assert.equal(hash(copy),hash(a.s));
 for(const s of [a.s,copy]){run(s,120);order(s,'move',{unitIds:[a.tre.id],x:1200,y:Y+150});run(s,60);}
 assert.equal(hash(copy),hash(a.s),'packing on both');assert.ok(copy.setups[a.tre.id].progress>0);
 for(const s of [a.s,copy])run(s,200);
 assert.equal(hash(copy),hash(a.s));assert.equal(copy.setups[a.tre.id],undefined);assert.equal(a.s.setups[a.tre.id],undefined);
});

test('the Worker projects whether a trebuchet is unpacked',()=>{
 const {s,tre,packed,m}=trebuchetAtWork();const service=createService(s);let id=0;
 const call=(operation:any)=>{const r=service({protocol:1,id:++id,operation});assert.equal(r.ok,true,JSON.stringify(r));return decodeView(r as any);};
 const view=call({kind:'advance',count:1}),unit=(v:ReturnType<typeof decodeView>,uid:number)=>v.units.find(u=>u.id===uid)!;
 assert.equal(unit(view,tre.id).kind,'trebuchet');assert.equal(unit(view,tre.id).unpacked,true);assert.equal(unit(view,packed.id).unpacked,false);assert.equal(unit(view,m.id).unpacked,false);
 assert.ok(view.units.filter(u=>u.id!==tre.id).every(u=>!u.unpacked));
 call({kind:'move',unitIds:[tre.id],x:1200,y:Y+150});let later=call({kind:'advance',count:80});assert.equal(unit(later,tre.id).unpacked,true,'packing: still unpacked');
 later=call({kind:'advance',count:80});later=call({kind:'advance',count:20});assert.equal(unit(later,tre.id).unpacked,false,'packed and on the move');
});
