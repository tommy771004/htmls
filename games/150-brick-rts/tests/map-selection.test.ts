import test from 'node:test';
import assert from 'node:assert/strict';
import {createService,decodeView} from '../packages/sim/protocol.ts';
import {createState,submit,tick,serialize,deserialize,hash,replay,rulesetHash} from '../packages/sim/sim.ts';
test('each map selection round-trips through snapshots and replay',()=>{
 for(const layout of ['meadow','coast','acceptance'] as const){const state=createState(7,layout);submit(state,{protocolVersion:1,rulesetHash,playerId:0,sequence:1,targetTick:1,commandType:'move',payload:{unitId:1,x:600,y:800}});for(let i=0;i<200;i++)tick(state);assert.equal(deserialize(serialize(state)).layout,layout);assert.equal(hash(replay(7,state.log,state.tick,layout)),hash(state));}
});
test('Worker recovery retains selected map and terrain projection excludes hidden entity refs',()=>{
 const service=createService();const start=service({protocol:1,id:1,operation:{kind:'reset',seed:7,layout:'acceptance'}});assert.ok(start.ok);const view=decodeView(start);assert.equal(view.layout,'acceptance');assert.equal(view.terrain[13*16+4].height,100);assert.ok(view.terrain.every(t=>!('resourceRefs' in t)&&!('obstacleRefs' in t)));
 const recovered=createService()({protocol:1,id:1,operation:{kind:'recover',checkpoint:{seed:7,layout:'acceptance',commands:[],ticks:0}}});assert.ok(recovered.ok);assert.equal(recovered.stateHash,start.stateHash);assert.equal(recovered.layout,'acceptance');
});
test('invalid map selection cannot replace the active Worker world',()=>{
 const service=createService(),start=service({protocol:1,id:1,operation:{kind:'reset',seed:7,layout:'coast'}});assert.ok(start.ok);const bad=service({protocol:1,id:2,operation:{kind:'reset',seed:7,layout:'invented'}});assert.equal(bad.ok,false);const after=service({protocol:1,id:3,operation:{kind:'snapshot'}});assert.ok(after.ok);assert.equal(after.stateHash,start.stateHash);
});
