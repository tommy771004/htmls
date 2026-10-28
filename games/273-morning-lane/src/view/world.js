// 街景：照 street.js 的配置擺 Blender 匯出的模型（房子、樹、灌木、柵欄、信箱、路燈、電線桿……），
// 同一種模型的每個零件合成一個 InstancedMesh。地面（柏油、路緣、草帶、人行道、草坪）在這裡用 shader 畫斑駁。
import * as THREE from 'three';
import { STREET } from '../core/config.js';
import { BASE, GATE } from '../core/street.js';
import { Kit } from './kit.js';
import { material, painted } from './assets.js';
import { NOISE } from './glsl.js';

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const mk = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) =>
  new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));

// 晚上的窗：同一份窗玻璃，依「哪一棟（實例位置）× 第幾層」雜湊決定亮不亮（約 65%，同 Blender 的 dusk 窗），亮的加暖色自發光
function litGlass(base, amount) {
  const m = base.clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLit = { value: amount };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vLit;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wq = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        vec3 ip = (modelMatrix * instanceMatrix[3]).xyz;
        vLit = step(fract(sin(dot(vec2(ip.x * 0.37 + ip.z * 0.131, floor(wq.y / 2.8)), vec2(12.9898, 78.233))) * 43758.5453), 0.65);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLit;\nuniform float uLit;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.72, 0.38) * 2.4 * uLit * vLit;');
  };
  m.customProgramCacheKey = () => 'litGlass';
  m.name = 'glassLit';
  return m;
}

