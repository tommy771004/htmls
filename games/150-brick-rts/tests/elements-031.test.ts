// The 遊戲元素 round (aoetw.com game-element pages): armor classes with class armor, frame delay, area of effect (friendly
// fire, the war elephant's trample, the rams' splash on buildings) and the shooter revealed by its hit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {makeUnit} from '../packages/sim/movement.ts';
import type {UnitKind} from '../packages/sim/movement.ts';
import {position,blockedTable,nodeTotal} from '../packages/sim/navigation.ts';
import {statsOf,maxHpOf,hitDamage,buildingTargetOf,buildingClassesOf} from '../packages/sim/stats.ts';
import type {CombatUnitKind} from '../packages/sim/stats.ts';
import {ownerOf,costOf} from '../packages/sim/civ.ts';
import type {Owner} from '../packages/sim/civ.ts';
import {authoritativeProblem,placeBuilding,addWork} from '../packages/sim/buildings.ts';
import type {BuildKind} from '../packages/sim/buildings.ts';
import {revealTicks} from '../packages/sim/combat.ts';
import {tileAt} from '../packages/sim/terrain.ts';
import {resources} from '../packages/content/rules.ts';
import {neutralCiv} from '../packages/content/civs.ts';
import {settle} from './flight.ts';

const SEED=260925,Y=1250;
function order(s:State,commandType:string,payload:any,playerId=0){submit(s,{protocolVersion:1,rulesetHash,playerId,sequence:s.sequence[playerId]+1,targetTick:s.tick+1,commandType,payload} as any);}
const tiles=(s:State)=>Array.from({length:s.map.size*s.map.size},(_,i)=>i);
const see=(s:State)=>{for(const v of s.vision){v.visible=tiles(s);v.explored=tiles(s);}};
const run=(s:State,n:number,stop=()=>false)=>{for(let i=0;i<n;i++){see(s);if(stop())return;tick(s);}see(s);};
const own=(civ:string,age=1,techs:string[]=[]):Owner=>({civ,age,techs});
function match(civ=neutralCiv){const s=createState(SEED,'meadow','idle',[civ,neutralCiv]);see(s);return s;}
const clearRed=(s:State)=>{s.units=s.units.filter(u=>!(u.player===1&&u.kind==='villager'));};
function freeNode(s:State,x:number,y:number){const closed=blockedTable(s.map),held=new Set(s.units.flatMap(u=>u.next===null?[u.node]:[u.node,u.next]));let best=-1,d=Infinity;
 for(let n=0;n<nodeTotal(s.map);n++){if(closed[n]||held.has(n))continue;const p=position(s.map,n),e=Math.abs(p.x-x)+Math.abs(p.y-y);if(e<d){d=e;best=n;}}return best;}
function spawn(s:State,player:number,kind:UnitKind,x:number,y:number){const p=position(s.map,freeNode(s,x,y)),u=makeUnit(s.map,s.nextUnitId++,player,p.x,p.y,kind);
 assert.deepEqual({x:u.x,y:u.y},{x,y},`${kind} stands on the node asked for`);
 u.hp=maxHpOf(kind as CombatUnitKind,ownerOf(s,player));s.units.push(u);s.units.sort((a,b)=>a.id-b.id);s.accounts[player].populationUsed++;return u;}
const freeAt=(s:State,x:number,y:number)=>position(s.map,freeNode(s,x,y));
function raise(s:State,p:number,kind:BuildKind,at:{x:number;y:number}){const cost=costOf(kind,ownerOf(s,p));for(const k of resources)s.accounts[p].stock[k]+=cost[k];
 assert.equal(authoritativeProblem(s,p,kind,at.x,at.y),null,`${kind} at ${at.x},${at.y}`);
 const b=placeBuilding(s,p,kind,at.x,at.y,`fixture:${s.nextBuildingId}`);while(!b.complete)addWork(s,b);return b;}

