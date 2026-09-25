import test from 'node:test';
import assert from 'node:assert/strict';
import {buildingStuds} from '../apps/web/building-studs.ts';
import {buildingParts,type BuildingPart} from '../apps/web/building-parts.ts';
import {militaryBuildings,militaryBuildingParts} from '../apps/web/military-building.ts';
import {economicBuildings,economicBuildingParts} from '../apps/web/economic-building.ts';
const base:BuildingPart={id:'base',phase:0,x:0,y:0,z:0,w:1,d:.5,h:.16,color:'#fff',studs:true};
test('studs stay on their brick and disappear on partial or full upper-piece overlap',()=>{
 const exposed=buildingStuds([base]);assert.equal(exposed.length,2);
 const cap={...base,id:'cap',x:.36,y:.16,w:.2,studs:false};
 assert.equal(buildingStuds([base,cap]).length,1,'edge of stud intersects cap even when its center does not');
 assert.equal(buildingStuds([base,{...base,id:'cap',y:.16,studs:false}]).length,0);
 assert.deepEqual(buildingStuds([base,{...cap,y:.25}]),exposed,'air gap does not cover stud');
 assert.deepEqual(buildingStuds([base,{...cap,y:-.16}]),exposed,'part below is irrelevant');
 assert.equal(buildingStuds([{...base,w:.3}]).length,0,'narrow plate cannot hold a complete stud');
 assert.deepEqual(buildingStuds([base]),exposed,'removing cap restores visible studs');
});
test('all building states restore exposed studs deterministically without modifying parts',()=>{
 const generators=[buildingParts,...economicBuildings.map(kind=>(v:Parameters<typeof buildingParts>[0])=>economicBuildingParts(kind,v)),...militaryBuildings.map(kind=>(v:Parameters<typeof buildingParts>[0])=>militaryBuildingParts(kind,v))];
 for(const generate of generators)for(const ageVariant of [1,2,3,4] as const){
  const full=generate({ageVariant,progress:100,health:100,red:false}),before=JSON.stringify(full),expected=buildingStuds(full);
  for(const progress of [0,20,40,60,100])for(const health of [0,35,100]){
   const parts=generate({ageVariant,progress,health,red:false});const studs=buildingStuds(parts);
   assert.ok(studs.every(s=>[s.x,s.y,s.z].every(Number.isFinite)));
   if(health===0)assert.equal(studs.length,0);
  }
  assert.equal(JSON.stringify(full),before);assert.deepEqual(buildingStuds(generate({ageVariant,progress:100,health:100,red:false})),expected);
 }
});
