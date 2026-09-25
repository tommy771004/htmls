import test from 'node:test';
import assert from 'node:assert/strict';
import {createDetailController,detailLevel} from '../apps/web/lod.ts';
const T=await import(new URL('../../../vendor/three-0.186.0/three.module.js',import.meta.url).href);
test('detail levels simplify geometry without changing transforms and restore original selection geometry',()=>{
 const lod=createDetailController(T),high=new T.BoxGeometry(2,3,4,4,4,4);high.translate(0,1.5,0);lod.register(high,2,3,4);
 const root=new T.Group(),mesh=new T.Mesh(high),stud=new T.Mesh(new T.BoxGeometry(.1,.1,.1));stud.userData.studs=true;root.add(mesh,stud);mesh.position.set(3,4,5);mesh.rotation.y=.4;
 for(const zoom of [2.5,1,.7,2.5]){lod.apply(root,zoom);assert.deepEqual(mesh.position.toArray(),[3,4,5]);assert.equal(mesh.rotation.y,.4);mesh.geometry.computeBoundingBox();high.computeBoundingBox();assert.deepEqual(mesh.geometry.boundingBox,high.boundingBox);assert.equal(stud.visible,zoom>=.9);
 if(zoom<1.8)assert.ok(mesh.geometry.index.count<high.index.count);else assert.equal(mesh.geometry,high);
 const before=mesh.geometry;assert.equal(lod.withSelectionGeometry(root,()=>mesh.geometry),high);assert.equal(mesh.geometry,before);
 assert.throws(()=>lod.withSelectionGeometry(root,()=>{throw Error('selection failure');}));assert.equal(mesh.geometry,before);
 }
 assert.equal(detailLevel(.7),'far');assert.equal(detailLevel(1),'medium');assert.equal(detailLevel(2.5),'near');lod.dispose();
});
