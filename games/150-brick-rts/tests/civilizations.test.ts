// Civilizations (packages/content/civs.ts, packages/sim/civ.ts) through the real sim: createState with civs, commands
// by submit, ticks. Fixture shortcuts (stock gifts, finished foundations, research finished early) only skip the
// waiting; the effects themselves go through stepProduction/refreshOwner, combat, defense, work and vision.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,hash,serialize,deserialize,replay,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {makeUnit} from '../packages/sim/movement.ts';
import type {UnitKind} from '../packages/sim/movement.ts';
import {position,blockedTable,nodeTotal} from '../packages/sim/navigation.ts';
import {statsOf,maxHpOf,speedOf,buildingHpOf,combatRules,hitDamage,lineName,buildingTarget} from '../packages/sim/stats.ts';
import type {CombatUnitKind} from '../packages/sim/stats.ts';
import {ownerOf,costOf,timeTicks,producedAt,arrowsOf} from '../packages/sim/civ.ts';
import type {Owner} from '../packages/sim/civ.ts';
import {authoritativeProblem,buildRequirement,placeBuilding,addWork,farmResourceId} from '../packages/sim/buildings.ts';
import type {Building,BuildKind} from '../packages/sim/buildings.ts';
import {trainable,trainBlocker} from '../packages/sim/production.ts';
import {garrisonCapacity,garrisonProblem} from '../packages/sim/defense.ts';
import {religionRules} from '../packages/sim/religion.ts';
import {economyRules} from '../packages/sim/economy.ts';
import {visionRules} from '../packages/sim/vision.ts';
import {terrainRules} from '../packages/sim/terrain.ts';
import {animalRules,GAIA} from '../packages/sim/fauna.ts';
import {rules,resources} from '../packages/content/rules.ts';
import {civDefs,neutralCiv,deferredTechs} from '../packages/content/civs.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';

const SEED=260925;
function order(s:State,commandType:string,payload:any,playerId=0){submit(s,{protocolVersion:1,rulesetHash,playerId,sequence:s.sequence[playerId]+1,targetTick:s.tick+1,commandType,payload} as any);}
const run=(s:State,n:number,stop=()=>false)=>{for(let i=0;i<n&&!stop();i++)tick(s);};
const tiles=(s:State)=>Array.from({length:s.map.size*s.map.size},(_,i)=>i);
// Both sides see the whole map until the next tick's vision update (targets must be visible to be ordered).
const see=(s:State)=>{for(const v of s.vision){v.visible=tiles(s);v.explored=tiles(s);}};
const own=(civ:string,age=1,techs:string[]=[]):Owner=>({civ,age,techs});
// Blue plays civ, red the neutral civilization unless given; red is idle (it never acts or shoots on its own).
function match(civ:string,red=neutralCiv,layout:'meadow'|'open'='meadow'){const s=createState(SEED,layout,'idle',[civ,red]);for(const v of s.vision)v.explored=tiles(s);return s;}
const tcOf=(s:State,p=0)=>s.buildings.find(b=>b.player===p&&b.kind==='town-center')!;
const boxOf=(s:State,id:string)=>obstacleBounds(s.map.obstacles.find(o=>o.id===id)!);
const reach=(p:{x:number;y:number},b:number[])=>Math.max(b[0]-p.x,0,p.x-b[2],b[1]-p.y,0,p.y-b[3]);
const unit=(s:State,id:number)=>s.units.find(u=>u.id===id)!;
function freeNode(s:State,x:number,y:number){const closed=blockedTable(s.map),held=new Set(s.units.flatMap(u=>u.next===null?[u.node]:[u.node,u.next]));let best=-1,d=Infinity;
 for(let n=0;n<nodeTotal(s.map);n++){if(closed[n]||held.has(n))continue;const p=position(s.map,n),e=Math.abs(p.x-x)+Math.abs(p.y-y);if(e<d){d=e;best=n;}}return best;}
// A unit on the free node nearest the point, at its owner's full health (civilization included), counted in population.
function spawn(s:State,player:number,kind:UnitKind,x:number,y:number){const p=position(s.map,freeNode(s,x,y)),u=makeUnit(s.map,s.nextUnitId++,player,p.x,p.y,kind);
 if(kind in combatRules.units)u.hp=maxHpOf(kind as CombatUnitKind,ownerOf(s,player));s.units.push(u);s.units.sort((a,b)=>a.id-b.id);if(player<2)s.accounts[player].populationUsed++;return u;}
// n free nodes in a straight west-east row (none blocked or held), the row nearest the point.
function row(s:State,n:number,x:number,y:number){const closed=blockedTable(s.map),held=new Set(s.units.map(u=>u.node)),side=s.map.size*2-1;let best:{x:number;y:number}|null=null,d=Infinity;
 for(let id=0;id<nodeTotal(s.map);id++){const p=position(s.map,id);if(id%side+n>side)continue;let ok=true;for(let i=0;i<n&&ok;i++)ok=!closed[id+i]&&!held.has(id+i);if(!ok)continue;const e=Math.abs(p.x-x)+Math.abs(p.y-y);if(e<d){d=e;best=p;}}
 assert.ok(best,'an open row');return best!;}
// Pays the owner's price (fixture gift), queues the entry by command and finishes it early; completion runs through
// stepProduction (refreshOwner, grants), as in a match.
function research(s:State,b:Building,entryId:string){const p=b.player,cost=costOf(entryId,ownerOf(s,p));for(const k of resources)s.accounts[p].stock[k]+=cost[k];
 order(s,'train',{buildingId:b.id,entryId},p);tick(s);const item=b.queue.find(q=>q.entryId===entryId);if(item){assert.equal(b.queue[0],item,'first in the queue');item.work=Math.max(item.work,item.required-1);tick(s);}
 const m=/^age-(\d)$/.exec(entryId);if(m||rules.entries.find(e=>e.id===entryId)?.kind==='technology')assert.ok(m?s.ages[p]>=Number(m[1]):s.techs[p].includes(entryId),`${entryId} done`);}
function ageTo(s:State,age:number,p=0){for(let a=s.ages[p]+1;a<=age;a++)research(s,tcOf(s,p),`age-${a}`);}
// A finished building of the player's own on the free site nearest its town centre (fixture: paid, then worked through).
function raise(s:State,p:number,kind:BuildKind,near?:{x:number;y:number}){const t=tcOf(s,p),c=near??{x:t.x+135,y:t.y+135},sites:{x:number;y:number;d:number}[]=[];
 for(let y=50;y<s.map.size*100;y+=50)for(let x=50;x<s.map.size*100;x+=50)if(!authoritativeProblem(s,p,kind,x,y))sites.push({x,y,d:Math.hypot(x-c.x,y-c.y)});
 sites.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);assert.ok(sites.length,'a site for '+kind);
 const cost=costOf(kind,ownerOf(s,p));for(const k of resources)s.accounts[p].stock[k]+=cost[k];
 const b=placeBuilding(s,p,kind,sites[0].x,sites[0].y,`fixture:${s.nextBuildingId}`);while(!b.complete)addWork(s,b);return b;}
const castleFor=(civ:string,age=3,red=neutralCiv)=>{const s=match(civ,red);ageTo(s,age);return {s,castle:raise(s,0,'castle')};};
const nearestResource=(s:State,kind:string,from:{x:number;y:number})=>s.map.resources.filter(r=>r.kind===kind&&r.collectible).sort((a,b)=>Math.abs(a.x-from.x)+Math.abs(a.y-from.y)-(Math.abs(b.x-from.x)+Math.abs(b.y-from.y))||(a.id<b.id?-1:1))[0];
// Progress one villager adds in one tick of gathering (hundredths of a unit), read from its work record on a tick
// that neither harvested nor changed phase.
function pace(s:State,id:number,limit=4000){for(let i=0;i<limit;i++){const w=s.works[id] as any,c=s.cargo[id]?.amount??0;
 if(w?.phase==='gathering'){const p0=w.progress;tick(s);if(s.works[id]===w&&w.phase==='gathering'&&(s.cargo[id]?.amount??0)===c)return w.progress-p0;continue;}tick(s);}
 throw Error('never gathered');}
