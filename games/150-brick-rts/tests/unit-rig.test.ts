import test from 'node:test';
import assert from 'node:assert/strict';
import {createUnitRig,samplePose,unitPoses,unitTools} from '../apps/web/unit-rig.ts';
const T=await import(new URL('../../../vendor/three-0.186.0/three.module.js',import.meta.url).href);
test('all tools attach to the hand joint and follow its world transform',()=>{
 const rig=createUnitRig(T,0,(w,h,d)=>new T.BoxGeometry(w,h,d),color=>new T.MeshStandardMaterial({color}));
 assert.equal(rig.sockets.rightHand.name,'hand-right');assert.equal(rig.sockets.leftHand.name,'hand-left');
 for(const tool of unitTools){rig.equip(tool);rig.pose('idle',0);rig.root.updateMatrixWorld(true);const before=rig.sockets.rightHand.getWorldPosition(new T.Vector3()).toArray();rig.pose('work',350);rig.root.updateMatrixWorld(true);const after=rig.sockets.rightHand.getWorldPosition(new T.Vector3()).toArray();assert.notDeepEqual(after,before);const visible=rig.sockets.rightHand.children.filter((c:any)=>c.visible);assert.equal(visible.length,tool==='none'?0:1);if(tool!=='none')assert.equal(visible[0].name,`tool-${tool}`);}
});
test('joint animation preserves rigid scales, clamps one-shot poses and does not accumulate transforms',()=>{
 const rig=createUnitRig(T,1,(w,h,d)=>new T.BoxGeometry(w,h,d),color=>new T.MeshStandardMaterial({color}));
 for(const pose of unitPoses)for(const time of [0,150,350,700,10000]){rig.pose(pose,time);rig.root.updateMatrixWorld(true);rig.root.traverse((o:any)=>{assert.deepEqual(o.scale.toArray(),[1,1,1]);assert.ok(o.matrixWorld.elements.every(Number.isFinite));});}
 assert.deepEqual(samplePose('death',700),samplePose('death',10000));assert.equal(samplePose('hit',10000).lean,0);
 rig.equip('axe');rig.pose('death',10000);assert.ok(rig.sockets.rightHand.children.every((c:any)=>!c.visible));rig.pose('idle',0);assert.equal(Math.abs(rig.root.rotation.z),0);assert.equal(rig.root.position.y,0);assert.equal(rig.sockets.rightHand.children[0].visible,true);
});

test('military silhouettes use one outfit and hand-mounted weapons and restore villager',()=>{
 const rig=createUnitRig(T,0,(w,h,d)=>new T.BoxGeometry(w,h,d),color=>new T.MeshStandardMaterial({color}));
 for(const [role,weapon] of [['swordsman','sword'],['spearman','spear'],['archer','bow']] as const){
  rig.dress(role);rig.pose('walk',350);rig.root.updateMatrixWorld(true);
  assert.equal(rig.root.children.filter((o:any)=>o.visible&&o.name.startsWith('outfit-')).length,1);
  assert.equal(rig.sockets.rightHand.children.filter((o:any)=>o.visible)[0].name,`tool-${weapon}`);
  assert.equal(rig.sockets.leftHand.getObjectByName('shield-left').visible,role==='swordsman');
 }
 rig.dress('villager');assert.equal(rig.root.children.filter((o:any)=>o.visible&&o.name.startsWith('outfit-')).length,0);
 assert.ok(rig.sockets.rightHand.children.every((o:any)=>!o.visible));assert.equal(rig.sockets.leftHand.getObjectByName('shield-left').visible,false);
 assert.throws(()=>rig.dress('unknown' as any));
});
