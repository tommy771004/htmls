import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacterRig} from '../apps/web/character-rig.ts';
const T=await import(new URL('../../../vendor/three-0.186.0/three.module.js',import.meta.url).href);
test('mounted rider attaches at saddle, stays above horse and restores foot rig',()=>{
 const rig=createCharacterRig(T,0,(w,h,d)=>{const g=new T.BoxGeometry(w,h,d);g.translate(0,h/2,0);return g;},color=>new T.MeshStandardMaterial({color}));
 rig.dress('cavalry');const horse=rig.root.getObjectByName('horse-root'),saddle=rig.root.getObjectByName('rider-saddle'),body=rig.root.getObjectByName('body-root');assert.equal(body.parent,saddle);
 for(const pose of ['idle','walk','attack'] as const)for(const time of Array.from({length:51},(_,i)=>i*20)){rig.pose(pose,time);rig.root.updateMatrixWorld(true);assert.equal(body.getWorldPosition(new T.Vector3()).y,.9);assert.equal(body.getObjectByName('hip-left').position.x,-.4);for(let i=0;i<4;i++){const leg=horse.getObjectByName(`horse-leg-${i}`);assert.ok(new T.Box3().setFromObject(leg).min.y>=-1e-6);}rig.root.traverse((o:any)=>{assert.deepEqual(o.scale.toArray(),[1,1,1]);assert.ok(o.matrixWorld.elements.every(Number.isFinite));});}
 assert.throws(()=>rig.pose('death',700),/僅支援/);rig.dress('villager');assert.equal(horse.visible,false);assert.equal(body.parent,rig.root);assert.equal(body.position.y,0);assert.equal(body.getObjectByName('hip-left').position.x,-.12);rig.dress('cavalry');assert.equal(rig.root.children.filter((o:any)=>o.name==='horse-root').length,1);
});
import {roleOf,poseFor,corpseRole} from '../apps/web/rig-roles.ts';
import {unitPoses} from '../apps/web/unit-rig.ts';
test('a mounted scout never receives a pose the mounted rig cannot play; its corpse lies dismounted',()=>{
 const rig=createCharacterRig(T,0,(w,h,d)=>{const g=new T.BoxGeometry(w,h,d);g.translate(0,h/2,0);return g;},color=>new T.MeshStandardMaterial({color}));
 assert.equal(roleOf('scout'),'cavalry');rig.dress('cavalry');
 for(const pose of unitPoses)assert.doesNotThrow(()=>rig.pose(poseFor('scout',pose),300),pose);
 const fallen=createCharacterRig(T,0,(w,h,d)=>{const g=new T.BoxGeometry(w,h,d);g.translate(0,h/2,0);return g;},color=>new T.MeshStandardMaterial({color}));
 fallen.dress(corpseRole('scout'));assert.doesNotThrow(()=>fallen.pose('death',700));
 assert.equal(poseFor('villager','work'),'work');
});