/** 地面材質：頂點色當底色，兩層世界座標雜訊做大塊斑駁；草坪加割草條紋、人行道加接縫、柏油加補丁 */
function groundMat(kind) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWP;\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 P = vec3(vWP.x, 0.0, vWP.z);
        float n = fbm(P * ${kind === 'lawn' ? '0.35' : '0.6'}, 6, 0.6) + 0.3 * fbm(P * 9.0, 4, 0.5) - 0.15;
        diffuseColor.rgb *= mix(0.80, 1.16, smoothstep(0.3, 0.72, n));
        ${kind === 'lawn' ? 'diffuseColor.rgb *= 1.0 + 0.07 * (step(0.5, fract(vWP.z / 2.4)) - 0.5);' : ''}
        ${kind === 'walk' ? 'float j = abs(fract(vWP.z / 1.5 + 0.5) - 0.5) * 1.5; diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(0.01, 0.03, j));' : ''}
        ${kind === 'road' ? `float pt = smoothstep(0.62, 0.66, fbm(P * 0.18 + 3.0, 3, 0.5)); diffuseColor.rgb *= 1.0 - pt * 0.16;
          float ck = smoothstep(0.012, 0.0, abs(fbm(P * 0.7 + 9.0, 4, 0.55) - 0.5)) * smoothstep(0.6, 0.7, fbm(P * 0.25, 2, 0.5)); diffuseColor.rgb *= 1.0 - ck * 0.45;` : ''}`);
  };
  m.customProgramCacheKey = () => 'ground-' + kind;
  return m;
}

/** look：stage.js 的 LOOKS[時段]；look.lights > 0 時窗戶亮燈、路燈發光，並配 nLights 盞跟著騎士挪的點光源 */
export function buildWorld(scene, street, A, look = { lights: 0 }, nLights = 6, low = false) {
  const meshes = [];
  const add = (m) => { if (m) { scene.add(m); meshes.push(m); } return m; };
  const L = street.length;
  const placed = new Map();
  // 手機畫質：花圃與草叢不擺（約佔全街 8% 的三角形）
  const skip = low ? new Set(['flowerBed', 'tufts', 'tuftsLine']) : new Set();
  const put = (name, M) => { if (!A[name] || skip.has(name)) return; if (!placed.has(name)) placed.set(name, []); placed.get(name).push(M); };

  // ---------- 地面 ----------
  const z0 = 40, z1 = -L - 80, len = z0 - z1, zc = (z0 + z1) / 2;
  const kits = { road: new Kit(), curb: new Kit(), strip: new Kit(), walk: new Kit(), lawn: new Kit() };
  for (const k of Object.values(kits)) k.jitter = 0;
  kits.road.box(0, -0.05, zc, STREET.roadHalf * 2, 0.1, len, '#55585e');
  for (let z = 30; z > -L - 60; z -= 9) kits.road.box(0, 0.002, z, 0.13, 0.004, 3, '#e9c75a');
  for (const s of [-1, 1]) {
    kits.curb.box(s * (STREET.roadHalf + 0.08), 0.075, zc, 0.16, 0.15, len, '#c4bdad');
    kits.road.box(s * (STREET.roadHalf - 0.2), 0.002, zc, 0.4, 0.004, len, '#6a6b6c');          // 排水溝
    kits.strip.box(s * ((STREET.roadHalf + 0.16 + STREET.stripOut) / 2), 0.07, zc, STREET.stripOut - STREET.roadHalf - 0.16, 0.14, len, '#5d9c39');
    kits.walk.box(s * ((STREET.stripOut + STREET.walkOut) / 2), 0.08, zc, STREET.walkOut - STREET.stripOut, 0.16, len, '#cfc8b8');
    kits.lawn.box(s * (STREET.walkOut + 70), 0.06, zc, 140, 0.12, len, '#62a03c');
  }
  // 人孔蓋、雨水格柵
  for (let z = -40; z > -L; z -= 57) kits.road.cyl(0.9, 0.003, z, 0.36, 0.006, '#46484c', 16);
  for (let z = -18; z > -L; z -= 24) for (const s of [-1, 1]) kits.road.box(s * (STREET.roadHalf - 0.22), 0.004, z + s * 6, 0.36, 0.006, 0.8, '#3c3d40');
  for (const [k, m] of Object.entries(kits)) { const g = m.build(groundMat(k), { shadow: false }); add(g); }
  // 遠方的草地、林帶與丘陵（霧會吃掉一半）
  const far = new Kit(); far.seed = 3;
  far.box(0, -0.2, -L / 2, 1400, 0.2, L + 1400, '#4f8a31');
  for (let i = 0; i < 70; i++) {
    const s = i % 2 ? 1 : -1, z = 60 - (i / 2) * ((L + 260) / 35);
    far.ico(s * (48 + far.rnd() * 26), 3 + far.rnd() * 3, z, 6 + far.rnd() * 4, ['#3f6e3c', '#46793f', '#3a6638'][i % 3], 1.0);
  }
  for (let i = 0; i < 16; i++) far.ico(-260 + i * 34 + far.rnd() * 10, -18, -L - 240 - far.rnd() * 120, 60 + far.rnd() * 40, ['#557a5a', '#5f7f6a', '#5b7690'][i % 3], 0.5, 2);
  add(far.build(material('paint_b0.35_r1.00'), { shadow: false }));

  // ---------- 每塊地 ----------
  const stones = new Kit(); stones.seed = 11;
  const R = (() => { let a = street.seed * 7 + 3; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
  for (const l of street.lots) {
    const s = l.side, ry = s > 0 ? 0 : Math.PI, F = STREET.houseFront;
    put('house' + l.variant, mk(s * F, BASE, l.z, ry));
    // 柵欄：木樁每 15 cm、柱子每 2.4 m、兩道橫木；門口留開口，門板往院子裡打開
    const fx = s * STREET.fence, fz0 = l.z - 8 + 0.1, fz1 = l.z + 8 - 0.1;
    for (let z = fz0; z <= fz1; z += 0.15) if (Math.abs(z - l.doorZ) > GATE) put('picket', mk(fx, BASE, z, ry));
    for (let z = fz0; z <= fz1 + 0.01; z += 2.4) put('post', mk(fx + s * 0.06, BASE, z));
    for (const z of [l.gate[0] - 0.05, l.gate[1] + 0.05]) put('post', mk(fx + s * 0.06, BASE, z));
    for (const y of [0.3, 0.78]) for (const [a, b] of [[fz0, l.gate[0]], [l.gate[1], fz1]]) put('rail', mk(fx + s * 0.035, BASE + y, (a + b) / 2, 0, 1, 1, b - a));
    const open = 0.6 + R() * 0.7, hinge = l.gate[0];
    for (let k = 0; k < 7; k++) { const u = 0.08 + k * 0.15; put('picket', mk(fx + s * Math.sin(open) * u, BASE, hinge + Math.cos(open) * u, ry + s * open)); }
    // 步道石板：柵欄門 → 前廊台階
    for (let x = STREET.fence + 0.25; x < F - 3.0; x += 0.7) stones.box(s * x, BASE + 0.02, l.doorZ + (R() - 0.5) * 0.24, 0.5 + R() * 0.12, 0.05, 0.75 + R() * 0.2, '#9d978a', R() * 0.4 - 0.2);
    // 房子正面兩側：花圃＋灌木
    for (const e of [-1, 1]) {
      const za = l.doorZ + e * 2.1, zb = l.z + e * (l.w / 2 - 0.4);
      if ((zb - za) * e < 1.0) continue;
      const mid = (za + zb) / 2, span = Math.abs(zb - za);
      put('flowerBed', mk(s * (F - 0.6), BASE, mid, 0, 1, 1, span / 2.4));
      for (let k = 0; k < Math.floor(span / 1.4); k++) put('bush' + ((l.id + k) % 3), mk(s * (F - 0.6), BASE, Math.min(za, zb) + 0.7 + k * 1.4, R() * 6));
    }
    // 草：柵欄內側一排、院子散落、植栽帶
    for (let z = fz0 + 1.5; z < fz1; z += 3) put('tuftsLine', mk(s * (STREET.fence + 0.18), BASE, z, R() < 0.5 ? 0 : Math.PI));
    for (let k = 0; k < 3; k++) put('tufts', mk(s * (STREET.fence + 1 + R() * (F - STREET.fence - 3)), BASE, l.z + (R() - 0.5) * 14, R() * 6));
    for (let k = 0; k < 2; k++) put('tufts', mk(s * (STREET.roadHalf + 0.7 + R() * 0.6), 0.14, l.z + (R() - 0.5) * 14, R() * 6, 0.45, 1, 1));
    if (l.id % 3 === 1) put('treeYard', mk(s * (F + l.depth + 3.5), BASE, l.z + (R() - 0.5) * 6, R() * 6));
    put(l.vip ? 'mailboxVip' : l.sub ? 'mailboxSub' : 'mailboxNo', mk(l.mailbox.x, 0.14, l.mailbox.z, ry));
  }
  add(stones.build(material('paint_b0.30_r0.90')));

  // ---------- 障礙物與街道家具 ----------
  const poles = [];
  let ti = 0;
  for (const o of street.obstacles) {
    if (o.kind === 'tree') put('tree' + (ti++ % 3), mk(o.x, 0.14, o.z, R() * 6));
    else if (o.kind === 'lamp') put('lamp', mk(o.x, 0.14, o.z));
    else if (o.kind === 'pole') { put('pole', mk(o.x, 0.14, o.z)); poles.push(o); }
    else if (o.kind === 'hydrant') put('hydrant', mk(o.x, 0.14, o.z, R() * 6));
    else if (o.kind === 'bin') put('bin', mk(o.x, 0, o.z, (R() - 0.5) * 0.6 + (o.x > 0 ? Math.PI / 2 : -Math.PI / 2)));
    else if (o.kind === 'car') put('carRed', mk(o.x, 0, o.z, 0));
  }
  for (const r of street.ramps) put('ramp', mk(r.x, 0, r.z, 0));       // 低的一端朝騎士（+z）
  put('car', mk(STREET.houseFront - 2.0, 0, street.lots.find((l) => l.side > 0 && l.i === 3)?.z ?? -90, Math.PI / 2 + 0.05));
  // 電線：每兩根桿子之間四條，中間下垂 0.9 m
  const wires = new Kit(); wires.jitter = 0;
  for (let k = 0; k + 1 < poles.length; k++) {
    const a = poles[k], b = poles[k + 1];
    for (const [dx, y] of [[-0.95, 8.76], [0, 8.76], [0.95, 8.76], [-0.6, 7.8]]) {
      let prev = null;
      for (let j = 0; j <= 12; j++) {
        const t = j / 12, p = new THREE.Vector3(a.x + dx, y - 0.9 * 4 * t * (1 - t), a.z + (b.z - a.z) * t);
        if (prev) { const d = p.clone().sub(prev); wires.box((p.x + prev.x) / 2, (p.y + prev.y) / 2, (p.z + prev.z) / 2, 0.022, 0.022, d.length(), '#2a2a2c', 0, 0, Math.atan2(-d.y, d.z)); }
        prev = p;
      }
    }
  }
  add(wires.build(material('paint_b0.00_r0.60'), { shadow: false }));
  // 終點：路上方一條橫幅
  const fin = new Kit(); const fz = street.finishZ;
  for (const s of [-1, 1]) fin.cyl(s * 4.0, 2.5, fz, 0.07, 5.0, '#f6f2e8', 10);
  fin.box(0, 4.5, fz, 8.0, 0.8, 0.05, '#d8402c');
  add(fin.build(material('paint_b0.10_r0.70')));

  // ---------- 實例化 ----------
  const inst = [];
  const night = look.lights > 0;
  const glassLit = night ? litGlass(material('glass'), look.lights) : null;
  const lampGlow = night ? new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(4.2, 2.7, 1.4), fog: true }) : null;
  // 房子另外用遠景版各建一份（同樣的實例清單），cull() 依距離分給近景／遠景
  const sets = [...placed].flatMap(([name, list]) => [[name, list, name, 'all'], ...(A['lod:' + name] ? [[name, list, 'lod:' + name, 'far']] : [])])
    .map(([name, list, src, band]) => [name, list, src, A['lod:' + name] && band === 'all' ? 'near' : band]);
  for (const [name, list, src, band] of sets) {
    A[src].parts.forEach((part, pi) => {
      let mat = part.material;
      if (night && name.startsWith('house') && part.tag === 'glass') mat = glassLit;
      if (night && name === 'lamp' && pi === 0) mat = lampGlow;            // 燈罩（零件 0，y≈3.95）
      const im = new THREE.InstancedMesh(part.geometry, mat, list.length);
      // 全部實例照 z 存一份，視窗裝填時從這裡挑（見 cull）
      const all = list.map((P) => ({ z: P.elements[14], m: new THREE.Matrix4().multiplyMatrices(P, part.matrix) }));
      all.forEach((o, i) => im.setMatrixAt(i, o.m));
      im.userData.all = all; im.userData.band = band; inst.push(im);
      im.castShadow = part.tag !== 'grass'; im.receiveShadow = true;
      im.computeBoundingSphere();
      add(im);
    });
  }
  // 路燈的光：只開幾盞真的點光源，每幀挪到騎士附近最近的路燈（其他路燈只有燈罩發光）
  const lamps = street.obstacles.filter((o) => o.kind === 'lamp');
  const pool = night ? Array.from({ length: nLights }, () => add(new THREE.PointLight('#ffc27a', 0, 15, 1.6))) : [];
  // 視窗裝填：只畫騎士後方 30 m 到前方 ahead m 之間的實例（騎過的、霧外的都不送進 GPU），每前進 8 m 重排一次
  const ahead = low ? 150 : 270, NEAR = 70;     // 房子：前方 70 m 內用近景版，再遠用遠景版
  let culledAt = Infinity;
  function cull(z) {
    culledAt = z;
    for (const im of inst) {
      let n = 0;
      const band = im.userData.band, lo = band === 'near' ? z - NEAR : z - ahead, hi = band === 'far' ? z - NEAR : z + 30;
      for (const o of im.userData.all) if (o.z < hi && o.z > lo) im.setMatrixAt(n++, o.m);
      im.count = n; im.instanceMatrix.needsUpdate = true;
      im.visible = n > 0;
      if (n) im.computeBoundingSphere();
    }
  }
  function update(bike) {
    if (Math.abs(bike.z - culledAt) > 8) cull(bike.z);
    if (!pool.length) return;
    const near = lamps.filter((o) => o.z < bike.z + 12 && o.z > bike.z - 60).sort((a, b) => Math.abs(a.z - bike.z + 14) - Math.abs(b.z - bike.z + 14));
    pool.forEach((L, i) => {
      const o = near[i];
      if (!o) { L.intensity = 0; return; }
      L.position.set(o.x * 0.92, 3.8, o.z); L.intensity = 26 * look.lights;
    });
  }
  return { meshes, update, counts: Object.fromEntries([...placed].map(([k, v]) => [k, v.length])) };
}
export { painted };
