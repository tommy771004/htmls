import test from 'node:test';
import assert from 'node:assert/strict';
import {obstacleBounds,obstacleFootprints} from '../packages/content/footprints.ts';
import type {ObstacleKind} from '../packages/content/footprints.ts';
import {buildingParts} from '../apps/web/building-parts.ts';
import {clearSegment} from '../packages/sim/navigation.ts';
import {createTiles} from '../packages/sim/terrain.ts';
test('house foundation uses the physical footprint, independent of age and render states',()=>{
 for(const ageVariant of [1,2,3,4] as const)for(const health of [0,35,100]){const p=buildingParts({ageVariant,health,progress:100,red:false})[0];assert.deepEqual([p.x*100,p.z*100,(p.x+p.w)*100,(p.z+p.d)*100].map(Math.round),obstacleBounds({kind:'house',x:0,y:0}));}
 assert.deepEqual(obstacleBounds({kind:'house',x:300,y:400},25),[260,360,560,640]);
});
test('every registered obstacle rejects contact and admits a point just outside expanded bounds',()=>{
 for(const kind of Object.keys(obstacleFootprints) as ObstacleKind[]){const o={kind,x:600,y:600},map={obstacles:[o],blocked:[],tiles:createTiles(),resources:[],navigationRevision:0,generationAttempt:0};const [x0,y0,x1,y1]=obstacleBounds(o,25);
 for(const [on,out] of [[{x:x0,y:600},{x:x0-1,y:600}],[{x:x1,y:600},{x:x1+1,y:600}],[{x:600,y:y0},{x:600,y:y0-1}],[{x:600,y:y1},{x:600,y:y1+1}]]){assert.equal(clearSegment(map,on,on),false);assert.equal(clearSegment(map,out,out),true);}
 }
 for(const radius of [-1,NaN,.5])assert.throws(()=>obstacleBounds({kind:'house',x:300,y:400},radius));
});