test('armor classes: a bonus is dulled by the target\'s armor of that class, never below 0; buildings have their classes',()=>{
 // Spearman (4, +12 against cavalry) against a Cataphract (melee armor 2, cavalry armor 10): 2 + 2; against a knight 2 + 12.
 assert.equal(hitDamage(statsOf('spearman'),statsOf('cataphract')),(4-2)+(12-10));assert.equal(hitDamage(statsOf('spearman'),statsOf('knight')),(4-2)+12);
 assert.equal(hitDamage(statsOf('spearman',['elite-cataphract']),statsOf('cataphract',['elite-cataphract'])),Math.max(1,(4-2)+Math.max(0,12-13)),'the elite\'s 13 swallows the whole bonus');
 // The Mameluke: cavalry armor 9 and its own class; a halberdier hits it for 6 + (26 - 9) + 9.
 assert.deepEqual(statsOf('mameluke').classes,['cavalry','unique','mameluke']);
 assert.equal(hitDamage(statsOf('spearman',['pikeman','halberdier']),statsOf('mameluke')),6+(26-9)+9);
 assert.equal(hitDamage(statsOf('mameluke'),statsOf('mameluke')),8,'its bonus against cavalry meets its own cavalry armor');
 // Attack under armor is 0, not negative: a galley (6 pierce, +8 against ships) on a galleon (pierce armor 8): 0 + 8.
 assert.equal(hitDamage(statsOf('galley'),statsOf('galley',['war-galley','galleon'])),0+8);
 // Fire against fire: the fire galley's ship armor 6 eats its +3; at least 1.
 assert.equal(hitDamage(statsOf('fire-galley'),statsOf('fire-galley')),1);
 // Fishing ships are their own class: ship bonuses need their fishing-ship twin (a fire galley has only +1 there).
 assert.deepEqual(statsOf('fishing-ship').classes,['fishing-ship']);assert.equal(hitDamage(statsOf('fire-galley'),statsOf('fishing-ship')),1+1);
 assert.equal(hitDamage(statsOf('galley'),statsOf('fishing-ship')),(6-4)+8);
 // Rams and trebuchets are 'ram': galleys, hand cannoneers and Janissaries have a bonus there.
 for(const k of ['ram','trebuchet'] as const)assert.ok(statsOf(k).classes.includes('ram'),k);
 assert.equal(hitDamage(statsOf('galley'),statsOf('ram')),0+3,'6 against pierce armor 120: nothing but the +3');
 // Building classes and building-class armor (castle 3, stone wall 5 -> 8 with Fortified Wall, gate 6; Masonry +1).
 assert.deepEqual(buildingClassesOf('house'),['building','standard-building']);assert.deepEqual(buildingClassesOf('wonder'),['building']);
 assert.deepEqual(buildingClassesOf('stone-wall'),['building','standard-building','stone-defense','wall-gate']);
 assert.deepEqual(buildingClassesOf('castle'),['building','standard-building','castle']);assert.deepEqual(buildingClassesOf('palisade-gate'),['building','standard-building','wall-gate']);
 assert.deepEqual(['house','castle','stone-wall','gate'].map(k=>buildingTargetOf(k).classArmor?.building??0),[0,3,5,6]);
 assert.equal(buildingTargetOf('stone-wall',own(neutralCiv,3,['fortified-wall'])).classArmor?.building,8);
 assert.equal(buildingTargetOf('castle',own(neutralCiv,4,['masonry','architecture'])).classArmor?.building,5);
 // A petard: 25 + (55 - 5) + 99 on a stone wall, 25 + (55 - 3) + 11 on a castle, 25 + 55 on a house.
 const p=statsOf('petard');assert.equal(hitDamage(p,buildingTargetOf('stone-wall')),25+50+99);assert.equal(hitDamage(p,buildingTargetOf('castle')),25+52+11);assert.equal(hitDamage(p,buildingTargetOf('house')),25+55);
 // Villagers +1 against buildings and +2 more against stone defenses; infantry lines against standard buildings only.
 assert.equal(hitDamage(statsOf('villager'),buildingTargetOf('house')),1+1);assert.equal(hitDamage(statsOf('villager'),buildingTargetOf('stone-wall')),1+0+2,'its +1 meets the wall\'s building armor 5');
 assert.equal(hitDamage(statsOf('militia',['man-at-arms']),buildingTargetOf('house')),8+2);assert.equal(hitDamage(statsOf('militia',['man-at-arms']),buildingTargetOf('wonder')),8);
 // The new bonuses: scouts against monks, camels against ships, the cannon galleon against soldiers, the elite skirmisher
 // against horse archers.
 assert.deepEqual([statsOf('scout').bonus.monk,statsOf('scout',['light-cavalry']).bonus.monk,statsOf('scout',['light-cavalry','hussar']).bonus.monk],[6,10,12]);
 assert.deepEqual([statsOf('camel').bonus.ship,statsOf('camel',['heavy-camel']).bonus.ship],[5,9]);
 assert.deepEqual(['infantry','archer','cavalry'].map(c=>statsOf('cannon-galleon').bonus[c]),[15,15,15]);
 assert.equal(statsOf('skirmisher',['elite-skirmisher']).bonus['cavalry-archer'],2);
});