// Red's starting villager out of the way: a building shoots the nearest enemy, and it may stand nearer than the test's.
const clearRed=(s:State)=>{s.units=s.units.filter(u=>!(u.player===1&&u.kind==='villager'));};
const unitKindsList=Object.keys(combatRules.units) as CombatUnitKind[];
const civIds=civDefs.map(c=>c.id).filter(id=>id!==neutralCiv);

test('the neutral civilization changes nothing: the default match is it, and every rule answers as without civilizations',()=>{
 const plain=createState(SEED,'open','ai'),neutral=createState(SEED,'open','ai',[neutralCiv,neutralCiv]);
 assert.equal(hash(plain),hash(neutral));assert.deepEqual(plain.civs,[neutralCiv,neutralCiv]);assert.deepEqual(plain.keptHousing,[0,0]);
 for(const p of [0,1]){const a=plain.accounts[p];assert.deepEqual(a.stock,economyRules.initialStock);assert.equal(a.populationUsed,4,'three villagers and a scout');assert.equal(a.populationCap,5);
  assert.equal(plain.units.filter(u=>u.player===p&&u.kind==='villager').length,3);assert.equal(tcOf(plain,p).hp,400);assert.equal(tcOf(plain,p).maxHp,400);}
 // Every unit, age and a spread of research: the owner's numbers equal the bare technology list's.
 const techSets=[[],['loom','forging','fletching','scale-mail-armor'],['man-at-arms','long-swordsman','crossbowman','light-cavalry','bodkin-arrow','iron-casting','chain-barding-armor','sanctity'],['elite-longbowman','elite-samurai','elite-chu-ko-nu','yeomen','rocketry','zealotry','furor-celtica']];
 for(const kind of unitKindsList)for(let age=1;age<=4;age++)for(const techs of techSets){assert.deepEqual(statsOf(kind,own(neutralCiv,age,techs)),statsOf(kind,techs),`${kind} age ${age}`);assert.equal(speedOf(kind,own(neutralCiv,age,techs)),combatRules.speed[kind]);}
 for(const e of rules.entries)for(let age=1;age<=4;age++){assert.deepEqual(costOf(e.id,own(neutralCiv,age)),e.cost,e.id);if(rules.production[e.id])assert.equal(timeTicks(e.id,own(neutralCiv,age),rules.production[e.id]!),e.time*rules.settings.tickHz);}
 for(const [kind,hp] of Object.entries(combatRules.buildings))for(let age=1;age<=4;age++)assert.equal(buildingHpOf(kind,own(neutralCiv,age)),hp);
 const settlers=rules.civilizations.find(c=>c.id===neutralCiv)!,unique=new Set(civDefs.flatMap(c=>[...c.uniqueUnits,...c.eliteUpgrades,...c.uniqueTechs.map(t=>t.id)]));
 assert.deepEqual([...settlers.unavailable].sort(),rules.entries.map(e=>e.id).filter(id=>id==='castle'||rules.production[id]==='castle'||unique.has(id)).sort(),'only the Castle and its content are missing');
});

test('civilization starts: Chinese villagers and housing, Persian stock and town centre, Byzantine town centre; the other side keeps the base',()=>{
 const base=economyRules.initialStock;
 const chinese=match('chinese');const villagers=chinese.units.filter(u=>u.player===0&&u.kind==='villager');
 assert.equal(villagers.length,6);assert.deepEqual(villagers.map(u=>u.id),[1,2,3,5,6,7],'the extra three follow red\'s villager');assert.equal(chinese.nextUnitId,8);
 assert.equal(new Set(villagers.map(u=>u.node)).size,6,'each on its own node');assert.ok(villagers.every(u=>u.hp===25));
 assert.ok(villagers.slice(3).every(u=>Math.hypot(u.x-unit(chinese,1).x,u.y-unit(chinese,1).y)<=400),'next to the first villager');
 const a=chinese.accounts[0];assert.deepEqual(a.stock,{food:base.food-200,wood:base.wood-50,gold:base.gold,stone:base.stone});assert.equal(a.populationUsed,6);assert.equal(a.populationCap,10,'the town centre houses 10');
 assert.deepEqual(chinese.accounts[1].stock,base);assert.equal(chinese.accounts[1].populationUsed,1);assert.equal(chinese.accounts[1].populationCap,5);
 // Against the computer on the open map: three villagers, a scout and the three extra ones.
 const open=createState(SEED,'open','ai',['settlers','chinese']);assert.equal(open.accounts[1].populationUsed,7);assert.equal(open.units.filter(u=>u.player===1&&u.kind==='villager').length,6);assert.equal(open.accounts[0].populationUsed,4);
 const persians=match('persians');assert.deepEqual(persians.accounts[0].stock,{food:base.food+50,wood:base.wood+50,gold:base.gold,stone:base.stone});
 assert.equal(tcOf(persians).hp,800);assert.equal(tcOf(persians).maxHp,800);assert.equal(tcOf(persians,1).maxHp,400);assert.deepEqual(persians.accounts[1].stock,base);
 const byz=match('byzantines');assert.equal(tcOf(byz).maxHp,440);assert.equal(tcOf(byz).hp,440);assert.equal(tcOf(byz,1).maxHp,400);
 for(const civ of ['britons','celts','franks','goths','teutons','vikings','saracens','turks','japanese','mongols']){const s=match(civ);assert.deepEqual(s.accounts[0].stock,base,civ);assert.equal(s.accounts[0].populationUsed,3,civ);assert.equal(tcOf(s).maxHp,400,civ);}
});

test('the civilization choice survives save, load and replay of a logged match (Vikings and Byzantines up to the second age)',()=>{
 for(const civ of ['vikings','byzantines']){const s=createState(SEED,'meadow','idle',[civ,'teutons']);
  order(s,'hunt',{unitIds:[1,2,3],animalId:900001});run(s,6000,()=>s.accounts[0].stock.food>=300);assert.ok(s.accounts[0].stock.food>=300,civ+' herded enough');
  order(s,'train',{buildingId:tcOf(s).id,entryId:'age-2'});run(s,600,()=>s.ages[0]===2);assert.equal(s.ages[0],2);
  if(civ==='vikings')assert.ok(s.techs[0].includes('wheelbarrow'));else assert.equal(tcOf(s).maxHp,480);
  const copy=deserialize(serialize(s));assert.deepEqual(copy.civs,[civ,'teutons']);assert.equal(hash(copy),hash(s));
  run(s,200);run(copy,200);assert.equal(hash(copy),hash(s));
 }
});

test('replay rebuilds a civilization match from its log alone; another civilization rebuilds a different match',()=>{
 const s=createState(SEED,'meadow','idle',['vikings','teutons']);
 order(s,'hunt',{unitIds:[1,2,3],animalId:900001});run(s,6000,()=>s.accounts[0].stock.food>=300);order(s,'train',{buildingId:tcOf(s).id,entryId:'age-2'});run(s,600,()=>s.ages[0]===2);run(s,50);
 assert.equal(hash(replay(s.seed,s.log,s.tick,s.layout,s.opponent,s.civs)),hash(s));
 const other=replay(s.seed,s.log,s.tick,s.layout,s.opponent,['franks','teutons']);assert.notEqual(hash(other),hash(s));assert.ok(!other.techs[0].includes('wheelbarrow'));
 assert.equal(hash(deserialize(serialize(s))),hash(s));
});

test('unknown civilizations are refused by createState and by deserialize',()=>{
 for(const civs of [['atlantis',neutralCiv],[neutralCiv],['britons','franks','goths'],[neutralCiv,42],'britons',[]] as any[])assert.throws(()=>createState(SEED,'meadow','idle',civs),/未知的文明/,JSON.stringify(civs));
 const raw=JSON.parse(serialize(createState(SEED,'meadow','idle',['britons','franks'])));
 const forged=structuredClone(raw);forged.state.civs=['atlantis','franks'];assert.throws(()=>deserialize(JSON.stringify(forged)),/版本不符或內容損壞/,'checksum first');
 forged.checksum=hash(forged.state);assert.throws(()=>deserialize(JSON.stringify(forged)),/無效存檔狀態/);
 const short=structuredClone(raw);short.state.civs=['britons'];short.checksum=hash(short.state);assert.throws(()=>deserialize(JSON.stringify(short)),/無效存檔狀態/);
 // A valid but different civilization: the log cannot rebuild the saved state (the Persian start differs).
 const swapped=structuredClone(raw);swapped.state.civs=['persians','franks'];swapped.checksum=hash(swapped.state);assert.throws(()=>deserialize(JSON.stringify(swapped)),/無法由命令重建/);
 assert.deepEqual(deserialize(JSON.stringify(raw)).civs,['britons','franks']);
});

