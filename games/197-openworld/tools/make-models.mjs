// 產生 assets/197/models/*.glb（船、床、刀、槍、手）。全部用程式建模，沒有外部美術資產。
// 之後要換成正式資產時，直接用同檔名覆蓋 GLB 即可，尺寸與擺放由 src/game/assets.js 的 manifest 控制。
// 各模型刻意用不同單位建模（公分、公釐…），用來驗證載入時的自動縮放。
//
//   npm run models

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// GLTFExporter 輸出 binary 時需要瀏覽器的 FileReader
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onloadend?.();
    });
  }
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 素材放在網站的 assets/197/（網頁版從 ../assets/197/ 讀取）
const PUBLIC = '../../assets/197';
const outDir = path.join(root, PUBLIC, 'models');
fs.mkdirSync(outDir, { recursive: true });

const mat = (color, roughness = 0.8, metalness = 0, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

/** 兩點之間的膠囊（手指、肋材這類圓條都用它） */
function capsuleBetween(a, b, radius, material, seg = 8) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, len, 4, seg), material);
  m.position.copy(va).lerp(vb, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize());
  return m;
}

/**
 * 把側面輪廓（x = 前方、y = 上方）擠出成有倒角的實體。
 * 擠出方向轉成模型的 X（左右），輪廓的 +x 轉成模型的 -Z（前方）。
 */
function extrudeProfile(points, depth, bevel, holes = []) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.translate(0, 0, -(depth - bevel * 2) / 2);
  geo.rotateY(Math.PI / 2);
  return geo;
}

// ---- 船：前方為 -Z，單位公分 ----
function makeBoat() {
  const g = new THREE.Group();
  g.name = 'boat';
  const L = 420;
  const W = 75;
  const H = 52;
  const hullMat = mat(0x8a5a33, 0.85, 0, { side: THREE.DoubleSide });
  const dark = mat(0x5b3b22, 0.9);
  const light = mat(0xa9794a, 0.8);
  const iron = mat(0x3a3c40, 0.6, 0.3);

  const stations = 15;
  const section = (t) => {
    const taper = Math.pow(Math.sin(Math.min(t / 0.6, 1) * Math.PI * 0.5), 0.7);
    const w = W * Math.max(taper * (t > 0.6 ? 1 - 0.22 * ((t - 0.6) / 0.4) : 1), 0.03);
    const keel = t < 0.35 ? H * 0.55 * Math.pow(1 - t / 0.35, 2) : 0;
    const top = H * (1 + 0.28 * Math.pow(1 - t, 2));
    // 七個點的圓舭斷面，比原本五個點圓滑
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI; // 0 = 左舷緣, π = 右舷緣
      const x = -Math.cos(a) * w;
      const k = Math.pow(Math.sin(a), 0.55);
      pts.push([x * (0.62 + 0.38 * (1 - k)), top - (top - keel) * k]);
    }
    pts[0][0] = -w;
    pts[6][0] = w;
    return pts;
  };
  const pos = [];
  const ring = [];
  for (let i = 0; i < stations; i++) {
    const t = i / (stations - 1);
    const z = -L / 2 + t * L;
    const pts = section(t);
    ring.push(pts.map(([x, y]) => new THREE.Vector3(x, y, z)));
    for (const [x, y] of pts) pos.push(x, y, z);
  }
  const idx = [];
  const n = 7;
  for (let i = 0; i < stations - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j;
      idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
    }
  }
  const last = (stations - 1) * n; // 船尾板
  for (let j = 1; j < n - 1; j++) idx.push(last, last + j, last + j + 1);
  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  hullGeo.setIndex(idx);
  hullGeo.computeVertexNormals();
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.name = 'hull';
  g.add(hull);

  // 舷緣：沿著船殼上緣的一圈圓木條
  for (const side of [0, n - 1]) {
    const curve = new THREE.CatmullRomCurve3(ring.map((r) => r[side].clone()));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 2.6, 6), dark));
  }
  // 龍骨與船首柱
  const keelCurve = new THREE.CatmullRomCurve3(ring.map((r) => r[3].clone().add(new THREE.Vector3(0, -1.5, 0))));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(keelCurve, 40, 2.2, 5), dark));
  // 肋材：每隔一個斷面貼著船殼內側一圈
  for (let i = 3; i < stations - 1; i += 2) {
    const curve = new THREE.CatmullRomCurve3(ring[i].map((p) => p.clone().multiply(new THREE.Vector3(0.97, 1, 1)).add(new THREE.Vector3(0, 1.2, 0))));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 1.5, 5), light));
  }
  g.add(box(W * 1.72, 4, 26, light, 0, H * 0.62, 20)); // 划槳座
  g.add(box(W * 1.46, 4, 26, light, 0, H * 0.62, 125)); // 後座
  g.add(box(W * 1.0, 4, 22, light, 0, H * 0.74, -105)); // 前座
  for (const x of [-22, 0, 22]) g.add(box(18, 2.5, L * 0.58, light, x, 7, 40)); // 底板條
  for (const sx of [-1, 1]) {
    // 槳架
    const lock = new THREE.Mesh(new THREE.TorusGeometry(4, 1, 5, 10, Math.PI), iron);
    lock.position.set(sx * W * 0.98, H * 1.08, 20);
    g.add(lock);
  }
  const cleat = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 12, 6), iron);
  cleat.rotation.z = Math.PI / 2;
  cleat.position.set(0, H * 1.2, -L / 2 + 22);
  g.add(cleat);
  return g;
}

