import test from 'node:test';
import assert from 'node:assert/strict';
import {monasteryParts} from '../apps/web/monastery-building.ts';
import {buildingStuds} from '../apps/web/building-studs.ts';
import type {BuildingPart} from '../apps/web/building-parts.ts';
// Same rules as the other buildings (building-support, economic-building, building-studs tests).
const holds=(a:BuildingPart,b:BuildingPart)=>{const o=[Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y),Math.min(a.z+a.d,b.z+b.d)-Math.max(a.z,b.z)];return o.every(v=>v>-1e-8)&&o.filter(v=>v>1e-8).length>=2;};
function unattached(parts:BuildingPart[]){const reached=new Set([parts[0]]),queue=[parts[0]];while(queue.length){const a=queue.pop()!;for(const b of parts)if(!reached.has(b)&&holds(a,b)){reached.add(b);queue.push(b);}}return parts.filter(p=>!reached.has(p)).map(p=>p.id);}
test('the monastery is bounded, built in additive stages, damage is reversible and every part is supported',()=>{
 const idsByAge:string[]=[];
 for(const ageVariant of [1,2,3,4] as const){let previous=new Set<string>();
  for(const progress of [0,20,40,60,100]){const p=monasteryParts({ageVariant,progress,health:100,red:false}),ids=new Set(p.map(a=>a.id));
   assert.equal(ids.size,p.length);assert.ok(p.length>previous.size,`stage ${progress} adds parts`);for(const id of previous)assert.ok(ids.has(id));previous=ids;
   assert.ok(p.every(a=>[a.x,a.y,a.z,a.w,a.d,a.h].every(Number.isFinite)&&a.w>0&&a.h>0&&a.d>0&&a.x>=-.15&&a.z>=-.15&&a.y>=0&&a.x+a.w<=2.85001&&a.z+a.d<=2.85001));}
  for(const progress of [0,20,40,60,80,100])for(const health of [35,100]){const parts=monasteryParts({ageVariant,progress,health,red:false});assert.equal(parts[0].id,'foundation');assert.deepEqual(unattached(parts),[],`age ${ageVariant} progress ${progress} health ${health}`);}
  const v={ageVariant,progress:100,health:100,red:false},full=monasteryParts(v);
  assert.ok(monasteryParts({...v,health:35}).length<full.length);assert.equal(monasteryParts({...v,health:0}).length,13);assert.deepEqual(monasteryParts(v),full);
  assert.deepEqual(buildingStuds(monasteryParts(v)),buildingStuds(full));idsByAge.push(full.map(p=>p.id).sort().join('|'));
 }
 assert.equal(new Set(idsByAge).size,4,'each age changes the structure');
 assert.throws(()=>monasteryParts({ageVariant:5 as never,progress:100,health:100,red:false}));
});
