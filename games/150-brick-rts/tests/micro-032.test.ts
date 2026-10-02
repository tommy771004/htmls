// The 戰術技巧 round (aoetw.com tactics pages: 閃躲, 拉兵, 包圍, 分散, the stances and patrol): shots fly and may miss,
// Ballistics leads moving targets, Thumb Ring makes shots at a standing target sure, Tracking, unit stances, patrols
// and the spread move.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,hash,replay,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {makeUnit} from '../packages/sim/movement.ts';
import type {UnitKind,Unit} from '../packages/sim/movement.ts';
import {position,blockedTable,nodeTotal} from '../packages/sim/navigation.ts';
import {statsOf,maxHpOf,hitDamage,shotOf,projectileRules} from '../packages/sim/stats.ts';
import type {CombatUnitKind} from '../packages/sim/stats.ts';
import {ownerOf,costOf,losBonus} from '../packages/sim/civ.ts';
import {tacticsRules} from '../packages/sim/combat.ts';
import {trainable} from '../packages/sim/production.ts';
import {authoritativeProblem,placeBuilding,addWork} from '../packages/sim/buildings.ts';
import type {BuildKind} from '../packages/sim/buildings.ts';
import {rules,resources} from '../packages/content/rules.ts';
import {neutralCiv} from '../packages/content/civs.ts';
import {settle} from './flight.ts';

const SEED=260925,Y=1250;
function order(s:State,commandType:string,payload:any,playerId=0){submit(s,{protocolVersion:1,rulesetHash,playerId,sequence:s.sequence[playerId]+1,targetTick:s.tick+1,commandType,payload} as any);}
const tiles=(s:State)=>Array.from({length:s.map.size*s.map.size},(_,i)=>i);
const see=(s:State)=>{for(const v of s.vision){v.visible=tiles(s);v.explored=tiles(s);}};
const run=(s:State,n:number,stop=()=>false)=>{for(let i=0;i<n;i++){see(s);if(stop())return;tick(s);}see(s);};
function match(civ=neutralCiv){const s=createState(SEED,'meadow','idle',[civ,neutralCiv]);see(s);s.units=s.units.filter(u=>!(u.player===1&&u.kind==='villager'));return s;}
function freeNode(s:State,x:number,y:number){const closed=blockedTable(s.map),held=new Set(s.units.flatMap(u=>u.next===null?[u.node]:[u.node,u.next]));let best=-1,d=Infinity;
 for(let n=0;n<nodeTotal(s.map);n++){if(closed[n]||held.has(n))continue;const p=position(s.map,n),e=Math.abs(p.x-x)+Math.abs(p.y-y);if(e<d){d=e;best=n;}}return best;}
function spawn(s:State,player:number,kind:UnitKind,x:number,y:number){const p=position(s.map,freeNode(s,x,y)),u=makeUnit(s.map,s.nextUnitId++,player,p.x,p.y,kind);
 assert.deepEqual({x:u.x,y:u.y},{x,y},`${kind} stands on the node asked for`);
 u.hp=maxHpOf(kind as CombatUnitKind,ownerOf(s,player));s.units.push(u);s.units.sort((a,b)=>a.id-b.id);s.accounts[player].populationUsed++;return u;}
function raise(s:State,p:number,kind:BuildKind,near:{x:number;y:number}){const cost=costOf(kind,ownerOf(s,p));for(const k of resources)s.accounts[p].stock[k]+=cost[k];
 for(let r=0;r<=800;r+=50)for(let dx=-r;dx<=r;dx+=50)for(let dy=-r;dy<=r;dy+=50){const x=near.x+dx,y=near.y+dy;if(!authoritativeProblem(s,p,kind,x,y)){const b=placeBuilding(s,p,kind,x,y,`fixture:${s.nextBuildingId}`);while(!b.complete)addWork(s,b);return b;}}
 throw Error(`no site for ${kind}`);}
// An archer (blue) shooting a red villager with a deep pool of hit points for a fixed time: what the villager lost.
// moving: the villager walks up and down across the line of fire (the 閃躲 of the tactics page).
function volleyAt(techs:string[],moving:boolean,ticks=600){
 const s=match();s.techs[0].push(...techs);const a=spawn(s,0,'archer',300,Y),v=spawn(s,1,'villager',550,Y);v.hp=10000;
 order(s,'attack',{unitIds:[a.id],target:{kind:'unit',id:v.id}});
 let leg=0,last=-99;for(let i=0;i<ticks;i++){see(s);if(moving&&v.next===null&&!v.path.length&&i-last>20){order(s,'move',{unitIds:[v.id],x:550,y:leg%2?Y-150:Y+150},1);leg++;last=i;}tick(s);}
 settle(s,see);return {lost:10000-v.hp,per:hitDamage(statsOf('archer',ownerOf(s,0)),statsOf('villager',ownerOf(s,1))),shots:s.nextProjectileId};}

