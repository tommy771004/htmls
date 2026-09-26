import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,hash,serialize,deserialize,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {authoritativeProblem,farmResourceId,buildingRules} from '../packages/sim/buildings.ts';
import {clearSegment} from '../packages/sim/navigation.ts';
import {terrainRules} from '../packages/sim/terrain.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
function order(s:State,commandType:string,payload:any,playerId=0){submit(s,{protocolVersion:1,rulesetHash,playerId,sequence:s.sequence[playerId]+1,targetTick:s.tick+1,commandType,payload} as any);}
// Sites come from what blue has actually explored, so replay can rebuild the same state.
function farm(s:State){
 for(let y=600;y<=1200;y+=50)for(let x=100;x<=800;x+=50)if(!authoritativeProblem(s,0,'farm',x,y)){order(s,'build',{unitIds:[1,2],kind:'farm',x,y});tick(s);return s.buildings.find(b=>b.kind==='farm')!;}
 throw Error('no farm site');}
const run=(s:State,until:()=>boolean,limit=4000)=>{for(let i=0;i<limit&&!until();i++)tick(s);};

test('a farm costs wood, is built like any building, and becomes an owner-only food source',()=>{
 const s=createState(260925),wood=s.accounts[0].stock.wood,b=farm(s);
 assert.equal(s.accounts[0].stock.wood,wood-60);assert.equal(s.map.resources.some(r=>r.id===farmResourceId(b.id)),false,'no food before completion');
 run(s,()=>b.complete);assert.ok(b.complete);
 const field=s.map.resources.find(r=>r.id===farmResourceId(b.id))!;assert.equal(field.kind,'farm');assert.equal(field.remaining,terrainRules.resourceCapacity.farm);
 // Red may not work a blue field, even when it knows about it.
 s.vision[1].explored=Array.from({length:256},(_,i)=>i);
 assert.throws(()=>order(s,'gather',{unitIds:[4],resourceId:field.id},1),/只能耕作己方的農田/);
 order(s,'gather',{unitIds:[1],resourceId:field.id});run(s,()=>s.accounts[0].ledger.deposited.food>0,3000);
 assert.ok(s.accounts[0].ledger.deposited.food>0,'food from the farm reaches the stock');
});

test('a farm is walkable, blocks other buildings, and snaps to the 10-unit grid',()=>{
 const s=createState(260925),b=farm(s),box=obstacleBounds(s.map.obstacles.find(o=>o.id===b.id)!);
 const mid={x:Math.round((box[0]+box[2])/2/50)*50,y:Math.round((box[1]+box[3])/2/50)*50};
 assert.equal(clearSegment(s.map,mid,mid),true,'units may stand on a farm');
 assert.equal(authoritativeProblem(s,0,'house',box[0],box[1]),'與建築或資源重疊');
 assert.equal(buildingRules.grid,10);assert.match(authoritativeProblem(s,0,'house',box[0]+5,1000)??'',/10 單位格線/);
});

test('a worked-out farm leaves the map with its building; save/load keeps the field',()=>{
 const s=createState(260925),b=farm(s);run(s,()=>b.complete);
 const field=s.map.resources.find(r=>r.id===farmResourceId(b.id))!;
 const copy=deserialize(serialize(s));assert.equal(hash(copy),hash(s));
 order(s,'gather',{unitIds:[1,2],resourceId:field.id});field.remaining=3;
 run(s,()=>field.status==='depleted',2000);
 assert.equal(field.status,'depleted');assert.equal(s.buildings.some(v=>v.id===b.id),false);assert.equal(s.map.obstacles.some(o=>o.id===b.id),false);
});