test('per-civilization tech trees: missing technologies and units are refused by submit, the page check agrees',()=>{
 // Britons have no Crop Rotation (refused before any age or resource reason); Heavy Plow is theirs.
 const britons=match('britons');ageTo(britons,4);const mill=raise(britons,0,'mill');britons.accounts[0].stock={food:5000,wood:5000,gold:5000,stone:5000};
 assert.throws(()=>order(britons,'train',{buildingId:mill.id,entryId:'crop-rotation'}),/此文明不能生產/);assert.equal(trainable(britons,0,mill,'horse-collar'),null);
 const plain=match(neutralCiv);ageTo(plain,4);const plainMill=raise(plain,0,'mill');plain.techs[0].push('horse-collar','heavy-plow');plain.accounts[0].stock={food:5000,wood:5000,gold:5000,stone:5000};assert.equal(trainable(plain,0,plainMill,'crop-rotation'),null);
 // Teutons have no Light Cavalry; scouts still train.
 const teutons=match('teutons');ageTo(teutons,3);raise(teutons,0,'barracks');const stable=raise(teutons,0,'stable');teutons.accounts[0].stock={food:5000,wood:5000,gold:5000,stone:5000};
 assert.throws(()=>order(teutons,'train',{buildingId:stable.id,entryId:'light-cavalry'}),/此文明不能生產/);assert.equal(trainable(teutons,0,stable,'scout'),null);
 // The page's pure check says the same from plain data.
 const input={player:0,age:4,techs:[] as string[],building:{kind:'mill',complete:true,queue:[]},ownBuildings:[{kind:'mill',complete:true,queue:[]}],stock:{food:9999,wood:9999,gold:9999,stone:9999},populationUsed:0,populationReserved:0,populationCap:40};
 assert.equal(trainBlocker({...input,civ:'britons'},'crop-rotation'),'此文明不能生產');assert.equal(trainBlocker({...input,civ:'celts'},'crop-rotation'),'此文明不能生產');assert.equal(trainBlocker({...input,civ:'goths'},'crop-rotation'),'需要先研究「重犁」');
 // Every civilization's tree follows its missing list exactly (among entries this game has).
 for(const c of civDefs){const avail=rules.civilizations.find(v=>v.id===c.id)!;for(const id of c.missing)if(rules.entries.some(e=>e.id===id))assert.ok(avail.unavailable.includes(id),`${c.id} lacks ${id}`);
  for(const u of c.uniqueUnits)for(const other of civDefs)assert.equal(rules.civilizations.find(v=>v.id===other.id)!.available.includes(u),other.id===c.id,`${u} for ${other.id}`);}
 for(const id of deferredTechs)assert.ok(!rules.entries.some(e=>e.id===id),`${id} stays out of the game`);
});

test('the Castle: refused to the neutral civilization and before the third age, with the same reason in submit',()=>{
 assert.equal(buildRequirement(3,'castle',[],neutralCiv),'此文明不能建造');assert.equal(buildRequirement(3,'castle',[]),'此文明不能建造','no civ means the neutral one');
 assert.equal(buildRequirement(2,'castle',[],'britons'),'需要第三時代');assert.equal(buildRequirement(1,'castle',[],'mongols'),'需要第三時代');assert.equal(buildRequirement(3,'castle',[],'britons'),null);
 assert.equal(buildRequirement(2,'house',[],'britons'),null);
 const site=(s:State)=>{for(let y=100;y<=1300;y+=50)for(let x=50;x<=1300;x+=50)if(!authoritativeProblem(s,0,'castle',x,y))return {x,y};throw Error('no castle site');};
 const plain=match(neutralCiv);ageTo(plain,3);plain.accounts[0].stock.stone=1000;assert.throws(()=>order(plain,'build',{unitIds:[1,2,3],kind:'castle',...site(plain)}),/此文明不能建造/);
 const early=match('britons');ageTo(early,2);early.accounts[0].stock.stone=1000;assert.throws(()=>order(early,'build',{unitIds:[1,2,3],kind:'castle',...site(early)}),/需要第三時代/);
});

test('the Castle: villagers build it for 300 stone; 800 hit points, houses 10, holds 20, shoots four arrows and trains the unique unit',()=>{
 const s=match('britons');ageTo(s,3);s.accounts[0].stock.stone=350;const stock=s.accounts[0].stock,wood=stock.wood;
 let site:{x:number;y:number}|null=null;for(let y=100;y<=1300&&!site;y+=50)for(let x=50;x<=1300&&!site;x+=50)if(!authoritativeProblem(s,0,'castle',x,y))site={x,y};
 order(s,'build',{unitIds:[1,2,3],kind:'castle',...site});run(s,3000,()=>s.buildings.some(b=>b.kind==='castle'&&b.complete));
 const castle=s.buildings.find(b=>b.kind==='castle')!;assert.ok(castle.complete,'built by villagers');assert.equal(stock.stone,50);assert.equal(stock.wood,wood);
 assert.equal(castle.hp,800);assert.equal(castle.maxHp,800);assert.equal(s.accounts[0].populationCap,15,'5 from the town centre, 10 from the Castle');
 assert.equal(garrisonCapacity(s,castle),20);assert.equal(garrisonCapacity(s,tcOf(s)),15);
 // Four arrows a volley (5 pierce against militia armor 1); a villager inside adds one.
 const box=boxOf(s,castle.id),tc=boxOf(s,tcOf(s).id);const at=(()=>{for(let n=0;n<nodeTotal(s.map);n++){const p=position(s.map,n);if(!blockedTable(s.map)[n]&&reach(p,box)>=150&&reach(p,box)<=350&&reach(p,tc)>400&&!s.units.some(u=>u.node===n))return p;}throw Error('no spot');})();
 clearRed(s);const foe=spawn(s,1,'militia',at.x,at.y);see(s);tick(s);assert.equal(foe.hp,45-4*4);assert.equal(s.volleys[castle.id],40);
 order(s,'garrison',{unitIds:[1],buildingId:castle.id});run(s,400,()=>{see(s);return !!s.garrison[castle.id];});assert.equal(s.garrison[castle.id].units.length,1);
 const second=spawn(s,1,'militia',at.x,at.y);see(s);s.volleys[castle.id]=0;s.units=s.units.filter(u=>u===second||u.player!==1||u.kind!=='militia');tick(s);assert.equal(second.hp,45-5*4);
 // The unique unit: paid as listed, trained in its time, with the Britons' third-age range.
 s.accounts[0].stock.wood+=35;s.accounts[0].stock.gold+=40;const before={...stock};order(s,'train',{buildingId:castle.id,entryId:'longbowman'});tick(s);
 assert.equal(stock.wood,before.wood-35);assert.equal(stock.gold,before.gold-40);assert.equal(castle.queue[0].required,18*20);
 const count=()=>s.units.filter(u=>u.player===0&&u.kind==='longbowman').length;run(s,400,()=>count()===1);const lb=s.units.find(u=>u.player===0&&u.kind==='longbowman')!;assert.ok(lb);
 assert.equal(lb.hp,35);assert.equal(statsOf('longbowman',ownerOf(s,0)).range,300+50);
 // The other civilizations' unique units are not trained here; the Byzantine castle stands 30% stronger in the third age.
 assert.match(trainable(s,0,castle,'huskarl')??'',/此文明不能生產/);assert.match(trainable(s,0,castle,'elite-longbowman')??'',/需要第四時代/);
 assert.equal(buildingHpOf('castle',own('byzantines',3)),1040);assert.equal(costOf('castle',own('franks',3)).stone,225);
});

