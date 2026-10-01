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
import {roleOf,poseFor,corpseRole,siegeKinds,isSiege,isVessel,lookOf,upgradeLooks} from '../apps/web/rig-roles.ts';
import {isMounted} from '../apps/web/character-rig.ts';
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
test('unique riders sit in the saddle of their own mount; the war elephant and the camel swap the horse for their own body and back',()=>{
 const box=(w:number,h:number,d:number)=>{const g=new T.BoxGeometry(w,h,d);g.translate(0,h/2,0);return g;};
 const rig=createCharacterRig(T,1,box,color=>new T.MeshStandardMaterial({color}));const body=rig.root.getObjectByName('body-root');
 const coats=new Set<string>();
 for(const role of [...mountedRoles,'cavalry','war-elephant','mameluke'] as const){
  rig.dress(role);const look=mounts[role],horse=rig.root.getObjectByName('horse-root'),elephant=rig.root.getObjectByName(`${look.mount}-root`);
  assert.equal(body.parent.name,'rider-saddle',role);
  if(look.horse){assert.equal(horse.visible,true);for(const other of ['elephant','camel'])assert.ok(!rig.root.getObjectByName(`${other}-root`)?.visible,`${role} hides the ${other}`);assert.equal(body.parent.parent,horse);
   assert.equal(horse.getObjectByName('horse-barding')?.visible??false,look.horse.barding,role);coats.add(horse.children[0].material.color.getHexString());}
  else{assert.equal(elephant.visible,true,role);assert.equal(horse?.visible??false,false);assert.ok(body.parent.parent.parent===elephant||body.parent.parent===elephant);
   for(const other of ['elephant','camel'])if(other!==look.mount)assert.ok(!rig.root.getObjectByName(`${other}-root`)?.visible,`${role} hides the ${other}`);}
  // The rider wears the mount's dress and holds its weapon (the mounted archer a bow).
  assert.equal(body.children.filter((o:any)=>o.visible&&o.name.startsWith('outfit-'))[0].name,`outfit-${look.rider}`);assert.equal(rig.sockets.rightHand.children.filter((o:any)=>o.visible)[0].name,`tool-${look.tool}`);
  for(const pose of ['idle','walk','attack'] as const)for(const time of [0,120,260,500,900]){rig.pose(pose,time);rig.root.updateMatrixWorld(true);
   const floor=new T.Box3().setFromObject(look.horse?horse:elephant).min.y;assert.ok(floor>=-1e-6,`${role} ${pose} stays on the ground`);
   assert.ok(body.getWorldPosition(new T.Vector3()).y>=.9-1e-6,`${role} rider above the mount`);
   rig.root.traverse((o:any)=>{assert.deepEqual(o.scale.toArray(),[1,1,1]);assert.ok(o.matrixWorld.elements.every(Number.isFinite));});}
  assert.throws(()=>rig.pose('work',0),/僅支援/);
 }
 // The camel rider sits on the hump, higher than any horse rider; the camel paces (both legs of a side together).
 rig.dress('camel');rig.pose('idle',0);rig.root.updateMatrixWorld(true);assert.ok(body.getWorldPosition(new T.Vector3()).y>1.5);
 rig.pose('walk',150);const legs=[0,1,2,3].map(i=>rig.root.getObjectByName(`camel-leg-${i}`).rotation.x);assert.equal(legs[0],legs[1]);assert.equal(legs[2],legs[3]);assert.notEqual(legs[0],legs[2]);
 assert.ok(coats.size>=3,'unique mounts are recoloured');
 rig.dress('samurai');assert.equal(body.parent,rig.root);assert.equal(rig.root.getObjectByName('elephant-root').visible,false);assert.equal(rig.root.getObjectByName('horse-root').visible,false);
 rig.dress('cavalry');assert.equal(rig.root.getObjectByName('horse-root').children[0].material.color.getHexString(),'957350','the scout keeps its bay horse');
 assert.equal(rig.root.children.filter((o:any)=>o.name==='elephant-root').length,1);
});
test('every unique unit kind maps to a dress the rig can wear, with poses clamped for mounts and a dismounted corpse',()=>{
 const kinds=['longbowman','woad-raider','throwing-axeman','huskarl','teutonic-knight','berserk','cataphract','war-elephant','mameluke','janissary','chu-ko-nu','samurai','mangudai','cavalry-archer','camel','petard','hand-cannoneer'];
 const box=(w:number,h:number,d:number)=>{const g=new T.BoxGeometry(w,h,d);g.translate(0,h/2,0);return g;};
 for(const kind of kinds){const rig=createCharacterRig(T,0,box,color=>new T.MeshStandardMaterial({color}));assert.doesNotThrow(()=>rig.dress(roleOf(kind)),kind);
  for(const pose of unitPoses)assert.doesNotThrow(()=>rig.pose(poseFor(kind,pose),300),`${kind} ${pose}`);
  const fallen=createCharacterRig(T,0,box,color=>new T.MeshStandardMaterial({color}));fallen.dress(corpseRole(kind));assert.doesNotThrow(()=>fallen.pose('death',700));assert.equal(fallen.root.getObjectByName('horse-root'),undefined);assert.equal(fallen.root.getObjectByName('elephant-root'),undefined);assert.equal(fallen.root.getObjectByName('camel-root'),undefined);}
 assert.deepEqual(kinds.filter(k=>mountedRoles.includes(roleOf(k) as any)),['cataphract','war-elephant','mameluke','mangudai','cavalry-archer','camel']);
 assert.equal(roleOf('petard'),'petard');assert.equal(roleOf('hand-cannoneer'),'hand-cannoneer');assert.equal(corpseRole('hand-cannoneer'),'hand-cannoneer');
 assert.ok(siegeKinds.includes('bombard-cannon')&&roleOf('bombard-cannon')==='villager');for(const k of siegeKinds)assert.ok(isSiege(k)&&!isMounted(roleOf(k)),k);
});
test('line-upgrade looks: the latest researched upgrade of the line, shown over the dress and cleared by the next dress',()=>{
 assert.equal(lookOf('militia',[]),null);assert.equal(lookOf('militia',['man-at-arms','two-handed-swordsman']),'two-handed-swordsman');assert.equal(lookOf('militia',['two-handed-swordsman','champion']),'champion');assert.equal(lookOf('knight',['cavalier']),'cavalier');assert.equal(lookOf('villager',['champion']),null);
 const box=(w:number,h:number,d:number)=>{const g=new T.BoxGeometry(w,h,d);g.translate(0,h/2,0);return g;};
 const rig=createCharacterRig(T,0,box,color=>new T.MeshStandardMaterial({color}));const shown=()=>{const out:string[]=[];rig.root.traverse((o:any)=>{if(o.name.startsWith('grade-')&&!o.name.includes('-arm-')&&o.visible)out.push(o.name);});return out;};
 rig.dress('swordsman');rig.grade('champion');assert.deepEqual(shown(),['grade-champion']);assert.equal(rig.root.getObjectByName('shield-left').visible,false,'two-handed: no shield');
 rig.dress('swordsman');assert.deepEqual(shown(),[]);assert.equal(rig.root.getObjectByName('shield-left').visible,true);
 rig.dress('cavalry');rig.grade('paladin');assert.equal(rig.root.getObjectByName('horse-barding').visible,true);assert.equal(rig.root.getObjectByName('horse-gilt').visible,true);
 rig.grade('cavalier');assert.equal(rig.root.getObjectByName('horse-gilt').visible,false);rig.dress('cavalry');assert.equal(rig.root.getObjectByName('horse-barding').visible,false,'a plain scout or knight has no barding');
 rig.dress('cataphract');rig.grade(null);assert.equal(rig.root.getObjectByName('horse-barding').visible,true,'the cataphract keeps its own barding');
 rig.dress('camel');rig.grade('heavy-camel');assert.equal(rig.root.getObjectByName('camel-armour').visible,true);rig.dress('camel');assert.equal(rig.root.getObjectByName('camel-armour').visible,false);
 for(const kind of Object.keys(upgradeLooks).filter(k=>!isSiege(k)&&!isVessel(k)))for(const look of upgradeLooks[kind]){const r=createCharacterRig(T,0,box,color=>new T.MeshStandardMaterial({color}));r.dress(roleOf(kind));r.grade(look);
  for(const pose of ['idle','walk','attack'] as const){r.pose(poseFor(kind,pose),300);r.root.updateMatrixWorld(true);r.root.traverse((o:any)=>{assert.deepEqual(o.scale.toArray(),[1,1,1]);assert.ok(o.matrixWorld.elements.every(Number.isFinite));});}}
});
