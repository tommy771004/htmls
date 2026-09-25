import test from 'node:test';
import assert from 'node:assert/strict';
import {economicBuildings,economicBuildingParts} from '../apps/web/economic-building.ts';
test('economic models preserve bounded footprints, unique parts and additive construction',()=>{
 for(const kind of economicBuildings)for(const ageVariant of [1,2,3,4] as const){let previous=new Set<string>();for(const progress of [0,20,40,60,100]){
 const parts=economicBuildingParts(kind,{ageVariant,progress,health:100,red:false}),ids=new Set(parts.map(p=>p.id));assert.equal(ids.size,parts.length);assert.ok(parts.length>previous.size);
 for(const id of previous)assert.ok(ids.has(id));previous=ids;
 for(const p of parts){assert.ok([p.x,p.y,p.z,p.w,p.h,p.d].every(Number.isFinite));assert.ok(p.w>0&&p.h>0&&p.d>0);assert.ok(p.x>=-.15&&p.z>=-.15&&p.y>=0&&p.x+p.w<=2.85001&&p.z+p.d<=2.85001);}
 }}
});
test('functional silhouettes differ and visual damage restores without mutating input',()=>{
 const v={ageVariant:2 as const,progress:100,health:100,red:false};const signatures=new Set();
 for(const kind of economicBuildings){const full=economicBuildingParts(kind,v);signatures.add(JSON.stringify(full.map(({color,...p})=>p)));assert.ok(economicBuildingParts(kind,{...v,health:35}).length<full.length);const rubble=economicBuildingParts(kind,{...v,health:0});assert.equal(rubble.length,13);assert.ok(rubble.every(p=>p.y+p.h<=.28));assert.deepEqual(economicBuildingParts(kind,v),full);}
 assert.equal(signatures.size,economicBuildings.length);assert.throws(()=>economicBuildingParts('fake' as any,v));assert.throws(()=>economicBuildingParts('mill',{...v,progress:NaN}));
});