test('every civilization trains its own unique unit at its Castle at full health, and nobody else\'s',()=>{
 for(const c of civDefs.filter(c=>c.uniqueUnits.length)){const {s,castle}=castleFor(c.id);const kind=c.uniqueUnits[0] as UnitKind;
  s.accounts[0].stock={food:5000,wood:5000,gold:5000,stone:5000};
  // A civilization's other unique units are trained elsewhere (the Vikings' Longboat at the dock).
  for(const other of civDefs)for(const u of other.uniqueUnits)assert.equal(trainable(s,0,castle,u),u===kind?null:c.uniqueUnits.includes(u)?'這棟建築不能生產這個項目':'此文明不能生產',`${c.id}: ${u}`);
  for(const t of c.uniqueTechs.filter(t=>!deferredTechs.includes(t.id)))assert.equal(trainable(s,0,castle,t.id),t.age===3?null:'需要第四時代',`${c.id}: ${t.id}`);
  research(s,castle,kind);run(s,1000,()=>s.units.some(u=>u.player===0&&u.kind===kind));
  const u=s.units.find(u=>u.player===0&&u.kind===kind)!;assert.ok(u,`${c.id} trained ${kind}`);assert.equal(u.hp,maxHpOf(kind as CombatUnitKind,own(c.id,3)),kind);
  // The 科技 round's Castle technologies (fourth age), where the civilization's tree has them (Turks' Artillery is
  // among its unique technologies above).
  const generic=['hoardings','sappers','conscription'].filter(id=>!c.missing.includes(id));
  for(const id of generic)assert.equal(trainable(s,0,castle,id),'需要第四時代',`${c.id}: ${id}`);
  for(const id of ['hoardings','sappers','conscription'].filter(id=>c.missing.includes(id)))assert.equal(trainable(s,0,castle,id),'此文明不能生產',`${c.id} lacks ${id}`);
  assert.deepEqual(producedAt('castle',ownerOf(s,0)).filter(id=>trainable(s,0,castle,id)!=='此文明不能生產').sort(),[kind,...c.eliteUpgrades.filter(id=>rules.production[id]==='castle'),...c.uniqueTechs.map(t=>t.id).filter(id=>!deferredTechs.includes(id)),'trebuchet','petard',...generic].sort());}
});

test('elite upgrades rename and restat the unique units already in the field, keeping their damage',()=>{
 for(const c of civDefs.filter(c=>c.uniqueUnits.length)){const {s,castle}=castleFor(c.id,4);const kind=c.uniqueUnits[0] as CombatUnitKind;
  const u=spawn(s,0,kind as UnitKind,700,1400),before=maxHpOf(kind,ownerOf(s,0));u.hp=before-5;
  research(s,castle,c.eliteUpgrades[0]);const after=maxHpOf(kind,ownerOf(s,0));
  assert.equal(lineName(kind,s.techs[0]),rules.entries.find(e=>e.id===c.eliteUpgrades[0])!.name);assert.equal(u.hp,after-5,`${kind} ${before} -> ${after}`);
  if(kind!=='mangudai')assert.ok(after>before,`${kind} gains health`);}
 // Numbers of two of them, civilization bonuses kept on top of the upgrade's whole-field set.
 assert.deepEqual([statsOf('longbowman',own('britons',4,['elite-longbowman'])).range,statsOf('longbowman',own('britons',4,['elite-longbowman'])).damage],[350+100,7]);
 assert.equal(statsOf('chu-ko-nu',own('chinese',4,['elite-chu-ko-nu'])).extraShots,4);
});

test('Yeomen: foot archers already in the field shoot farther and towers hit harder; Yeomen reaches skirmishers too (the civ bonus does not); red stays as it was',()=>{
 const {s,castle}=castleFor('britons');const archer=spawn(s,0,'archer',700,1400),skirm=spawn(s,0,'skirmisher',750,1400),lb=spawn(s,0,'longbowman',800,1400);
 const range=(u:{kind:string;player:number})=>statsOf(u.kind as CombatUnitKind,ownerOf(s,u.player)).range;
 assert.deepEqual([range(archer),range(skirm),range(lb)],[300,200,350]);research(s,castle,'yeomen');assert.deepEqual([range(archer),range(skirm),range(lb)],[350,250,400]);
 assert.equal(statsOf('archer',ownerOf(s,1)).range,250);
 // Blue's own archers would shoot the militia too: only the tower is left to hit it.
 s.units=s.units.filter(u=>![archer,skirm,lb].includes(u));clearRed(s);
 const tower=raise(s,0,'watch-tower',{x:300,y:1300}),box=boxOf(s,tower.id),foe=spawn(s,1,'militia',box[2]+150,box[3]+50);
 assert.ok(reach(foe,box)<=350&&reach(foe,boxOf(s,castle.id))>400&&reach(foe,boxOf(s,tcOf(s).id))>300,'only the tower reaches');
 see(s);tick(s);assert.equal(foe.hp,45-(5+2-1));
});

test('Furor Celtica, Zealotry, Rocketry: units in the field take the new maximum at once; other kinds do not',()=>{
 {const {s,castle}=castleFor('celts',4);const ram=spawn(s,0,'ram',700,1400),knight=spawn(s,0,'knight',800,1400);ram.hp=100;
  research(s,castle,'furor-celtica');assert.equal(maxHpOf('ram',ownerOf(s,0)),245);assert.equal(ram.hp,170);assert.equal(knight.hp,100);assert.equal(maxHpOf('ram',ownerOf(s,1)),175);}
 {const {s,castle}=castleFor('saracens',4);const m=spawn(s,0,'mameluke',700,1400),knight=spawn(s,0,'knight',800,1400);
  research(s,castle,'zealotry');assert.equal(m.hp,65+30);assert.equal(knight.hp,100);assert.equal(maxHpOf('mameluke',ownerOf(s,0)),95);}
 {const {s,castle}=castleFor('chinese',4);research(s,castle,'rocketry');assert.equal(statsOf('chu-ko-nu',ownerOf(s,0)).damage,10);assert.equal(statsOf('chu-ko-nu',ownerOf(s,0)).extraDamage,3,'the extra arrows stay at 3');assert.equal(statsOf('archer',ownerOf(s,0)).damage,4);}
});

test('the Great Wall rescales towers already standing, keeping their share of damage; Byzantine buildings rescale with each age',()=>{
 const {s,castle}=castleFor('chinese');const tower=raise(s,0,'watch-tower',{x:300,y:1300});assert.equal(tower.maxHp,250);tower.hp=125;
 research(s,castle,'great-wall');assert.equal(tower.maxHp,325);assert.equal(tower.hp,Math.round(125*325/250));assert.equal(tcOf(s).maxHp,400,'town centres unchanged');
 assert.equal(buildingHpOf('watch-tower',own('chinese',3)),250,'before the research');
 const byz=match('byzantines');const house=raise(byz,0,'house');assert.equal(house.maxHp,165);const tc=tcOf(byz);tc.hp=220;house.hp=150;
 ageTo(byz,2);assert.equal(tc.maxHp,480);assert.equal(tc.hp,240);assert.equal(house.maxHp,180);assert.equal(house.hp,Math.round(150*180/165));assert.equal(tcOf(byz,1).maxHp,400);
 ageTo(byz,4);assert.equal(tc.maxHp,560);assert.equal(tc.hp,280);const keep=raise(byz,0,'castle');assert.equal(keep.maxHp,1120);
});

