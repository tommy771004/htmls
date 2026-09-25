import test from 'node:test';
import assert from 'node:assert/strict';
import {militaryBuildings,militaryBuildingParts} from '../apps/web/military-building.ts';
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

test('military buildings have bounded geometry and additive stages with reversible damage',()=>{
 const signatures=new Set();for(const kind of militaryBuildings)for(const ageVariant of [1,2,3,4] as const){let previous=new Set();for(const progress of [0,20,40,60,100]){const p=militaryBuildingParts(kind,{ageVariant,progress,health:100,red:false});const ids=new Set(p.map(a=>a.id));assert.equal(ids.size,p.length);assert.ok(p.length>previous.size);for(const id of previous)assert.ok(ids.has(id as string));previous=ids;assert.ok(p.every(a=>[a.x,a.y,a.z,a.w,a.d,a.h].every(Number.isFinite)&&a.w>0&&a.h>0&&a.d>0&&a.x>=-.15&&a.z>=-.15&&a.y>=0&&a.x+a.w<=2.85001&&a.z+a.d<=2.85001));}
 const v={ageVariant,progress:100,health:100,red:false},full=militaryBuildingParts(kind,v);assert.ok(militaryBuildingParts(kind,{...v,health:35}).length<full.length);assert.equal(militaryBuildingParts(kind,{...v,health:0}).length,13);assert.deepEqual(militaryBuildingParts(kind,v),full);if(ageVariant===2)signatures.add(JSON.stringify(full));}assert.equal(signatures.size,3);
});


test('military ages change structure and upper additions retain physical support',()=>{
 for(const kind of militaryBuildings){
  const idsByAge=[];
  for(const ageVariant of [1,2,3,4] as const){
   const full=militaryBuildingParts(kind,{ageVariant,progress:100,health:100,red:false});
   idsByAge.push(full.map(p=>p.id).sort().join('|'));
   for(const progress of [0,20,40,60,100])for(const health of [35,100]){
    const parts=militaryBuildingParts(kind,{ageVariant,progress,health,red:false});
    for(const part of parts.filter(p=>/^(vent-|turret-|ridge-cap|canopy-|backstop-crenel)/.test(p.id))){
     // A load-bearing contact below each added roof/post survives damage and construction.
     assert.ok(parts.some(b=>b!==part&&Math.abs(b.y+b.h-part.y)<1e-8&&b.x<part.x+part.w&&b.x+b.w>part.x&&b.z<part.z+part.d&&b.z+b.d>part.z),kind+' '+ageVariant+' '+progress+' '+health+' unsupported '+part.id);
    }
   }
  }
  assert.equal(new Set(idsByAge).size,4,kind+' must have structural age differences independent of color/height');
 }
});

test('economic ages change structure, not only height or color',()=>{
 for(const kind of economicBuildings){
  const byAge=([1,2,3,4] as const).map(ageVariant=>economicBuildingParts(kind,{ageVariant,progress:100,health:100,red:false}).map(p=>p.id).sort().join('|'));
  assert.equal(new Set(byAge).size,4,kind+' needs distinct part sets per age');
 }
});
