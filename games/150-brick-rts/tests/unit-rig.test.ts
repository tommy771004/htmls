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
import {unitRoles,roleTools} from '../apps/web/unit-rig.ts';
test('every dress, unique outfits included, shows exactly one outfit and arrives with its own weapon',()=>{
 const rig=createUnitRig(T,1,(w,h,d)=>new T.BoxGeometry(w,h,d),color=>new T.MeshStandardMaterial({color}));
 const looks=new Set<string>();
 for(const role of unitRoles.filter(r=>r!=='villager')){
  rig.dress(role);rig.pose('attack',350);rig.root.updateMatrixWorld(true);
  const shown=rig.root.children.filter((o:any)=>o.visible&&o.name.startsWith('outfit-'));assert.equal(shown.length,1,role);assert.equal(shown[0].name,`outfit-${role}`);
  // Sleeves and strapped shields ride the arm joints: only this outfit's arm groups are visible.
  for(const arm of ['shoulder-left','shoulder-right'])assert.deepEqual(rig.root.getObjectByName(arm).children.filter((o:any)=>o.name.startsWith('outfit-')&&o.visible).map((o:any)=>o.name),[`outfit-${role}-arm-${arm.split('-')[1]}`]);
  assert.equal(rig.sockets.rightHand.children.filter((o:any)=>o.visible)[0].name,`tool-${roleTools[role]}`,role);
  rig.root.traverse((o:any)=>{assert.deepEqual(o.scale.toArray(),[1,1,1]);assert.ok(o.matrixWorld.elements.every(Number.isFinite));});
  looks.add(JSON.stringify(shown[0].children.map((m:any)=>[m.position.toArray(),m.material.color.getHexString()])));
 }
 assert.equal(looks.size,unitRoles.length-1,'no two outfits are the same');
 rig.dress('villager');assert.equal(rig.root.children.filter((o:any)=>o.visible&&o.name.startsWith('outfit-')).length,0);assert.ok(rig.sockets.rightHand.children.every((o:any)=>!o.visible));
});
import {createSiegeRig,trebuchetStates} from '../apps/web/siege-rig.ts';
import {siegeKinds,upgradeLooks} from '../apps/web/rig-roles.ts';
test('siege engines stand on the ground in every pose, animate their attack, show their team and toggle upgrade looks',()=>{
 const box=(w:number,h:number,d:number)=>{const g=new T.BoxGeometry(w,h,d);g.translate(0,h/2,0);return g;};
 const states:Record<string,readonly string[]>={trebuchet:trebuchetStates};
 const shown=(o:any)=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
 const colours=(rig:any)=>{const out=new Set<string>();rig.root.traverse((o:any)=>{if(o.isMesh&&shown(o))out.add(o.material.color.getHexString());});return out;};
 const snapshot=(rig:any)=>{rig.root.updateMatrixWorld(true);const out:number[]=[];rig.root.traverse((o:any)=>{if(o.isMesh&&shown(o))out.push(...o.getWorldPosition(new T.Vector3()).toArray().map((v:number)=>Math.round(v*1000)));});return out.join();};
 const visibleBox=(rig:any)=>{const b=new T.Box3();rig.root.updateMatrixWorld(true);rig.root.traverse((o:any)=>{if(o.isMesh&&shown(o))b.expandByObject(o);});return b;};
 for(const kind of siegeKinds)for(const state of states[kind]??[null]){
  const rig=createSiegeRig(T,kind,0,box,color=>new T.MeshStandardMaterial({color})),enemy=createSiegeRig(T,kind,1,box,color=>new T.MeshStandardMaterial({color}));
  if(state){rig.dress(state);enemy.dress(state);}
  assert.ok(colours(rig).has('45728c')&&colours(enemy).has('b25441'),`${kind} ${state} shows its team`);
  for(const pose of unitPoses)for(const time of [0,120,300,700,1400,2200,10000]){rig.pose(pose,time);const b=visibleBox(rig);
   if(pose!=='death')assert.ok(b.min.y>=-1e-6,`${kind} ${state} ${pose} ${time} on the ground (${b.min.y})`);
   rig.root.traverse((o:any)=>{assert.deepEqual(o.scale.toArray(),[1,1,1]);assert.ok(o.matrixWorld.elements.every(Number.isFinite));});}
  rig.pose('idle',0);const idle=snapshot(rig);rig.pose('attack',100);if(state==='packed')assert.equal(snapshot(rig),idle,'a packed trebuchet cannot shoot');else assert.notEqual(snapshot(rig),idle,`${kind} ${state} attack moves`);
  rig.pose('death',10000);rig.root.updateMatrixWorld(true);assert.ok(Math.abs(rig.root.rotation.z)>.3,`${kind} tips over`);rig.pose('idle',0);assert.equal(rig.root.rotation.z,0);assert.equal(rig.root.position.y,0);
  for(const look of upgradeLooks[kind]??[]){rig.grade(look);assert.notEqual(snapshot(rig),idle,`${kind} ${look} looks different`);rig.grade(null);assert.equal(snapshot(rig),idle,`${kind} ${look} clears`);}
 }
 // The trebuchet's two states: packed is a low wagon, unpacked a tall frame; anything else is rejected.
 const treb=createSiegeRig(T,'trebuchet',0,box,color=>new T.MeshStandardMaterial({color}));treb.pose('idle',0);
 const height=()=>visibleBox(treb).max.y;treb.dress('packed');const low=height();treb.dress('unpacked');const tall=height();assert.ok(low<1.2&&tall>2.3,`${low} ${tall}`);
 treb.dress('packed');assert.equal(height(),low);assert.throws(()=>treb.dress('folded'));
});
test('the hand cannoneer aims level, kicks back on each shot with a muzzle flash, and swings no other tool that way',()=>{
 const rig=createUnitRig(T,0,(w,h,d)=>new T.BoxGeometry(w,h,d),color=>new T.MeshStandardMaterial({color}));
 rig.dress('hand-cannoneer');assert.equal(roleTools['hand-cannoneer'],'hand-cannon');
 const arm=rig.root.getObjectByName('shoulder-right'),flash=()=>rig.sockets.rightHand.getObjectByName('tool-hand-cannon-flash');
 rig.pose('attack',40);assert.ok(arm.rotation.x<-1.5,'raised and kicked');assert.equal(flash().visible,true);assert.ok(rig.root.rotation.x<0,'leans back');
 rig.pose('attack',700);assert.equal(arm.rotation.x,-1.5,'holds aim while reloading');assert.equal(flash().visible,false);assert.equal(rig.root.rotation.x,0);
 rig.pose('idle',40);assert.equal(flash().visible,false);rig.pose('death',10000);assert.ok(rig.sockets.rightHand.children.every((c:any)=>!c.visible));
 rig.equip('musket');rig.pose('attack',700);assert.notEqual(arm.rotation.x,-1.5,'the musket keeps the shared swing');
});
test('the bombard cannon recoils along its bed and the destroyed wreck sheds its barrel',()=>{
 const box=(w:number,h:number,d:number)=>{const g=new T.BoxGeometry(w,h,d);g.translate(0,h/2,0);return g;};
 const rig=createSiegeRig(T,'bombard-cannon',1,box,color=>new T.MeshStandardMaterial({color})),barrel=rig.root.getObjectByName('bombard-barrel');
 rig.pose('idle',0);const rest=barrel.position.z;rig.pose('attack',90);assert.ok(barrel.position.z<rest-.15,'kicked back');rig.pose('attack',900);assert.equal(barrel.position.z,rest,'run forward again');
 rig.pose('death',10000);assert.ok(barrel.rotation.z>.3&&rig.root.rotation.z<-.3,'wreck');rig.pose('idle',0);assert.equal(barrel.rotation.z,0);assert.equal(barrel.position.z,rest);
});
import {createVesselRig,vesselFrames} from '../apps/web/vessel-rig.ts';
import {vesselKinds,shipKinds,isVessel,isSiege as siegeKind} from '../apps/web/rig-roles.ts';
test('ships float, row, fire and sink; the trade cart rolls on the ground; line upgrades swap the whole ship',()=>{
 const box=(w:number,h:number,d:number)=>{const g=new T.BoxGeometry(w,h,d);g.translate(0,h/2,0);return g;};
 const shown=(o:any)=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
 const colours=(rig:any)=>{const out=new Set<string>();rig.root.traverse((o:any)=>{if(o.isMesh&&shown(o))out.add(o.material.color.getHexString());});return out;};
 const snapshot=(rig:any)=>{rig.root.updateMatrixWorld(true);const out:number[]=[];rig.root.traverse((o:any)=>{if(o.isMesh&&shown(o))out.push(...o.getWorldPosition(new T.Vector3()).toArray().map((v:number)=>Math.round(v*1000)));});return out.join();};
 const visibleBox=(rig:any)=>{const b=new T.Box3();rig.root.updateMatrixWorld(true);rig.root.traverse((o:any)=>{if(o.isMesh&&shown(o))b.expandByObject(o);});return b;};
 const warships=['galley','fire-galley','cannon-galleon','longboat'];
 for(const kind of vesselKinds){const make=(p:number)=>createVesselRig(T,kind,p,box,color=>new T.MeshStandardMaterial({color}));const rig=make(0);
  assert.ok(isVessel(kind)&&!siegeKind(kind)&&vesselFrames[kind],kind);assert.ok(colours(rig).has('45728c')&&colours(make(1)).has('b25441'),`${kind} shows its team`);
  for(const look of [null,...(upgradeLooks[kind]??[])]){rig.grade(look);
   for(const pose of unitPoses)for(const time of [0,120,300,700,1400,2200,10000]){rig.pose(pose,time);const b=visibleBox(rig);
    // A hull sits a little below the waterline (hidden in the water tile); the cart's wheels stand on the ground.
    if(pose!=='death')assert.ok(b.min.y>=(kind==='trade-cart'?-1e-6:-.2),`${kind} ${look} ${pose} ${time} afloat (${b.min.y})`);
    rig.root.traverse((o:any)=>{assert.deepEqual(o.scale.toArray(),[1,1,1]);assert.ok(o.matrixWorld.elements.every(Number.isFinite));});}}
  rig.grade(null);rig.pose('idle',0);const idle=snapshot(rig);
  rig.pose('idle',200);const still=snapshot(rig);rig.pose('walk',200);assert.notEqual(snapshot(rig),still,`${kind} moves when walking`);
  if(warships.includes(kind)){rig.pose('attack',40);assert.notEqual(snapshot(rig),idle,`${kind} fires`);}
  if(kind==='fishing-ship'){rig.pose('work',400);assert.notEqual(snapshot(rig),idle,'the net dips');}
  rig.pose('death',10000);rig.root.updateMatrixWorld(true);if(kind==='trade-cart')assert.ok(Math.abs(rig.root.rotation.z)>.3,'the cart tips over');else assert.ok(rig.root.position.y<-.3&&rig.root.rotation.x<-.3,`${kind} sinks`);
  rig.pose('idle',0);assert.equal(snapshot(rig),idle,`${kind} death leaves no trace`);
  for(const look of upgradeLooks[kind]??[]){rig.grade(look);assert.notEqual(snapshot(rig),idle,`${kind} ${look} looks different`);rig.grade(null);assert.equal(snapshot(rig),idle,`${kind} ${look} clears`);}
 }
 assert.equal(shipKinds.length+1,vesselKinds.length);assert.throws(()=>createVesselRig(T,'submarine',0,box,color=>new T.MeshStandardMaterial({color})));
});