test('Crenellations: the Castle outranges by 3 tiles and infantry inside add arrows; Stronghold and Yasama change fire rate and arrows',()=>{
 const {s,castle}=castleFor('teutons',4);clearRed(s);const box=boxOf(s,castle.id),tc=boxOf(s,tcOf(s).id);
 const spot=(lo:number,hi:number)=>{for(let n=0;n<nodeTotal(s.map);n++){const p=position(s.map,n);if(!blockedTable(s.map)[n]&&reach(p,box)>=lo&&reach(p,box)<=hi&&reach(p,tc)>450&&!s.units.some(u=>u.node===n))return p;}throw Error('no spot');};
 const far=spot(450,540),near=spot(150,350);
 const a=spawn(s,1,'militia',far.x,far.y);see(s);tick(s);assert.equal(a.hp,45,'out of range before');
 const inf=spawn(s,0,'militia',box[0]-60,box[3]+60);see(s);order(s,'garrison',{unitIds:[inf.id],buildingId:castle.id});run(s,300,()=>{see(s);return !!s.garrison[castle.id];});assert.ok(s.garrison[castle.id]);
 s.units=s.units.filter(u=>u!==a);const b=spawn(s,1,'militia',near.x,near.y);see(s);s.volleys[castle.id]=0;tick(s);assert.equal(b.hp,45-4*4,'a militia inside adds nothing yet');
 research(s,castle,'crenellations');assert.equal(arrowsOf(ownerOf(s,0),'castle').range,150);
 s.units=s.units.filter(u=>u!==b);const c=spawn(s,1,'militia',near.x,near.y);see(s);s.volleys[castle.id]=0;tick(s);assert.equal(c.hp,45-5*4,'one more arrow for the infantry inside');
 s.units=s.units.filter(u=>u!==c);const d=spawn(s,1,'militia',far.x,far.y);see(s);s.volleys[castle.id]=0;tick(s);assert.equal(d.hp,45-5*4,'hit at 3 tiles more');
 // Celts: Stronghold fires every 32 ticks instead of 40.
 {const {s,castle}=castleFor('celts');clearRed(s);research(s,castle,'stronghold');const box=boxOf(s,castle.id);const foe=spawn(s,1,'militia',box[2]+150,box[3]+150);see(s);s.volleys[castle.id]=0;tick(s);
  assert.equal(foe.hp,45-16);assert.equal(s.volleys[castle.id],32);}
 // Japanese: Yasama gives towers two more arrows.
 {const {s,castle}=castleFor('japanese');research(s,castle,'yasama');const tower=raise(s,0,'watch-tower',{x:300,y:1300}),box=boxOf(s,tower.id);const foe=spawn(s,1,'militia',box[2]+150,box[3]+50);
  assert.ok(reach(foe,boxOf(s,castle.id))>400&&reach(foe,boxOf(s,tcOf(s).id))>300);see(s);tick(s);assert.equal(foe.hp,45-3*4);}
});

test('Anarchy lets the barracks train Huskarls; Perfusion and Chivalry speed up production queued after them',()=>{
 const {s,castle}=castleFor('goths',4);const barracks=raise(s,0,'barracks');
 assert.equal(trainable(s,0,barracks,'huskarl'),'這棟建築不能生產這個項目');assert.ok(!producedAt('barracks',ownerOf(s,0)).includes('huskarl'));
 research(s,castle,'anarchy');assert.equal(trainable(s,0,barracks,'huskarl'),null);assert.ok(producedAt('barracks',ownerOf(s,0)).includes('huskarl'));
 s.accounts[0].stock.food+=500;s.accounts[0].stock.gold+=500;order(s,'train',{buildingId:barracks.id,entryId:'militia'});tick(s);
 assert.equal(barracks.queue[0].required,Math.round(20*20*100/120),'the Goth barracks already works 20% faster');
 research(s,castle,'perfusion');order(s,'train',{buildingId:barracks.id,entryId:'huskarl'});tick(s);
 assert.equal(barracks.queue[0].required,Math.round(20*20*100/120),'what was queued keeps its time');assert.equal(barracks.queue[1].required,Math.round(16*20*100/220));
 run(s,2000,()=>s.units.some(u=>u.player===0&&u.kind==='huskarl'));assert.ok(s.units.some(u=>u.player===0&&u.kind==='huskarl'),'a huskarl came out of the barracks');
 assert.equal(timeTicks('militia',ownerOf(s,1),'barracks'),400,'red\'s barracks is untouched');
 const franks=castleFor('franks');raise(franks.s,0,'barracks');const stable=raise(franks.s,0,'stable');assert.equal(timeTicks('knight',ownerOf(franks.s,0),'stable'),400);
 research(franks.s,franks.castle,'chivalry');franks.s.accounts[0].stock={food:500,wood:500,gold:500,stone:0};order(franks.s,'train',{buildingId:stable.id,entryId:'knight'});tick(franks.s);assert.equal(stable.queue[0].required,Math.round(400*100/140));
});

test('Kamandaran moves the archer\'s gold onto wood for what is queued after it; skirmishers and red pay as before',()=>{
 const {s,castle}=castleFor('persians');raise(s,0,'barracks');const range=raise(s,0,'archery-range');
 assert.deepEqual(costOf('archer',ownerOf(s,0)),{food:0,wood:40,gold:30,stone:0});research(s,castle,'kamandaran');
 assert.deepEqual(costOf('archer',ownerOf(s,0)),{food:0,wood:70,gold:0,stone:0});assert.deepEqual(costOf('skirmisher',ownerOf(s,0)),{food:25,wood:35,gold:0,stone:0});assert.deepEqual(costOf('archer',ownerOf(s,1)),{food:0,wood:40,gold:30,stone:0});
 s.accounts[0].stock={food:0,wood:70,gold:0,stone:0};order(s,'train',{buildingId:range.id,entryId:'archer'});tick(s);assert.equal(range.queue.length,1);assert.deepEqual(s.accounts[0].stock,{food:0,wood:0,gold:0,stone:0});
});

test('Nomads: a fallen house keeps its housing for the Mongols; without it the cap drops',()=>{
 for(const nomads of [true,false]){const {s,castle}=castleFor('mongols');if(nomads)research(s,castle,'nomads');const house=raise(s,0,'house',{x:300,y:1300});
  assert.equal(s.accounts[0].populationCap,5+10+5);house.hp=1;const foe=spawn(s,1,'militia',boxOf(s,house.id)[2]+40,boxOf(s,house.id)[3]-30);see(s);
  order(s,'attack',{unitIds:[foe.id],target:{kind:'building',id:house.id}},1);run(s,200,()=>{see(s);return !s.buildings.includes(house);});assert.ok(!s.buildings.includes(house),'the house fell');
  assert.equal(s.keptHousing[0],nomads?5:0);assert.equal(s.accounts[0].populationCap,nomads?20:15);}
});

test('Madrasah: a Saracen monk that falls returns 33 gold; other units and other civilizations return nothing',()=>{
 const kill=(s:State,kind:UnitKind)=>{const victim=spawn(s,0,kind,300,1450),foe=spawn(s,1,'knight',350,1450);see(s);const gold=s.accounts[0].stock.gold;
  order(s,'attack',{unitIds:[foe.id],target:{kind:'unit',id:victim.id}},1);run(s,400,()=>{see(s);return !s.units.includes(victim);});assert.ok(!s.units.includes(victim),kind+' fell');s.units=s.units.filter(u=>u!==foe);return s.accounts[0].stock.gold-gold;};
 const {s,castle}=castleFor('saracens');assert.equal(kill(s,'monk'),0,'not before the research');research(s,castle,'madrasah');
 assert.equal(kill(s,'monk'),33);assert.equal(s.accounts[0].ledger.refund.gold,33);assert.equal(kill(s,'villager'),0);
 const plain=match(neutralCiv);assert.equal(kill(plain,'monk'),0);
});

test('the Berserk regains 20 hit points a minute, 40 with Berserkergang',()=>{
 const {s,castle}=castleFor('vikings',4);const b=spawn(s,0,'berserk',300,1450),max=maxHpOf('berserk',ownerOf(s,0));assert.equal(max,Math.round(54*1.2));
 const gained=(ticks:number)=>{b.hp=max-40;const t0=s.tick;run(s,ticks);return {got:b.hp-(max-40),expect:[...Array(ticks)].filter((_,i)=>(t0+i+1)%(1200/statsOf('berserk',ownerOf(s,0)).regen!)===0).length};};
 let r=gained(600);assert.equal(r.got,r.expect);assert.equal(r.got,10);
 research(s,castle,'berserkergang');assert.equal(statsOf('berserk',ownerOf(s,0)).regen,40);r=gained(600);assert.equal(r.got,r.expect);assert.equal(r.got,20);
 const m=spawn(s,0,'militia',400,1450);m.hp=20;run(s,600);assert.equal(m.hp,20,'other infantry do not regenerate');
});

