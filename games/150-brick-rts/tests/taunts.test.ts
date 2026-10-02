// Taunts (the 遊戲元素 round): the 'taunt' command through the real sim (validation, the one-a-second limit, the chat
// log, save and replay) and the computer's taunts at the moments it watches for.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,rulesetHash,replay,hash,serialize,deserialize} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {makeUnit} from '../packages/sim/movement.ts';
import {position,blockedTable,nodesNear} from '../packages/sim/navigation.ts';
import {maxHpOf} from '../packages/sim/stats.ts';
import {ownerOf} from '../packages/sim/civ.ts';
import {aiRules} from '../packages/sim/ai.ts';
import {taunts,tauntOf,tauntRules,parseTaunt} from '../packages/content/taunts.ts';

const SEED=260925;
function order(s:State,commandType:string,payload:any,playerId=0){submit(s,{protocolVersion:1,rulesetHash,playerId,sequence:s.sequence[playerId]+1,targetTick:s.tick+1,commandType,payload} as any);}
const run=(s:State,n:number)=>{for(let i=0;i<n;i++)tick(s);};

test('the taunt list: 42 numbered lines, each with Chinese and English text; the number comes first',()=>{
 assert.equal(taunts.length,42);assert.deepEqual(taunts.map(t=>t.n),Array.from({length:42},(_,i)=>i+1));
 for(const t of taunts){assert.ok(t.zh.trim()&&t.en.trim(),String(t.n));}
 assert.equal(tauntOf(11)?.zh,'（奸笑）');assert.equal(tauntOf(16)?.en,'Enemy sighted!');
 assert.equal(parseTaunt('11'),11);assert.equal(parseTaunt(' 11 哈哈'),11);assert.equal(parseTaunt('11哈'),11);
 assert.equal(parseTaunt('43'),null);assert.equal(parseTaunt('0'),null);assert.equal(parseTaunt('哈 11'),null);assert.equal(parseTaunt('111'),null);
});

test('taunt: validated, one a second per player, logged in the chat both sides see, and kept to the last 20',()=>{
 const s=createState(SEED,'open','idle');
 for(const bad of [0,43,1.5,'3',null])assert.throws(()=>order(s,'taunt',{number:bad}),/嘲諷編號是 1–42/);
 order(s,'taunt',{number:11});
 // A second one before the first even runs: refused (it would land within the same second).
 assert.throws(()=>order(s,'taunt',{number:3}),/嘲諷太頻繁/);
 tick(s);assert.deepEqual(s.chat,[{player:0,taunt:11,tick:1}]);
 run(s,tauntRules.everyTicks-2);assert.throws(()=>order(s,'taunt',{number:3}),/嘲諷太頻繁/);
 tick(s);order(s,'taunt',{number:3});tick(s);
 assert.deepEqual(s.chat.map(m=>[m.player,m.taunt]),[[0,11],[0,3]]);
 // Red (here a second human on the same sim) has its own limit.
 order(s,'taunt',{number:29},1);tick(s);assert.equal(s.chat.at(-1)!.player,1);
 for(let i=0;i<25;i++){run(s,tauntRules.everyTicks);order(s,'taunt',{number:1+(i%42)});}
 tick(s);assert.equal(s.chat.length,tauntRules.keep);
 // Taunts never touch the economy or the units.
 const fresh=createState(SEED,'open','idle');run(fresh,s.tick);
 assert.deepEqual(s.accounts.map(a=>a.stock),fresh.accounts.map(a=>a.stock));assert.equal(s.units.length,fresh.units.length);
});

test('taunts survive save, load and replay',()=>{
 const s=createState(SEED,'open','idle');order(s,'taunt',{number:14});run(s,30);order(s,'taunt',{number:42});run(s,10);
 const back=deserialize(serialize(s));assert.deepEqual(back.chat,s.chat);
 assert.equal(hash(replay(SEED,s.log,s.tick,'open','idle')),hash(s));
});

// Blue soldiers on free nodes near red's town centre (fixture shortcut: spawned, not trained).
function raid(s:State,count:number){
 const tc=s.buildings.find(b=>b.player===1&&b.kind==='town-center')!,closed=blockedTable(s.map),held=new Set(s.units.map(u=>u.node));
 const nodes=nodesNear(s.map,[tc.x-200,tc.y-200,tc.x+500,tc.y+500],0).filter(n=>!closed[n]&&!held.has(n)).slice(0,count);
 for(const n of nodes){const p=position(s.map,n),u=makeUnit(s.map,s.nextUnitId++,0,p.x,p.y,'militia');u.hp=maxHpOf('militia',ownerOf(s,0));s.units.push(u);s.accounts[0].populationUsed++;}
 s.units.sort((a,b)=>a.id-b.id);return tc;
}
const redTaunts=(s:State)=>s.chat.filter(m=>m.player===aiRules.player).map(m=>m.taunt);

test('the computer: 16 發現敵人 when blue soldiers reach its town centre; 12 我快招架不住了 when it is also below half health',()=>{
 const a=createState(SEED,'open','ai');raid(a,3);
 for(let i=0;i<200&&!redTaunts(a).length;i++)tick(a);
 assert.deepEqual(redTaunts(a),[16]);
 // Deterministic: the same start says the same line at the same tick.
 const twin=createState(SEED,'open','ai');raid(twin,3);run(twin,a.tick);assert.deepEqual(twin.chat,a.chat);
 // Quiet for tauntQuiet ticks after any line, and the same line not again within tauntGap.
 run(a,aiRules.tauntQuiet);assert.equal(redTaunts(a).filter(n=>n===16).length,1);
 const b=createState(SEED,'open','ai'),tc=raid(b,3);tc.hp=Math.floor(tc.maxHp*.4);
 for(let i=0;i<200&&!redTaunts(b).length;i++)tick(b);
 assert.deepEqual(redTaunts(b),[12]);
 // With no enemy in sight the computer stays quiet.
 const c=createState(SEED,'open','ai');run(c,600);assert.deepEqual(redTaunts(c),[]);
});
