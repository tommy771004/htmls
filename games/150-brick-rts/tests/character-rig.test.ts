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
import {mountedRoles,mounts} from '../apps/web/character-rig.ts';
test('unique riders sit in the saddle of their own mount; the war elephant swaps the horse for an elephant and back',()=>{
 const box=(w:number,h:number,d:number)=>{const g=new T.BoxGeometry(w,h,d);g.translate(0,h/2,0);return g;};
 const rig=createCharacterRig(T,1,box,color=>new T.MeshStandardMaterial({color}));const body=rig.root.getObjectByName('body-root');
 const coats=new Set<string>();
 for(const role of [...mountedRoles,'cavalry','war-elephant','mameluke'] as const){
  rig.dress(role);const horse=rig.root.getObjectByName('horse-root'),elephant=rig.root.getObjectByName('elephant-root'),look=mounts[role];
  assert.equal(body.parent.name,'rider-saddle',role);
  if(look.horse){assert.equal(horse.visible,true);assert.ok(!elephant||!elephant.visible);assert.equal(body.parent.parent,horse);
   assert.equal(horse.getObjectByName('horse-barding')?.visible??false,look.horse.barding,role);coats.add(horse.children[0].material.color.getHexString());}
  else{assert.equal(elephant.visible,true);assert.equal(horse?.visible??false,false);assert.ok(body.parent.parent.parent===elephant||body.parent.parent===elephant);}
  // The rider wears the mount's dress and holds its weapon (the mounted archer a bow).
  assert.equal(body.children.filter((o:any)=>o.visible&&o.name.startsWith('outfit-'))[0].name,`outfit-${look.rider}`);assert.equal(rig.sockets.rightHand.children.filter((o:any)=>o.visible)[0].name,`tool-${look.tool}`);
  for(const pose of ['idle','walk','attack'] as const)for(const time of [0,120,260,500,900]){rig.pose(pose,time);rig.root.updateMatrixWorld(true);
   const floor=new T.Box3().setFromObject(look.horse?horse:elephant).min.y;assert.ok(floor>=-1e-6,`${role} ${pose} stays on the ground`);
   assert.ok(body.getWorldPosition(new T.Vector3()).y>=.9-1e-6,`${role} rider above the mount`);
   rig.root.traverse((o:any)=>{assert.deepEqual(o.scale.toArray(),[1,1,1]);assert.ok(o.matrixWorld.elements.every(Number.isFinite));});}
  assert.throws(()=>rig.pose('work',0),/僅支援/);
 }
 assert.ok(coats.size>=3,'unique mounts are recoloured');
 rig.dress('samurai');assert.equal(body.parent,rig.root);assert.equal(rig.root.getObjectByName('elephant-root').visible,false);assert.equal(rig.root.getObjectByName('horse-root').visible,false);
 rig.dress('cavalry');assert.equal(rig.root.getObjectByName('horse-root').children[0].material.color.getHexString(),'957350','the scout keeps its bay horse');
 assert.equal(rig.root.children.filter((o:any)=>o.name==='elephant-root').length,1);
});
test('every unique unit kind maps to a dress the rig can wear, with poses clamped for mounts and a dismounted corpse',()=>{
 const kinds=['longbowman','woad-raider','throwing-axeman','huskarl','teutonic-knight','berserk','cataphract','war-elephant','mameluke','janissary','chu-ko-nu','samurai','mangudai'];
 const box=(w:number,h:number,d:number)=>{const g=new T.BoxGeometry(w,h,d);g.translate(0,h/2,0);return g;};
 for(const kind of kinds){const rig=createCharacterRig(T,0,box,color=>new T.MeshStandardMaterial({color}));assert.doesNotThrow(()=>rig.dress(roleOf(kind)),kind);
  for(const pose of unitPoses)assert.doesNotThrow(()=>rig.pose(poseFor(kind,pose),300),`${kind} ${pose}`);
  const fallen=createCharacterRig(T,0,box,color=>new T.MeshStandardMaterial({color}));fallen.dress(corpseRole(kind));assert.doesNotThrow(()=>fallen.pose('death',700));assert.equal(fallen.root.getObjectByName('horse-root'),undefined);assert.equal(fallen.root.getObjectByName('elephant-root'),undefined);}
 assert.deepEqual(kinds.filter(k=>mountedRoles.includes(roleOf(k) as any)),['cataphract','war-elephant','mameluke','mangudai']);
});