// ---- 床：床頭在 -Z，單位為 2.5 倍公尺（故意不對） ----
function makeBed() {
  const g = new THREE.Group();
  g.name = 'bed';
  const k = 2.5;
  const wood = mat(0x6b4a2f, 0.85);
  const woodDark = mat(0x4f3622, 0.9);
  const sheet = mat(0xe7e2d6, 0.95);
  const blanket = mat(0x7a2f2f, 0.95);
  const stripe = mat(0xd8c9a0, 0.95);
  // 床架：兩根長邊、床板條、四支腳
  for (const sx of [-1, 1]) g.add(box(0.06 * k, 0.14 * k, 2.0 * k, wood, sx * 0.47 * k, 0.3 * k, 0));
  for (let i = -4; i <= 4; i++) g.add(box(0.9 * k, 0.025 * k, 0.12 * k, woodDark, 0, 0.33 * k, i * 0.21 * k));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * k, 0.045 * k, 0.3 * k, 8), wood);
      leg.position.set(sx * 0.45 * k, 0.15 * k, sz * 0.95 * k);
      g.add(leg);
    }
  }
  // 床頭板：兩根立柱＋三片橫板
  for (const sx of [-1, 1]) g.add(box(0.07 * k, 0.9 * k, 0.07 * k, wood, sx * 0.47 * k, 0.45 * k, -1.0 * k));
  for (const y of [0.45, 0.63, 0.81]) g.add(box(0.9 * k, 0.13 * k, 0.04 * k, woodDark, 0, y * k, -1.0 * k));
  g.add(box(0.07 * k, 0.5 * k, 0.07 * k, wood, -0.47 * k, 0.25 * k, 1.0 * k));
  g.add(box(0.07 * k, 0.5 * k, 0.07 * k, wood, 0.47 * k, 0.25 * k, 1.0 * k));
  g.add(box(0.9 * k, 0.12 * k, 0.04 * k, woodDark, 0, 0.42 * k, 1.0 * k));

  // 床墊：邊角圓一點
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(0.9 * k, 0.16 * k, 1.9 * k, 6, 2, 10), sheet);
  const mp = mattress.geometry.attributes.position;
  for (let i = 0; i < mp.count; i++) {
    const ex = Math.abs(mp.getX(i)) / (0.45 * k);
    const ez = Math.abs(mp.getZ(i)) / (0.95 * k);
    const edge = Math.max(Math.pow(ex, 8), Math.pow(ez, 8));
    if (mp.getY(i) > 0) mp.setY(i, mp.getY(i) - edge * 0.035 * k);
  }
  mattress.geometry.computeVertexNormals();
  mattress.position.set(0, 0.43 * k, 0.01 * k);
  g.add(mattress);

  const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.2 * k, 14, 10), sheet);
  pillow.scale.set(1.35, 0.3, 0.8);
  pillow.position.set(0, 0.55 * k, -0.72 * k);
  g.add(pillow);

  // 毯子：細分後加一點起伏，靠床頭那一側反摺
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.96 * k, 0.045 * k, 1.25 * k, 10, 1, 14), blanket);
  const cp = cover.geometry.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i) / k;
    const z = cp.getZ(i) / k;
    cp.setY(i, cp.getY(i) + (Math.sin(x * 9 + z * 4) * 0.008 + Math.sin(z * 11) * 0.006) * k);
  }
  cover.geometry.computeVertexNormals();
  cover.position.set(0, 0.535 * k, 0.34 * k);
  g.add(cover);
  g.add(box(0.96 * k, 0.03 * k, 0.16 * k, stripe, 0, 0.565 * k, -0.22 * k));
  return g;
}