test('shots fly: nothing lands on the firing tick, the arrow arrives after its flight; a town centre\'s arrows fly too',()=>{
 const s=match();const a=spawn(s,0,'archer',300,Y),v=spawn(s,1,'villager',550,Y);s.techs[0].push('thumb-ring');
 order(s,'attack',{unitIds:[a.id],target:{kind:'unit',id:v.id}});run(s,40,()=>(s.attacks[a.id]?.firedTick??-1)>=0);
 assert.equal(v.hp,25,'not yet');assert.equal(s.projectiles.length,1);const p=s.projectiles[0];assert.equal(p.speed,projectileRules.units.archer.speed);
 const fired=s.tick;run(s,40,()=>v.hp<25);const flight=s.tick-fired;assert.ok(flight>=Math.floor(250/17.5)-1&&flight<=Math.ceil(250/17.5)+1,`about 250 / 17.5 ticks (${flight})`);
 assert.equal(v.hp,25-hitDamage(statsOf('archer',ownerOf(s,0)),statsOf('villager')));
 // A town centre's arrow: launched, then down.
 const t=createState(SEED,'meadow','idle');see(t);const tc=t.buildings.find(b=>b.player===0&&b.kind==='town-center')!;
 const at=position(t.map,freeNode(t,tc.x+400,tc.y+100)),foe=spawn(t,1,'militia',at.x,at.y);t.stances[foe.id]='passive';run(t,2);assert.ok(t.projectiles.some(p=>p.kind==='town-center'),'an arrow in the air');
 assert.equal(foe.hp,45);settle(t,see);assert.ok(foe.hp<45,'it lands');
});

test('閃躲: without Ballistics a target walking across the line of fire takes far fewer arrows; Ballistics leads it',()=>{
 const still=volleyAt([],false),dodging=volleyAt([],true),led=volleyAt(['ballistics'],true);
 assert.ok(still.lost>0&&dodging.lost<still.lost/2,`dodging ${dodging.lost} against standing ${still.lost}`);
 assert.ok(led.lost>dodging.lost*2,`Ballistics ${led.lost} against ${dodging.lost} without`);
 // Every arrow that lands does the archer's whole hit.
 for(const r of [still,dodging,led])assert.equal(r.lost%r.per,0);
});

test('accuracy: 80% for the archer, sure shots at a standing target with Thumb Ring; the rolls replay exactly',()=>{
 assert.equal(shotOf('archer')!.accuracy,80);assert.equal(shotOf('archer',['crossbowman'])!.accuracy,85);assert.equal(shotOf('archer',['crossbowman','arbalest'])!.accuracy,90);
 assert.equal(shotOf('cavalry-archer')!.accuracy,50);assert.equal(shotOf('longbowman',['elite-longbowman'])!.accuracy,80);assert.equal(shotOf('janissary')!.accuracy,50);
 assert.equal(shotOf('archer',['thumb-ring'])!.steady,100);assert.equal(shotOf('hand-cannoneer',['thumb-ring'])!.steady,0,'gunpowder never');assert.equal(shotOf('militia'),null,'blows land at once');
 assert.equal(shotOf('trebuchet',{civ:'britons',age:4,techs:['warwolf']})!.steady,100);
 const plain=volleyAt([],false,900),ring=volleyAt(['thumb-ring'],false,900);
 assert.equal(ring.lost,ring.shots*ring.per,'every arrow at the standing villager lands');assert.ok(plain.lost<plain.shots*plain.per,'some of the 80% arrows miss');
 // The same start gives the same rolls; a logged match with arrows replays to the same state.
 assert.deepEqual(volleyAt([],false,300),volleyAt([],false,300));
 const m=createState(SEED,'open','ai');for(let i=0;i<9000&&!m.outcome;i++)tick(m);assert.ok(m.nextProjectileId>0,'arrows were shot');
 assert.equal(hash(replay(m.seed,m.log,m.tick,'open','ai')),hash(m));
});

