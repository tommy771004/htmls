import test from 'node:test';
import assert from 'node:assert/strict';
import {buildingParts,type BuildingPart,type BuildingVisual} from '../apps/web/building-parts.ts';
import {economicBuildings,economicBuildingParts} from '../apps/web/economic-building.ts';
import {militaryBuildings,militaryBuildingParts} from '../apps/web/military-building.ts';
// Face contact or overlap on two axes; a shared edge or corner does not hold a part.
const holds=(a:BuildingPart,b:BuildingPart)=>{const o=[Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y),Math.min(a.z+a.d,b.z+b.d)-Math.max(a.z,b.z)];return o.every(v=>v>-1e-8)&&o.filter(v=>v>1e-8).length>=2;};
function unattached(parts:BuildingPart[]){const reached=new Set([parts[0]]),queue=[parts[0]];while(queue.length){const a=queue.pop()!;for(const b of parts)if(!reached.has(b)&&holds(a,b)){reached.add(b);queue.push(b);}}return parts.filter(p=>!reached.has(p)).map(p=>p.id);}
test('every visible building part connects to its foundation in all construction and damage states',()=>{
 const models:[string,(v:BuildingVisual)=>BuildingPart[]][]=[['house',buildingParts],...economicBuildings.map(k=>[k,(v:BuildingVisual)=>economicBuildingParts(k,v)] as [string,(v:BuildingVisual)=>BuildingPart[]]),...militaryBuildings.map(k=>[k,(v:BuildingVisual)=>militaryBuildingParts(k,v)] as [string,(v:BuildingVisual)=>BuildingPart[]])];
 for(const [kind,generate] of models)for(const ageVariant of [1,2,3,4] as const)for(const progress of [0,20,40,60,80,100])for(const health of [35,100]){
  const parts=generate({ageVariant,progress,health,red:false});
  assert.equal(parts[0].id,'foundation');
  assert.deepEqual(unattached(parts),[],`${kind} age ${ageVariant} progress ${progress} health ${health}`);
 }
});