// ---- 刀：刀尖朝 -Z，單位公釐 ----
function makeKnife() {
  const g = new THREE.Group();
  g.name = 'knife';
  const steel = mat(0xd3d8de, 0.28, 0.35);
  const grip = mat(0x2b2b2e, 0.9);
  const wood = mat(0x5a3a22, 0.75);
  const brass = mat(0xb08d43, 0.45, 0.35);

  // 刀身側面輪廓：刀背直線到 clip point，再由刀腹弧線收回
  const blade = extrudeProfile(
    [[0, 14], [92, 14], [128, 9], [160, -3], [150, -9], [128, -14], [90, -16], [0, -15]],
    3.4,
    1.1,
  );
  // 越靠近刃口越薄
  const bp = blade.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const t = THREE.MathUtils.smoothstep(bp.getY(i), -16, 4);
    bp.setX(i, bp.getX(i) * (0.12 + 0.88 * t));
  }
  blade.computeVertexNormals();
  g.add(new THREE.Mesh(blade, steel));
  for (const sx of [-1, 1]) g.add(box(0.5, 3, 78, mat(0x9aa0a8, 0.4, 0.3), sx * 1.75, 8, -50)); // 血槽

  g.add(new THREE.Mesh(extrudeProfile([[2, 24], [2, -24], [-5, -22], [-7, 0], [-5, 22]], 12, 2.5), brass));
  const handle = extrudeProfile(
    [[-6, 12], [-60, 13.5], [-112, 11], [-120, 0], [-112, -13], [-84, -11], [-56, -14.5], [-26, -11.5], [-6, -13]],
    20,
    5,
  );
  g.add(new THREE.Mesh(handle, wood));
  for (const z of [28, 62, 96]) {
    const rivet = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 21, 8), brass);
    rivet.rotation.z = Math.PI / 2;
    rivet.position.set(0, 0, z);
    g.add(rivet);
  }
  g.add(new THREE.Mesh(extrudeProfile([[-117, 13], [-126, 9], [-126, -11], [-117, -14]], 21, 3), grip));
  return g;
}

// ---- 手槍：槍口朝 -Z，1 單位 = 10 公分 ----
function makeGun() {
  const g = new THREE.Group();
  g.name = 'gun';
  const slideMat = mat(0x2f3136, 0.5, 0.65); // 槍鋼色：會反射天空，底色要夠深才不會整把變藍
  const frameMat = mat(0x1e1f22, 0.7, 0.3);
  const black = mat(0x18191b, 0.6);
  const wood = mat(0x6a4630, 0.7);

  // 滑套：前端下緣倒角
  g.add(new THREE.Mesh(extrudeProfile([[-0.95, 0.04], [0.88, 0.04], [0.97, 0.12], [0.97, 0.34], [-0.95, 0.34]], 0.27, 0.025), slideMat));
  // 槍身＋握把一體成形
  g.add(
    new THREE.Mesh(
      extrudeProfile(
        [[0.9, 0.04], [0.9, -0.1], [0.28, -0.14], [-0.2, -0.14], [-0.44, -1.04], [-0.9, -1.0], [-0.74, -0.24], [-0.99, -0.08], [-0.95, 0.04]],
        0.25,
        0.03,
      ),
      frameMat,
    ),
  );
  // 扳機護弓（中空）與扳機
  g.add(
    new THREE.Mesh(
      extrudeProfile(
        [[0.32, -0.12], [0.32, -0.5], [-0.24, -0.5], [-0.28, -0.12]],
        0.1,
        0.012,
        [[[0.26, -0.15], [-0.2, -0.15], [-0.18, -0.44], [0.26, -0.44]]],
      ),
      frameMat,
    ),
  );
  g.add(new THREE.Mesh(extrudeProfile([[0.0, -0.14], [0.06, -0.14], [0.03, -0.3], [-0.03, -0.36], [-0.06, -0.33]], 0.06, 0.008), black));
  // 握把木片
  for (const sx of [-1, 1]) {
    const panel = new THREE.Mesh(extrudeProfile([[-0.3, -0.26], [-0.48, -0.96], [-0.84, -0.93], [-0.7, -0.26]], 0.03, 0.012), wood);
    panel.position.x = sx * 0.135;
    g.add(panel);
  }
  // 滑套細節：後段防滑紋、拋殼窗、準星照門、擊錘、槍口
  for (let i = 0; i < 7; i++) {
    for (const sx of [-1, 1]) g.add(box(0.012, 0.22, 0.03, black, sx * 0.137, 0.2, 0.52 + i * 0.058));
  }
  g.add(box(0.012, 0.13, 0.34, black, 0.137, 0.25, -0.1));
  g.add(box(0.05, 0.07, 0.07, black, 0, 0.375, -0.88));
  for (const sx of [-1, 1]) g.add(box(0.05, 0.08, 0.07, black, sx * 0.06, 0.375, 0.88));
  g.add(box(0.07, 0.14, 0.1, black, 0, 0.28, 1.0));
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.08, 12), black);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 0.2, -0.99);
  g.add(muzzle);
  g.add(box(0.2, 0.05, 0.42, black, 0, -1.04, 0.66)); // 彈匣底板
  return g;
}

