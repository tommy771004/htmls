import test from 'node:test';
import assert from 'node:assert/strict';
import {buildingParts} from '../apps/web/building-parts.ts';
test('construction stages add real opaque parts monotonically for every age',()=>{
 for(const ageVariant of [1,2,3,4] as const){let previous=new Set<string>();for(const progress of [0,20,40,60,100]){const parts=buildingParts({ageVariant,progress,health:100,red:false}),ids=new Set(parts.map(p=>p.id));assert.equal(ids.size,parts.length);for(const id of previous)assert.ok(ids.has(id));assert.ok(parts.length>previous.size);assert.ok(parts.every(p=>[p.x,p.y,p.z,p.w,p.d,p.h].every(Number.isFinite)&&p.w>0&&p.h>0&&p.d>0));previous=ids;}}
});
test('ages change geometry rather than only color and retain a consistent foundation',()=>{
 const models=([1,2,3,4] as const).map(ageVariant=>buildingParts({ageVariant,progress:100,health:100,red:false}));for(let i=1;i<models.length;i++){assert.deepEqual(models[i][0],models[0][0]);assert.notDeepEqual(models[i].map(({color,...p})=>p),models[i-1].map(({color,...p})=>p));}
});
test('damage and rubble are bounded; restoring health reconstructs exactly',()=>{
 const visual={ageVariant:4 as const,progress:100,health:100,red:false},full=buildingParts(visual);visual.health=35;const damaged=buildingParts(visual);assert.ok(damaged.length<full.length);assert.ok(damaged.some(p=>p.id==='foundation'));visual.health=0;const rubble=buildingParts(visual);assert.equal(rubble.length,13);assert.ok(rubble.every(p=>p.y+p.h<=.28));visual.health=100;assert.deepEqual(buildingParts(visual),full);
});
test('invalid inspector state rejects before producing model parts',()=>{for(const value of [-1,101,NaN,Infinity])assert.throws(()=>buildingParts({ageVariant:2,progress:value,health:100,red:false}));});
