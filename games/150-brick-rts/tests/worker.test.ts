import test from 'node:test';
import assert from 'node:assert/strict';
import {createService,decodeView,UNIT_STRIDE} from '../packages/sim/protocol.ts';
import type {Operation,Response} from '../packages/sim/protocol.ts';
function harness(){const service=createService();let id=0;return {raw:service,call:(operation:Operation)=>{const r=service({protocol:1,id:++id,operation});assert.equal(r.ok,true,JSON.stringify(r));return r as Extract<Response,{ok:true}>;}};}
test('service sends transferable projection, commits movement and preserves snapshots',()=>{
 const h=harness();h.call({kind:'reset',seed:42});const moved=h.call({kind:"move",unitIds:[1],x:900,y:700});assert.equal(moved.accepted?.sequence,1);
 const result=h.call({kind:'advance',count:20});assert.ok(['searching','moving','waiting'].includes(decodeView(result).units[0].navigation));
 const transferred=structuredClone(result,{transfer:[result.positions]});assert.equal(result.positions.byteLength,0);assert.equal(decodeView(transferred).units.length,3);
 const saved=h.call({kind:'snapshot'});h.call({kind:'advance',count:20});assert.equal(h.call({kind:'restore',snapshot:saved.snapshot!}).stateHash,saved.stateHash);
 assert.equal(h.call({kind:'replay'}).replayMatches,true);
});
test('duplicate IDs, malformed operations and enemy control are rejected atomically with context',()=>{
 const service=createService();const baseline=service({protocol:1,id:1,operation:{kind:'snapshot'}});assert.ok(baseline.ok);
 for(const raw of [{protocol:1,id:1,operation:{kind:'advance',count:1}},{protocol:1,id:2,operation:{kind:'advance',count:NaN}},{protocol:1,id:3,operation:{kind:"move",unitIds:[4],x:900,y:700}},{protocol:1,id:4,operation:{kind:'restore',snapshot:'broken'}},null]){const r=service(raw);assert.equal(r.ok,false);assert.equal(r.tick,0);}
 const after=service({protocol:1,id:5,operation:{kind:'snapshot'}});assert.ok(after.ok);assert.equal(after.stateHash,baseline.stateHash);
});
test('a replacement worker recovers precisely the acknowledged command/tick history',()=>{
 const a=harness();a.call({kind:'reset',seed:7});const move=a.call({kind:"move",unitIds:[2],x:1100,y:900});const step=a.call({kind:'advance',count:12});
 const b=harness();const recovered=b.call({kind:'recover',checkpoint:{seed:7,commands:[move.accepted!],ticks:12}});assert.equal(recovered.stateHash,step.stateHash);
 assert.equal(b.call({kind:'advance',count:20}).stateHash,a.call({kind:'advance',count:20}).stateHash);
});

test('raw position buffers use the stride that tests/browser.mjs hard-codes',()=>{
 assert.equal(UNIT_STRIDE,15,'update tests/browser.mjs fogUnits when the projection changes');
 const h=harness();const r=h.call({kind:'reset',seed:7});assert.equal(new Int32Array(r.positions).length,UNIT_STRIDE*decodeView(r).units.length);
});
test('one advance request covers up to one second at 4x (80 ticks) and no more',()=>{
 const h=harness();assert.equal(decodeView(h.call({kind:'advance',count:80})).tick,80);assert.throws(()=>h.call({kind:'advance',count:81}),/1–80/);
});