test('Chu Ko Nu fires extra arrows; Logistica tramples the enemy next to the target; the Samurai hits unique units harder',()=>{
 const volley=(civ:string,kind:UnitKind,techs:string[],victim:UnitKind,neighbours=false)=>{const {s,castle}=castleFor(civ,techs.length?4:3);for(const t of techs)research(s,castle,t);
  const at=row(s,5,700,1400),atk=spawn(s,0,kind,at.x,at.y),target=spawn(s,1,victim,at.x+(kind==='chu-ko-nu'?200:50),at.y);
  const side=neighbours?spawn(s,1,'militia',target.x+50,at.y):null,far=neighbours?spawn(s,1,'militia',target.x+100,at.y+50):null,friend=neighbours?spawn(s,0,'villager',target.x,target.y+50):null;
  // Red's militias are sent at the attacker, not at the villager beside them: what the villager loses could only be splash.
  see(s);order(s,'attack',{unitIds:[atk.id],target:{kind:'unit',id:target.id}});order(s,'attack',{unitIds:[target,side,far].flatMap(u=>u?[u.id]:[]),target:{kind:'unit',id:atk.id}},1);tick(s);
  return {lost:maxHpOf(victim as CombatUnitKind,ownerOf(s,1))-target.hp,side:side?45-side.hp:0,far:far?45-far.hp:0,friend:friend?25-friend.hp:0};};
 assert.equal(volley('chinese','chu-ko-nu',[],'militia').lost,(8-1)+2*(3-1));
 assert.equal(volley('chinese','chu-ko-nu',['rocketry'],'militia').lost,(10-1)+2*(3-1));
 assert.equal(volley('chinese','chu-ko-nu',['elite-chu-ko-nu'],'militia').lost,(8-1)+4*(3-1));
 const plain=volley('byzantines','cataphract',[],'militia',true);assert.deepEqual(plain,{lost:9+9,side:0,far:0,friend:0});
 const trample=volley('byzantines','cataphract',['logistica'],'militia',true);assert.deepEqual(trample,{lost:9+9+6,side:5,far:0,friend:0});
 assert.equal(volley('japanese','samurai',[],'longbowman').lost,8-0+10);assert.equal(volley('japanese','samurai',[],'militia').lost,8);
});

test('gathering bonuses in a real run: each speeds up its own source only',()=>{
 const deer=(s:State)=>s.units.filter(u=>u.kind==='deer').sort((a,b)=>Math.hypot(a.x-400,a.y-800)-Math.hypot(b.x-400,b.y-800))[0];
 const on=(civ:string,how:'hunt'|'sheep'|'berries'|'tree'|'gold'|'stone')=>{const s=match(civ);const v=unit(s,1);
  if(how==='hunt'){see(s);order(s,'hunt',{unitIds:[1],animalId:deer(s).id});}else if(how==='sheep')order(s,'hunt',{unitIds:[1],animalId:900001});else order(s,'gather',{unitIds:[1],resourceId:nearestResource(s,how,v).id});
  return pace(s,1);};
 const table:[string,string,number][]=[['mongols','hunt',140],['mongols','berries',100],['mongols','sheep',100],['britons','sheep',125],['britons','hunt',100],['franks','berries',125],['franks','tree',100],
  ['celts','tree',115],['celts','gold',100],['turks','gold',120],['turks','stone',100],['settlers','hunt',100],['settlers','sheep',100],['settlers','berries',100]];
 for(const [civ,how,rate] of table)assert.equal(on(civ,how as any),rate,`${civ} ${how}`);
});

test('Goth hunters carry 15 more and strike boar 5 harder; Vikings get Wheelbarrow and Hand Cart with the ages',()=>{
 const load=(civ:string,how:'hunt'|'tree',setup=(_:State)=>{})=>{const s=match(civ);setup(s);
  if(how==='hunt'){see(s);const d=s.units.filter(u=>u.kind==='deer').sort((a,b)=>Math.hypot(a.x-400,a.y-800)-Math.hypot(b.x-400,b.y-800))[0];order(s,'hunt',{unitIds:[1],animalId:d.id});}
  else order(s,'gather',{unitIds:[1],resourceId:nearestResource(s,'tree',unit(s,1)).id});
  run(s,6000,()=>s.works[1]?.phase==='toDropoff');assert.equal(s.works[1]?.phase,'toDropoff');return s.cargo[1].amount;};
 assert.equal(load('goths','hunt'),10+15);assert.equal(load('goths','tree'),10);assert.equal(load(neutralCiv,'hunt'),10);
 const strike=(civ:string,kind:'boar'|'deer')=>{const s=match(civ);const v=unit(s,1),a=spawn(s,GAIA,kind,v.x,v.y+150);see(s);order(s,'hunt',{unitIds:[1],animalId:a.id});
  const hp=a.hp;run(s,400,()=>{see(s);return a.hp<hp;});return hp-a.hp;};
 assert.equal(strike('goths','boar'),animalRules.hunt.damage+5);assert.equal(strike(neutralCiv,'boar'),animalRules.hunt.damage);assert.equal(strike('goths','deer'),animalRules.hunt.damage);
 // Vikings: free with the second and third ages; the tile then reads 已研究 and villagers carry 12, then 15.
 const s=match('vikings','vikings');ageTo(s,2);const tc=tcOf(s);assert.deepEqual(s.techs[0],['wheelbarrow']);assert.equal(trainable(s,0,tc,'wheelbarrow'),'已研究');assert.deepEqual(s.techs[1],[],'red has not aged');
 assert.equal(load('vikings','tree',s=>ageTo(s,2)),12);assert.equal(load('vikings','tree',s=>ageTo(s,3)),15);
 ageTo(s,3);assert.deepEqual(s.techs[0],['wheelbarrow','hand-cart']);assert.equal(trainable(s,0,tc,'hand-cart'),'已研究');
 const plain=match(neutralCiv);ageTo(plain,2);assert.deepEqual(plain.techs[0],[]);plain.accounts[0].stock.food+=500;plain.accounts[0].stock.wood+=500;assert.equal(trainable(plain,0,tcOf(plain),'wheelbarrow'),null);
});

test('Teuton towers hold 10 and town centres 25; the Teuton team bonus adds a sure failure to conversions',()=>{
 const fill=(civ:string)=>{const s=match(civ);const tc=tcOf(s),box=boxOf(s,tc.id);for(let i=0;i<13;i++)spawn(s,0,'villager',box[2]+100,box[3]+100);
  const ids=s.units.filter(u=>u.player===0&&u.kind==='villager').map(u=>u.id);assert.equal(ids.length,16);return {s,tc,ids,problem:garrisonProblem(s,0,tc.id,ids)};};
 const plain=fill(neutralCiv);assert.equal(plain.problem,'空位不足：還能進駐 15 名');
 const teutons=fill('teutons');assert.equal(teutons.problem,null);order(teutons.s,'garrison',{unitIds:teutons.ids,buildingId:teutons.tc.id});run(teutons.s,1500,()=>teutons.s.garrison[teutons.tc.id]?.units.length===16);
 assert.equal(teutons.s.garrison[teutons.tc.id].units.length,16);assert.equal(garrisonCapacity(teutons.s,teutons.tc),25);assert.equal(garrisonCapacity(teutons.s,tcOf(teutons.s,1)),15);
 const t=match('teutons');ageTo(t,2);const tower=raise(t,0,'watch-tower');assert.equal(garrisonCapacity(t,tower),10);assert.equal(garrisonCapacity(t,{kind:'watch-tower',player:1}),5);
 // Conversion: the same first roll succeeds at the 4th attempt against a neutral villager, the 5th against a Teuton one.
 const xs=(n:number)=>{n^=n<<13;n^=n>>>17;n^=n<<5;return n>>>0;};let seed=1;while(xs(seed)%100>=religionRules.attemptChance)seed++;
 const convert=(red:string)=>{const s=match(neutralCiv,red);const v=unit(s,4),monk=spawn(s,0,'monk',v.x-200,v.y);see(s);assert.ok(Math.max(Math.abs(monk.x-v.x),Math.abs(monk.y-v.y))<=religionRules.convertRange);
  const x=monk.x;s.rng=seed;const t0=s.tick;order(s,'convert',{unitIds:[monk.id],targetId:v.id});run(s,600,()=>{see(s);return v.player===0;});assert.equal(v.player,0);assert.equal(monk.x,x,'converted from where it stood');return s.tick-t0;};
 assert.equal(convert(neutralCiv),religionRules.attemptTicks*religionRules.attempts.min);assert.equal(convert('teutons'),religionRules.attemptTicks*(religionRules.attempts.min+1));
});