test('frame delay: a ranged unit aims before its first shot at a new target; melee strikes at once; a walk starts the aim over',()=>{
 for(const [kind,delay] of [['archer',5],['cavalry-archer',10],['militia',0]] as [UnitKind,number][]){
  assert.equal(statsOf(kind as CombatUnitKind).frameDelay??0,delay,kind);
  const s=match();clearRed(s);const range=statsOf(kind as CombatUnitKind).range,a=spawn(s,0,kind,300,Y),foe=spawn(s,1,'ram',300+Math.max(50,range),Y);
  // When a shot leaves is the attack's firedTick (shots fly from the 戰術技巧 round on and land a little later).
  order(s,'attack',{unitIds:[a.id],target:{kind:'unit',id:foe.id}});run(s,delay);assert.equal(foe.hp,175,`${kind}: nothing during the aim`);assert.equal(s.attacks[a.id]?.firedTick??-1,-1);
  run(s,1);assert.equal(s.attacks[a.id].firedTick,s.tick,`${kind}: the first shot on tick ${delay+1}`);
  // Later shots come on the cooldown only.
  const fired=s.tick,cd=statsOf(kind as CombatUnitKind).cooldown;run(s,cd-1);assert.equal(s.attacks[a.id].firedTick,fired);run(s,1);assert.equal(s.attacks[a.id].firedTick,s.tick,`${kind}: the second shot one cooldown later`);
  settle(s,see);assert.ok(foe.hp<175,`${kind}: the shots land`);}
 // Hit and run: the archer steps away and comes back: the aim starts over.
 const s=match();clearRed(s);const a=spawn(s,0,'archer',300,Y),foe=spawn(s,1,'ram',550,Y);
 order(s,'attack',{unitIds:[a.id],target:{kind:'unit',id:foe.id}});run(s,6);assert.equal(s.attacks[a.id].firedTick,s.tick);settle(s,see);assert.equal(foe.hp,174);
 order(s,'move',{unitIds:[a.id],x:200,y:Y});run(s,60,()=>a.x===200&&a.next===null);
 order(s,'attack',{unitIds:[a.id],target:{kind:'unit',id:foe.id}});let first=-1;const t0=s.tick;run(s,200,()=>{if((s.attacks[a.id]?.firedTick??-1)>t0){first=s.tick;return true;}return false;});
 assert.ok(first-t0>5,`walked back in range, then aimed again (${first-t0} ticks)`);assert.ok(s.attacks[a.id]?.windup===0,'aimed and fired');
});

test('area of effect: the bombard cannon hits its own units too; demolition rafts and Warwolf spare them; the elephant tramples',()=>{
 // Which blasts spare their own (aoetw.com marks only the mangonel line and the bombard cannon *).
 assert.deepEqual(['mangonel','bombard-cannon','demolition-raft','trebuchet','petard'].map(k=>!!statsOf(k as CombatUnitKind,['warwolf']).friendlyFire),[true,true,false,false,false]);
 // Bombard cannon: an own ram next to the enemy one takes the blast too (never the cannon itself).
 {const s=match();clearRed(s);s.ages[0]=4;s.techs[0].push('chemistry');const b=spawn(s,0,'bombard-cannon',200,Y),foe=spawn(s,1,'ram',800,Y),mine=spawn(s,0,'ram',850,Y);
  order(s,'attack',{unitIds:[b.id],target:{kind:'unit',id:foe.id}});run(s,1+7);assert.equal(s.attacks[b.id].firedTick,s.tick,'fired after its aim');run(s,400,()=>foe.hp<175);assert.equal(foe.hp,175-46);assert.equal(mine.hp,175-46,'friendly fire');}
 // War elephant: enemies next to its target take half of what the blow would do to them; own units none (rams, which
 // never strike back, so only the elephant's blow counts).
 {const s=match('persians');clearRed(s);s.ages[0]=3;const e=spawn(s,0,'war-elephant',300,Y),target=spawn(s,1,'ram',350,Y),side=spawn(s,1,'ram',400,Y),far=spawn(s,1,'ram',450,Y),friend=spawn(s,0,'ram',350,Y+50);
  assert.equal(statsOf('war-elephant').trample,0.5);
  order(s,'attack',{unitIds:[e.id],target:{kind:'unit',id:target.id}});tick(s);
  const full=hitDamage(statsOf('war-elephant',ownerOf(s,0)),statsOf('ram'));assert.equal(full,15);assert.equal(target.hp,175-full);assert.equal(side.hp,175-Math.round(full*0.5),'next to the target: half');
  assert.equal(far.hp,175,'two nodes away: none');assert.equal(friend.hp,175,'own units: none');}
});

