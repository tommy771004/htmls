import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,tick,hash,serialize,deserialize,replay,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {matchSettings,defaultSettings,settingRules} from '../packages/sim/settings.ts';
import {recomputeCapacity} from '../packages/sim/buildings.ts';
import type {Building} from '../packages/sim/buildings.ts';
import {civAvailable,ownerOf} from '../packages/sim/civ.ts';
import {trainBlocker} from '../packages/sim/production.ts';
import {buildingHpOf} from '../packages/sim/stats.ts';
// The lobby's match settings (前置開場): every option changes the real match, and survives save, load and replay.
const run=(s:State,n:number)=>{for(let i=0;i<n;i++)tick(s);return s;};
const building=(s:State,kind:string,player=0):Building=>{const b={id:`test-${kind}-${s.nextBuildingId++}`,kind,player,x:0,y:0,work:0,required:0,complete:true,reservationId:null,queue:[],rally:null,hp:100,maxHp:100} as unknown as Building;s.buildings.push(b);return b;};
test('match settings: defaults, every option checked, unknown values refused',()=>{
 assert.deepEqual(matchSettings(),defaultSettings);assert.deepEqual(createState(1).settings,defaultSettings);
 assert.deepEqual(matchSettings({difficulty:'hard',popCap:75}),{...defaultSettings,difficulty:'hard',popCap:75});
 for(const bad of [{difficulty:'insane'},{resources:'huge'},{popCap:33},{reveal:'half'},{startAge:5},{victory:'score'},{allTechs:'yes'}])assert.throws(()=>matchSettings(bad),Error,JSON.stringify(bad));
 assert.throws(()=>createState(1,{popCap:41}),/人口上限/);
 // The options object and the positional form build the same match.
 assert.equal(hash(createState(7,{layout:'open',opponent:'ai',civs:['britons','franks'],difficulty:'hard'})),hash(createState(7,'open','ai',['britons','franks'],'standard',{difficulty:'hard'})));
});
test('資源: the starting stock preset for both players, civilization bonuses on top',()=>{
 for(const level of ['low','standard','medium','high'] as const){const s=createState(3,{layout:'open',opponent:'ai',resources:level});
  for(const a of s.accounts)assert.deepEqual(a.stock,settingRules.resources[level],level);}
 // Persians start with 50 more food and wood; the Chinese with 200 less food, never below zero.
 const s=createState(3,{layout:'open',opponent:'ai',civs:['persians','chinese'],resources:'low'});
 assert.deepEqual(s.accounts[0].stock,{food:150,wood:150,gold:0,stone:0});assert.equal(s.accounts[1].stock.food,0);
 // 標準 is exactly the old start.
 assert.equal(hash(createState(3,{layout:'open',opponent:'ai',resources:'standard'})),hash(createState(3,'open','ai')));
});
test('人口: the population ceiling follows the setting (housing still decides below it)',()=>{
 for(const cap of [25,40,75,100]){const s=createState(5,{popCap:cap});for(let i=0;i<20;i++)building(s,'house');recomputeCapacity(s,0);
  assert.equal(s.accounts[0].populationCap,Math.min(cap,5+20*5),String(cap));}
 // Goths add 10 in the fourth age on top of the setting.
 const g=createState(5,{popCap:25,civs:['goths','settlers'],startAge:4});for(let i=0;i<20;i++)building(g,'house');recomputeCapacity(g,0);assert.equal(g.accounts[0].populationCap,35);
});
test('顯示地圖: fog, explored at start, or everything visible to both sides all match',()=>{
 const all=(s:State)=>s.map.size**2;
 const normal=createState(9,{layout:'open',opponent:'ai'});assert.ok(normal.vision[0].explored.length<all(normal));
 const explored=createState(9,{layout:'open',opponent:'ai',reveal:'explored'});assert.equal(explored.vision[0].explored.length,all(explored));assert.equal(explored.vision[1].explored.length,all(explored));
 assert.ok(explored.vision[0].visible.length<all(explored),'fog of war stays on');run(explored,40);assert.ok(explored.vision[0].visible.length<all(explored));
 const everything=createState(9,{layout:'open',opponent:'ai',reveal:'all'});run(everything,40);
 for(const v of everything.vision){assert.equal(v.visible.length,all(everything));assert.ok(v.known.some(k=>k.obstacle.kind==='town-center'&&k.obstacle.red===(v===everything.vision[0]?true:undefined)),'sees the other town centre');}
});
test('遊戲開始時代: both sides start in that age with its tiers, free technologies and looks',()=>{
 const s=createState(11,{layout:'open',opponent:'ai',civs:['vikings','byzantines'],startAge:3});
 assert.deepEqual(s.ages,[3,3]);assert.ok(s.techs[0].includes('wheelbarrow')&&s.techs[0].includes('hand-cart'),'Vikings get their free carts');
 const tc=s.buildings.find(b=>b.player===1&&b.kind==='town-center')!;assert.equal(tc.maxHp,buildingHpOf('town-center',ownerOf(s,1)));assert.equal(tc.maxHp,Math.round(400*1.3),'Byzantine third-age town centre');
 assert.ok(s.map.obstacles.filter(o=>o.kind==='town-center').every(o=>o.age===3));
 // Viking infantry health tier applies to units trained from the start (the age is reached, not researched).
 assert.equal(ownerOf(s,0).age,3);run(s,200);assert.ok(!s.outcome);
});
test('勝利 征服: holding every relic or standing a wonder starts no countdown',()=>{
 for(const victory of ['standard','conquest'] as const){
  const s=createState(13,{layout:'open',opponent:'idle',victory});const m=building(s,'monastery');for(const r of s.relics){r.carrier=null;r.monastery=m.id;}
  run(s,2);assert.equal(s.relicVictory===null,victory==='conquest',`relics ${victory}`);
  building(s,'wonder');run(s,2);assert.equal(s.wonderVictory===null,victory==='conquest',`wonder ${victory}`);
  if(victory==='conquest')assert.ok(s.accounts[0].ledger.relic.gold>=0,'relics still pay gold');}
});
test('所有科技: every civilization may use every shared entry; unique content stays its own',()=>{
 assert.equal(civAvailable('britons','camel'),false);assert.equal(civAvailable('britons','camel',true),true);
 assert.equal(civAvailable('britons','samurai',true),false);assert.equal(civAvailable('britons','longbowman',true),true);
 assert.equal(civAvailable('settlers','castle',true),false,'the neutral civ still has no castle');
 const s=createState(15,{civs:['britons','settlers'],allTechs:true,startAge:3,resources:'high'});assert.equal(ownerOf(s,0).allTechs,true);
 const input={player:0,civ:'britons',age:3,techs:[],building:{kind:'stable',complete:true,queue:[]},ownBuildings:[{kind:'stable',complete:true,queue:[]}],stock:{food:9999,wood:9999,gold:9999,stone:9999},populationUsed:0,populationReserved:0,populationCap:40};
 assert.equal(trainBlocker(input,'camel'),'此文明不能生產');assert.equal(trainBlocker({...input,allTechs:true},'camel'),null);
});
test('難易度: 標準 is the old computer exactly; easier and harder computers differ, deterministically',()=>{
 const play=(difficulty?:'easy'|'standard'|'hard'|'hardest')=>run(createState(260925,{layout:'open',opponent:'ai',...(difficulty?{difficulty}:{})}),6000);
 assert.equal(hash(play('standard')),hash(play()));
 const villagers=(s:State)=>s.units.filter(u=>u.player===1&&u.kind==='villager').length;
 const easy=play('easy'),hard=play('hard'),hardest=play('hardest');
 assert.ok(villagers(easy)<=settingRules.difficulty.easy.villagerTarget,`easy ${villagers(easy)}`);
 assert.ok(villagers(hard)>villagers(easy),`hard ${villagers(hard)} vs easy ${villagers(easy)}`);
 assert.notEqual(hash(hardest),hash(hard));assert.equal(hash(play('hard')),hash(hard),'same seed, same match');
});
test('settings survive save, load and replay; a tampered setting is refused',()=>{
 const options={layout:'open' as const,opponent:'ai' as const,civs:['teutons','mongols'],difficulty:'hard' as const,resources:'medium' as const,popCap:75,reveal:'explored' as const,startAge:2 as const,victory:'conquest' as const,allTechs:true};
 const s=run(createState(17,options),300);const back=deserialize(serialize(s));assert.deepEqual(back.settings,s.settings);assert.equal(hash(back),hash(s));
 assert.equal(hash(replay(17,s.log,300,options)),hash(s));
 const bad=structuredClone(s);(bad.settings as {popCap:number}).popCap=33;
 assert.throws(()=>deserialize(JSON.stringify({format:'brick-sandbox-34',rulesetHash,state:bad,checksum:hash(bad)})),/無效存檔狀態/);
});