test('monks: the Byzantines heal 50% faster, the Teutons heal from twice as far',()=>{
 const heal=(civ:string,gap:number,ticks:number)=>{const s=match(civ);const at=row(s,8,700,1400),m=spawn(s,0,'militia',at.x,at.y),monk=spawn(s,0,'monk',at.x+gap,at.y);m.hp=10;const x=monk.x;
  run(s,ticks);return {gained:m.hp-10,progress:s.rites[monk.id]?.progress??-1,moved:monk.x!==x};};
 const byz=heal('byzantines',100,100),plain=heal(neutralCiv,100,100);
 assert.equal(byz.gained,Math.floor(byz.progress/Math.round(religionRules.healTicks/1.5)));assert.equal(plain.gained,Math.floor(plain.progress/religionRules.healTicks));assert.ok(byz.gained>plain.gained,`${plain.gained} -> ${byz.gained}`);assert.ok(!byz.moved&&!plain.moved);
 const far=heal('teutons',250,60),short=heal(neutralCiv,250,60);assert.equal(far.moved,false,'heals from where it stands');assert.equal(far.gained,Math.floor(far.progress/religionRules.healTicks));assert.ok(far.gained>=2);assert.equal(short.moved,true,'walks closer first');
});

test('sight: the Chinese town centre sees 5 tiles farther, Frank knights and Mongol scouts 2 tiles farther',()=>{
 const circle=(size:number,x:number,y:number,r:number)=>{const out=new Set<number>();for(let ty=0;ty<size;ty++)for(let tx=0;tx<size;tx++){const dx=tx*100+50-x,dy=ty*100+50-y;if(dx*dx+dy*dy<=r*r)out.add(ty*size+tx);}return out;};
 const view=(civ:string,kind?:UnitKind)=>{const s=match(civ);s.units=s.units.filter(u=>u.player!==0);const u=kind?spawn(s,0,kind,1300,1400):null;tick(s);const tc=s.map.obstacles.find(o=>o.id===tcOf(s).id)!;
  return {got:[...s.vision[0].visible].sort((a,b)=>a-b),tc:{x:tc.x+135,y:tc.y+135},u,size:s.map.size};};
 const expect=(v:ReturnType<typeof view>,tcR:number,uR=0)=>{const set=circle(v.size,v.tc.x,v.tc.y,tcR);if(v.u)for(const t of circle(v.size,v.u.x,v.u.y,uR))set.add(t);return [...set].sort((a,b)=>a-b);};
 assert.deepEqual(view('chinese').got,expect(view('chinese'),visionRules.townCenterRadius+500));assert.deepEqual(view(neutralCiv).got,expect(view(neutralCiv),visionRules.townCenterRadius));
 const fk=view('franks','knight');assert.deepEqual(fk.got,expect(fk,visionRules.townCenterRadius,visionRules.unitRadius+200));const pk=view(neutralCiv,'knight');assert.deepEqual(pk.got,expect(pk,visionRules.townCenterRadius,visionRules.unitRadius));
 const fm=view('franks','militia');assert.deepEqual(fm.got,expect(fm,visionRules.townCenterRadius,visionRules.unitRadius),'only knights');
 const ms=view('mongols','scout');assert.deepEqual(ms.got,expect(ms,visionRules.townCenterRadius,visionRules.scoutRadius+200));
 assert.ok(expect(view('chinese'),1000).length>expect(view(neutralCiv),600).length);
});

test('Goths: 10 more population in the fourth age, even without a new building',()=>{
 for(const civ of ['goths',neutralCiv]){const s=match(civ);for(let i=0;i<9;i++)raise(s,0,'house');assert.equal(s.accounts[0].populationCap,40,civ);
  ageTo(s,4);assert.equal(s.accounts[0].populationCap,civ==='goths'?50:40,civ);raise(s,0,'house');assert.equal(s.accounts[0].populationCap,civ==='goths'?50:40,civ);
  assert.equal(s.accounts[1].populationCap,5);}
});

test('Celt infantry move 5.75 a tick from the second age (the fraction carries over), the woad raider 8.05',()=>{
 assert.equal(speedOf('militia',own('celts',1)),5);assert.equal(speedOf('militia',own('celts',2)),5.75);assert.equal(speedOf('woad-raider',own('celts',2)),8.05);assert.equal(speedOf('archer',own('celts',2)),5);assert.equal(speedOf('knight',own('celts',4)),10);
 const walk=(civ:string,age:number)=>{const s=match(civ);ageTo(s,age);const at=row(s,9,700,1400),m=spawn(s,0,'militia',at.x,at.y);order(s,'move',{unitIds:[m.id],x:at.x+400,y:at.y});
  const steps:number[]=[];let x=m.x;run(s,300,()=>{if(m.x!==x){steps.push(m.x-x);x=m.x;}return m.x===at.x+400&&m.next===null;});assert.equal(m.x,at.x+400);assert.equal(m.y,at.y);return steps;};
 const celt=walk('celts',2),plain=walk(neutralCiv,2),early=walk('celts',1);
 // 400 units at 5.75 a tick: steps of 5 and 6, and after each node the part of a step cut short there (under one
 // step) carries on, so the walk ends in exactly ceil(400/5.75) = 70 ticks.
 assert.ok(Math.max(...celt)<=2*6,`${Math.max(...celt)}`);assert.equal(celt.reduce((t,d)=>t+d,0),400);
 assert.equal(celt.length,Math.ceil(400/5.75),`${celt.length}`);assert.equal(plain.length,8*10);assert.equal(early.length,8*10);assert.deepEqual(new Set(plain),new Set([5]));
});

test('Japanese infantry attack faster by age; the fourth-age militia strikes every 15 ticks in a real fight',()=>{
 assert.deepEqual([1,2,3,4].map(a=>statsOf('militia',own('japanese',a)).cooldown),[20,18,17,15]);assert.equal(statsOf('samurai',own('japanese',4)).cooldown,14);assert.equal(statsOf('archer',own('japanese',4)).cooldown,30);
 const s=match('japanese');ageTo(s,4);const at=row(s,3,700,1400),m=spawn(s,0,'militia',at.x,at.y),foe=spawn(s,1,'militia',at.x+50,at.y);see(s);
 order(s,'attack',{unitIds:[m.id],target:{kind:'unit',id:foe.id}});const fired:number[]=[];run(s,60,()=>{see(s);const t=s.attacks[m.id]?.firedTick;if(t!==undefined&&t>=0&&!fired.includes(t))fired.push(t);return fired.length===3;});
 assert.deepEqual([fired[1]-fired[0],fired[2]-fired[1]],[15,15]);assert.equal(statsOf('militia',ownerOf(s,1)).cooldown,20);
});

test('Turks: Light Cavalry free, gunpowder health, scout armor; the Mongol light cavalry and horse archers',()=>{
 const s=match('turks');ageTo(s,3);raise(s,0,'barracks');const stable=raise(s,0,'stable');const scout=spawn(s,0,'scout',700,1400);const stock={...s.accounts[0].stock};
 order(s,'train',{buildingId:stable.id,entryId:'light-cavalry'});tick(s);assert.deepEqual(s.accounts[0].stock,stock,'nothing paid');stable.queue[0].work=stable.queue[0].required-1;tick(s);
 assert.ok(s.techs[0].includes('light-cavalry'));assert.equal(scout.hp,60);assert.deepEqual(statsOf('scout',ownerOf(s,0)).armor,[0,3]);assert.deepEqual(statsOf('scout',ownerOf(s,1)).armor,[0,2]);
 assert.equal(maxHpOf('janissary',own('turks',3)),44);assert.equal(maxHpOf('archer',own('turks',3)),30);assert.equal(timeTicks('janissary',own('turks',3),'castle'),Math.round(17*20/1.25));
 assert.deepEqual(costOf('light-cavalry',own('teutons',3)),{food:150,wood:0,gold:50,stone:0});
 assert.equal(maxHpOf('scout',own('mongols',3,['light-cavalry'])),78);assert.equal(maxHpOf('scout',own('mongols',3)),45);assert.equal(statsOf('mangudai',own('mongols',3)).cooldown,25);assert.equal(statsOf('archer',own('mongols',3)).cooldown,30);
});

