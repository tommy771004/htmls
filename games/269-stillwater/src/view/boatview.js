// 划艇與漁夫：船身（換漆）、雙槳（照 SPEC 的划槳公式由程式轉）、船頭提燈、魚簍蓋、收在船內的釣竿；
// 漁夫的划槳動作時間對齊槳的相位，釣魚動作照狀態交叉淡入；依張力讓竿身彎曲；釣魚時整個人轉向釣點。
import * as THREE from 'three';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gltf, staticObject, report } from './assets.js';
import { oarPose, OAR_REST, STROKE_T } from '../core/boat.js';
import { PAINTS, RIBBONS } from '../core/quests.js';
import * as PH from './placeholders.js';

const D2R = Math.PI / 180;
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
const AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);

// 蒙皮網格在 GLB 裡每個材質一個 primitive（漁夫有 18 個）：把材質底色烘成頂點色，合併成一個 SkinnedMesh，
// 帽帶（hat_ribbon）單獨留一個，遊戲可以換色。
function bakeSkinned(root) {
  const groups = [];
  root.traverse((o) => {
    if (o.isSkinnedMesh || !o.children.length) return;
    const kids = o.children.filter((c) => c.isSkinnedMesh);
    if (kids.length >= 2) groups.push([o, kids]);
  });
  for (const [grp, kids] of groups) {
    const sk = kids[0].skeleton;
    const keep = kids.filter((k) => k.material.name === 'hat_ribbon');
    const bake = kids.filter((k) => k.skeleton === sk && !keep.includes(k) && !Array.isArray(k.material));
    const geos = bake.map((k) => {
      const src = k.geometry, g = new THREE.BufferGeometry();
      for (const a of ['position', 'normal', 'skinIndex', 'skinWeight']) if (src.attributes[a]) g.setAttribute(a, src.attributes[a]);
      if (src.index) g.setIndex(src.index);
      const n = src.attributes.position.count, col = new Float32Array(n * 3), c = k.material.color || new THREE.Color(1, 1, 1);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    });
    const merged = mergeGeometries(geos.map((g) => (geos.some((x) => !x.index) && g.index ? g.toNonIndexed() : g)));
    if (!merged) continue;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, metalness: 0, roughness: 0.8, side: THREE.DoubleSide });
    const k0 = bake[0];
    const sm = new THREE.SkinnedMesh(merged, mat);
    sm.name = grp.name + '_baked';
    sm.position.copy(k0.position); sm.quaternion.copy(k0.quaternion); sm.scale.copy(k0.scale);
    sm.bindMode = k0.bindMode;
    for (const k of bake) grp.remove(k);
    grp.add(sm);
    sm.bind(k0.skeleton, k0.bindMatrix);
  }
}