test('capped and siege rams strike the enemy buildings next to the one they hit; the battering ram does not',()=>{
 for(const [techs,splash] of [[[],0],[['capped-ram'],75],[['capped-ram','siege-ram'],100]] as [string[],number][]){
  const s=match();clearRed(s);s.ages[0]=4;s.techs[0].push(...techs);assert.equal(statsOf('ram',ownerOf(s,0)).buildingSplash??0,splash);
  // Two red houses side by side 55 apart (gap between footprints), a third 140 away.
  let at:{x:number;y:number}|null=null;for(let y=900;y<=1500&&!at;y+=10)for(let x=450;x<=1300&&!at;x+=10)if([0,290,-390].every(dx=>!authoritativeProblem(s,1,'house',x+dx,y)))at={x,y};
  assert.ok(at,'a row for three houses');const a=raise(s,1,'house',at!),b=raise(s,1,'house',{x:at!.x+290,y:at!.y}),c=raise(s,1,'house',{x:at!.x-390,y:at!.y});
  const ram=spawn(s,0,'ram',freeAt(s,at!.x+100,at!.y+300).x,freeAt(s,at!.x+100,at!.y+300).y);order(s,'attack',{unitIds:[ram.id],target:{kind:'building',id:a.id}});run(s,400,()=>a.hp<a.maxHp);
  assert.ok(a.hp<a.maxHp,'the target is struck');assert.equal(b.hp<b.maxHp,splash>=50,`the house 50 away (splash ${splash})`);assert.equal(c.hp,c.maxHp,'150 away: never');}
});

test('a hit from out of sight shows the shooter to the victim for a while',()=>{
 // A trebuchet 850 from red's town centre (which sees 600): red learns where it stands when the stone lands.
 const s=createState(SEED,'meadow','idle',['franks',neutralCiv]);clearRed(s);
 const red=s.buildings.find(b=>b.player===1&&b.kind==='town-center')!,tre=makeUnit(s.map,s.nextUnitId++,0,1200,Y,'trebuchet');tre.hp=150;s.units.push(tre);s.accounts[0].populationUsed++;
 for(const v of s.vision){v.visible=tiles(s);v.explored=tiles(s);}order(s,'attack',{unitIds:[tre.id],target:{kind:'building',id:red.id}});
 const spot=tileAt(tre.x,tre.y,s.map.size);let hitTick=-1;
 for(let i=0;i<400&&hitTick<0;i++){tick(s);s.vision[0].visible=tiles(s);if(red.hp<red.maxHp)hitTick=s.tick;}
 assert.ok(hitTick>0,'the stone landed');assert.ok(s.vision[1].visible.includes(spot),'red sees the trebuchet\'s tile');
 assert.deepEqual(s.reveals.map(r=>[r.player,r.tile]),[[1,spot]]);
 // It fades after revealTicks unless another stone lands; the trebuchet reloads in 100, so move it out of range first.
 order(s,'stop',{unitIds:[tre.id]});for(let i=0;i<revealTicks+2;i++){tick(s);s.vision[0].visible=tiles(s);}
 assert.equal(s.reveals.length,0);assert.ok(!s.vision[1].visible.includes(spot),'hidden again');
});
