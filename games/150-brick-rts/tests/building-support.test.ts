import test from 'node:test';
import assert from 'node:assert/strict';
import {buildingParts,regionalParts,architectures,type BuildingPart,type BuildingVisual} from '../apps/web/building-parts.ts';
import {economicBuildings,economicBuildingParts} from '../apps/web/economic-building.ts';
import {militaryBuildings,militaryBuildingParts} from '../apps/web/military-building.ts';
import {monasteryParts} from '../apps/web/monastery-building.ts';
import {blacksmithParts} from '../apps/web/blacksmith-building.ts';
import {towerParts,siegeWorkshopParts,towerGrades,towerGradeOf} from '../apps/web/defense-building.ts';
import {universityParts} from '../apps/web/university-building.ts';
import {castleParts} from '../apps/web/castle-building.ts';
import {buildingStuds} from '../apps/web/building-studs.ts';
// Face contact or overlap on two axes; a shared edge or corner does not hold a part.
const holds=(a:BuildingPart,b:BuildingPart)=>{const o=[Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y),Math.min(a.z+a.d,b.z+b.d)-Math.max(a.z,b.z)];return o.every(v=>v>-1e-8)&&o.filter(v=>v>1e-8).length>=2;};
function unattached(parts:BuildingPart[]){const reached=new Set([parts[0]]),queue=[parts[0]];while(queue.length){const a=queue.pop()!;for(const b of parts)if(!reached.has(b)&&holds(a,b)){reached.add(b);queue.push(b);}}return parts.filter(p=>!reached.has(p)).map(p=>p.id);}
type Model=[string,(v:BuildingVisual)=>BuildingPart[]];
const models:Model[]=[['house',buildingParts],...economicBuildings.map(k=>[k,(v:BuildingVisual)=>economicBuildingParts(k,v)] as Model),...militaryBuildings.map(k=>[k,(v:BuildingVisual)=>militaryBuildingParts(k,v)] as Model),
 ['monastery',monasteryParts],['blacksmith',blacksmithParts],['watch-tower',towerParts],['siege-workshop',siegeWorkshopParts],['castle',castleParts],['university',universityParts],
 ...towerGrades.map(g=>[`watch-tower-${g}`,(v:BuildingVisual)=>towerParts(v,g)] as Model)];
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
test('the university fills its 3x3 footprint, builds additively, changes structure by age and restores from damage',()=>{
 const idsByAge:string[]=[];
 for(const ageVariant of [1,2,3,4] as const){let previous=new Set<string>();
  for(const progress of [0,20,40,60,100]){const p=universityParts({ageVariant,progress,health:100,red:false}),ids=new Set(p.map(a=>a.id));
   assert.equal(ids.size,p.length);assert.ok(p.length>previous.size,`stage ${progress} adds parts`);for(const id of previous)assert.ok(ids.has(id));previous=ids;
   assert.ok(p.every(a=>[a.x,a.y,a.z,a.w,a.d,a.h].every(Number.isFinite)&&a.w>0&&a.h>0&&a.d>0&&a.x>=-.15001&&a.z>=-.15001&&a.y>=0&&a.x+a.w<=2.85001&&a.z+a.d<=2.85001));}
  const v={ageVariant,progress:100,health:100,red:false},full=universityParts(v);
  assert.deepEqual([full[0].x,full[0].z,full[0].w,full[0].d],[-.15,-.15,3,3]);
  // Recognisable pieces: the porch lectern with its book, the observatory tower and the treadwheel crane.
  for(const id of ['book','tower','wheel-a-top','wheel-b-top','porch-beam'])assert.ok(full.some(p=>p.id===id),`age ${ageVariant} ${id}`);
  if(ageVariant>=3)for(const id of ['observatory','telescope','crane-jib','crane-load'])assert.ok(full.some(p=>p.id===id),`age ${ageVariant} ${id}`);
  const damaged=universityParts({...v,health:35});assert.ok(damaged.length<full.length);assert.ok(!damaged.some(p=>p.id==='flag'));
  const rubble=universityParts({...v,health:0});assert.equal(rubble.length,13);assert.ok(rubble.every(p=>p.y+p.h<=.28));
  assert.deepEqual(universityParts(v),full);assert.deepEqual(buildingStuds(universityParts(v)),buildingStuds(full));idsByAge.push(full.map(p=>p.id).sort().join('|'));
  assert.ok(full.some(p=>p.color==='#456e87')&&universityParts({...v,red:true}).some(p=>p.color==='#b85c47'),'team colour shows');
  // No two parts cut into each other (face contact only), so nothing hides inside another brick.
  for(let i=0;i<full.length;i++)for(let j=i+1;j<full.length;j++){const a=full[i],b=full[j];if(a.id==='foundation')continue;
   assert.ok(!(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1e-8&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1e-8&&Math.min(a.z+a.d,b.z+b.d)-Math.max(a.z,b.z)>1e-8),`age ${ageVariant}: ${a.id} cuts ${b.id}`);}
 }
 assert.equal(new Set(idsByAge).size,4,'each age changes the structure');
 assert.throws(()=>universityParts({ageVariant:5 as never,progress:100,health:100,red:false}));assert.throws(()=>universityParts({ageVariant:3,progress:NaN,health:100,red:false}));
});
test('own watch towers show the University tower upgrades: guard tower taller in stone, keep taller still with corbels and a spire',()=>{
 assert.equal(towerGradeOf([]),null);assert.equal(towerGradeOf(['guard-tower']),'guard-tower');assert.equal(towerGradeOf(['guard-tower','keep']),'keep');
 for(const ageVariant of [1,2,3,4] as const){const v={ageVariant,progress:100,health:100,red:false},top=(p:ReturnType<typeof towerParts>)=>Math.max(...p.map(a=>a.y+a.h));
  const plain=towerParts(v),guard=towerParts(v,'guard-tower'),keep=towerParts(v,'keep');
  assert.deepEqual(towerParts(v,null),plain);assert.ok(top(plain)<top(guard)&&top(guard)<top(keep),`age ${ageVariant} heights`);
  assert.ok(guard.some(p=>p.id.startsWith('guard-tower-merlon-'))&&keep.some(p=>p.id.startsWith('keep-corbel-'))&&keep.some(p=>p.id==='roof-spire'));
  assert.equal(towerParts({...v,health:0},'keep').length,7);assert.ok(towerParts({...v,health:35},'keep').every(p=>p.id!=='roof-spire'&&p.id!=='flag'));
  for(const p of [plain,guard,keep])assert.ok(p.every(a=>a.x>=-.05-1e-8&&a.z>=-.05-1e-8&&a.x+a.w<=1.05+1e-8&&a.z+a.d<=1.05+1e-8||a.id==='roof'||a.id.startsWith('style-')));}
 assert.throws(()=>towerParts({ageVariant:2,progress:100,health:100,red:false},'bombard-tower' as never));
});
import {wallParts,gateParts,outpostParts,bombardTowerParts,wallKinds,gateKinds,noLinks} from '../apps/web/fortification-building.ts';
import type {WallLinks} from '../apps/web/fortification-building.ts';
import {dockParts,fishTrapParts,turnParts} from '../apps/web/harbor-building.ts';
import {wonderParts,wonderStyles} from '../apps/web/wonder-building.ts';
// The 建築 round's buildings: each fills its own footprint (one tile, the 2x2 fish trap, the 3x3 dock, the 5x5 wonder),
// builds additively, connects every part to its foundation, loses ornaments when damaged, and restores exactly.
const run:WallLinks={...noLinks,e:true,w:true},corner:WallLinks={...noLinks,n:true,e:true,sw:true},all:WallLinks={n:true,s:true,e:true,w:true,ne:true,nw:true,se:true,sw:true};
const newModels:[string,number,(v:BuildingVisual)=>BuildingPart[]][]=[
 ...wallKinds.flatMap(k=>[noLinks,run,corner,all].map((l,i)=>[`${k}-${i}`,1,(v:BuildingVisual)=>wallParts(k,v,l)] as [string,number,(v:BuildingVisual)=>BuildingPart[]])),
 ...gateKinds.flatMap(k=>[run,{...noLinks,n:true,s:true}].map((l,i)=>[`${k}-${i}`,1,(v:BuildingVisual)=>gateParts(k,v,l)] as [string,number,(v:BuildingVisual)=>BuildingPart[]])),
 ['outpost',1,outpostParts],['bombard-tower',1,bombardTowerParts],['fish-trap',2,fishTrapParts],
 ...[0,1,2,3].map(q=>[`dock-${q}`,3,(v:BuildingVisual)=>dockParts(v,q)] as [string,number,(v:BuildingVisual)=>BuildingPart[]]),
 ...wonderStyles.map(st=>[`wonder-${st}`,5,(v:BuildingVisual)=>wonderParts(v,st)] as [string,number,(v:BuildingVisual)=>BuildingPart[]])];