export function buildBoat(scene) {
  const root = new THREE.Group(); root.name = 'boatRoot';
  const hull = staticObject('boat', 'boat', PH.boatHull, ['Oar_L', 'Oar_R', 'lantern', 'creel', 'creel_lid', 'rod_stowed']);
  root.add(hull);
  scene.add(root);
  const oarL = hull.getObjectByName('Oar_L'), oarR = hull.getObjectByName('Oar_R');
  const lantern = hull.getObjectByName('lantern');
  const lid = hull.getObjectByName('creel_lid');
  const rodStowed = hull.getObjectByName('rod_stowed');
  const paintMats = [], lampMats = [];
  hull.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.special === 'hull_paint') paintMats.push(o.material);
    if (o.userData.special === 'lamp_glow') lampMats.push(o.material);
  });
  for (const m of lampMats) { m.emissive = new THREE.Color('#ffc46b'); m.emissiveIntensity = 0; }
  if (lantern) lantern.visible = false;
  const lampLight = new THREE.PointLight(0xffc46b, 0, 12, 1.6);
  lampLight.position.set(0, 0.6, 1.7);
  root.add(lampLight);

  // ---------- 漁夫 ----------
  let fisher, mixer = null, actions = {}, bones = {};
  const ribbonMats = [];
  if (gltf.fisher) {
    fisher = skClone(gltf.fisher.scene.getObjectByName('fisher_rig') || gltf.fisher.scene);
    bakeSkinned(fisher);
    fisher.traverse((o) => {
      if (o.isBone) bones[o.name] = o;
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => { if (m.name === 'hat_ribbon') ribbonMats.push(m); m.flatShading = true; m.needsUpdate = true; });
      }
    });
    mixer = new THREE.AnimationMixer(fisher);
    for (const clip of gltf.fisher.animations) {
      const a = mixer.clipAction(clip);
      if (['cast', 'hook', 'cheer'].includes(clip.name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      actions[clip.name] = a;
    }
  } else {
    report.placeholders.add('fisher');
    fisher = PH.fisher();
  }
  const pivot = new THREE.Group(); pivot.name = 'fisherPivot';
  pivot.add(fisher);
  root.add(pivot);

  // 划槳動作：時間由槳的相位決定（timeScale 0，每幀設定 time）
  const ROWS = ['sit', 'row', 'row_L', 'row_R'];
  for (const n of ROWS) if (actions[n]) { actions[n].play(); actions[n].setEffectiveWeight(n === 'sit' ? 1 : 0); if (n !== 'sit') actions[n].timeScale = 0; }
  let rowW = { sit: 1, row: 0, row_L: 0, row_R: 0 };
  let fishAct = null;                         // 目前的釣魚動作名稱（null = 划船狀態）
  const oarState = { L: { ...OAR_REST }, R: { ...OAR_REST } };
  let pivotYaw = 0, pivotTarget = 0, bend = 0, lidOpen = 0, lidT = 0;

  function play(name, fade = 0.25) {
    // 釣魚動作：把划船的權重淡出，交叉淡入新動作
    if (!mixer || !actions[name]) { fishAct = name; return; }
    const prev = fishAct && actions[fishAct];
    const a = actions[name];
    a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.play();
    if (prev && prev !== a) prev.crossFadeTo(a, fade, false);
    else a.fadeIn(fade);
    fishAct = name;
  }
  function stopFishing(fade = 0.35) {
    if (fishAct && actions[fishAct]) actions[fishAct].fadeOut(fade);
    fishAct = null;
  }

  const api = {
    root, hull, fisher, bones, pivot, oarL, oarR,
    get fishAct() { return fishAct; },
    play, stopFishing,
    setPaint(i) { for (const m of paintMats) m.color.set(PAINTS[i].hex); },
    setRibbon(i) { for (const m of ribbonMats) m.color.set(RIBBONS[i].hex); },
    setLantern(on) { if (lantern) lantern.visible = on; api.hasLantern = on; },
    hasLantern: false,
    openLid() { lidT = 1.6; },
    faceTo(x, z) {
      // 漁夫轉身面向世界座標 (x, z)；他在船上預設面向船尾（本地 −Z）
      const inv = new THREE.Vector3(x, 0, z);
      root.worldToLocal(inv);
      // 轉身超過船尾 ±40° 靴子會穿出船殼，所以限制角度，剩下的由遊戲把整艘船轉過去
      pivotTarget = THREE.MathUtils.clamp(Math.atan2(-inv.x, -inv.z), -0.7, 0.7);
    },
    faceRow() { pivotTarget = 0; },
    setBend(b) { bend = b; },
    rodTip(out) {
      if (bones.rod_tip) return bones.rod_tip.getWorldPosition(out);
      return out.set(0, 1.6, -1.5).applyMatrix4(root.matrixWorld);
    },
    hand(out) { return bones.hand_L ? bones.hand_L.getWorldPosition(out) : out.set(0, 1.2, 0).applyMatrix4(root.matrixWorld); },
    // 每幀：boat = 物理狀態，fishing = 是否在釣魚（槳收起）
    update(dt, boat, fishing, duskLight) {
      root.position.set(boat.x, Math.sin(performance.now() * 0.0012) * 0.025 - 0.01, boat.z);
      root.rotation.set(0, 0, 0);
      root.rotation.order = 'YXZ';
      root.rotation.y = boat.yaw;
      root.rotation.x = boat.pitch * D2R + Math.sin(performance.now() * 0.0009) * 0.006;
      root.rotation.z = boat.roll * D2R + (boat.sway || 0);
      // 槳
      const mode = fishing ? 'rest' : boat.mode;
      const actL = ['row', 'rowR+', 'rowL+', 'row_L'].includes(mode), actR = ['row', 'rowR+', 'rowL+', 'row_R'].includes(mode);
      const moving = mode !== 'rest' && mode !== 'idle';
      const tgtL = moving ? oarPose(boat.phi, actL) : OAR_REST;
      const tgtR = moving ? oarPose(boat.phi, actR) : OAR_REST;
      const k = moving ? 1 : Math.min(1, dt * 4);
      for (const [s, tg] of [['L', tgtL], ['R', tgtR]]) { oarState[s].sweep += (tg.sweep - oarState[s].sweep) * (moving ? Math.min(1, dt * 18) : k); oarState[s].lift += (tg.lift - oarState[s].lift) * (moving ? Math.min(1, dt * 18) : k); }
      if (oarL) oarL.quaternion.copy(qa.setFromAxisAngle(AY, -oarState.L.sweep * D2R)).multiply(qb.setFromAxisAngle(AZ, oarState.L.lift * D2R));
      if (oarR) oarR.quaternion.copy(qa.setFromAxisAngle(AY, oarState.R.sweep * D2R)).multiply(qb.setFromAxisAngle(AZ, -oarState.R.lift * D2R));
      // 漁夫划槳動作的權重與時間
      if (mixer) {
        const want = fishing ? { sit: 0, row: 0, row_L: 0, row_R: 0 }
          : mode === 'row' || mode === 'rowR+' || mode === 'rowL+' ? { sit: 0, row: 1, row_L: 0, row_R: 0 }
          : mode === 'row_L' ? { sit: 0, row: 0, row_L: 1, row_R: 0 }
          : mode === 'row_R' ? { sit: 0, row: 0, row_L: 0, row_R: 1 }
          : { sit: 1, row: 0, row_L: 0, row_R: 0 };
        for (const n of ROWS) {
          if (!actions[n]) continue;
          rowW[n] += (want[n] - rowW[n]) * Math.min(1, dt * 7);
          actions[n].setEffectiveWeight(rowW[n]);
          if (n !== 'sit') actions[n].time = boat.phi * STROKE_T;
        }
        if (!fishing && fishAct) stopFishing();
        mixer.update(dt);
        // 竿身依張力往前下方彎
        if (bend > 0.001) for (const [i, n] of ['rod_1', 'rod_2', 'rod_3'].entries()) if (bones[n]) bones[n].rotateX(bend * (0.18 + i * 0.12));
      }
      if (rodStowed) rodStowed.visible = !fishing;
      // 轉身
      const dy = Math.atan2(Math.sin(pivotTarget - pivotYaw), Math.cos(pivotTarget - pivotYaw));
      pivotYaw += dy * Math.min(1, dt * 5);
      pivot.rotation.y = pivotYaw;
      // 魚簍蓋：放魚時打開一下
      if (lid) { lidT = Math.max(0, lidT - dt); lidOpen += ((lidT > 0 ? 1 : 0) - lidOpen) * Math.min(1, dt * 8); lid.rotation.x = -lidOpen * 1.6; }
      // 提燈
      const on = api.hasLantern ? duskLight : 0;
      for (const m of lampMats) m.emissiveIntensity = on * 2.2;
      lampLight.intensity = on * 5;
    },
  };
  return api;
}
