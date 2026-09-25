import test from 'node:test';
import assert from 'node:assert/strict';
import {rules,validateRules} from '../packages/content/rules.ts';
import {createState,submit,tick,replay,hash,serialize,deserialize,rulesetHash,nextRandom} from '../packages/sim/sim.ts';
import type {Command,MoveCommand} from '../packages/sim/sim.ts';
const copy=()=>structuredClone(rules);
const command=(sequence=1,targetTick=1):MoveCommand=>({protocolVersion:1,rulesetHash,playerId:0,sequence,targetTick,commandType:'move',payload:{unitIds:[1],x:1150,y:900}});
test('design defaults accepted; unknown reference version rejected for exact verification',()=>{assert.deepEqual(validateRules(rules),[]);assert.match(validateRules(rules,true).join(),/版本/);});
test('duplicate IDs, dangling dependencies, negative costs and cyclic technology fail',()=>{
 let r=copy();r.entries.push({...r.entries[0]});assert.match(validateRules(r).join(),/重複 ID/);
 r=copy();r.entries[0].requires=['missing'];assert.match(validateRules(r).join(),/懸空/);
 r=copy();r.entries[0].cost.food=-1;assert.match(validateRules(r).join(),/成本/);
 r=copy();r.entries[0].requires=['age-2'];r.entries.find(e=>e.id==='age-2')!.requires=['villager'];assert.match(validateRules(r).join(),/循環/);
});
test('schema rejects malformed data and unavailable civilization items',()=>{for(const v of [null,[],{}, {entries:[null]}])assert.ok(validateRules(v).length);const r=copy();r.civilizations[0].unavailable=['villager'];assert.match(validateRules(r).join(),/禁用/);});
test('negative, fractional and non-finite settings fail',()=>{const r=copy();r.settings.seed=-1;r.settings.tickHz=0;r.entries[0].population=Infinity;assert.ok(validateRules(r).length>=3);assert.throws(()=>createState(-1));});
test('commands reject enemy control, duplicate, expired, invalid payload without mutations',()=>{
 const s=createState(3);for(const c of [{...command(),payload:{unitIds:[4],x:100,y:100}},{...command(),targetTick:0},{...command(),payload:{unitIds:[1],x:NaN,y:100}},{...command(),rulesetHash:'wrong'}]){const before=hash(s);assert.throws(()=>submit(s,c as Command));assert.equal(hash(s),before);}
 submit(s,command());const before=hash(s);assert.throws(()=>submit(s,command()));assert.equal(hash(s),before);tick(s);assert.equal(s.units[0].navigation,'searching');assert.ok(s.pathJobs.length>0);
});
test('10000 ticks replay, frame batching, and save/load continuation remain identical',()=>{
 const s=createState(260925);submit(s,command());for(let i=0;i<100;i++)tick(s);submit(s,{...command(2,101),payload:{unitIds:[2],x:700,y:400}});
 const restored=deserialize(serialize(s));for(let i=0;i<9900;i++)tick(s);for(let frame=0;frame<990;frame++)for(let j=0;j<10;j++)tick(restored);
 assert.equal(hash(s),hash(restored));assert.equal(hash(s),hash(replay(s.seed,s.log,s.tick)));assert.equal(s.units[0].x,1150);assert.equal(s.units[1].y,400);
});
test('pending commands survive snapshot and replay; corrupted snapshots fail',()=>{const s=createState(0);submit(s,command(1,100));assert.deepEqual(deserialize(serialize(s)),s);assert.throws(()=>deserialize('bad'));const v=JSON.parse(serialize(s));v.state.units[0].x=999;assert.throws(()=>deserialize(JSON.stringify(v)));v.checksum=hash(v.state);assert.throws(()=>deserialize(JSON.stringify(v)));});
test('canonical hash ignores object key order and PRNG is stable',()=>{assert.equal(hash({a:1,b:2}),hash({b:2,a:1}));const a=createState(42),b=createState(42);for(let i=0;i<50;i++)assert.equal(nextRandom(a),nextRandom(b));});

test('snapshots beyond supported restore limits cannot overwrite a valid save',()=>{const s=createState(1);s.tick=100001;assert.throws(()=>serialize(s),/存檔容量/);});
