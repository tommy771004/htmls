// 場景佈置：木屋、碼頭、石拱橋、燈樁、松林、岩石、峽谷崖壁、蘆葦、睡蓮、沉木與漂流木。
// 大量物件用 InstancedMesh；靠近鏡頭與船之間的樹會以抖動透明挖空（不擋住船）。
import * as THREE from 'three';
import { SAMPLES, N, along, nearest, zoneAt, CHECKPOINTS, SPOTS, DOCK, CABIN, BRIDGE_U, BOULDERS, FALLS } from '../core/map.js';
import { mulberry, fbm, vnoise } from '../core/rng.js';
import { staticObject, instGeo, VC_MAT } from './assets.js';
import { patchUnderwater } from './shared.js';
import * as PH from './placeholders.js';

export const CUT = { uCutA: { value: new THREE.Vector3() }, uCutB: { value: new THREE.Vector3() } };

// 鏡頭到船之間的圓柱內，以螢幕抖動挖空（樹、崖壁、木屋共用）
export function patchCutaway(mat, radius = 3.2) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, CUT);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldC;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldC = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#ifdef USE_INSTANCING\nvWorldC = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#endif');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldC; uniform vec3 uCutA; uniform vec3 uCutB;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        { vec3 ab = uCutB - uCutA; float t = clamp(dot(vWorldC - uCutA, ab) / dot(ab, ab), 0.0, 1.0);
          float d = length(vWorldC - (uCutA + ab * t));
          float k = smoothstep(${radius.toFixed(2)}, ${(radius * 0.55).toFixed(2)}, d) * step(0.02, t) * step(t, 0.97);
          float dither = fract(dot(floor(gl_FragCoord.xy), vec2(0.5, 0.25)) + fract(gl_FragCoord.y * 0.5) * 0.5);
          if (k > 0.0 && dither < k * 0.92) discard; }`);
  };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  mat.customProgramCacheKey = () => key + '|cut' + radius;
  return mat;
}

function instanced(geo, list, { shadow = true, mat = null, cut = false, under = false } = {}) {
  const m = mat || VC_MAT();
  if (under) patchUnderwater(m, 0.15, 0.8);
  if (cut) patchCutaway(m);
  const im = new THREE.InstancedMesh(geo, m, Math.max(1, list.length));
  const o = new THREE.Object3D();
  list.forEach((p, i) => {
    o.position.set(p.x, p.y || 0, p.z);
    o.rotation.set(p.rx || 0, p.yaw || 0, p.rz || 0);
    o.scale.setScalar(p.s || 1);
    if (p.sy) o.scale.y = p.sy;
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  });
  im.count = list.length;
  im.castShadow = shadow; im.receiveShadow = true;
  im.computeBoundingSphere();
  return im;
}

export function buildScatter(scene, grid) {
  const rnd = mulberry(26901);
  const out = { obstacles: [], buoys: [], cabin: null, dock: null, bridge: null, lights: [] };
  const clearPts = [{ x: CABIN.x, z: CABIN.z, r: 13 }, { x: DOCK.x, z: DOCK.z, r: 8 }];
  const isClear = (x, z, pad = 0) => clearPts.every((c) => Math.hypot(c.x - x, c.z - z) > c.r + pad);
  const slopeAt = (x, z) => Math.hypot(grid.sample(x + 1, z) - grid.sample(x - 1, z), grid.sample(x, z + 1) - grid.sample(x, z - 1)) / 2;

  // ---------- 木屋、碼頭 ----------
  const cabin = staticObject('env', 'cabin', PH.cabin);
  cabin.position.set(CABIN.x, grid.sample(CABIN.x, CABIN.z) - 0.05, CABIN.z);
  cabin.rotation.y = CABIN.yaw;
  scene.add(cabin); out.cabin = cabin;
  cabin.traverse((o) => { if (o.isMesh && !o.userData.special) patchCutaway(o.material, 4); });
  const dock = staticObject('env', 'dock', PH.dock, ['bollard']);
  dock.position.set(DOCK.x, 0, DOCK.z);
  dock.rotation.y = DOCK.yaw;
  scene.add(dock); out.dock = dock;
  // 碼頭的碰撞：沿著棧橋一串圓
  dock.updateMatrixWorld(true);
  const db = new THREE.Box3().setFromObject(dock);
  for (let z = db.max.z - 0.6; z > db.min.z + 0.4; z -= 1.1) out.obstacles.push({ x: (db.min.x + db.max.x) / 2, z, r: Math.min(1.4, (db.max.x - db.min.x) / 2 - 0.1), kind: 'dock' });
  // 碼頭盡頭 T 形平台兩翼
  out.obstacles.push({ x: db.min.x + 0.9, z: db.min.z + 1, r: 1.0, kind: 'dock' }, { x: db.max.x - 0.9, z: db.min.z + 1, r: 1.0, kind: 'dock' });
  // 木屋窗戶與碼頭燈（黃昏點亮）
  const winL = new THREE.PointLight(0xffb866, 0, 16, 1.6);
  winL.position.set(CABIN.x, 2.2, CABIN.z - 4); scene.add(winL); out.lights.push({ light: winL, max: 9 });

  // ---------- 石拱橋 ----------
  const bp = along(BRIDGE_U, 0);
  const bridge = staticObject('env', 'bridge', PH.bridge);
  bridge.position.set(bp.x, 0, bp.z);
  bridge.rotation.y = bp.yaw;
  scene.add(bridge); out.bridge = bridge;
  bridge.traverse((o) => { if (o.isMesh) patchCutaway(o.material, 3.5); });
  const nX = Math.cos(bp.yaw), nZ = -Math.sin(bp.yaw);     // 橋的 X 軸（橫跨河道）
  for (const s of [-1, 1]) out.obstacles.push({ x: bp.x + nX * 5.7 * s, z: bp.z + nZ * 5.7 * s, r: 1.15, kind: 'pier' });

  // ---------- 燈樁 ----------
  for (const cp of CHECKPOINTS) {
    if (cp.k === 0) continue;
    const b = staticObject('env', 'buoy', PH.buoy, ['buoy_flag']);
    b.position.set(cp.x, 0, cp.z);
    b.rotation.y = rnd() * 6.28;
    scene.add(b);
    const light = new THREE.PointLight(0xffc46b, 0, 14, 1.8);
    light.position.set(cp.x, 2.6, cp.z);
    scene.add(light);
    out.buoys.push({ cp, obj: b, flag: b.getObjectByName('buoy_flag'), lamp: b.getObjectByName('lamp_glow'), light, lit: 0 });
    out.obstacles.push({ x: cp.x, z: cp.z, r: 0.55, kind: 'buoy' });
  }
  // 碼頭的燈樁（第 0 座）：立在棧橋盡頭
  {
    const b = staticObject('env', 'buoy', PH.buoy, ['buoy_flag']);
    b.position.set(db.max.x - 0.25, 0.0, db.min.z + 0.3);
    b.scale.setScalar(0.9);
    scene.add(b);
    const light = new THREE.PointLight(0xffc46b, 0, 14, 1.8);
    light.position.set(b.position.x, 2.4, b.position.z); scene.add(light);
    out.buoys.unshift({ cp: CHECKPOINTS[0], obj: b, flag: b.getObjectByName('buoy_flag'), lamp: b.getObjectByName('lamp_glow'), light, lit: 0 });
  }

  // ---------- 松林 ----------
  const pines = { pine_tall: [], pine_short: [], pine_dense: [] }, stumps = [], bankRocks = [], drift = [];
  const DENS = [0, 0.16, 0.3, 0.8, 0.32, 0.5];
  for (let z = -790; z < 108; z += 4.2) for (let x = -178; x < 178; x += 4.2) {
    const px = x + (rnd() - 0.5) * 3.6, pz = z + (rnd() - 0.5) * 3.6;
    const h = grid.sample(px, pz);
    if (h < 0.55 || !isClear(px, pz, 2)) continue;
    const n = nearest(px, pz);
    if (n.d < n.w + 2.5) continue;
    const zone = zoneAt(px, pz);
    const sl = slopeAt(px, pz);
    if (sl > 1.1) continue;
    let d = DENS[zone] * (0.35 + fbm(px * 0.02, pz * 0.02, 3) * 1.3);
    if (zone === 1) d *= THREE.MathUtils.smoothstep(n.d - n.w, 6, 30);   // 碼頭灣邊留草地
    if (rnd() > d) {
      if (zone >= 3 && rnd() < 0.012) stumps.push({ x: px, y: h - 0.05, z: pz, yaw: rnd() * 6.28, s: 0.8 + rnd() * 0.5 });
      continue;
    }
    const r = rnd();
    const kind = zone === 3 ? (r < 0.45 ? 'pine_tall' : r < 0.8 ? 'pine_dense' : 'pine_short') : zone === 4 ? (r < 0.6 ? 'pine_short' : 'pine_dense') : (r < 0.35 ? 'pine_tall' : r < 0.65 ? 'pine_short' : 'pine_dense');
    pines[kind].push({ x: px, y: h - 0.15, z: pz, yaw: rnd() * 6.28, s: 0.75 + rnd() * 0.5 });
  }
  for (const [k, list] of Object.entries(pines)) {
    const geo = instGeo('env', k, () => PH.pine(k));
    scene.add(instanced(geo, list, { cut: true }));
  }
  if (stumps.length) scene.add(instanced(instGeo('env', 'stump', PH.stump), stumps));

  // ---------- 岩石：河中巨石、岸邊散石 ----------
  const boulderGeo = instGeo('env', 'boulder', PH.boulder);
  boulderGeo.computeBoundingBox();
  const bs = boulderGeo.boundingBox.getSize(new THREE.Vector3());
  scene.add(instanced(boulderGeo, BOULDERS.map((b) => { const sc = (b.r * 2.1) / Math.max(bs.x, bs.z); return { x: b.x, y: b.h - bs.y * sc, z: b.z, yaw: b.rot, s: sc }; })));
  for (const b of BOULDERS) out.obstacles.push({ x: b.x, z: b.z, r: b.r, kind: 'rock' });
  for (let i = 0; i < N; i += 5) {
    const zone = zoneAt(SAMPLES.x[i], SAMPLES.z[i]);
    const p = zone >= 4 ? 0.7 : zone === 3 ? 0.3 : 0.12;
    for (const side of [-1, 1]) {
      if (rnd() > p) continue;
      const off = side * (1.02 + rnd() * 0.35);
      const w = SAMPLES.w[i];
      const x = SAMPLES.x[i] - SAMPLES.tz[i] * off * w, z = SAMPLES.z[i] + SAMPLES.tx[i] * off * w;
      if (!isClear(x, z, 1)) continue;
      const kind = rnd() < 0.25 ? 'rock_L' : rnd() < 0.6 ? 'rock_M' : 'rock_S';
      bankRocks.push({ kind, x, y: grid.sample(x, z) - 0.25, z, yaw: rnd() * 6.28, s: 0.7 + rnd() * 0.7 });
    }
  }
  for (const k of ['rock_L', 'rock_M', 'rock_S']) {
    const list = bankRocks.filter((r) => r.kind === k);
    if (list.length) scene.add(instanced(instGeo('env', k, () => PH.rock(k)), list));
  }

  // ---------- 峽谷崖壁與瀑布後方崖 ----------
  const cliffs = [];
  for (let i = 0; i < N; i += 9) {
    const u = SAMPLES.u[i];
    if (u < 11.7 || u > 18.2) continue;
    for (const side of [-1, 1]) {
      if (u > 15.7 && rnd() < 0.45) continue;
      const w = SAMPLES.w[i], off = side * (w + 3.5 + rnd() * 2.5);
      const x = SAMPLES.x[i] - SAMPLES.tz[i] * off, z = SAMPLES.z[i] + SAMPLES.tx[i] * off;
      // 面朝河心
      const yaw = Math.atan2(SAMPLES.x[i] - x, SAMPLES.z[i] - z);
      cliffs.push({ x, y: grid.sample(x, z) - 3.5, z, yaw, s: 0.9 + rnd() * 0.5 });
    }
  }
  for (const dx of [-15, -5, 6, 16]) cliffs.push({ x: FALLS.x + dx + (rnd() - 0.5) * 3, y: -1, z: FALLS.z - 3 - rnd() * 2, yaw: (rnd() - 0.5) * 0.4, s: 1.5 + rnd() * 0.3 });
  if (cliffs.length) scene.add(instanced(instGeo('env', 'cliff', PH.cliff), cliffs, { cut: true }));

  // ---------- 蘆葦、睡蓮 ----------
  const reeds = [], lilies = [];
  const spotClear = (x, z, r) => SPOTS.every((s) => Math.hypot(s.x - x, s.z - z) > r);
  for (let z = -440; z < 70; z += 1.6) for (let x = -60; x < 70; x += 1.6) {
    const px = x + (rnd() - 0.5) * 1.4, pz = z + (rnd() - 0.5) * 1.4;
    const h = grid.sample(px, pz);
    const zone = zoneAt(px, pz);
    if (zone > 3) continue;
    if (h > -0.75 && h < 0.3 && isClear(px, pz, 2) && spotClear(px, pz, 3)) {
      const n = vnoise(px * 0.12, pz * 0.12);
      if (rnd() < (zone === 1 ? 0.55 : 0.18) * THREE.MathUtils.smoothstep(n, 0.35, 0.65)) reeds.push({ x: px, y: Math.min(0, h) - 0.05, z: pz, yaw: rnd() * 6.28, s: 0.7 + rnd() * 0.6 });
    }
    if (zone === 1 && h > -1.9 && h < -0.45 && spotClear(px, pz, 3.5) && Math.hypot(px - DOCK.x, pz - DOCK.z + 7) > 9) {
      const n = vnoise(px * 0.08 + 9, pz * 0.08);
      if (rnd() < 0.5 * THREE.MathUtils.smoothstep(n, 0.55, 0.75)) lilies.push({ x: px, y: 0.02, z: pz, yaw: rnd() * 6.28, s: 0.7 + rnd() * 0.8 });
    }
  }
  if (reeds.length) scene.add(instanced(instGeo('env', 'reeds', PH.reeds), reeds, { shadow: false }));
  if (lilies.length) scene.add(instanced(instGeo('env', 'lily', PH.lily), lilies, { shadow: false }));

  // ---------- 沉木（水底）與漂流木（岸邊） ----------
  const logs = [];
  for (let i = 0; i < N; i += 11) {
    const u = SAMPLES.u[i];
    if (u < 7.9 || u > 11.4) continue;
    if (rnd() < 0.35) continue;
    const off = (rnd() - 0.5) * 1.3, w = SAMPLES.w[i];
    const x = SAMPLES.x[i] - SAMPLES.tz[i] * off * w, z = SAMPLES.z[i] + SAMPLES.tx[i] * off * w;
    const h = grid.sample(x, z);
    if (h > -1.6 || !spotClear(x, z, 2.5)) continue;
    logs.push({ x, y: h + 0.2, z, yaw: rnd() * 6.28, s: 0.8 + rnd() * 0.4, rz: (rnd() - 0.5) * 0.2 });
  }
  if (logs.length) scene.add(instanced(instGeo('env', 'log_sunken', PH.log), logs, { under: true, shadow: false }));
  for (let i = 0; i < N; i += 13) {
    const u = SAMPLES.u[i];
    if (u < 7.5 || u > 15.5 || rnd() < 0.6) continue;
    const side = rnd() < 0.5 ? -1 : 1, w = SAMPLES.w[i], off = side * (w + 1 + rnd() * 2);
    const x = SAMPLES.x[i] - SAMPLES.tz[i] * off, z = SAMPLES.z[i] + SAMPLES.tx[i] * off;
    drift.push({ x, y: grid.sample(x, z) + 0.05, z, yaw: rnd() * 6.28, s: 0.8 + rnd() * 0.5 });
  }
  if (drift.length) scene.add(instanced(instGeo('env', 'log_drift', PH.logDrift), drift));
  return out;
}