test('a missed shot comes down beside its target and strikes an enemy standing there, never a friend',()=>{
 const s=match();s.ages[0]=3;const a=spawn(s,0,'cavalry-archer',300,Y),v=spawn(s,1,'ram',550,Y);
 const ring=[spawn(s,1,'ram',600,Y),spawn(s,1,'ram',500,Y),spawn(s,1,'ram',550,Y+50),spawn(s,1,'ram',550,Y-50),spawn(s,1,'ram',600,Y+50),spawn(s,1,'ram',500,Y-50)],friend=spawn(s,0,'ram',600,Y-50);
 for(const u of [v,...ring])u.hp=10000;
 order(s,'attack',{unitIds:[a.id],target:{kind:'unit',id:v.id}});run(s,1500);settle(s,see);
 assert.ok(ring.some(u=>u.hp<10000),'a stray arrow struck a ram beside the target');assert.equal(friend.hp,maxHpOf('ram',ownerOf(s,0)),'never an own unit');
});

test('stances: stand ground never steps to fight, no attack never starts one but obeys an order, defensive gives up and walks back',()=>{
 // Aggressive (the default) chases a red villager in sight; stand ground stays where it is.
 for(const stance of ['aggressive','stand'] as const){const s=match();const m=spawn(s,0,'militia',300,Y),v=spawn(s,1,'villager',500,Y);
  if(stance!=='aggressive')order(s,'stance',{unitIds:[m.id],stance});run(s,200);
  if(stance==='stand'){assert.deepEqual({x:m.x,y:m.y},{x:300,y:Y},'stand ground: not a step');assert.equal(v.hp,25);}else assert.ok(v.hp<25,'aggressive: went and hit it');}
 // Stand ground still hits what is in reach.
 {const s=match();const m=spawn(s,0,'militia',300,Y),v=spawn(s,1,'villager',350,Y);order(s,'stance',{unitIds:[m.id],stance:'stand'});run(s,100);assert.ok(v.hp<25);assert.deepEqual({x:m.x,y:m.y},{x:300,y:Y});}
 // No attack: an archer with a red villager in range does nothing, until ordered.
 {const s=match();const a=spawn(s,0,'archer',300,Y),v=spawn(s,1,'villager',500,Y);s.techs[0].push('thumb-ring');order(s,'stance',{unitIds:[a.id],stance:'passive'});run(s,200);
  assert.equal(s.attacks[a.id],undefined);assert.equal(v.hp,25);
  order(s,'attack',{unitIds:[a.id],target:{kind:'unit',id:v.id}});run(s,200);assert.ok(v.hp<25,'an order is obeyed');assert.equal(s.stances[a.id],'passive','the stance stays');}
 // Defensive: chases a villager that runs off, gives up past the leash and walks back.
 {const s=match();const m=spawn(s,0,'militia',300,Y),v=spawn(s,1,'villager',550,Y);v.hp=10000;order(s,'stance',{unitIds:[m.id],stance:'defensive'});run(s,3);
  assert.ok(s.attacks[m.id]?.anchor,'engaged, remembering where it stood');order(s,'move',{unitIds:[v.id],x:1500,y:Y},1);
  let far=0;run(s,600,()=>{far=Math.max(far,Math.abs(m.x-300));return false;});
  assert.ok(far<=tacticsRules.defensiveLeash+100,`never far past the leash (${far})`);assert.equal(s.attacks[m.id],undefined,'gave up');assert.ok(Math.abs(m.x-300)<=100,`back near where it stood (${m.x})`);}
 // Validation: villagers have no stance; the names are fixed.
 const s=match();assert.throws(()=>order(s,'stance',{unitIds:[1],stance:'stand'}),/只有戰鬥單位/);
 const m=spawn(s,0,'militia',300,Y);assert.throws(()=>order(s,'stance',{unitIds:[m.id],stance:'berserk'}),/未知的戰鬥姿態/);
});

test('patrol: the unit walks between two points, fights what it meets, then patrols on; another order ends it',()=>{
 const s=match();const m=spawn(s,0,'militia',300,Y),seen=new Set<number>();
 order(s,'patrol',{unitIds:[m.id],x:900,y:Y});run(s,600,()=>{seen.add(m.x);return false;});
 assert.ok(s.patrols[m.id],'still patrolling');assert.ok(Math.max(...seen)>=800&&Math.min(...seen)<=400,'reached both ends');
 // An enemy on the route: fought, then the patrol goes on.
 const v=spawn(s,1,'villager',600,Y);run(s,600,()=>!s.units.includes(v));assert.ok(!s.units.includes(v),'killed on the way');
 const at=m.x;run(s,200);assert.ok(s.patrols[m.id]&&m.x!==at,'patrolling again');
 order(s,'stop',{unitIds:[m.id]});run(s,2);assert.equal(s.patrols[m.id],undefined,'a stop ends it');
});

