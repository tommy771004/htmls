import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleMeshHits} from '../apps/web/picking.ts';
import {createUnitRig} from '../apps/web/unit-rig.ts';
import {createDetailController} from '../apps/web/lod.ts';
const T=await import(new URL('../../../vendor/three-0.186.0/three.module.js',import.meta.url).href);
test('hidden mesh and ancestor groups never participate in picking',()=>{
 const root=new T.Group(),equipment=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(1,1,1));root.add(equipment);equipment.add(mesh);root.updateMatrixWorld(true);
 const ray=new T.Raycaster(new T.Vector3(0,0,3),new T.Vector3(0,0,-1));
 assert.ok(visibleMeshHits(ray,[root]).length);equipment.visible=false;
 assert.ok(ray.intersectObjects([root],true).length,'regression trigger: Three.js includes invisible equipment');assert.equal(visibleMeshHits(ray,[root]).length,0);
 equipment.visible=true;mesh.visible=false;assert.equal(visibleMeshHits(ray,[root]).length,0);mesh.visible=true;root.visible=false;assert.equal(visibleMeshHits(ray,[root]).length,0);
});
test('unequipping actual spear removes its extended hit area at all detail levels',()=>{
 const lod=createDetailController(T),rig=createUnitRig(T,0,(w,h,d)=>{const high=new T.BoxGeometry(w,h,d,2,2,2);high.translate(0,h/2,0);lod.register(high,w,h,d);return high;},color=>new T.MeshStandardMaterial({color}));
 rig.dress('spearman');rig.pose('idle',0);rig.root.updateMatrixWorld(true);
 const spear=rig.sockets.rightHand.getObjectByName('tool-spear'),box=new T.Box3().setFromObject(spear),point=box.getCenter(new T.Vector3());point.y=box.max.y-.03;
 const ray=new T.Raycaster(new T.Vector3(point.x,point.y,3),new T.Vector3(0,0,-1));
 for(const zoom of [2.5,1,.7]){rig.equip('spear');lod.apply(rig.root,zoom);const read=()=>lod.withSelectionGeometry(rig.root,()=>visibleMeshHits(ray,[rig.root]));assert.ok(read().length);rig.equip('none');assert.equal(read().length,0);}
 lod.dispose();
});
