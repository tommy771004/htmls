import test from 'node:test';
import assert from 'node:assert/strict';
import {obstacleBounds,obstacleFootprints,obstacleRects,walkablePlatforms,townCenterEntrance} from '../packages/content/footprints.ts';
import type {ObstacleKind} from '../packages/content/footprints.ts';
import {buildingParts} from '../apps/web/building-parts.ts';
import {clearSegment,makeMap,createPathJob,advancePathJob} from '../packages/sim/navigation.ts';
import {economicBuildingParts} from '../apps/web/economic-building.ts';
import {archOpening} from '../apps/web/brick-geometries.ts';
import {createTiles} from '../packages/sim/terrain.ts';
test('house foundation uses the physical footprint, independent of age and render states',()=>{
 for(const ageVariant of [1,2,3,4] as const)for(const health of [0,35,100]){const p=buildingParts({ageVariant,health,progress:100,red:false})[0];assert.deepEqual([p.x*100,p.z*100,(p.x+p.w)*100,(p.z+p.d)*100].map(Math.round),obstacleBounds({kind:'house',x:0,y:0}));}
 assert.deepEqual(obstacleBounds({kind:'house',x:300,y:400},25),[260,360,560,640]);
});
test('every registered obstacle rejects contact and admits a point just outside expanded bounds',()=>{
 for(const kind of Object.keys(obstacleFootprints) as ObstacleKind[]){const o={kind,x:600,y:600},map={obstacles:[o],blocked:[],tiles:createTiles(),resources:[],navigationRevision:0,generationAttempt:0},rects=obstacleRects(o,25);
  const inside=(p:{x:number;y:number})=>rects.some(([x0,y0,x1,y1])=>p.x>=x0&&p.x<=x1&&p.y>=y0&&p.y<=y1);
  for(const [x0,y0,x1,y1] of rects){const mx=Math.round((x0+x1)/2),my=Math.round((y0+y1)/2);
   for(const [on,out] of [[{x:x0,y:my},{x:x0-1,y:my}],[{x:x1,y:my},{x:x1+1,y:my}],[{x:mx,y:y0},{x:mx,y:y0-1}],[{x:mx,y:y1},{x:mx,y:y1+1}]]){assert.equal(clearSegment(map,on,on),false,kind);if(!inside(out))assert.equal(clearSegment(map,out,out),true,kind);}
  }
 }
 for(const radius of [-1,NaN,.5])assert.throws(()=>obstacleBounds({kind:'house',x:300,y:400},radius));
});
// Villager envelope from unit-rig.ts: torso .46 wide, hat top 1.13; the plinth lifts it 0.16.
const villager={halfWidth:.23,top:1.13+walkablePlatforms['town-center']!.height/100};
const walkable=new Set(['foundation','entrance-paving']);
test('town-center collision rects equal the ground projection of every part a villager could walk into',()=>{
 const rects=obstacleRects({kind:'town-center',x:0,y:0});
 for(const ageVariant of [1,2,3,4] as const){
  const parts=economicBuildingParts('town-center',{ageVariant,progress:100,health:100,red:false});
  const blocking=parts.filter(p=>!walkable.has(p.id)&&p.shape!=='arch'&&p.y<villager.top);
  for(const p of blocking){const box=[Math.floor(p.x*100+1e-6),Math.floor(p.z*100+1e-6),Math.ceil((p.x+p.w)*100-1e-6),Math.ceil((p.z+p.d)*100-1e-6)];
   assert.ok(rects.some(r=>r.every((v,i)=>v===box[i])),`age ${ageVariant} ${p.id} ${box} has no matching collision rect`);}
  // Walkable pieces stay low enough that feet never sink into them.
  for(const p of parts.filter(p=>walkable.has(p.id)))assert.ok(p.y+p.h<=.18+1e-9,p.id);
  const arch=parts.find(p=>p.shape==='arch')!,{radius,spring}=archOpening(arch.w-.018,arch.h),center=(arch.x+arch.w/2)*100;
  // Largest centre offset where the villager's top corners stay under the arch curve.
  const offset=Math.sqrt(radius**2-(villager.top-arch.y-spring)**2)-villager.halfWidth;assert.ok(offset>0);
  const flanks=rects.filter(r=>r[1]===Math.round(arch.z*100)&&r[3]===Math.round((arch.z+arch.d)*100));
  assert.deepEqual(flanks.map(r=>[r[0],r[2]]),[[Math.round(arch.x*100),Math.ceil(center-(offset+.25)*100)],[Math.floor(center+(offset+.25)*100),Math.round((arch.x+arch.w)*100)]]);
  // No invented blocking: each non-arch rect is exactly one blocking part.
  for(const r of rects.filter(r=>!flanks.includes(r)))assert.ok(blocking.some(p=>[Math.floor(p.x*100+1e-6),Math.floor(p.z*100+1e-6),Math.ceil((p.x+p.w)*100-1e-6),Math.ceil((p.z+p.d)*100-1e-6)].every((v,i)=>v===r[i])),`rect ${r} matches no part`);
 }
});
test('villagers reach the town-center gate from both spawns and pass through the arch into the hall',()=>{
 for(const seed of [7,42,260925])for(const layout of ['meadow','coast','acceptance'] as const){const map=makeMap(seed,layout);
  for(const tc of map.obstacles.filter(o=>o.kind==='town-center')){
   const gate={x:tc.x+townCenterEntrance.x,y:tc.y+townCenterEntrance.y},hall={x:tc.x+135,y:tc.y+60};
   assert.ok(clearSegment(map,hall,hall),'hall floor is walkable');
   for(const spawn of [{x:350,y:700},{x:1150,y:700}]){const job=createPathJob(map,1,spawn,hall);advancePathJob(map,job,961);assert.equal(job.status,'found',`${seed} ${layout} ${tc.id}`);
    const inArch=job.path.filter(p=>p.y>=tc.y+150&&p.y<=tc.y+175);assert.ok(inArch.length&&inArch.every(p=>p.x===tc.x+135),'route crosses the gate on its centre line');
    const toGate=createPathJob(map,1,spawn,gate);advancePathJob(map,toGate,961);assert.equal(toGate.status,'found');}
   // One grid step either side of the gate centre is inside the collision flanks.
   for(const dx of [-50,50])assert.equal(clearSegment(map,{x:tc.x+135+dx,y:tc.y+160},{x:tc.x+135+dx,y:tc.y+160}),false);
  }
 }
});