// ---- 手：右手握拳（握把軸為 Y，穿過原點），前臂往右後下方延伸，任意單位 ----
function makeHands() {
  const g = new THREE.Group();
  g.name = 'hands';
  const k = 37;
  const skin = mat(0xd9a57e, 0.75);
  const sleeve = mat(0x3d4a35, 0.95);
  const cuff = mat(0x2f3a29, 0.95);
  const S = (v) => v.map((n) => n * k);

  // 手掌貼在握把右側
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.05 * k, 14, 10), skin);
  palm.scale.set(0.42, 1.0, 0.95);
  palm.position.set(0.04 * k, 0, 0.005 * k);
  g.add(palm);
  g.add(capsuleBetween(S([0.035, 0.012, 0.035]), S([0.03, -0.035, 0.03]), 0.02 * k, skin)); // 掌根

  // 四指由上而下排列，各三節：沿握把右側往前 → 橫過前方 → 從左側繞回
  [0.032, 0.011, -0.01, -0.031].forEach((y, i) => {
    const r = (0.0105 - i * 0.0006) * k;
    const reach = i === 0 ? 0.004 : 0;
    g.add(capsuleBetween(S([0.036, y, -0.004]), S([0.03, y, -0.05 - reach]), r, skin));
    g.add(capsuleBetween(S([0.03, y, -0.05 - reach]), S([-0.02, y - 0.002, -0.058 - reach]), r, skin));
    g.add(capsuleBetween(S([-0.02, y - 0.002, -0.058 - reach]), S([-0.034, y - 0.003, -0.026]), r * 0.95, skin));
  });
  // 拇指壓在握把左上方
  g.add(capsuleBetween(S([0.028, 0.04, 0.03]), S([-0.012, 0.05, 0.012]), 0.0125 * k, skin));
  g.add(capsuleBetween(S([-0.012, 0.05, 0.012]), S([-0.03, 0.048, -0.03]), 0.011 * k, skin));

  // 手腕、袖口、前臂
  const wrist = [0.045, -0.012, 0.06];
  const elbow = [0.11, -0.085, 0.42];
  g.add(capsuleBetween(S([0.04, -0.005, 0.03]), S(wrist), 0.026 * k, skin));
  const mid = wrist.map((w, i) => w + (elbow[i] - w) * 0.14);
  g.add(capsuleBetween(S(wrist), S(mid), 0.036 * k, cuff, 12));
  g.add(capsuleBetween(S(mid), S(elbow), 0.043 * k, sleeve, 12));
  return g;
}

const models = { boat: makeBoat, bed: makeBed, knife: makeKnife, gun: makeGun, hands: makeHands };
const exporter = new GLTFExporter();
for (const [name, make] of Object.entries(models)) {
  const scene = new THREE.Scene();
  scene.add(make());
  const glb = await exporter.parseAsync(scene, { binary: true });
  const file = path.join(outDir, `${name}.glb`);
  fs.writeFileSync(file, Buffer.from(glb));
  console.log(`${name}.glb  ${(glb.byteLength / 1024).toFixed(1)} KB`);
}
