import test from 'node:test';
import assert from 'node:assert/strict';
import {buildingParts,regionalParts,architectures,type BuildingPart,type BuildingVisual} from '../apps/web/building-parts.ts';
import {economicBuildings,economicBuildingParts} from '../apps/web/economic-building.ts';
import {militaryBuildings,militaryBuildingParts} from '../apps/web/military-building.ts';
import {monasteryParts} from '../apps/web/monastery-building.ts';
import {blacksmithParts} from '../apps/web/blacksmith-building.ts';
import {towerParts,siegeWorkshopParts} from '../apps/web/defense-building.ts';
import {castleParts} from '../apps/web/castle-building.ts';
import {buildingStuds} from '../apps/web/building-studs.ts';
// Face contact or overlap on two axes; a shared edge or corner does not hold a part.
const holds=(a:BuildingPart,b:BuildingPart)=>{const o=[Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y),Math.min(a.z+a.d,b.z+b.d)-Math.max(a.z,b.z)];return o.every(v=>v>-1e-8)&&o.filter(v=>v>1e-8).length>=2;};
function unattached(parts:BuildingPart[]){const reached=new Set([parts[0]]),queue=[parts[0]];while(queue.length){const a=queue.pop()!;for(const b of parts)if(!reached.has(b)&&holds(a,b)){reached.add(b);queue.push(b);}}return parts.filter(p=>!reached.has(p)).map(p=>p.id);}
type Model=[string,(v:BuildingVisual)=>BuildingPart[]];
const models:Model[]=[['house',buildingParts],...economicBuildings.map(k=>[k,(v:BuildingVisual)=>economicBuildingParts(k,v)] as Model),...militaryBuildings.map(k=>[k,(v:BuildingVisual)=>militaryBuildingParts(k,v)] as Model),
 ['monastery',monasteryParts],['blacksmith',blacksmithParts],['watch-tower',towerParts],['siege-workshop',siegeWorkshopParts],['castle',castleParts]];
test('every visible building part connects to its foundation in all construction and damage states',()=>{
 for(const [kind,generate] of models)for(const ageVariant of [1,2,3,4] as const)for(const progress of [0,20,40,60,80,100])for(const health of [35,100]){
  const parts=generate({ageVariant,progress,health,red:false});
  assert.equal(parts[0].id,'foundation');
  assert.deepEqual(unattached(parts),[],`${kind} age ${ageVariant} progress ${progress} health ${health}`);
 }
});
test('the castle fills its 4x4 footprint, builds additively, changes structure by age and restores from damage',()=>{
 const idsByAge:string[]=[];
 for(const ageVariant of [1,2,3,4] as const){let previous=new Set<string>();
  for(const progress of [0,20,40,60,100]){const p=castleParts({ageVariant,progress,health:100,red:false}),ids=new Set(p.map(a=>a.id));
   assert.equal(ids.size,p.length);assert.ok(p.length>previous.size,`stage ${progress} adds parts`);for(const id of previous)assert.ok(ids.has(id));previous=ids;
   assert.ok(p.every(a=>[a.x,a.y,a.z,a.w,a.d,a.h].every(Number.isFinite)&&a.w>0&&a.h>0&&a.d>0&&a.x>=-.15001&&a.z>=-.15001&&a.y>=0&&a.x+a.w<=3.85001&&a.z+a.d<=3.85001));}
  const v={ageVariant,progress:100,health:100,red:false},full=castleParts(v);
  assert.deepEqual([full[0].x,full[0].z,full[0].w,full[0].d],[-.15,-.15,4,4]);
  assert.ok(castleParts({...v,health:35}).length<full.length);const rubble=castleParts({...v,health:0});assert.equal(rubble.length,13);assert.ok(rubble.every(p=>p.y+p.h<=.28));
  assert.deepEqual(castleParts(v),full);assert.deepEqual(buildingStuds(castleParts(v)),buildingStuds(full));idsByAge.push(full.map(p=>p.id).sort().join('|'));
  assert.ok(full.some(p=>p.color==='#456e87')&&castleParts({...v,red:true}).some(p=>p.color==='#b85c47'),'team colour shows');
 }
 assert.equal(new Set(idsByAge).size,4,'each age changes the structure');
 assert.throws(()=>castleParts({ageVariant:5 as never,progress:100,health:100,red:false}));assert.throws(()=>castleParts({ageVariant:3,progress:NaN,health:100,red:false}));
});
test('regional styles add supported, bounded, unique silhouette parts to every building; neutral and rubble stay unchanged',()=>{
 const shown=new Map<string,number>();
 for(const [kind,generate] of models)for(const ageVariant of [1,2,3,4] as const)for(const progress of [0,20,40,60,100])for(const health of [0,35,100]){
  const plain=generate({ageVariant,progress,health,red:false}),f=plain[0];
  assert.equal(regionalParts(plain,'neutral'),plain);
  for(const style of architectures){const parts=regionalParts(plain,style),what=`${kind} ${style} age ${ageVariant} progress ${progress} health ${health}`;
   assert.deepEqual(parts.slice(0,plain.length),plain,what);assert.equal(new Set(parts.map(p=>p.id)).size,parts.length,what);
   const added=parts.slice(plain.length);assert.ok(added.every(p=>p.id.startsWith(`style-${style}-`)&&!p.studs),what);
   assert.ok(added.every(p=>p.x>=f.x-1e-8&&p.z>=f.z-1e-8&&p.x+p.w<=f.x+f.w+1e-8&&p.z+p.d<=f.z+f.d+1e-8&&p.w>0&&p.h>0&&p.d>0),what+' in bounds');
   assert.deepEqual(unattached(parts),[],what);
   if(health===0||progress<40)assert.equal(added.length,0,what+' adds nothing before the roof or to rubble');
   if(health===100&&progress===100&&added.length&&kind!=='farm')shown.set(style,(shown.get(style)??0)+1);
   // Added pieces never cut into the building (face contact only).
   for(const a of added)for(const b of parts)if(a!==b)assert.ok(!(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1e-8&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1e-8&&Math.min(a.z+a.d,b.z+b.d)-Math.max(a.z,b.z)>1e-8),`${what}: ${a.id} cuts ${b.id}`);
  }
 }
 // Every finished building in every age shows each regional style, except the roofless ones: the farm (drawn as a field
 // plot in the match) and the first-age archery range (an open yard with nothing to crown).
 for(const style of architectures.filter(s=>s!=='neutral'))assert.equal(shown.get(style),(models.length-1)*4-1,style);
 assert.throws(()=>regionalParts(buildingParts({ageVariant:2,progress:100,health:100,red:false}),'unknown' as never));
});