test('spread: a group moved with spread keeps two nodes between its units; packed otherwise',()=>{
 const gaps=(spread:boolean)=>{const s=match();const us:Unit[]=[0,1,2,3,4,5].map(i=>spawn(s,0,'militia',300+50*(i%3),Y+50*Math.floor(i/3)));
  order(s,'move',{unitIds:us.map(u=>u.id),x:900,y:Y,...(spread?{spread:true}:{})});run(s,600,()=>us.every(u=>u.next===null&&!u.path.length&&u.x>=700));
  let min=Infinity;for(const a of us)for(const b of us)if(a!==b)min=Math.min(min,Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y)));return min;};
 assert.equal(gaps(false),50);assert.equal(gaps(true),100);
});

test('Ballistics at the University (Castle Age, 300 wood 175 gold, 60 s) for every civilization; Tracking: infantry see 2 tiles farther from the second age',()=>{
 const e=rules.entries.find(e=>e.id==='ballistics')!;assert.deepEqual([e.cost,e.requires,e.time,rules.production.ballistics],[{food:0,wood:300,gold:175,stone:0},['age-3'],60,'university']);
 for(const c of rules.civilizations)assert.ok(c.available.includes('ballistics'),c.id);
 const s=match();s.ages[0]=3;const school=raise(s,0,'university',{x:600,y:Y});for(const k of resources)s.accounts[0].stock[k]+=500;assert.equal(trainable(s,0,school,'ballistics'),null);
 order(s,'train',{buildingId:school.id,entryId:'ballistics'});run(s,60*20+5,()=>s.techs[0].includes('ballistics'));assert.ok(s.techs[0].includes('ballistics'));
 assert.equal(shotOf('archer',ownerOf(s,0))!.lead,true);assert.equal(shotOf('hand-cannoneer',ownerOf(s,0))!.lead,false,'gunpowder is not led');assert.equal(shotOf('scorpion',ownerOf(s,0))!.lead,false);
 const inf=statsOf('militia').classes;assert.equal(losBonus({civ:neutralCiv,age:1,techs:[]},'militia',inf),0);assert.equal(losBonus({civ:neutralCiv,age:2,techs:[]},'militia',inf),200);
 assert.equal(losBonus({civ:neutralCiv,age:2,techs:[]},'archer',statsOf('archer').classes),0);
});

test('spread: five or more soldiers (militia and archers) reach stations at least 100 apart in every direction; a normal move still packs',()=>{
 // The group's stations are two nodes apart; each unit walks its own route around the others' stations, so none stops
 // beside a mate that settled first (the bug the micro flow found: 3 militia + 2 archers after a packed move).
 const nearest=(us:Unit[])=>Math.min(...us.map(a=>Math.min(...us.filter(b=>b!==a).map(b=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))))));
 for(const n of [5,7]){const s=match();s.ages[0]=2;
  const us:Unit[]=Array.from({length:n},(_,i)=>spawn(s,0,i<3?'militia':'archer',400+50*(i%4),Y+50*Math.floor(i/4)));
  const ids=us.map(u=>u.id),settled=()=>us.every(u=>u.next===null&&!u.path.length&&!s.pathJobs.some(j=>j.kind==='group'?j.unitIds.includes(u.id):j.unitId===u.id));
  for(const [to,spread] of [[{x:400,y:Y-400},false],[{x:400,y:Y+100},true],[{x:1000,y:Y},true],[{x:600,y:Y-350},true],[{x:900,y:Y+200},false]] as [{x:number;y:number},boolean][]){
   order(s,'move',{unitIds:ids,...to,...(spread?{spread:true}:{})});run(s,3);run(s,800,settled);assert.ok(settled(),`${n} units settled after the move to ${to.x},${to.y}`);
   const d=nearest(us);if(spread)assert.ok(d>=100,`${n} units spread to ${to.x},${to.y}: nearest ${d}`);else assert.equal(d,50,`${n} units packed at ${to.x},${to.y}`);}}
});