test('the 建築 round buildings fill their footprints, build additively, hold together, take damage and restore',()=>{
 for(const [kind,size,generate] of newModels){const byAge:string[]=[];
  for(const ageVariant of [1,2,3,4] as const){let previous=new Set<string>();
   for(const progress of [0,20,40,60,80,100])for(const health of [35,100]){const p=generate({ageVariant,progress,health,red:false}),what=`${kind} age ${ageVariant} progress ${progress} health ${health}`;
    assert.equal(p[0].id,'foundation',what);assert.equal(new Set(p.map(a=>a.id)).size,p.length,what);assert.deepEqual(unattached(p),[],what);
    // Everything inside the footprint (a bombard tower's barrel may poke out of its embrasure by a fifth of a tile).
    assert.ok(p.every(a=>[a.x,a.y,a.z,a.w,a.d,a.h].every(Number.isFinite)&&a.w>0&&a.h>0&&a.d>0&&a.x>=-1e-8&&a.z>=-1e-8&&a.x+a.w<=size+1e-8&&a.z+a.d<=size+.2+1e-8),what);
    if(health===100){const ids=new Set(p.map(a=>a.id));for(const id of previous)assert.ok(ids.has(id),`${what} keeps ${id}`);if(previous.size)assert.ok(ids.size>=previous.size,what);previous=ids;}}
   const v={ageVariant,progress:100,health:100,red:false},full=generate(v);
   assert.ok(generate({...v,health:35}).length<full.length,`${kind} age ${ageVariant} damage drops parts`);
   const rubble=generate({...v,health:0});assert.ok(rubble.length>1&&rubble.every(a=>a.y+a.h<=.32),`${kind} rubble`);
   assert.deepEqual(generate(v),full);assert.ok(full.some(a=>a.color==='#456e87')&&generate({...v,red:true}).some(a=>a.color==='#b85c47'),`${kind} team colour shows`);
   byAge.push(JSON.stringify(full.map(({color,...a})=>a)));
   for(const style of architectures){const styled=regionalParts(full,style);assert.deepEqual(unattached(styled),[],`${kind} ${style}`);}}
  if(!kind.startsWith('bombard')&&!kind.startsWith('wonder'))assert.ok(new Set(byAge).size>=2,`${kind} changes with the ages`);
 }
});
test('walls join their neighbours, gates turn with the wall line, the dock turns to face the land, and wonders differ by region',()=>{
 const v={ageVariant:3 as const,progress:100,health:100,red:false},extent=(p:BuildingPart[])=>[Math.min(...p.map(a=>a.x)),Math.max(...p.map(a=>a.x+a.w)),Math.min(...p.map(a=>a.z)),Math.max(...p.map(a=>a.z+a.d))];
 for(const k of wallKinds){const alone=extent(wallParts(k,v)),line=extent(wallParts(k,v,run)),cross=extent(wallParts(k,v,all));
  assert.ok(alone[0]>.1&&alone[1]<.9,`${k} alone stays a post`);assert.deepEqual([line[0],line[1]].map(n=>Math.round(n*100)/100),[0,1],`${k} run spans the tile`);assert.ok(cross[2]<.05&&cross[3]>.95,`${k} cross`);}
 for(const k of gateKinds){const ew=extent(gateParts(k,v,run)),ns=extent(gateParts(k,v,{...noLinks,n:true,s:true}));assert.ok(ew[1]-ew[0]>.95&&ns[3]-ns[2]>.95&&ns[1]-ns[0]<.8,k);}
 const shed=(q:number)=>dockParts(v,q).find(a=>a.id==='shed-back')!;assert.ok(shed(0).z<.5&&shed(1).x>2.3&&shed(2).z>2.3&&shed(3).x<.5,'shed on the shore side');
 assert.deepEqual(turnParts(dockParts(v,0),3,4),dockParts(v,0));
 const tops=wonderStyles.map(st=>JSON.stringify(wonderParts(v,st).map(a=>a.id).sort()));assert.equal(new Set(tops).size,wonderStyles.length);
 assert.throws(()=>wonderParts(v,'atlantis' as never));assert.throws(()=>wallParts('hedge' as never,v));assert.throws(()=>dockParts({...v,progress:NaN}));
});