test('costs by civilization: each discount hits its own entries in its ages and nothing else',()=>{
 const c=(civ:string,id:string,age=1)=>costOf(id,own(civ,age));
 assert.deepEqual([1,2,3,4].map(a=>c('goths','militia',a)),[{food:48,wood:0,gold:16,stone:0},{food:45,wood:0,gold:15,stone:0},{food:42,wood:0,gold:14,stone:0},{food:39,wood:0,gold:13,stone:0}]);
 assert.deepEqual(c('goths','archer',3),{food:0,wood:40,gold:30,stone:0});assert.deepEqual(c('goths','huskarl',3),{food:56,wood:0,gold:28,stone:0});assert.deepEqual(c('goths','knight',3),{food:60,wood:0,gold:75,stone:0});
 assert.deepEqual(c('franks','horse-collar',2),{food:0,wood:0,gold:0,stone:0});assert.deepEqual(c('franks','wheelbarrow',2),{food:175,wood:50,gold:0,stone:0});assert.equal(c('franks','castle',3).stone,225);
 assert.deepEqual(c('teutons','farm'),{food:0,wood:36,gold:0,stone:0});assert.deepEqual(c('teutons','house'),{food:0,wood:30,gold:0,stone:0});
 assert.deepEqual([c('japanese','lumber-camp').wood,c('japanese','mining-camp').wood,c('japanese','mill').wood,c('japanese','barracks').wood],[50,50,50,150]);
 assert.deepEqual(c('byzantines','spearman',2),{food:26,wood:19,gold:0,stone:0});assert.deepEqual(c('byzantines','skirmisher',2),{food:19,wood:26,gold:0,stone:0});assert.deepEqual(c('byzantines','age-4',3),{food:536,wood:0,gold:268,stone:0});assert.deepEqual(c('byzantines','age-3',2),{food:500,wood:0,gold:200,stone:0});
 assert.deepEqual([1,2,3,4].map(a=>c('chinese','loom',a).gold),[50,45,43,40]);assert.deepEqual(c('chinese','age-3',2),{food:500,wood:0,gold:200,stone:0});assert.deepEqual(c('chinese','villager',4),{food:50,wood:0,gold:0,stone:0});assert.deepEqual(c('chinese','great-wall',3),{food:0,wood:340,gold:0,stone:170});
 // Real payment: a Goth militia in the second age is paid at the discounted price.
 const s=match('goths');ageTo(s,2);const barracks=raise(s,0,'barracks');s.accounts[0].stock={food:45,wood:0,gold:15,stone:0};order(s,'train',{buildingId:barracks.id,entryId:'militia'});tick(s);
 assert.equal(barracks.queue.length,1);assert.deepEqual(s.accounts[0].stock,{food:0,wood:0,gold:0,stone:0});
 // Goths: Loom is instant (still paid).
 const g=match('goths');const gold=g.accounts[0].stock.gold;order(g,'train',{buildingId:tcOf(g).id,entryId:'loom'});tick(g);assert.ok(g.techs[0].includes('loom'));assert.equal(g.accounts[0].stock.gold,gold-50);assert.equal(tcOf(g).queue.length,0);
 assert.ok(unit(g,1).hp===40);
});

test('production speed by civilization: Persian town centres by age, team bonuses at their buildings',()=>{
 assert.deepEqual([1,2,3,4].map(a=>timeTicks('villager',own('persians',a),'town-center')),[400,364,348,333]);assert.equal(timeTicks('villager',own('persians',4),'barracks'),400);
 assert.equal(timeTicks('archer',own('britons',2),'archery-range'),Math.round(400*100/120));assert.equal(timeTicks('militia',own('britons',2),'barracks'),400);
 assert.equal(timeTicks('ram',own('celts',3),'siege-workshop'),Math.round(400*100/120));assert.equal(timeTicks('militia',own('goths',1),'barracks'),Math.round(400*100/120));
 const s=match('persians');ageTo(s,2);s.accounts[0].stock.food+=50;order(s,'train',{buildingId:tcOf(s).id,entryId:'villager'});tick(s);assert.equal(tcOf(s).queue[0].required,364);
});

test('unit numbers by civilization: each bonus on its target kinds and ages only',()=>{
 const st=(civ:string,kind:CombatUnitKind,age=1,techs:string[]=[])=>statsOf(kind,own(civ,age,techs));
 // Britons: foot archers only, skirmishers excluded.
 assert.deepEqual([1,2,3,4].map(a=>st('britons','archer',a).range),[250,250,300,350]);assert.equal(st('britons','skirmisher',4).range,200);assert.equal(st('britons','janissary',4).range,450);
 // Goths and Saracens against buildings.
 assert.deepEqual([1,2,3,4].map(a=>hitDamage(st('goths','militia',a),buildingTarget)),[6,7,8,9]);assert.equal(hitDamage(st('goths','archer',4),buildingTarget),2);
 assert.equal(hitDamage(st('saracens','archer',2),buildingTarget),4-2+1+2);assert.equal(hitDamage(st('saracens','skirmisher',4),buildingTarget),1);assert.equal(hitDamage(st('saracens','militia',4),buildingTarget),6);
 // Vikings: infantry health by age; Chieftains against cavalry.
 assert.deepEqual([1,2,3,4].map(a=>st('vikings','militia',a).hp),[45,Math.round(45*1.1),Math.round(45*1.15),Math.round(45*1.2)]);assert.equal(st('vikings','archer',4).hp,30);
 assert.equal(hitDamage(st('vikings','militia',3,['chieftains']),st(neutralCiv,'knight')),6-2+5);assert.equal(hitDamage(st('vikings','militia',3),st(neutralCiv,'knight')),6-2);assert.equal(hitDamage(st('vikings','archer',3,['chieftains']),st(neutralCiv,'knight')),4-2);
 // Teutons: melee armor of barracks and stable units from the third age; Ironclad for siege.
 assert.deepEqual([2,3,4].map(a=>st('teutons','militia',a).armor),[[0,1],[1,1],[2,1]]);assert.deepEqual(st('teutons','knight',4).armor,[4,2]);assert.deepEqual(st('teutons','archer',4).armor,[0,0]);
 assert.deepEqual(st('teutons','ram',3,['ironclad']).armor,[4,120]);
 // Franks: stable units +20% from the second age; Bearded Axe.
 assert.deepEqual([1,2].map(a=>st('franks','knight',a).hp),[100,120]);assert.equal(st('franks','scout',2).hp,54);assert.equal(st('franks','militia',4).hp,45);assert.equal(st('franks','throwing-axeman',4,['bearded-axe']).range,250);
 // Persians: knights against archers; Mahouts.
 assert.equal(hitDamage(st('persians','knight'),st(neutralCiv,'archer')),10+2);assert.equal(hitDamage(st('persians','knight'),st(neutralCiv,'militia')),10);assert.equal(speedOf('war-elephant',own('persians',4,['mahouts'])),5.2);assert.equal(speedOf('war-elephant',own('persians',4)),4);
 // Celts: siege fire rate; Mongols: Drill.
 assert.equal(st('celts','ram').cooldown,48);assert.equal(st('celts','militia').cooldown,20);assert.equal(speedOf('ram',own('mongols',4,['drill'])),3);assert.equal(speedOf('ram',own('mongols',4)),2);
 // Byzantines: Logistica's bonus on the cataphract only.
 assert.equal(st('byzantines','cataphract',4,['logistica']).bonus.infantry,15);assert.equal(st('byzantines','cataphract',4,['logistica']).splash,5);assert.equal(st('byzantines','knight',4,['logistica']).splash,undefined);
});

test('an existing Frank scout gains its stable bonus with the second age; red\'s units never take blue\'s bonuses',()=>{
 const s=match('franks');const scout=spawn(s,0,'scout',700,1400),red=spawn(s,1,'scout',800,1400);scout.hp=30;ageTo(s,2);assert.equal(scout.hp,39);assert.equal(red.hp,45);
 for(const civ of civIds){const s=match(civ);ageTo(s,4);for(const kind of unitKindsList)assert.deepEqual(statsOf(kind,ownerOf(s,1)),statsOf(kind,[]),`${civ}: red ${kind}`);
  for(const e of rules.entries)assert.deepEqual(costOf(e.id,ownerOf(s,1)),e.cost,`${civ}: red pays list price for ${e.id}`);
  assert.equal(tcOf(s,1).maxHp,400);assert.equal(garrisonCapacity(s,tcOf(s,1)),15);assert.equal(s.accounts[1].populationCap,5);}
});

test('Chinese team bonus: farms hold 45 more food',()=>{
 const food=(civ:string)=>{const s=match(civ);const farm=raise(s,0,'farm');return s.map.resources.find(r=>r.id===farmResourceId(farm.id))!.capacity;};
 assert.equal(food('chinese'),terrainRules.resourceCapacity.farm+45);assert.equal(food(neutralCiv),terrainRules.resourceCapacity.farm);
});
